const mysql = require('mysql2');
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kalinga_db',
});

const sampleLetter = `Dear Kalinga at Pag-ibig Foundation,

I am writing to share my experiences from the past month as an Apple Scholar. I was able to balance my academics with community service, and I have maintained strong attendance while completing the required activities.

During this period, I participated in our local clean-up drive and helped tutor younger scholars in math and science. These activities helped me grow in confidence and taught me the importance of teamwork and empathy.

I also included photos of the community event and my report card for your review. I hope these documents demonstrate my commitment to both my studies and service.

Thank you for supporting my scholarship journey. I look forward to continuing my growth and contributing more to our community.

Sincerely,
Jordan Cruz`;

const sql = `INSERT INTO submissions (scholar_id, submission_type, title, description, status, officer_comment, submitted_at, updated_at, letter_content) VALUES (?, 'letter', 'Monthly Letter', ?, 'pending', NULL, NOW(), NOW(), ?)`;
const values = ['AS-2026-000001', 'Monthly letter submission with realistic content.', sampleLetter];

db.query(sql, values, (err, result) => {
  if (err) {
    console.error('ERROR inserting sample letter:', err.message);
    process.exit(1);
  }
  console.log('Inserted sample letter id =', result.insertId);
  db.end();
});
