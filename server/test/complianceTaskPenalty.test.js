const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const compliancePath = require.resolve('../utils/complianceLogger');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === compliancePath) {
    return { query() { throw new Error('Database access is not expected in this test.'); } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { calculateComplianceScore, calculateOverdueTasksByScholar, defaults } = require('../utils/complianceLogger');
Module._load = originalLoad;

test('overdue required tasks are counted only for assigned scholars and matching task submissions', () => {
  const counts = calculateOverdueTasksByScholar(
    [
      { scholar_id: 'A-001', year_level: '1st Year College' },
      { scholar_id: 'A-002', year_level: 'Grade 10' },
    ],
    [
      { id: 1, type: 'Monthly Report', due_date: '2026-10-10', created_at: '2026-10-01 08:00:00', target_year_levels: '["College 1"]' },
      { id: 2, type: 'Report Card', due_date: '2026-10-12', created_at: '2026-10-02 08:00:00', target_year_levels: '["Grade 10"]' },
      { id: 3, type: 'COR Upload', due_date: '2026-10-15', created_at: '2026-10-03 08:00:00', target_year_levels: '[]' },
      { id: 4, type: 'Other Documents', due_date: '2026-10-16', created_at: '2026-10-03 08:00:00', target_year_levels: '["College 2"]' },
      { id: 5, type: 'Other Documents', due_date: '2026-10-20', created_at: '2026-10-03 08:00:00', target_year_levels: '["Grade 10"]' },
    ],
    [
      { record_key: 'submission:1', scholar_id: 'A-001', submission_type: 'letter', submitted_at: '2026-10-08 10:00:00' },
      { record_key: 'grade:1', scholar_id: 'A-002', submission_type: 'grades', submitted_at: '2026-10-10 10:00:00' },
    ],
    new Date(2026, 9, 27)
  );

  assert.deepEqual(counts, { 'A-001': 1, 'A-002': 2 });
});

test('each overdue task beyond the existing missed-task grace allowances applies the configured deduction', () => {
  const settings = {
    ...defaults,
    required_hours: 0,
    allowed_missed: 1,
    missed_submission_grace_count: 1,
    late_submission_grace_count: 2,
    missed_submission_deduction: 2,
    service_hour_shortfall_deduction: 0,
    absent_duty_deduction: 0,
    late_submission_deduction: 0,
    quality_drop_deduction: 0,
    extra_service_bonus: 0,
    good_maintenance_bonus: 0,
    recovery_enabled: 0,
  };
  const score = calculateComplianceScore({
    settings,
    overdueTaskCount: 3,
    sub: {
      total_submissions: 1,
      total_service_hours: 0,
      avg_quality: 100,
      last_submission: new Date(2026, 9, 27),
    },
    att: { total_duties: 1, present: 1, absent: 0 },
    today: new Date(2026, 9, 27),
  });

  assert.equal(score.deductions.missedSubmission.overdueTasks, 3);
  assert.equal(score.deductions.missedSubmission.penalizedTasks, 1);
  assert.equal(score.deductions.missedSubmission.points, 2);
  assert.equal(score.overallCompliance, 98);
});

test('overdue assigned tasks still incur penalties when the scholar has no prior compliance history', () => {
  const score = calculateComplianceScore({
    settings: { ...defaults },
    overdueTaskCount: 5,
    sub: null,
    att: null,
    today: new Date(2026, 9, 27),
  });

  assert.equal(score.deductions.missedSubmission.overdueTasks, 5);
  assert.equal(score.deductions.missedSubmission.points, defaults.missed_submission_deduction);
});
