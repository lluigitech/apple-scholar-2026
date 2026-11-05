const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const compliancePath = require.resolve('../utils/complianceLogger');
const servicePath = require.resolve('../services/complianceThresholdNotificationService');
const notifications = [];
const stateEvents = [];
const sentEmails = [];
const scores = new Map([
  ['AS-071', { score: 74, minimumScore: 70 }],
  ['AS-069', { score: 68, minimumScore: 70 }],
]);
const scholars = [
  { scholar_id: 'AS-071', full_name: 'Warning Scholar', email: 'warning@example.com' },
  { scholar_id: 'AS-069', full_name: 'Below Minimum Scholar', email: 'critical@example.com' },
];

const fakeDb = {
  promise() {
    return {
      async getConnection() {
        return {
          async query(sql, values = []) {
            if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }], []];
            if (sql.includes('FROM users') && sql.includes("role = 'scholar'")) return [scholars, []];
            if (sql.includes('FROM compliance_threshold_alert_events')) {
              const rows = stateEvents
                .filter(row => row.scholar_id === values[0])
                .sort((a, b) => b.id - a.id)
                .slice(0, 1);
              return [rows, []];
            }
            if (sql.includes('INSERT INTO compliance_threshold_alert_events')) {
              const [scholar_id, stage] = values;
              stateEvents.push({ id: stateEvents.length + 1, scholar_id, stage });
              return [{ insertId: stateEvents.length, affectedRows: 1 }, []];
            }
            if (sql.includes('SELECT id FROM notification_logs') && sql.includes('status =')) {
              const [recipient, type, detail] = values;
              return [notifications.filter(row =>
                row.recipient === recipient && row.type === type && row.detail === detail && row.status === 'sent'
              ).map(row => ({ id: row.id })).slice(0, 1), []];
            }
            if (sql.includes('INSERT INTO notification_logs')) {
              const [scholar_id, recipient, channel, type, status, detail] = values;
              notifications.push({ id: notifications.length + 1, scholar_id, recipient, channel, type, status, detail });
              return [{ insertId: notifications.length, affectedRows: 1 }, []];
            }
            if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }], []];
            throw new Error(`Unexpected SQL: ${sql}`);
          },
          release() {},
        };
      },
    };
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'nodemailer' && parent.filename === servicePath) {
    return {
      createTransport: () => ({
        sendMail: async message => {
          sentEmails.push(message);
          return { messageId: `threshold-test-${sentEmails.length}` };
        },
      }),
    };
  }
  if (request === '../config/db' && parent.filename === servicePath) return fakeDb;
  if (request === '../utils/complianceLogger' && parent.filename === servicePath) {
    return {
      calculateCurrentCompliance(scholarId, callback) {
        const score = scores.get(scholarId);
        callback(null, score.score, score.minimumScore);
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'sender@example.com';
process.env.SMTP_PASS = 'test-password';

const { sendComplianceThresholdNotifications } = require('../services/complianceThresholdNotificationService');
Module._load = originalLoad;

test('compliance threshold alerts notify at 75 and below 70, dedupe, and alert again after recovery', async () => {
  notifications.length = 0;
  stateEvents.length = 0;
  sentEmails.length = 0;

  const firstRun = await sendComplianceThresholdNotifications();
  assert.equal(firstRun.notified_count, 2);
  assert.equal(firstRun.email_count, 2);
  assert.deepEqual(
    notifications.filter(row => row.channel === 'system').map(row => row.type).sort(),
    ['compliance_below_minimum', 'compliance_near_minimum']
  );
  assert.ok(sentEmails.find(email => email.to === 'warning@example.com').html.includes('Compliance Points Warning'));
  assert.ok(sentEmails.find(email => email.to === 'critical@example.com').html.includes('Compliance Points Below Minimum'));
  assert.ok(notifications.find(row => row.channel === 'system' && row.type === 'compliance_below_minimum').detail.includes('compliance points'));

  const duplicateRun = await sendComplianceThresholdNotifications();
  assert.equal(duplicateRun.notified_count, 0);
  assert.equal(duplicateRun.email_count, 0);
  assert.equal(sentEmails.length, 2);

  scores.set('AS-071', { score: 80, minimumScore: 70 });
  const recoveredRun = await sendComplianceThresholdNotifications();
  assert.equal(recoveredRun.notified_count, 0);

  scores.set('AS-071', { score: 73, minimumScore: 70 });
  const warningAgainRun = await sendComplianceThresholdNotifications();
  assert.equal(warningAgainRun.notified_count, 1);
  assert.equal(warningAgainRun.email_count, 1);
  assert.equal(sentEmails.filter(email => email.to === 'warning@example.com').length, 2);
});
