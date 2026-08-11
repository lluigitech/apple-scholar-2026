(async ()=>{
  try {
    const generator = require('../services/letterPdfGenerator');
    console.log('Calling generateLetterPdf for id=5');
    const res = await generator.generateLetterPdf(5);
    console.log('Result:', res);
  } catch (e) {
    console.error('Generation error:', e);
  }
})();
