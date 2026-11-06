const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const privacyPath = require.resolve('../middleware/privacyAccess');
const dbModule = new Module(dbPath, module);
const privacyModule = new Module(privacyPath, module);
const fakeDb = {
  query: (sql, values, callback) => {
    if (sql.includes('FROM officer_year_level_assignments')) {
      callback(null, assignedLevels.map(year_level => ({ year_level })));
      return;
    }
    callback(new Error(`Unexpected query: ${sql}`));
  },
  promise: () => ({
    query: async (sql, values = []) => {
      queryLog.push({ sql, values });
      if (sql.includes('SELECT u.scholar_id')) {
        const assignedLevelKeys = assignedLevels.map(level => String(level).toLowerCase().replace(/[_\s-]+/g, ''));
        const filteredScholars = sql.includes('IN (?)') && assignedLevelKeys.length
          ? scholars.filter(scholar => assignedLevelKeys.includes(String(scholar.year_level).toLowerCase().replace(/[_\s-]+/g, '')))
          : scholars;
        return [filteredScholars, []];
      }
      if (sql.includes('FROM tasks t')) {
        let filteredTasks = sql.includes("DATE_FORMAT(t.due_date, '%Y-%m') = ?")
          ? tasks.filter(task => String(task.due_date || '').slice(0, 7) === values[values.length - 1])
          : tasks;
        if (sql.includes('t.due_date <= CURDATE()')) {
          const today = new Date().toISOString().slice(0, 10);
          filteredTasks = filteredTasks.filter(task => String(task.due_date || '').slice(0, 10) <= today);
        }
        return [filteredTasks, []];
      }
      if (sql.includes('FROM tasks')) {
        const today = new Date().toISOString().slice(0, 10);
        const limit = new Date(`${today}T00:00:00`);
        limit.setDate(limit.getDate() + 3);
        const end = limit.toISOString().slice(0, 10);
        return [tasks.filter(task => String(task.due_date || '').slice(0, 10) >= today
          && String(task.due_date || '').slice(0, 10) <= end), []];
      }
      if (sql.includes('FROM submissions')) {
        return [submissions.filter(row => row.status !== 'approved' || row.finalized_at), []];
      }
      if (sql.includes('FROM grades')) {
        return [grades.filter(row => row.verification_status !== 'approved' || row.finalized_at), []];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  }),
};
let scholars = [];
let tasks = [];
let submissions = [];
let grades = [];
let assignedLevels = [];
const queryLog = [];

dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = fakeDb;
privacyModule.filename = privacyPath;
privacyModule.loaded = true;
privacyModule.exports = {
  canAccessScholar: async () => true,
  getSettings: async () => ({}),
  logPrivacyAccess: async () => {},
};
require.cache[dbPath] = dbModule;
require.cache[privacyPath] = privacyModule;

const officerController = require('../controllers/officerController');

delete require.cache[dbPath];
delete require.cache[privacyPath];

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

test('submission records accept and apply a reporting date range', async () => {
  const today = new Date();
  const dateTo = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const dateFromValue = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const dateFrom = `${dateFromValue.getFullYear()}-${String(dateFromValue.getMonth() + 1).padStart(2, '0')}-${String(dateFromValue.getDate()).padStart(2, '0')}`;
  scholars = [{ scholar_id: 'S-1', full_name: 'Range Scholar', year_level: 'grade_12' }];
  assignedLevels = ['grade_12'];
  tasks = [];
  submissions = [];
  grades = [];
  queryLog.length = 0;

  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 8, role: 'officer' },
    query: { document_type: 'all', date_from: dateFrom, date_to: dateTo },
  });

  assert.equal(response.statusCode, 200);
  assert.ok(queryLog.some(({ sql, values }) => sql.includes('DATE(s.submitted_at) >= ?')
    && values.includes(dateFrom) && values.includes(dateTo)));
  assert.ok(queryLog.some(({ sql, values }) => sql.includes('DATE(g.created_at) >= ?')
    && values.includes(dateFrom) && values.includes(dateTo)));
  assert.ok(queryLog.some(({ sql, values }) => sql.includes('DATE(t.due_date) >= ?')
    && values.includes(dateFrom) && values.includes(dateTo)));
});

