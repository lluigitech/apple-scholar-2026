(async ()=>{
  const db = require('../config/db');
  const p = db.promise();
  try {
    const [rows] = await p.query(`SELECT id, submission_type, generated_pdf_path FROM submissions WHERE submission_type='letter' ORDER BY submitted_at DESC LIMIT 1`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('DB query error', e);
  } finally {
    process.exit();
  }
})();
