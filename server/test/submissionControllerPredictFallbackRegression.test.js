const fs = require('fs');
const path = require('path');
const assert = require('assert');

const controllerContent = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'submissionController.js'),
  'utf8'
);

const lateModelBranch = controllerContent.match(/const result = await predictLetterScore\(rawLetter\);[\s\S]*?return res\.status\(200\)\.json\(\{[\s\S]*?score: Number\(result\.score\),[\s\S]*?fallback: false,\s*\}\);/m);
assert.ok(lateModelBranch, 'local model success branch should serialize a numeric score with fallback: false');

console.log('submissionController predict fallback regression test passed');
