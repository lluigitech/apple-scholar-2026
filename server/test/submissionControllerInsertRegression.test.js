const fs = require('fs');
const path = require('path');
const assert = require('assert');

const controllerContent = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'submissionController.js'),
  'utf8'
);

const match = controllerContent.match(/INSERT INTO submissions \([\s\S]*?\) VALUES \(([^)]*\?[^)]*)\)/m);
assert.ok(match, 'submission insert block should exist in the controller');

const placeholderCount = (match[1].match(/\?/g) || []).length;
assert.strictEqual(placeholderCount, 18, 'submission insert query must provide one placeholder for each insert column');

console.log('submissionController insert placeholder regression test passed');