test('submission records reject invalid reporting date ranges', async () => {
  queryLog.length = 0;
  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 8, role: 'officer' },
    query: { date_from: '2026-02-30', date_to: '2026-03-01' },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /Date filters must use YYYY-MM-DD/);
  assert.equal(queryLog.length, 0);
});

const currentMonth = new Date().toISOString().slice(0, 7);
const currentMonthFirstDay = `${currentMonth}-01`;

test('shows submitted records and creates a typed missing row after the requirement is due', async () => {
  scholars = [
    { scholar_id: 'S-1', full_name: 'Submitted Scholar', year_level: 'grade_12' },
    { scholar_id: 'S-2', full_name: 'Pending Scholar', year_level: 'grade_12' },
    { scholar_id: 'S-3', full_name: 'Missing Scholar', year_level: 'grade_12' },
  ];
  tasks = [{
    id: 31,
    type: 'Monthly Report',
    due_date: currentMonthFirstDay,
    created_at: `${currentMonthFirstDay} 08:00:00`,
    target_year_levels: '["grade_12"]',
  }, {
    id: 32,
    type: 'COR Upload',
    due_date: currentMonthFirstDay,
    created_at: `${currentMonthFirstDay} 08:00:00`,
    target_year_levels: '["grade_11"]',
  }];
  submissions = [
    {
      id: 17,
      scholar_id: 'S-1',
      scholar_name: 'Submitted Scholar',
      submission_type: 'letter',
      submitted_at: `${currentMonthFirstDay} 09:00:00`,
      status: 'approved',
      finalized_at: '2026-10-28 09:00:00',
      generated_pdf_path: 'https://example.test/letter.pdf',
    },
    {
      id: 18,
      scholar_id: 'S-2',
      scholar_name: 'Pending Scholar',
      submission_type: 'letter',
      submitted_at: `${currentMonthFirstDay} 09:00:00`,
      status: 'pending',
    },
  ];
  grades = [];

  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 4, role: 'admin' },
    query: { document_type: 'letter', month: currentMonth },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.records.length, 3);
  const submitted = response.body.records.find(record => record.scholarId === 'S-1');
  assert.equal(submitted.scholarId, 'S-1');
  assert.equal(submitted.status, 'approved');
  const pending = response.body.records.find(record => record.scholarId === 'S-2');
  assert.equal(pending.status, 'pending');
  const missing = response.body.records.find(record => record.isMissing);
  assert.equal(missing.scholarId, 'S-3');
  assert.equal(missing.requirement, 'Monthly Letter');
  assert.equal(missing.period, currentMonth);
  assert.equal(missing.status, 'not-submitted');
  assert.equal(missing.filePath, null);
});

test('includes pending submissions for a requirement due in September even if its task was created in August', async () => {
  scholars = [{ scholar_id: 'S-1', full_name: 'September Scholar', year_level: 'grade_12' }];
  tasks = [{
    id: 35,
    type: 'Monthly Report',
    due_date: '2026-09-30',
    created_at: '2026-08-20 08:00:00',
    target_year_levels: '["grade_12"]',
  }];
  submissions = [{
    id: 19,
    scholar_id: 'S-1',
    scholar_name: 'September Scholar',
    submission_type: 'letter',
    submitted_at: '2026-09-15 09:00:00',
    status: 'pending',
  }];
  grades = [];

  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 4, role: 'admin' },
    query: { document_type: 'all', month: '2026-09' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.records.length, 1);
  assert.equal(response.body.records[0].scholarId, 'S-1');
  assert.equal(response.body.records[0].period, '2026-09');
  assert.equal(response.body.records[0].status, 'pending');
  assert.equal(response.body.records[0].isMissing, undefined);
});

