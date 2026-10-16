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

const dashboardController = require('../controllers/adminDashboardController');

delete require.cache[dbPath];

const invokeSummary = () => new Promise((resolve) => {
  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      resolve({ statusCode, body });
    },
  };
  dashboardController.getSummary({}, res);
});

const configureQueries = (fixtures, failure) => {
  const captured = [];
  fakeDb.query = (sql, values, callback) => {
    if (typeof values === 'function') {
      callback = values;
      values = [];
    }
    captured.push({ sql, values });

    if (failure && sql.includes(failure.match)) {
      callback(failure.error);
      return;
    }

    const key = Object.keys(fixtures).find((queryFragment) => sql.includes(queryFragment));
    callback(null, fixtures[key] || []);
  };
  return captured;
};

test('dashboard summary returns zero counts for successful empty aggregates', async () => {
  const captured = configureQueries({
    'COUNT(*) AS total,\n      COALESCE(SUM(CASE WHEN role': [{ total: 0, scholars: 0 }],
    'SELECT id, full_name, email, role, created_at': [],
    'DATE_FORMAT(created_at': [],
    'FROM announcements': [{ total: 0, active: 0, withdrawn: 0 }],
    'FROM tasks': [{ total: 0, active: 0, overdue: 0 }],
    'FROM duties': [{ total: 0, cancelled: 0, upcoming: 0, today: 0, past: 0, assigned_groups: 0, assigned_scholar_assignments: 0 }],
    'FROM submissions': [{
      total_records: 0, approved: 0, pending: 0, rejected: 0,
      positive_sentiment: 0, neutral_sentiment: 0, negative_sentiment: 0, unscored_sentiment: 0,
    }],
    'FROM audit_logs': [],
  });

  const response = await invokeSummary();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    users: { total: 0, scholars: 0 },
    recentUsers: [],
    scholarGrowth: [],
    announcements: { total: 0, active: 0, withdrawn: 0 },
    tasks: { total: 0, active: 0, overdue: 0 },
    duties: {
      total: 0, cancelled: 0, upcoming: 0, today: 0, past: 0,
      assignedGroups: 0, assignedScholarAssignments: 0,
    },
    submissions: {
      totalRecords: 0, approved: 0, pending: 0, rejected: 0,
      sentiment: { positive: 0, neutral: 0, negative: 0, unscored: 0 },
    },
    recentActivity: [],
  });
  const activityQuery = captured.find((query) => query.sql.includes('FROM audit_logs'));
  assert.deepEqual(activityQuery.values, [10]);
});

test('dashboard summary preserves actual aggregate counts and distinct assignment counts', async () => {
  const captured = configureQueries({
    'COUNT(*) AS total,\n      COALESCE(SUM(CASE WHEN role': [{ total: '12', scholars: '7' }],
    'SELECT id, full_name, email, role, created_at': [{ id: 4, full_name: 'Recent Admin', role: 'admin' }],
    'DATE_FORMAT(created_at': [{ month: '2026-10', total: '3' }],
    'FROM announcements': [{ total: '7', active: '4', withdrawn: '3' }],
    'FROM tasks': [{ total: '9', active: '6', overdue: '2' }],
    'FROM duties': [{
      total: '6', cancelled: '1', upcoming: '2', today: '1', past: '2',
      assigned_groups: '4', assigned_scholar_assignments: '12',
    }],
    'FROM submissions': [{
      total_records: '15', approved: '8', pending: '4', rejected: '3',
      positive_sentiment: '5', neutral_sentiment: '2', negative_sentiment: '1', unscored_sentiment: '7',
    }],
    'FROM audit_logs': [{ id: 99, action: 'submission_reviewed', module: 'Submissions', result: 'success', actor_name: 'Admin' }],
  });
  const response = await invokeSummary();

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.announcements.active, 4);
  assert.equal(response.body.tasks.overdue, 2);
  assert.equal(response.body.duties.cancelled, 1);
  assert.equal(response.body.duties.assignedScholarAssignments, 12);
  assert.equal(response.body.submissions.sentiment.negative, 1);
  assert.equal(response.body.submissions.sentiment.unscored, 7);
  assert.equal(response.body.users.total, 12);
  assert.equal(response.body.users.scholars, 7);
  assert.deepEqual(response.body.recentUsers, [{ id: 4, full_name: 'Recent Admin', role: 'admin' }]);
  assert.deepEqual(response.body.scholarGrowth, [{ month: '2026-10', total: 3 }]);
  assert.deepEqual(response.body.recentActivity, [
    { id: 99, action: 'submission_reviewed', module: 'Submissions', result: 'success', actor_name: 'Admin' },
  ]);
  const userSummaryQuery = captured.find((query) => query.sql.includes('COUNT(*) AS total,\n      COALESCE(SUM(CASE WHEN role'));
  assert.match(userSummaryQuery.sql, /role = 'scholar' AND COALESCE\(status, ''\) = 'archived'/);
  const recentUsersQuery = captured.find((query) => query.sql.includes('SELECT id, full_name, email, role, created_at'));
  assert.deepEqual(recentUsersQuery.values, [5]);
  const activityQuery = captured.find((query) => query.sql.includes('FROM audit_logs'));
  assert.match(activityQuery.sql, /SELECT al\.id, al\.action, al\.module, al\.details/);
  const dutyQuery = captured.find((query) => query.sql.includes('FROM duties'));
  assert.match(dutyQuery.sql, /SELECT DISTINCT dga\.duty_id, sgm\.scholar_id/);
});

test('dashboard summary returns an error when an aggregate query fails', async () => {
  configureQueries({
    'COUNT(*) AS total,\n      COALESCE(SUM(CASE WHEN role': [{ total: 0, scholars: 0 }],
    'SELECT id, full_name, email, role, created_at': [],
    'DATE_FORMAT(created_at': [],
    'FROM announcements': [{ total: 0, active: 0, withdrawn: 0 }],
    'FROM tasks': [{ total: 0, active: 0, overdue: 0 }],
    'FROM duties': [{ total: 0, cancelled: 0, upcoming: 0, today: 0, past: 0, assigned_groups: 0, assigned_scholar_assignments: 0 }],
    'FROM submissions': [{
      total_records: 0, approved: 0, pending: 0, rejected: 0,
      positive_sentiment: 0, neutral_sentiment: 0, negative_sentiment: 0, unscored_sentiment: 0,
    }],
    'FROM audit_logs': [],
  }, { match: 'FROM tasks', error: new Error('database unavailable') });

  const originalConsoleError = console.error;
  let response;
  console.error = () => {};
  try {
    response = await invokeSummary();
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: 'Failed to load administrator dashboard summary.' });
});

test('dashboard summary route is protected by the admin router guard', () => {
  const routes = require('node:fs').readFileSync(
    path.join(__dirname, '..', 'routes', 'admin', 'adminRoutes.js'),
    'utf8'
  );
  assert.match(routes, /router\.use\(verifyToken, requireRole\(\['admin'\]/);
  assert.match(routes, /router\.get\('\/dashboard-summary', adminDashboard\.getSummary\)/);
});
