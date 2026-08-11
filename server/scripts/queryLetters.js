const mysql = require('mysql2');
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kalinga_db',
});

const sql = `SELECT id, scholar_id, letter_content, submitted_at, status
             FROM submissions
             WHERE submission_type = 'letter'
             ORDER BY submitted_at DESC
             LIMIT 50`;

console.log('Running query:', sql.replace(/\s+/g, ' ').trim());

db.query(sql, (err, rows) => {
  if (err) {
    console.error('ERROR', err.message);
    process.exit(1);
  }

  rows.forEach((row, index) => {
    const snippet = (row.letter_content || '').replace(/\s+/g, ' ').slice(0, 240);
    console.log(`${index + 1}. id=${row.id} scholar=${row.scholar_id} status=${row.status} date=${row.submitted_at}`);
    console.log(`   snippet=${snippet}`);
  });

  db.end();
});
