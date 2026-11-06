const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
let attendanceRow;
let updateAffectedRows;
let updateCalled;
let autoCheckoutSql;
let autoCheckoutAffectedRows = 0;
const fakeDb = {
  query(sql, values, callback) {
    if (sql.includes('FROM duty_attendance da')) {
      callback(null, attendanceRow ? [attendanceRow] : []);
      return;
    }
    updateCalled = true;
    callback(null, { affectedRows: updateAffectedRows });
  },
  promise() {
    return {
      query: async sql => {
        autoCheckoutSql = sql;
        return [{ affectedRows: autoCheckoutAffectedRows }, []];
      },
    };
  },
};
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const { checkOutDutyAttendance, autoCheckOutDutyAttendances } = require('../services/dutyAttendanceService');

delete require.cache[dbPath];

const invokeCheckout = () => new Promise(resolve => {
  updateCalled = false;
  checkOutDutyAttendance(18, 'SCH-18', (error, result) => resolve({ error, result }));
});

test('make-up duty check-out is available at the scheduled end', async () => {
  attendanceRow = {
    id: 8,
    status: 'present',
    check_out_at: null,
    is_makeup: 1,
    checkout_open: 0,
    checkout_locked: 0,
  };
  updateAffectedRows = 1;

  const response = await invokeCheckout();

  assert.equal(response.error.status, 409);
  assert.match(response.error.error, /after the scheduled duty ends/);
  assert.equal(updateCalled, false);
});

test('make-up duty can be checked out after the scheduled end', async () => {
  attendanceRow = {
    id: 8,
    status: 'late',
    check_out_at: null,
    is_makeup: 1,
    checkout_open: 1,
    checkout_locked: 0,
  };
  updateAffectedRows = 1;

  const response = await invokeCheckout();

  assert.equal(response.error, null);
  assert.deepEqual(response.result, { id: 8 });
  assert.equal(updateCalled, true);
});

test('regular duty cannot be checked out before the scheduled end', async () => {
  attendanceRow = {
    id: 9,
    status: 'present',
    check_out_at: null,
    is_makeup: 0,
    checkout_open: 0,
    checkout_locked: 0,
  };

  const response = await invokeCheckout();

  assert.equal(response.error.status, 409);
  assert.match(response.error.error, /after the scheduled duty ends/);
  assert.equal(updateCalled, false);
});

test('check-out is locked two hours after the scheduled duty end', async () => {
  attendanceRow = {
    id: 10,
    status: 'present',
    check_out_at: null,
    is_makeup: 0,
    checkout_open: 1,
    checkout_locked: 1,
  };
  updateAffectedRows = 1;

  const response = await invokeCheckout();

  assert.equal(response.error.status, 409);
  assert.match(response.error.error, /closed two hours after/);
  assert.equal(updateCalled, false);
});

test('automatically checks out present scholars after the grace period using scheduled time', async () => {
  autoCheckoutAffectedRows = 4;

  const result = await autoCheckOutDutyAttendances();

  assert.deepEqual(result, { checkedOutCount: 4 });
  assert.match(autoCheckoutSql, /UPDATE duty_attendance da/);
  assert.match(autoCheckoutSql, /DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL 8 HOUR\)/);
  assert.match(autoCheckoutSql, /INTERVAL 15 MINUTE/);
  assert.match(autoCheckoutSql, /SET da\.check_out_at = TIMESTAMP\(d\.duty_date, COALESCE\(d\.time_end, '23:59:59'\)\)/);
  assert.match(autoCheckoutSql, /DATE_ADD\(TIMESTAMP\(d\.duty_date, COALESCE\(d\.time_end, '23:59:59'\)\), INTERVAL 15 MINUTE\)/);
  assert.match(autoCheckoutSql, /da\.check_out_at IS NULL/);
});
