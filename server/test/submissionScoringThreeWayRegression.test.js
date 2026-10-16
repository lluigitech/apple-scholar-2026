const fs = require('fs');
const path = require('path');
const assert = require('assert');

const scoringSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'submissionScoring.js'),
  'utf8'
);

assert.ok(scoringSource.includes('const LETTER_BODY_MAX = 70;'), 'letter-body max should be 70');
assert.ok(scoringSource.includes('const DOCUMENTATION_MAX = 20;'), 'documentation max should be 20');
assert.ok(scoringSource.includes('const INFO_MAX = 10;'), 'info max should be 10');
assert.ok(scoringSource.includes('score += asText(info.name).length > 2 ? 3 : 0;'), 'name contribution should be 3');
assert.ok(scoringSource.includes('score += asText(info.age).length > 0 ? 1 : 0;'), 'age contribution should be 1');
assert.ok(scoringSource.includes('score += asText(info.year).length > 0 ? 1.5 : 0;'), 'year level contribution should be 1.5');
assert.ok(scoringSource.includes('score += asText(info.course).length > 2 ? 2 : 0;'), 'course contribution should be 2');
assert.ok(scoringSource.includes('score += asText(info.school).length > 2 ? 2 : 0;'), 'school contribution should be 2');
assert.ok(scoringSource.includes('score += asText(info.date).length > 0 ? 0.5 : 0;'), 'date contribution should be 0.5');
assert.ok(scoringSource.includes('const pictureScore = photos >= 1 ? 15 : 0;'), 'picture contribution should be 15');
assert.ok(scoringSource.includes('const captionScore = Math.min(described, photos) >= 1 ? 5 : 0;'), 'caption contribution should be 5');
assert.ok(scoringSource.includes('const total = Math.min(Math.round(pictureScore + captionScore), 20);'), 'documentation total should be capped at 20');
assert.ok(scoringSource.includes('const reportScore = rawReportScore * LETTER_BODY_MAX / 100;'), 'letter-body score must be normalized into a 70-point contribution without forcing an integer');
assert.ok(scoringSource.includes('const overallScore = Math.min(reportScore + mediaScore + infoScore, 100);'), 'overall score should remain a 100-point total and carry decimals in the sum');
assert.ok(scoringSource.includes('return Math.min(score, 10);'), 'info score must carry the fractional total and never force a whole-number average');
assert.ok(scoringSource.includes('calcInfoScore'), 'scoring utility must expose an info score function for the separate information component');

console.log('submissionScoringThreeWayRegression test passed');
