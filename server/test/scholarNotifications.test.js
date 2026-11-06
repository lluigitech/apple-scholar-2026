const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const controllerPath = require.resolve('../controllers/scholarController');
const notificationRows = [
  {
    id: 1,
    scholar_id: 'AS-001',
    recipient: 'scholar@example.com',
    channel: 'system',
    type: 'attendance_late',
    status: 'generated',
    detail: 'Late check-in recorded for duty "Campus Cleanup" (duty_id=43).',
    is_read: 0,
    created_at: '2026-03-05 09:00:00',
  },
  {
    id: 2,
    scholar_id: 'AS-001',
    recipient: 'scholar@example.com',
    channel: 'system',
    type: 'overdue-task',
    status: 'generated',
    detail: 'overdue-task:s:scholar:AS-2026-000003:date:2026-10-27',
    is_read: 0,
    created_at: '2026-03-05 08:00:00',
  },
  {
    id: 3,
    scholar_id: 'AS-001',
    recipient: 'scholar@example.com',
    channel: 'system',
    type: 'compliance_below_minimum',
    status: 'generated',
    detail: 'Your compliance points are below the minimum required points.',
    is_read: 1,
    created_at: '2026-03-04 09:00:00',
  },
  {
    id: 4,
    scholar_id: 'AS-001',
    recipient: 'scholar@example.com',
    channel: 'system',
    type: 'overdue-task',
    status: 'generated',
    detail: 'overdue-task:s:scholar:AS-2026-000003:date:2026-10-27',
    is_read: 0,
    created_at: '2026-03-04 08:00:00',
  },
];
let capturedSql = '';
let capturedParams = [];
const fakeDb = {
  query(sql, params, callback) {
    capturedSql = sql;
    capturedParams = params;
    queueMicrotask(() => callback(null, notificationRows));
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return fakeDb;
  return originalLoad.call(this, request, parent, isMain);
};
const { getScholarNotifications } = require('../controllers/scholarController');
Module._load = originalLoad;

const invoke = handler => new Promise(resolve => {
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      resolve({ statusCode: this.statusCode || 200, payload });
      return this;
    },
  };
  handler({ user: { scholar_id: 'AS-001' } }, res);
});

test('scholar notification feed returns formatted system updates without delivery metadata', async () => {
  const response = await invoke(getScholarNotifications);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedParams, ['AS-001']);
  assert.match(capturedSql, /channel = 'system' AND status = 'generated'/);
  assert.equal(response.payload.length, 3);
  assert.equal(response.payload[0].title, 'Late check-in recorded');
  assert.equal(response.payload[0].message, 'Your check-in for Campus Cleanup was recorded as late.');
  assert.equal(response.payload[0].read, false);
  assert.equal(response.payload[1].title, 'Overdue requirement');
  assert.equal(response.payload[1].message, 'A scholarship requirement is overdue. Please review your checklist and submit any outstanding work.');
  assert.equal(response.payload[2].title, 'Compliance below minimum');
  assert.equal(response.payload[2].message, 'Your compliance points are below the minimum required points.');
  assert.ok(response.payload.every(notification => !('recipient' in notification) && !('channel' in notification)));
  assert.ok(!JSON.stringify(response.payload).includes('duty_id=43'));
  assert.ok(!JSON.stringify(response.payload).includes('overdue-task:'));
});
