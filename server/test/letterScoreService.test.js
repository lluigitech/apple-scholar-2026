const assert = require('assert');
const { normalizeLetterScoreResponse } = require('../services/letterScoreService');

assert.deepStrictEqual(normalizeLetterScoreResponse({ predicted_score: 96 }), {
  score: 96,
  quality_status: 'accepted',
  quality_label: 'Excellent',
  academic_tone: 'Formal',
  breakdown: {
    date: 5,
    body: 58,
    attachments: 20,
    caption: 13,
  },
});

console.log('letterScoreService test passed');
