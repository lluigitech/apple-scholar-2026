const assert = require('assert');
const { normalizeLetterScoreResponse } = require('../services/letterScoreService');

assert.deepStrictEqual(normalizeLetterScoreResponse({ predicted_score: 96 }), {
  score: 96,
  quality_status: 'accepted',
  quality_label: 'Excellent',
});

console.log('letterScoreService test passed');
