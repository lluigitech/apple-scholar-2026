const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const fakeDb = {
  query: null,
  promise: () => ({ query: async () => [[], []] }),
};
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const officerController = require('../controllers/officerController');

delete require.cache[dbPath];

const invoke = (handler, request) => new Promise(resolve => {
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
  const result = handler(request, res);
  if (result && typeof result.catch === 'function') result.catch(resolve);
});

test('monthly letter list returns review and AI data within the officer assignment and month', async () => {
  const queries = [];
  fakeDb.query = (sql, values, callback) => {
    queries.push({ sql, values });
    if (sql.includes('FROM officer_year_level_assignments')) {
      callback(null, [{ year_level: 'Grade 12' }]);
      return;
    }
    callback(null, [{
      id: 27,
      scholar_id: 'S-27',
      submission_type: 'letter',
      letter_content: 'Monthly letter text',
      quality_score: '82.5',
      quality_status: 'accepted',
      quality_label: 'accepted',
      content_score: 57,
      content_breakdown: '{"paragraph":6}',
      sentiment_score: 0.4,
      sentiment_label: 'positive',
      review_status: 'pending',
      staff_comment: null,
      submitted_at: '2026-04-12 10:00:00',
      reviewed_at: null,
      approved_at: null,
      returned_at: null,
      finalized_at: null,
      export_available_at: null,
      full_name: 'Test Scholar',
      year_level: 'grade_12',
      media_raw: 'https://example.test/photo.jpg||Activity',
    }]);
  };

  const response = await invoke(officerController.getMonthlySubmissions, {
    user: { id: 8, role: 'officer' },
    query: { month: '2026-04' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].review_status, 'pending');
  assert.equal(response.body[0].quality_status, 'accepted');
  assert.equal(response.body[0].content_breakdown, '{"paragraph":6}');
  assert.equal(response.body[0].staffAction, null);
  assert.equal(response.body[0].photos[0].description, 'Activity');

  const listQuery = queries.find(({ sql }) => sql.includes('FROM submissions s'));
  assert.match(listQuery.sql, /DATE_FORMAT\(s\.submitted_at, '%Y-%m'\) = \?/);
  assert.match(listQuery.sql, /COALESCE\(s\.archived_at, s\.archive_at\) IS NULL/);
  assert.match(listQuery.sql, /u\.year_level[\s\S]* IN \(\?\)/);
  assert.ok(queries.some(({ sql }) => sql.includes('officer_year_level_assignments')));
  assert.doesNotMatch(listQuery.sql, /s\.finalized_at IS NOT NULL|s\.status = 'approved'/);
  assert.deepEqual(listQuery.values, ['grade_12', '2026-04']);
});

test('monthly letter list rejects invalid periods before querying', async () => {
  let queryCount = 0;
  fakeDb.query = () => { queryCount += 1; };

  const response = await invoke(officerController.getMonthlySubmissions, {
    user: { id: 8, role: 'officer' },
    query: { month: '2026-13' },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /YYYY-MM/);
  assert.equal(queryCount, 0);
});

test('officer return action requires a reason and does not update without one', async () => {
  let queryCount = 0;
  fakeDb.query = () => { queryCount += 1; };

  const response = await invoke(officerController.reviewMonthlySubmission, {
    params: { id: '27' },
    user: { id: 8, role: 'officer' },
    body: { action: 'return', comment: '   ' },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /reason is required/i);
  assert.equal(queryCount, 0);
});

test('canonical approve action uses the shared submission lifecycle', async () => {
  const queries = [];
  fakeDb.query = (sql, values, callback) => {
    queries.push({ sql, values });
    if (sql.startsWith('UPDATE submissions s')) {
      callback(null, { affectedRows: 1 });
    } else if (sql.includes('FROM privacy_settings')) {
      callback(null, [{ role_based_access: 1, document_protection: 1, access_logging: 0, privacy_monitoring: 0 }]);
    } else {
      callback(null, []);
    }
  };

  const response = await invoke(officerController.reviewMonthlySubmission, {
    params: { id: '27' },
    user: { id: 8, role: 'officer' },
    body: { action: 'approve', comment: 'Reviewed and complete.' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { message: 'Submission reviewed successfully', id: '27', review_status: 'approved' });
  const update = queries.find(({ sql }) => sql.startsWith('UPDATE submissions s'));
  assert.equal(update.values[0], 'approved');
  assert.equal(update.values[1], 'Reviewed and complete.');
  assert.match(update.sql, /s\.finalized_at IS NULL AND s\.status IN \('pending', 'under_review'\)/);
});

test('valid return action persists the returned status and trimmed reason', async () => {
  const queries = [];
  fakeDb.query = (sql, values, callback) => {
    queries.push({ sql, values });
    if (sql.startsWith('UPDATE submissions s')) {
      callback(null, { affectedRows: 1 });
    } else if (sql.includes('FROM privacy_settings')) {
      callback(null, [{ role_based_access: 1, document_protection: 1, access_logging: 0, privacy_monitoring: 0 }]);
    } else {
      callback(null, []);
    }
  };

  const response = await invoke(officerController.reviewMonthlySubmission, {
    params: { id: '27' },
    user: { id: 8, role: 'officer' },
    body: { action: 'return', comment: '  Please complete the academic section.  ' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.review_status, 'returned');
  const update = queries.find(({ sql }) => sql.startsWith('UPDATE submissions s'));
  assert.equal(update.values[0], 'returned');
  assert.equal(update.values[1], 'Please complete the academic section.');
});

test('officer cannot update a letter outside the assigned year levels', async () => {
  const queries = [];
  fakeDb.query = (sql, values, callback) => {
    queries.push({ sql, values });
    if (sql.startsWith('UPDATE submissions')) {
      callback(null, { affectedRows: 0 });
    } else if (sql.includes('FROM privacy_settings')) {
      callback(null, [{ role_based_access: 1, document_protection: 1, access_logging: 0, privacy_monitoring: 0 }]);
    } else if (sql.includes('SELECT s.submission_type, s.status, s.finalized_at')) {
      callback(null, [{ submission_type: 'letter', status: 'pending', finalized_at: null, assigned: 0 }]);
    } else {
      callback(null, []);
    }
  };

  const response = await invoke(officerController.reviewMonthlySubmission, {
    params: { id: '27' },
    user: { id: 8, role: 'officer' },
    body: { action: 'approve' },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.body.error, /outside your assigned year levels/i);
  const update = queries.find(({ sql }) => sql.startsWith('UPDATE submissions'));
  assert.match(update.sql, /s\.finalized_at IS NULL AND s\.status IN \('pending', 'under_review'\)/);
  assert.match(update.sql, /officer_year_level_assignments/);
});

test('unknown submission IDs return 404 instead of a success-shaped response', async () => {
  fakeDb.query = (sql, values, callback) => {
    if (sql.startsWith('UPDATE submissions s')) {
      callback(null, { affectedRows: 0 });
    } else if (sql.includes('FROM privacy_settings')) {
      callback(null, [{ role_based_access: 1, document_protection: 1, access_logging: 0, privacy_monitoring: 0 }]);
    } else if (sql.includes('SELECT s.submission_type, s.status, s.finalized_at')) {
      callback(null, []);
    } else {
      callback(null, []);
    }
  };

  const response = await invoke(officerController.reviewMonthlySubmission, {
    params: { id: '9999' },
    user: { id: 8, role: 'officer' },
    body: { action: 'approve' },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: 'Submission not found.' });
});

test('database errors return a generic error without leaking SQL details', async () => {
  fakeDb.query = (sql, values, callback) => {
    if (sql.includes('FROM officer_year_level_assignments')) {
      callback(null, [{ year_level: 'Grade 12' }]);
      return;
    }
    callback(Object.assign(new Error('private SQL detail'), { code: 'ER_BAD_FIELD_ERROR', sqlMessage: 'private SQL detail' }));
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  let response;
  try {
    response = await invoke(officerController.getMonthlySubmissions, {
      user: { id: 8, role: 'officer' },
      query: { month: '2026-04' },
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: 'Error fetching monthly letter submissions.' });
  assert.doesNotMatch(JSON.stringify(response.body), /private SQL detail|ER_BAD_FIELD_ERROR/);
});

test('legacy letter routes remain registered and use the shared review controller', () => {
  const submissionRoutes = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'submissionRoutes.js'),
    'utf8'
  );
  const officerRoutes = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'officer', 'officerRoutes.js'),
    'utf8'
  );
  const officerSource = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'officerController.js'),
    'utf8'
  );

  assert.match(submissionRoutes, /router\.get\('\/letters'[\s\S]*?submissionController\.getLetters/);
  assert.match(submissionRoutes, /router\.put\('\/review\/:id'[\s\S]*?submissionController\.reviewSubmission/);
  assert.match(officerRoutes, /router\.get\('\/reports\/monthly-submissions'[\s\S]*?officerController\.getMonthlySubmissions/);
  assert.match(officerSource, /return submissionController\.reviewSubmission\(req, res\)/);
});