test('all types use due task requirements rather than a generic Any Submission row', async () => {
  scholars = [
    { scholar_id: 'S-1', full_name: 'Submitted Scholar', year_level: 'college_1' },
    { scholar_id: 'S-2', full_name: 'Missing Scholar', year_level: 'college_1' },
  ];
  tasks = [
    { id: 41, type: 'COR Upload', due_date: currentMonthFirstDay, created_at: `${currentMonthFirstDay} 08:00:00`, target_year_levels: '["college_1"]' },
    { id: 42, type: 'Report Card', due_date: currentMonthFirstDay, created_at: `${currentMonthFirstDay} 08:00:00`, target_year_levels: '["college_1"]' },
    { id: 43, type: 'Monthly Report', due_date: currentMonthFirstDay, created_at: `${currentMonthFirstDay} 08:00:00`, target_year_levels: '["college_1"]' },
  ];
  submissions = [{
    id: 21,
    scholar_id: 'S-1',
    scholar_name: 'Submitted Scholar',
    submission_type: 'cor',
    submitted_at: `${currentMonthFirstDay} 09:00:00`,
    status: 'approved',
    finalized_at: '2026-10-28 09:00:00',
    cor_path: 'https://example.test/cor.pdf',
  }];
  grades = [];

  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 4, role: 'admin' },
    query: { document_type: 'all', month: currentMonth },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.records.length, 6);
  const missing = response.body.records.filter(record => record.isMissing);
  assert.deepEqual(
    missing.map(record => `${record.scholarId}:${record.requirement}`).sort(),
    ['S-1:Grades', 'S-1:Monthly Letter', 'S-2:COR', 'S-2:Grades', 'S-2:Monthly Letter']
  );
  assert.ok(response.body.records.every(record => record.requirement !== 'Any Submission'));
});

test('does not show missing requirements when no matching task has become due', async () => {
  scholars = [{ scholar_id: 'S-1', full_name: 'Scholar', year_level: 'college_1' }];
  tasks = [];
  submissions = [];
  grades = [];

  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 4, role: 'admin' },
    query: { document_type: 'all', month: currentMonth },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.records, []);
});

