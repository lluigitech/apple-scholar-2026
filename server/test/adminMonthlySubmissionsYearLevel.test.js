const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
let capturedQuery;
const fakeDb = {
  query(sql, values, callback) {
    capturedQuery = { sql, values };
    callback(null, []);
  },
};
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const adminController = require('../controllers/adminController');

delete require.cache[dbPath];

test('monthly reports match college_N records when filtering by ordinal year labels', async () => {
  capturedQuery = undefined;
  const response = await new Promise(resolve => {
    adminController.getMonthlySubmissions(
      { query: { month: '2026-09', year_level: '2nd Year College' } },
      {
        status() {
          return this;
        },
        json(body) {
          resolve(body);
        },
      }
    );
  });

  assert.deepEqual(response, []);
  assert.match(capturedQuery.sql, /CASE[\s\S]*u\.year_level[\s\S]*college 2[\s\S]*college_2/);
  assert.deepEqual(capturedQuery.values, [2026, 9, 'college_2']);
});
