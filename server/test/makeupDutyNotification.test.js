const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const notifyPath = require.resolve('../utils/notifyHelpers');
const sentEmails = [];
const logs = [];
const staff = [
  { id: 11, full_name: 'Assigned Staff', email: 'assigned-staff@example.com', makeup_requests: 1 },
  { id: 12, full_name: 'Other Staff', email: 'other-staff@example.com', makeup_requests: 0 },
];

const fakeDb = {
  query(sql, params, callback) {
    let rows = [];
    if (sql.includes('FROM duties WHERE id = ?')) {
      rows = [{ id: 8, title: 'Weekly Cleanup', duty_date: '2026-11-01', time_start: '09:00:00', time_end: '11:00:00', location: 'Campus' }];
    } else if (sql.includes('FROM users WHERE scholar_id = ?')) {
      rows = [{ scholar_id: 'AS-101', full_name: 'Makeup Scholar', email: 'scholar@example.com' }];
    } else if (sql.includes('FROM duty_group_assignments dga')) {
      rows = staff;
    } else if (sql.includes('SELECT id FROM notification_logs')) {
      const [recipient, detail] = params;
      rows = logs.some(log => log.recipient === recipient && log.detail === detail && log.status === 'sent')
        ? [{ id: 1 }]
        : [];
    } else if (sql.includes('INSERT INTO notification_logs')) {
      const [, recipient, , type, status, detail] = params;
      logs.push({ recipient, type, status, detail });
    } else {
      throw new Error(`Unexpected SQL: ${sql}`);
    }
    queueMicrotask(() => callback(null, rows));
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'nodemailer' && parent.filename === notifyPath) {
    return {
      createTransport: () => ({
        sendMail: async message => {
          sentEmails.push(message);
          return { messageId: `makeup-test-${sentEmails.length}` };
        },
      }),
    };
  }
  if (request === '../config/db' && parent.filename === notifyPath) return fakeDb;
  return originalLoad.call(this, request, parent, isMain);
};

process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'sender@example.com';
process.env.SMTP_PASS = 'test-password';

const { sendMakeupDutyAssignmentEmails } = require('../utils/notifyHelpers');
Module._load = originalLoad;

const sendAssignmentEmails = () => new Promise((resolve, reject) => {
  sendMakeupDutyAssignmentEmails('AS-101', 3, 8, (error, result) => {
    if (error) return reject(error);
    resolve(result);
  });
});

test('makeup duty assignment emails only the scholar and enabled staff assigned to that duty', async () => {
  sentEmails.length = 0;
  logs.length = 0;

  const firstRun = await sendAssignmentEmails();

  assert.equal(firstRun.ok, true);
  assert.equal(firstRun.sent_count, 2);
  assert.deepEqual(sentEmails.map(email => email.to).sort(), ['assigned-staff@example.com', 'scholar@example.com']);
  assert.ok(sentEmails.every(email => email.subject.includes('Makeup duty assigned')));
  assert.ok(sentEmails.every(email => email.html.includes('Makeup Duty Assigned')));
  assert.ok(sentEmails.every(email => email.html.includes('Makeup Scholar')));

  const repeatedRun = await sendAssignmentEmails();
  assert.equal(repeatedRun.sent_count, 0);
  assert.equal(sentEmails.length, 2);
});
