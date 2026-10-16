const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const notifyPath = require.resolve('../utils/notifyHelpers');
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = {};
require.cache[dbPath] = fakeDbModule;

let notifyResult;
let notifyError;
const fakeNotifyModule = new Module(notifyPath, module);
fakeNotifyModule.filename = notifyPath;
fakeNotifyModule.loaded = true;
fakeNotifyModule.exports = {
  sendDutyNotifyEmails(_dutyId, callback) {
    callback(notifyError, notifyResult);
  },
};
require.cache[notifyPath] = fakeNotifyModule;

const dutyController = require('../controllers/dutyController');

delete require.cache[dbPath];
delete require.cache[notifyPath];

const invokeNotify = () => new Promise((resolve) => {
  const res = {
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      resolve({ statusCode: this.statusCode || 200, body });
    },
  };
  dutyController.notifyDutyScholars({ params: { id: '3' } }, res);
});

test('duty notification reports missing SMTP configuration as service unavailable', async () => {
  notifyError = null;
  notifyResult = { ok: false, error: 'SMTP not configured' };

  const response = await invokeNotify();

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'Email service is not configured.' });
});

test('duty notification reports an unknown duty as not found', async () => {
  notifyError = new Error('Duty not found');
  notifyResult = null;

  const response = await invokeNotify();

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error, 'Failed to send duty notifications');
});
