const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const queryCalls = [];
const sentEmails = [];
const notificationLogs = [];
let absenceRows = [];
let queryHandler;
const fakeDb = {
    promise() {
        return {
            getConnection: async () => ({
                async query(sql, values) {
                    queryCalls.push({ sql, values });
                    return queryHandler(sql, values);
                },
                release() {
                    queryCalls.push({ sql: 'RELEASE_CONNECTION' });
                },
            }),
        };
    },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'nodemailer' && parent.filename === require.resolve('../services/dutyAbsenceService')) {
        return {
            createTransport: () => ({
                sendMail: async message => {
                    sentEmails.push(message);
                    return { messageId: `duty-test-${sentEmails.length}` };
                },
            }),
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const { markEndedDutyAbsences } = require('../services/dutyAbsenceService');
Module._load = originalLoad;
delete require.cache[dbPath];

process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'sender@example.com';
process.env.SMTP_PASS = 'test-password';

test('marks unrecorded assigned scholars absent one hour after the duty starts', async () => {
    queryCalls.length = 0;
    queryHandler = async sql => {
        if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }], []];
        if (sql.includes('SELECT CURRENT_TIMESTAMP AS sweep_started_at')) return [[{ sweep_started_at: '2026-10-27 10:00:00' }], []];
        if (sql.includes('INSERT INTO duty_attendance')) {
            assert.match(sql, /TIMESTAMP\(d\.duty_date, COALESCE\(d\.time_start/);
            assert.match(sql, /INTERVAL 1 HOUR/);
            assert.match(sql, /DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL 8 HOUR\)/);
            assert.match(sql, /LOWER\(COALESCE\(d\.status, ''\)\) <> 'cancelled'/);
            assert.match(sql, /NOT EXISTS/);
            assert.match(sql, /p\.makeup_duty_id AS duty_id/);
            assert.match(sql, /u\.role = 'scholar' AND u\.status = 'active'/);
            return [{ affectedRows: 3 }, []];
        }
        if (sql.includes('SELECT d.id AS duty_id')) return [absenceRows, []];
        if (sql.includes('SELECT id FROM notification_logs')) return [[], []];
        if (sql.includes('INSERT INTO notification_logs')) return [{ affectedRows: 1 }, []];
        if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }], []];
        throw new Error(`Unexpected query: ${sql}`);
    };

    const result = await markEndedDutyAbsences();

    assert.deepEqual(result, { skipped: false, markedCount: 3, sentCount: 0, failedCount: 0 });
    assert.equal(queryCalls.filter(call => call.sql.includes('INSERT INTO duty_attendance')).length, 1);
    assert.equal(queryCalls.filter(call => call.sql.includes('RELEASE_LOCK')).length, 1);
    assert.equal(queryCalls.at(-1).sql, 'RELEASE_CONNECTION');
});

test('emails duty creator and assigned staff once when system absences are recorded', async () => {
    const row = {
        duty_id: 7,
        title: 'Weekly Campus Cleanup',
        duty_date: '2026-10-25',
        time_start: '09:00:00',
        time_end: '11:00:00',
        location: 'Campus',
        creator_id: 1,
        creator_name: 'Duty Creator',
        creator_email: 'creator@example.com',
        creator_role: 'admin',
        creator_preferences: '{"emailNotifications":true}',
        scholar_id: 'AS-101',
        scholar_name: 'Absent Scholar',
        staff_id: 2,
        staff_name: 'Assigned Staff',
        staff_email: 'staff@example.com',
        staff_duty_attendance: 1,
    };
    absenceRows = [row, { ...row, scholar_id: 'AS-102', scholar_name: 'Another Absent Scholar' }];
    notificationLogs.length = 0;
    sentEmails.length = 0;
    queryCalls.length = 0;
    queryHandler = async sql => {
        if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }], []];
        if (sql.includes('SELECT CURRENT_TIMESTAMP AS sweep_started_at')) return [[{ sweep_started_at: '2026-10-27 10:00:00' }], []];
        if (sql.includes('INSERT INTO duty_attendance')) return [{ affectedRows: 0 }, []];
        if (sql.includes('SELECT d.id AS duty_id')) return [absenceRows, []];
        if (sql.includes('SELECT id FROM notification_logs')) {
            const [recipient, detail] = queryCalls.at(-1).values;
            return [notificationLogs.some(log => log.recipient === recipient && log.detail === detail && log.status === 'sent') ? [{ id: 1 }] : [], []];
        }
        if (sql.includes('INSERT INTO notification_logs')) {
            const [recipient, detail] = queryCalls.at(-1).values;
            const type = sql.includes("'duty_absence_notice'") ? 'duty_absence_notice' : '';
            const status = sql.includes("'sent'") ? 'sent' : 'failed';
            notificationLogs.push({ recipient, type, status, detail });
            return [{ affectedRows: 1 }, []];
        }
        if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }], []];
        throw new Error(`Unexpected query: ${sql}`);
    };

    const firstRun = await markEndedDutyAbsences();
    assert.equal(firstRun.sentCount, 2);
    assert.deepEqual(sentEmails.map(email => email.to).sort(), ['creator@example.com', 'staff@example.com']);
    assert.ok(sentEmails.every(email => email.html.includes('Duty Absence Notice')));
    assert.ok(sentEmails.every(email => email.html.includes('Absent Scholar') && email.html.includes('Another Absent Scholar')));

    const duplicateRun = await markEndedDutyAbsences();
    assert.equal(duplicateRun.sentCount, 0);
    assert.equal(sentEmails.length, 2);
});

test('skips duplicate sweeps while another scheduler holds the lock', async () => {
    queryCalls.length = 0;
    queryHandler = async sql => {
        assert.match(sql, /GET_LOCK/);
        return [[{ acquired: 0 }], []];
    };

    const result = await markEndedDutyAbsences();

    assert.deepEqual(result, { skipped: true, markedCount: 0 });
    assert.equal(queryCalls.length, 2);
    assert.equal(queryCalls.at(-1).sql, 'RELEASE_CONNECTION');
});
