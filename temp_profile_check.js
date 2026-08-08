const db = require('./server/config/db');

const queries = [
  {
    name: 'profileQuery',
    sql: 'SELECT id, scholar_id, full_name, email, role, year_level, status, created_at, phone, address, course, school FROM users WHERE id = ?',
    params: [2],
  },
  {
    name: 'columns',
    sql: 'SHOW COLUMNS FROM users',
    params: [],
  },
];

let completed = 0;
queries.forEach((q) => {
  db.query(q.sql, q.params, (err, rows) => {
    console.log('QUERY', q.name);
    if (err) {
      console.error('ERROR', err);
    } else {
      console.log('ROWS', JSON.stringify(rows, null, 2));
    }
    completed += 1;
    if (completed === queries.length) process.exit(0);
  });
});
