const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const fakeDb = {
  query: null,
  promise: () => ({
    query: async () => [[], []],
    getConnection: async () => ({ release() {} }),
  }),
};
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const submissionController = require('../controllers/submissionController');

delete require.cache[dbPath];

const invokeArchive = (submissionIds) => new Promise((resolve) => {
  let statusCode = 200;
  const req = { body: { submissionIds } };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      resolve({ statusCode, body });
    },
  };
  submissionController.archiveSubmissionsBulk(req, res);
});

test('bulk archive validates IDs and updates only active approved submissions', async () => {
  let capturedQuery;
  fakeDb.query = (sql, ids, callback) => {
    capturedQuery = { sql, ids };
    callback(null, { affectedRows: 2 });
  };

  const invalidResponse = await invokeArchive([1, 0]);
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(capturedQuery, undefined);

  const response = await invokeArchive([12, '12', 27]);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    message: 'Submission records archived successfully.',
    archivedCount: 2,
  });
  assert.deepEqual(capturedQuery.ids, [12, 27]);
  assert.match(capturedQuery.sql, /SET archived_at = NOW\(\)/);
  assert.match(capturedQuery.sql, /status = 'approved'/);
  assert.match(capturedQuery.sql, /archived_at IS NULL/);
  assert.match(capturedQuery.sql, /archive_at IS NULL/);
});

test('bulk archive route requires an authenticated administrator', () => {
  const routes = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'submissionRoutes.js'),
    'utf8'
  );
  assert.match(
    routes,
    /router\.post\('\/archive\/bulk', verifyToken, requireRole\(\['admin'\]\), submissionController\.archiveSubmissionsBulk\)/
  );
});

test('archived submissions are omitted from active monthly reports', () => {
  const adminController = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'adminController.js'),
    'utf8'
  );
  assert.match(adminController, /COALESCE\(s\.archived_at, s\.archive_at\) IS NULL/);
});

test('all announcement requests include the administrator Bearer token', () => {
  const announcementPage = fs.readFileSync(
    path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Admin', 'AdminAnnouncement.jsx'),
    'utf8'
  );
  assert.match(announcementPage, /Authorization: `Bearer \$\{localStorage\.getItem\('token'\)\}`/);
  assert.match(announcementPage, /axios\.get\(`\$\{API\}\/admin\/announcements`, authHeaders\(\)\)/);
  assert.match(announcementPage, /axios\.post\(`\$\{API\}\/admin\/announcements`, \{[\s\S]*?\}, authHeaders\(\)\)/);
  assert.match(announcementPage, /axios\.post\(`\$\{API\}\/admin\/announcements\/\$\{id\}\/notify`, \{\}, authHeaders\(\)\)/);
  assert.match(announcementPage, /axios\.delete\(`\$\{API\}\/admin\/announcements\/\$\{selectedAnn\.id\}`, authHeaders\(\)\)/);
  assert.match(announcementPage, /axios\.put\(`\$\{API\}\/admin\/announcements\/\$\{id\}\/toggle`, \{\}, authHeaders\(\)\)/);
});
