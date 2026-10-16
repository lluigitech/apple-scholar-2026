const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const fakeDb = { query: null };
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const archiveController = require('../controllers/archiveController');

delete require.cache[dbPath];

const invokeList = (query) => new Promise((resolve) => {
  const req = { query };
  const res = {
    json(body) {
      resolve({ statusCode: 200, body });
    },
    status(statusCode) {
      return { json: body => resolve({ statusCode, body }) };
    },
  };
  archiveController.listDocuments(req, res);
});

const invokeRestore = id => new Promise(resolve => {
  const req = { params: { id } };
  const res = {
    json(body) {
      resolve({ statusCode: 200, body });
    },
    status(statusCode) {
      return { json: body => resolve({ statusCode, body }) };
    },
  };
  archiveController.restoreSubmission(req, res);
});

test('archived documents listing includes archived submission records and preserves filters', async () => {
  const statements = [];
  fakeDb.query = (sql, values, callback) => {
    statements.push({ sql, values });
    if (sql.includes('FROM documents d')) {
      callback(null, [{ id: 4, file_name: 'retained.pdf' }]);
      return;
    }
    callback(null, [{
      id: 'submission-12',
      record_id: 12,
      record_type: 'submission',
      file_name: 'LETTER #12',
      status: 'Archived',
    }]);
  };

  const response = await invokeList({
    archived: 'true',
    search: 'Jovel',
    category: 'letter',
    year: '2026',
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.map(row => row.record_type || 'document'), ['document', 'submission']);
  assert.equal(response.body[1].record_id, 12);
  assert.equal(statements.length, 2);
  assert.ok(statements[1].sql.includes("s.archived_at IS NOT NULL OR s.archive_at IS NOT NULL"));
  assert.ok(statements[1].sql.includes('s.submission_type LIKE ?'));
  assert.ok(statements[1].sql.includes('YEAR(s.submitted_at) = ?'));
  assert.deepEqual(statements[1].values, ['%Jovel%', '%Jovel%', '%Jovel%', '%Jovel%', '%letter%', 2026]);
});

test('restoring an archived submission clears its archive timestamps', async () => {
  let captured;
  fakeDb.query = (sql, values, callback) => {
    captured = { sql, values };
    callback(null, { affectedRows: 1 });
  };

  const response = await invokeRestore('12');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { message: 'Submission record restored.' });
  assert.deepEqual(captured.values, [12]);
  assert.match(captured.sql, /SET archived_at = NULL, archive_at = NULL/);
});

test('restore rejects invalid submission identifiers without querying the database', async () => {
  let queryCalled = false;
  fakeDb.query = () => { queryCalled = true; };

  const response = await invokeRestore('invalid');
  assert.equal(response.statusCode, 400);
  assert.equal(queryCalled, false);
});
