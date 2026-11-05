const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildReportSummaryHTML } = require('../services/reportSummaryTemplate');

test('monthly letter review PDF includes visible report fields without hidden status fields', () => {
  const html = buildReportSummaryHTML({
    logoBase64: '',
    roleLabel: 'officer',
    reportTitle: 'Monthly Letter Review',
    reportType: 'Monthly Letter Review',
    periodLabel: 'September 2026',
    certifiedByName: 'Officer',
    rows: [{
      scholarName: 'Sam Santos',
      studentId: 'AS-2026-000001',
      yearLevel: 'College 4',
      course: 'BS Education',
      school: 'Example University',
      qualityScore: 91,
      sentiment: 'positive',
      submittedAt: '2026-09-28 09:00:00',
    }],
  });

  assert.match(html, /QUALITY SCORE/);
  assert.match(html, /SENTIMENT/);
  assert.match(html, /SUBMITTED AT/);
  assert.match(html, /Sam Santos/);
  assert.match(html, /AS-2026-000001/);
  assert.doesNotMatch(html, /COURSE \/ SCHOOL/);
  assert.doesNotMatch(html, /Example University/);
  assert.doesNotMatch(html, /OFFICER REVIEW/);
  assert.doesNotMatch(html, /QUALITY STATUS/);
});
