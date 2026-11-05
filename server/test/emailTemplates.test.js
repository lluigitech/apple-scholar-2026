const test = require('node:test');
const assert = require('node:assert/strict');
const templates = require('../utils/emailTemplates');

const htmlBuilders = [
  () => templates.buildDutyReminderEmail({ recipientName: '<Scholar>', duty: { title: '<Cleanup>' }, actionUrl: 'https://example.com/scholar/duties' }),
  () => templates.buildDutyAbsenceEmail({
    recipientName: '<Staff>',
    duty: { title: '<Cleanup>', duty_date: '2026-10-25' },
    scholars: [{ full_name: '<Absent>', scholar_id: 'AS-001' }],
  }),
  () => templates.buildMakeupDutyAssignmentEmail({
    recipientName: '<Scholar>',
    scholarName: '<Scholar>',
    scholarId: 'AS-001',
    duty: { title: '<Makeup>', duty_date: '2026-11-01' },
    recipientRole: 'scholar',
  }),
  () => templates.buildComplianceThresholdEmail({
    recipientName: '<Scholar>',
    score: 74,
    minimumScore: 70,
    warningScore: 75,
  }),
  () => templates.buildWelcomeEmail({ fullName: '<Scholar>', loginId: 'AS-001', email: 'scholar@example.com', temporaryPassword: '<temporary>', setupUrl: 'https://example.com/account/setup' }),
  () => templates.buildPasswordResetEmail({ fullName: '<Scholar>', resetUrl: 'https://example.com/forgot-password?token=abc' }),
  () => templates.buildAnnouncementEmail({ title: '<Announcement>', content: '<script>alert(1)</script>', actionUrl: 'https://example.com/announcements' }),
  () => templates.buildDeadlineReminderEmail({ recipientName: '<Scholar>', taskTitle: '<Task>', dueDate: '2026-10-30', daysLeft: 3, actionUrl: 'https://example.com/scholar/submission' }),
  () => templates.buildOverdueEmail({ recipientName: '<Scholar>', scholarName: '<Scholar>', taskTitle: '<Task>', dueDate: '2026-10-20' }),
  () => templates.buildRepeatedRiskEmail({ recipientName: '<Officer>', scholarName: '<Scholar>', negativeCount: 2 }),
  () => templates.buildUnsubmittedTaskSummaryEmail({
    taskTitle: '<Task>',
    taskType: 'Monthly Report',
    dueDate: '2026-10-30',
    scholars: [{ full_name: '<Scholar>', scholar_id: 'AS-001', year_level: 'Grade 10' }],
  }),
  () => templates.buildTaskDeadlineSummaryEmail({
    recipientName: '<Admin>',
    taskTitle: '<Task>',
    taskType: 'Monthly Report',
    dueDate: '2026-10-30',
    submittedScholars: [{ full_name: '<Submitted>', scholar_id: 'AS-001', year_level: 'Grade 10' }],
    unsubmittedScholars: [{ full_name: '<Missing>', scholar_id: 'AS-002', year_level: 'Grade 11' }],
  }),
  () => templates.buildSubmissionReviewEmail({ recipientName: '<Scholar>', submissionTitle: '<Letter>', submissionType: 'Monthly Letter', status: 'returned', comment: '<feedback>' }),
  () => templates.buildTestEmail(),
];

test('all email templates render HTML documents', () => {
  for (const build of htmlBuilders) {
    const html = build();
    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /Apple Scholar/);
    assert.match(html, /<\/html>$/);
  }
});

test('template content is escaped and unsafe action URLs do not create links', () => {
  const html = templates.buildAnnouncementEmail({
    title: '<Announcement>',
    content: '<script>alert("x")</script>',
    actionUrl: 'javascript:alert(1)',
  });

  assert.match(html, /&lt;Announcement&gt;/);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/i);
  assert.doesNotMatch(html, /href="javascript:/i);

  const summaryHtml = templates.buildUnsubmittedTaskSummaryEmail({
    taskTitle: 'Monthly Report',
    taskType: 'Monthly Report',
    dueDate: '2026-10-30',
    scholars: [{ full_name: '<Scholar>', scholar_id: 'AS-001', year_level: 'Grade 10' }],
  });
  assert.match(summaryHtml, /&lt;Scholar&gt;/);
  assert.doesNotMatch(summaryHtml, /<Scholar>/);

  const deadlineHtml = templates.buildTaskDeadlineSummaryEmail({
    recipientName: '<Admin>',
    taskTitle: '<Task>',
    taskType: 'Monthly Report',
    dueDate: '2026-10-30',
  });
  assert.match(deadlineHtml, /Task Deadline Has Passed/);
  assert.match(deadlineHtml, /who submitted and who has not/);
  assert.doesNotMatch(deadlineHtml, /Submitted by the deadline|Not submitted by the deadline/);

  const dutyAbsenceHtml = templates.buildDutyAbsenceEmail({
    recipientName: '<Staff>',
    duty: { title: '<Cleanup>', duty_date: '2026-10-25' },
    scholars: [{ full_name: '<Absent>', scholar_id: 'AS-001' }],
  });
  assert.match(dutyAbsenceHtml, /&lt;Absent&gt;/);
  assert.doesNotMatch(dutyAbsenceHtml, /<Absent>/);

  const makeupHtml = templates.buildMakeupDutyAssignmentEmail({
    recipientName: '<Scholar>',
    scholarName: '<Scholar>',
    scholarId: 'AS-001',
    duty: { title: '<Makeup>', duty_date: '2026-11-01' },
    recipientRole: 'scholar',
  });
  assert.match(makeupHtml, /&lt;Makeup&gt;/);
  assert.doesNotMatch(makeupHtml, /<Makeup>/);

  const complianceHtml = templates.buildComplianceThresholdEmail({
    recipientName: '<Scholar>',
    score: 68,
    minimumScore: 70,
    warningScore: 75,
    belowMinimum: true,
  });
  assert.match(complianceHtml, /Compliance Points Below Minimum/);
  assert.match(complianceHtml, /Current compliance points/);
  assert.match(complianceHtml, /68\.00%/);
  assert.doesNotMatch(complianceHtml, /<Scholar>/);
});
