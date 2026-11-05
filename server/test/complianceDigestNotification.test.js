const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const notifyPath = require.resolve('../utils/notifyHelpers');
const sentEmails = [];
const notificationLogs = [];
const dueTomorrow = new Date();
dueTomorrow.setDate(dueTomorrow.getDate() + 1);
const dueDate = [
  dueTomorrow.getFullYear(),
  String(dueTomorrow.getMonth() + 1).padStart(2, '0'),
  String(dueTomorrow.getDate()).padStart(2, '0'),
].join('-');
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const expiredDueDate = [
  yesterday.getFullYear(),
  String(yesterday.getMonth() + 1).padStart(2, '0'),
  String(yesterday.getDate()).padStart(2, '0'),
].join('-');

let upcomingTasks = [{
  id: 41,
  title: 'Monthly Report',
  type: 'Monthly Report',
  due_date: dueDate,
  created_at: '2026-10-01 00:00:00',
  target_year_levels: '[]',
}];
let expiredTasks = [];
let repeatedRisks = [];

const scholars = [
  { scholar_id: 'AS-001', full_name: 'Submitted Scholar', year_level: 'Grade 10' },
  { scholar_id: 'AS-002', full_name: 'Missing Scholar One', year_level: 'Grade 10' },
  { scholar_id: 'AS-003', full_name: 'Missing Scholar Two', year_level: 'Grade 11' },
];
const assignedOfficers = [
  { id: 21, email: 'grade10-officer@example.com', full_name: 'Grade 10 Officer', role: 'officer', year_level: 'Grade 10' },
  { id: 22, email: 'grade11-officer@example.com', full_name: 'Grade 11 Officer', role: 'officer', year_level: 'Grade 11' },
  { id: 23, email: 'unassigned-officer@example.com', full_name: 'Unassigned Officer', role: 'officer', year_level: 'Grade 12' },
];
const riskRecipients = [
  { email: 'admin@example.com', full_name: 'Admin', role: 'admin', preferences: '{"emailNotifications":true,"securityAlerts":true}' },
  { email: 'second-admin@example.com', full_name: 'Second Admin', role: 'admin', preferences: '{"emailNotifications":true,"securityAlerts":true}' },
  { email: 'alerts-disabled@example.com', full_name: 'Alerts Disabled', role: 'admin', preferences: '{"emailNotifications":true,"securityAlerts":false}' },
];

