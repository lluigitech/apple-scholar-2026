const fs = require('fs');
const path = require('path');
const assert = require('assert');

const officerController = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'officerController.js'),
  'utf8'
);
const submissionSummaryHandler = officerController.slice(
  officerController.indexOf('exports.getScholarSubmissionSummary ='),
  officerController.indexOf('\n    function buildRows', officerController.indexOf('exports.getScholarSubmissionSummary ='))
);

assert.ok(
  submissionSummaryHandler.includes('DATE(submitted_at) BETWEEN ? AND ?') &&
    submissionSummaryHandler.includes('DATE(created_at) BETWEEN ? AND ?'),
  'submission summaries should filter submissions and grades by their actual submission timestamps'
);

assert.ok(
  submissionSummaryHandler.includes('FROM submissions WHERE scholar_id IN (${placeholders})') &&
    submissionSummaryHandler.includes('FROM grades WHERE scholar_id IN (${placeholders})') &&
    !submissionSummaryHandler.includes("AND finalized_at IS NOT NULL AND status = 'approved'") &&
    !submissionSummaryHandler.includes("AND finalized_at IS NOT NULL AND verification_status = 'approved'"),
  'submission summaries should count submitted records before manual approval, not only finalized approvals'
);

assert.ok(
  submissionSummaryHandler.includes('applyOfficerYearLevelFilter(req, scholarConditions, scholarValues)') &&
    submissionSummaryHandler.includes("scholar_group !== 'All Scholars'"),
  'submission summaries should remain limited to the officer assigned year levels and selected group'
);

console.log('officerReportSubmissionMonthRegression test passed');
