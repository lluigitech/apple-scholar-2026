const fs = require('fs');
const path = require('path');
const assert = require('assert');

const submissionUi = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Scholar', 'Submission.jsx'),
  'utf8'
);

assert.ok(submissionUi.includes('70 pts'), 'Report should have 70 points');
assert.ok(submissionUi.includes('20 pts'), 'Media should have 20 points');
assert.ok(submissionUi.includes('10 pts'), 'Information should have 10 points');

assert.ok(!submissionUi.includes('75% weight'), 'Incorrect 75% report weight');
assert.ok(!submissionUi.includes('25% weight'), 'Incorrect 25% media weight');
assert.ok(!submissionUi.includes('30% weight'), 'Incorrect 30% media weight');

console.log('submissionUiWeightRegression test passed');