const fakeDb = {
  query(sql, params, callback) {
    const statement = sql.replace(/\s+/g, ' ').trim();
    let rows = [];
    if (statement.includes('FROM tasks t') && statement.includes('DATE_SUB(CURDATE(), INTERVAL 1 DAY)')) {
      rows = expiredTasks;
    } else if (statement.includes('FROM tasks') && statement.includes('DATE_ADD(CURDATE(), INTERVAL 1 DAY)')) {
      rows = upcomingTasks;
    } else if (statement.includes('FROM users') && statement.includes("WHERE role = 'scholar'")) {
      rows = scholars;
    } else if (statement.includes('FROM officer_year_level_assignments oya')) {
      rows = assignedOfficers;
    } else if (statement.includes('FROM users u') && statement.includes('admin_preferences')) {
      rows = riskRecipients;
    } else if (statement.includes('SELECT DISTINCT scholar_id FROM submissions')) {
      rows = [{ scholar_id: 'AS-001' }];
    } else if (statement.includes('SELECT DISTINCT scholar_id FROM grades')) {
      rows = [];
    } else if (statement.includes('SELECT id FROM notification_logs')) {
      const type = statement.includes("type = 'task_deadline_summary'")
        ? 'task_deadline_summary'
        : statement.includes("type = 'repeated_risk_flag'")
          ? 'repeated_risk_flag'
          : 'unsubmitted_task_summary';
      const [recipient, detail] = params;
      rows = notificationLogs.some(log => (!recipient || log.recipient === recipient) && log.type === type && log.detail === detail && log.status === 'sent')
        ? [{ id: 1 }]
        : [];
    } else if (statement.includes('INSERT INTO notification_logs')) {
      const [scholar_id, recipient, channel, type, status, detail] = params;
      notificationLogs.push({ scholar_id, recipient, channel, type, status, detail });
    } else if (statement.includes('HAVING COUNT(s.id) >= 3')) {
      rows = repeatedRisks;
    } else {
      throw new Error(`Unexpected test SQL: ${statement}`);
    }

    queueMicrotask(() => callback(null, rows));
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'nodemailer' && parent.filename === notifyPath) {
    return {
      createTransport: () => ({
        sendMail: async (message) => {
          sentEmails.push(message);
          return { messageId: `test-${sentEmails.length}` };
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

const { sendComplianceAlerts } = require('../utils/notifyHelpers');
Module._load = originalLoad;

test('one-day-before compliance alert goes only to assigned officers with their scholars and is sent once', async () => {
  const firstRun = await sendComplianceAlerts();

  assert.equal(firstRun.sent_count, 2);
  assert.equal(sentEmails.length, 2);
  const grade10Email = sentEmails.find(email => email.to === 'grade10-officer@example.com');
  const grade11Email = sentEmails.find(email => email.to === 'grade11-officer@example.com');
  assert.ok(grade10Email);
  assert.ok(grade11Email);
  assert.equal(grade10Email.subject.includes('1 not submitted'), true);
  assert.equal(grade10Email.text.includes('Missing Scholar One'), true);
  assert.equal(grade10Email.text.includes('Missing Scholar Two'), false);
  assert.equal(grade11Email.subject.includes('1 not submitted'), true);
  assert.equal(grade11Email.text.includes('Missing Scholar Two'), true);
  assert.equal(grade11Email.text.includes('Missing Scholar One'), false);
  assert.ok(sentEmails.every(email => !email.to.includes('admin@example.com') && !email.to.includes('unassigned-officer')));
  assert.ok(sentEmails.every(email => !email.text.includes('Submitted Scholar')));
  assert.ok(sentEmails.every(email => email.html.includes('Missing Scholar')));
  assert.ok(notificationLogs.every(log => log.type === 'unsubmitted_task_summary' && log.scholar_id === null));

  const duplicateRun = await sendComplianceAlerts();
  assert.equal(duplicateRun.sent_count, 0);
  assert.equal(sentEmails.length, 2);

  upcomingTasks = [];
  const overdueTaskRun = await sendComplianceAlerts();
  assert.equal(overdueTaskRun.sent_count, 0);
  assert.equal(sentEmails.length, 2);

  const complianceTypes = ['Monthly Report', 'Report Card', 'COR Upload', 'Other Documents'];
  expiredTasks = complianceTypes.map((type, index) => ({
    id: 52 + index,
    title: `${type} October`,
    type,
    due_date: expiredDueDate,
    created_at: '2026-10-01 00:00:00',
    target_year_levels: '["Grade 10","Grade 11"]',
    creator_email: 'task-creator@example.com',
    creator_name: 'Task Creator',
    creator_preferences: '{"emailNotifications":true,"securityAlerts":true}',
  }));
  const completedSummaryRun = await sendComplianceAlerts();
  const completionEmails = sentEmails.filter(email => email.to === 'task-creator@example.com');
  assert.equal(completedSummaryRun.sent_count, complianceTypes.length);
  assert.equal(completionEmails.length, complianceTypes.length);
  for (const type of complianceTypes) {
    const completionEmail = completionEmails.find(email => email.subject.includes(`${type} October`));
    assert.ok(completionEmail, `Expected a deadline notice for ${type}`);
    assert.match(completionEmail.subject, /Task deadline passed/);
    assert.match(completionEmail.text, /deadline .* has passed/i);
    assert.match(completionEmail.text, /check the task now to see who submitted and who did not/i);
    assert.doesNotMatch(completionEmail.text, /Submitted Scholar|Missing Scholar/);
    assert.match(completionEmail.html, /Task Deadline Has Passed/);
    assert.match(completionEmail.html, /who submitted and who has not/i);
    assert.doesNotMatch(completionEmail.html, /Submitted Scholar|Missing Scholar/);
  }

  const duplicateSummaryRun = await sendComplianceAlerts();
  assert.equal(duplicateSummaryRun.sent_count, 0);
  assert.equal(sentEmails.filter(email => email.to === 'task-creator@example.com').length, complianceTypes.length);

  repeatedRisks = [{ scholar_id: 'AS-009', full_name: 'Repeated Risk Scholar', negative_letters: 3 }];
  const riskEmailsBefore = sentEmails.filter(email => email.subject.includes('Repeated risk flag:')).length;
  const riskAlertRun = await sendComplianceAlerts();
  const newRiskEmails = sentEmails.filter(email => email.subject.includes('Repeated risk flag:'));
  assert.equal(riskAlertRun.sent_count, 2);
  assert.equal(newRiskEmails.length - riskEmailsBefore, 2);
  assert.deepEqual(
    newRiskEmails.slice(riskEmailsBefore).map(email => email.to).sort(),
    ['admin@example.com', 'second-admin@example.com']
  );
  assert.ok(newRiskEmails.slice(riskEmailsBefore).every(email => email.html.includes('3')));

  const duplicateRiskAlertRun = await sendComplianceAlerts();
  assert.equal(duplicateRiskAlertRun.sent_count, 0);
  assert.equal(sentEmails.filter(email => email.subject.includes('Repeated risk flag:')).length, 2);
});
