const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const assignmentsPath = require.resolve('../utils/officerAssignments');
const fakeDb = { promise: () => ({ query: null }) };
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

test('task progress counts latest approved submissions for assigned active scholars', async () => {
  const taskCreatedAt = new Date('2026-10-01T00:00:00.000Z');
  const fakeResults = [
    [[
      { id: 11, type: 'Monthly Report', created_at: taskCreatedAt, target_year_levels: '["Grade 7"]' },
      { id: 12, type: 'Monthly Report', created_at: taskCreatedAt, target_year_levels: '["Grade 8"]' },
    ]],
    [[
      { scholar_id: 'S1', year_level: 'grade_7' },
      { scholar_id: 'S2', year_level: 'Grade 7' },
      { scholar_id: 'S3', year_level: 'Grade 8' },
    ]],
    [[
      { scholar_id: 'S1', submission_type: 'letter', status: 'approved', submitted_at: new Date('2026-10-05T00:00:00.000Z') },
      { scholar_id: 'S2', submission_type: 'letter', status: 'approved', submitted_at: new Date('2026-09-30T00:00:00.000Z') },
      { scholar_id: 'S2', submission_type: 'letter', status: 'pending', submitted_at: new Date('2026-10-06T00:00:00.000Z') },
      { scholar_id: 'S3', submission_type: 'letter', status: 'approved', submitted_at: new Date('2026-10-05T00:00:00.000Z') },
    ]],
  ];
  fakeDb.promise = () => ({
    query: async () => fakeResults.shift(),
  });

  const response = await new Promise((resolve) => {
    taskController.getTaskProgressSummary({}, {
      status(code) {
        return { json: (body) => resolve({ status: code, body }) };
      },
      json(body) {
        resolve({ status: 200, body });
      },
    });
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, [
    { task_id: 11, total: 2, submitted: 1 },
    { task_id: 12, total: 1, submitted: 1 },
  ]);
});
