
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const useSSL = process.env.DB_SSL === 'true';

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kalinga_db',

  ...(useSSL && {
    ssl: {
      ca: process.env.DB_CA_CERT ||
        fs.readFileSync(
          path.resolve(__dirname, '../certs/ca.pem'),
          'utf8'
        ),
      rejectUnauthorized: true,
    },
  }),

  connectTimeout: 10000,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  charset: 'utf8mb4_general_ci',
});

let dbReadyResolved = false;
let dbReadyRejected = false;

const dbReady = new Promise((resolve, reject) => {
  setImmediate(() => {
    db.getConnection((err, connection) => {
      if (err) {
        dbReadyRejected = true;
        console.error('[MYSQL CONNECTION ERROR]', {
          code: err.code,
          errno: err.errno,
          syscall: err.syscall,
          fatal: err.fatal,
          message: err.message,
          stack: err.stack,
        });
        reject(err);
        return;
      }

      connection.release();
      dbReadyResolved = true;
      console.log('Connected to MySQL Database!');
      resolve();
    });
  });
});

db.on('error', (err) => {
  console.error('Database pool error:', err.message);
});

module.exports = db;
module.exports.ready = dbReady;
