const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const queries = [];
const connection = {
  beginTransaction: async () => {},
  query: async (sql, values) => {
    queries.push({ sql, values });
    return [{ affectedRows: queries.length === 1 ? 2 : 1 }, []];
  },
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
};
const fakeDb = {
  promise: () => ({
    getConnection: async () => connection,
    query: async (sql, values) => {
      queries.push({ sql, values });
      return [[], []];
    },
  }),
};
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const { finalizeApprovedSubmissions } = require('../services/approvedSubmissionFinalizationService');
const { getDonorReport } = require('../services/reportQueryService.js.js');

delete require.cache[dbPath];

test('approved submissions and grades are finalized only after three days', async () => {
  queries.length = 0;
  const result = await finalizeApprovedSubmissions();

  assert.deepEqual(result, { submissions_finalized: 2, grades_finalized: 1 });
  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /COALESCE\(approved_at, reviewed_at, submitted_at\) <= DATE_SUB\(NOW\(\), INTERVAL 3 DAY\)/);
  assert.match(queries[0].sql, /finalized_at IS NULL/);
  assert.match(queries[1].sql, /COALESCE\(approved_at, created_at\) <= DATE_SUB\(NOW\(\), INTERVAL 3 DAY\)/);
  assert.match(queries[1].sql, /finalized_at IS NULL/);
});

test('donor reports exclude approved submissions until they are finalized', async () => {
  queries.length = 0;
  await getDonorReport({});

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /finalized_at IS NOT NULL/);
});