test('does not show missing rows for requirements due outside the selected report month', async () => {
  scholars = [{ scholar_id: 'S-1', full_name: 'Scholar', year_level: 'college_1' }];
  const previousMonth = new Date(`${currentMonth}-01T00:00:00`);
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const previousMonthDate = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}-15`;
  tasks = [{
    id: 51,
    type: 'Monthly Report',
    due_date: currentMonthFirstDay,
    created_at: `${previousMonthDate} 08:00:00`,
    target_year_levels: '["college_1"]',
  }];
  submissions = [];
  grades = [];

  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 4, role: 'admin' },
    query: { document_type: 'all', month: previousMonth.toISOString().slice(0, 7) },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.records, []);
});

test('adds a missing row for a task due in September even if created in August', async () => {
  const previousMonthDate = new Date(`${currentMonth}-01T00:00:00`);
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;
  scholars = [
    { scholar_id: 'S-1', full_name: 'Submitted Scholar', year_level: 'college_4' },
    { scholar_id: 'S-2', full_name: 'Missing Scholar', year_level: 'college_4' },
  ];
  tasks = [{
    id: 52,
    type: 'Monthly Report',
    due_date: `${previousMonth}-30`,
    created_at: `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}-05 08:00:00`,
    target_year_levels: '["college_4"]',
  }];
  submissions = [{
    id: 63,
    scholar_id: 'S-1',
    scholar_name: 'Submitted Scholar',
    submission_type: 'letter',
    submitted_at: `${previousMonth}-20 09:00:00`,
    status: 'approved',
    finalized_at: '2026-10-28 09:00:00',
  }];
  grades = [];

  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 4, role: 'admin' },
    query: { document_type: 'all', month: previousMonth },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.records.length, 2);
  const missing = response.body.records.find(record => record.isMissing);
  assert.equal(missing.scholarId, 'S-2');
  assert.equal(missing.requirement, 'Monthly Letter');
  assert.equal(missing.period, previousMonth);
  assert.equal(missing.status, 'not-submitted');
});

test('shows finalized approved submissions even when no task exists for the selected month', async () => {
  scholars = [{ scholar_id: 'S-1', full_name: 'Scholar', year_level: 'college_1' }];
  tasks = [];
  submissions = [{
    id: 61,
    scholar_id: 'S-1',
    scholar_name: 'Scholar',
    submission_type: 'letter',
    submitted_at: `${currentMonthFirstDay} 09:00:00`,
    status: 'approved',
    finalized_at: '2026-10-28 09:00:00',
  }];
  grades = [];

  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 4, role: 'admin' },
    query: { document_type: 'all', month: currentMonth },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.records.length, 1);
  assert.equal(response.body.records[0].scholarId, 'S-1');
  assert.equal(response.body.records[0].requirement, 'Monthly Letter');
  assert.equal(response.body.records[0].period, currentMonth);
  assert.equal(response.body.records[0].status, 'approved');
});

test('keeps submitted records but does not invent missing requirements when no task exists', async () => {
  scholars = [
    { scholar_id: 'S-1', full_name: 'Submitted Scholar', year_level: 'college_4' },
    { scholar_id: 'S-2', full_name: 'Missing Scholar', year_level: 'college_4' },
    { scholar_id: 'S-3', full_name: 'Unassigned Scholar', year_level: 'college_3' },
  ];
  assignedLevels = ['college_4'];
  tasks = [];
  submissions = [{
    id: 62,
    scholar_id: 'S-1',
    scholar_name: 'Submitted Scholar',
    year_level: 'college_4',
    submission_type: 'letter',
    submitted_at: '2026-09-28 09:00:00',
    status: 'approved',
    finalized_at: '2026-09-30 09:00:00',
  }];
  grades = [];

  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 4, role: 'officer' },
    query: { document_type: 'letter', month: '2026-09' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.records.length, 1);
  assert.equal(response.body.records[0].scholarId, 'S-1');
  assert.equal(response.body.records[0].status, 'approved');
  assert.equal(response.body.records.some(record => record.isMissing), false);
});

test('keeps approved submissions out of Reports until finalized', async () => {
  scholars = [{ scholar_id: 'S-1', full_name: 'Scholar', year_level: 'college_1' }];
  assignedLevels = [];
  tasks = [];
  submissions = [{
    id: 64,
    scholar_id: 'S-1',
    scholar_name: 'Scholar',
    submission_type: 'letter',
    submitted_at: `${currentMonthFirstDay} 09:00:00`,
    status: 'approved',
    finalized_at: null,
  }];
  grades = [];

  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 4, role: 'admin' },
    query: { document_type: 'letter', month: currentMonth },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.records.length, 0);
});

test('does not show task records before the task due date', async () => {
  scholars = [{ scholar_id: 'S-1', full_name: 'Scholar', year_level: 'college_1' }];
  const future = new Date();
  future.setDate(future.getDate() + 5);
  const futureDate = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
  tasks = [{
    id: 71,
    type: 'Monthly Report',
    due_date: futureDate,
    created_at: `${currentMonthFirstDay} 08:00:00`,
    target_year_levels: '["college_1"]',
  }];
  submissions = [];
  grades = [];

  const response = await invoke(officerController.getSubmissionRecords, {
    user: { id: 4, role: 'admin' },
    query: { document_type: 'all', month: currentMonth },
  });

  test('compliance due reminders only include assigned scholars without a valid submission', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 2);
    const dateOnly = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    const due = dateOnly(dueDate);
    const createdAt = `${dateOnly(today)} 08:00:00`;
    assignedLevels = ['grade_12'];
    scholars = [
      { scholar_id: 'S-1', full_name: 'Needs Submission', year_level: 'grade_12' },
      { scholar_id: 'S-2', full_name: 'Pending Review', year_level: 'grade_12' },
      { scholar_id: 'S-3', full_name: 'Returned Submission', year_level: 'grade_12' },
      { scholar_id: 'S-4', full_name: 'Other Year', year_level: 'grade_11' },
    ];
    tasks = [{
      id: 301,
      title: 'Monthly Report',
      type: 'Monthly Report',
      due_date: due,
      created_at: createdAt,
      target_year_levels: '["grade_12"]',
      days_remaining: 2,
    }];
    submissions = [
      { scholar_id: 'S-2', submission_type: 'letter', status: 'pending', submitted_at: `${dateOnly(today)} 09:00:00` },
      { scholar_id: 'S-3', submission_type: 'letter', status: 'returned', submitted_at: `${dateOnly(today)} 10:00:00` },
    ];
    grades = [];

    const response = await invoke(officerController.getComplianceDueReminders, {
      user: { id: 8, role: 'officer' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].id, 301);
    assert.equal(response.body[0].days_remaining, 2);
    assert.deepEqual(response.body[0].scholars, [
      { scholar_id: 'S-1', full_name: 'Needs Submission' },
      { scholar_id: 'S-3', full_name: 'Returned Submission' },
    ]);
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.records, []);
});
