const mysql = require('mysql2');

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kalinga_db',
  connectTimeout: 10000,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  charset: 'utf8mb4_general_ci',
});

let dbReadyResolved = false;
let dbReadyRejected = false;

const dbReady = new Promise((resolve, reject) => {
  const attemptConnection = () => {
    db.getConnection((err, connection) => {
      if (err) {
        if (!dbReadyRejected) {
          dbReadyRejected = true;
          console.error('Error connecting to database:', err && err.message ? err.message : err);
          reject(err);
        }
        return;
      }

      connection.release();
      if (!dbReadyResolved) {
        dbReadyResolved = true;
        console.log('Connected to MySQL Database! 🗄️');
        resolve();
      }
    });
  };

  attemptConnection();
});

db.on('error', (err) => {
  console.error('Database pool error:', err && err.message ? err.message : err);
});

module.exports = db;
module.exports.ready = dbReady;