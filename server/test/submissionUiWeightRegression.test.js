const fs = require('fs');
const path = require('path');
const assert = require('assert');

const submissionUi = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Scholar', 'Submission.jsx'),
  'utf8'
);

assert.ok(submissionUi.includes('70% weight'), 'Submission UI should describe the report/media split as 70% Report and 30% Media');
assert.ok(submissionUi.includes('30% weight'), 'Submission UI should describe the report/media split as 70% Report and 30% Media');
assert.ok(!submissionUi.includes('75% weight'), 'Submission UI must not describe the report/media split incorrectly as 75%/25%');
assert.ok(!submissionUi.includes('25% weight'), 'Submission UI must not describe the report/media split incorrectly as 75%/25%');

console.log('submissionUiWeightRegression test passed');
