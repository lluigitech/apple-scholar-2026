(async () => {
  try {
    const generator = require('../services/letterPdfGenerator');
    console.log('Calling generateLetterPdf for id=5');
    const res = await generator.generateLetterPdf(5);
    console.log('Result:', res);
  } catch (e) {
    console.error('Generation error message:', e && e.message);
    console.error('Generation error stack:', e && e.stack);
    console.error('Generation error properties:', e && e.properties);
    console.error('Generation error constructor:', e && e.constructor && e.constructor.name);
  }
})();
