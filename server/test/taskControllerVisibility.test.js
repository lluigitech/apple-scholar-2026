const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const assignmentsPath = require.resolve('../utils/officerAssignments');
const fakeDb = { query: null };
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const fakeAssignmentsModule = new Module(assignmentsPath, module);
fakeAssignmentsModule.filename = assignmentsPath;
fakeAssignmentsModule.loaded = true;
fakeAssignmentsModule.exports = {
  getAssignedYearLevels: async () => [],
  getAllAssignedYearLevels: async () => [],
};
require.cache[assignmentsPath] = fakeAssignmentsModule;

const taskController = require('../controllers/taskController');

delete require.cache[dbPath];
delete require.cache[assignmentsPath];

const fetchTasks = (scholarYearLevel) => new Promise((resolve, reject) => {
  const task = {
    id: 12,
    title: 'Submit monthly report',
    type: 'Monthly Report',
    target_year_levels: JSON.stringify(['Grade 7']),
    is_active: 1,
  };
  fakeDb.query = (sql, values, callback) => {
    if (typeof values === 'function') callback = values;
    if (sql.includes('SELECT t.id')) return callback(null, [task]);
    if (sql.includes('officer_year_level_assignments')) return callback(null, []);
    if (sql.includes('SELECT year_level FROM users')) return callback(null, [{ year_level: scholarYearLevel }]);
    reject(new Error(`Unexpected query: ${sql}`));
  };

  taskController.getAllTasks(
    { user: { id: 7, role: 'scholar' } },
    {
      status(code) {
        return {
          json(body) {
            resolve({ status: code, body });
          },
        };
      },
      json(body) {
        resolve({ status: 200, body });
      },
    }
  );
});

test('scholar task visibility matches equivalent year-level formats', async () => {
  const response = await fetchTasks('grade_7');

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].id, 12);
});

test('scholar task visibility still excludes tasks for a different year level', async () => {
  const response = await fetchTasks('Grade 8');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});
