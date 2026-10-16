const fs = require('fs');
const path = require('path');
const assert = require('assert');

const scoringSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'submissionScoring.js'),
  'utf8'
);

assert.ok(
  !scoringSource.includes("if (!normalized || normalized.split(/\\s+/).filter(Boolean).length < 1) {") ||
  !scoringSource.includes('return 0;'),
  'calcReportScore must stop zeroing the report score when the body text is empty and metadata is already present'
);

console.log('submissionScoringBodyGuardRegression test passed');
