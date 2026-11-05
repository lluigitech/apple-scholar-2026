const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
let promiseQuery;
const queryCalls = [];
const fakeDb = {
  query(sql, values, callback) {
    queryCalls.push({ sql, values });
    if (callback) callback(null, []);
  },
  promise() {
    return {
      async query(sql, values) {
        queryCalls.push({ sql, values });
        return promiseQuery(sql, values);
      },
    };
  },
};

const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const staffSettingsController = require('../controllers/staffSettingsController');
const authController = require('../controllers/authController');

delete require.cache[dbPath];

const invoke = (handler, request) => new Promise((resolve, reject) => {
  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      resolve({ statusCode, body });
      return this;
    },
  };
  Promise.resolve(handler(request, res)).catch(reject);
});

const profile = {
  staff_id: 'STF-2026-001',
  full_name: 'Staff Member',
  email: 'staff@example.test',
  role: 'staff',
  status: 'active',
};

const defaultPreferences = {
  announcements: true,
  task_assignments: true,
  duty_attendance: true,
  submission_updates: true,
  makeup_requests: true,
  system_updates: true,
};

test('staff profile only returns the authenticated staff account fields', async () => {
  queryCalls.length = 0;
  promiseQuery = async (sql, values) => {
    assert.match(sql, /scholar_id AS staff_id/);
    assert.match(sql, /WHERE id = \? AND role = 'staff'/);
    assert.doesNotMatch(sql, /phone|contact_number/i);
    assert.doesNotMatch(sql, /password/);
    assert.deepEqual(values, [12]);
    return [[profile], []];
  };

  const response = await invoke(staffSettingsController.getProfile, { user: { id: 12, role: 'staff' } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, profile);
});

test('staff profile update rejects fields outside the contract without writing', async () => {
  queryCalls.length = 0;
  const response = await invoke(staffSettingsController.updateProfile, {
    user: { id: 12, role: 'staff' },
    body: { full_name: 'Staff Member', email: 'staff@example.test', phone: '09123456789', role: 'admin' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(queryCalls.length, 0);
});

test('staff profile update trims data and returns the updated profile', async () => {
  queryCalls.length = 0;
  const updatedProfile = {
    ...profile,
    full_name: 'Updated Staff',
    email: 'updated@example.test',
  };
  promiseQuery = async (sql, values) => {
    if (sql.startsWith('SELECT password FROM users')) return [[{ password: 'current-password' }], []];
    if (sql.startsWith('UPDATE users')) {
      assert.match(sql, /WHERE id = \? AND role = 'staff'/);
      assert.doesNotMatch(sql, /phone/i);
      assert.deepEqual(values, ['Updated Staff', 'updated@example.test', 12]);
      return [{ affectedRows: 1 }, []];
    }
    return [[updatedProfile], []];
  };

  const response = await invoke(staffSettingsController.updateProfile, {
    user: { id: 12, role: 'staff' },
    body: { full_name: ' Updated Staff ', email: ' UPDATED@example.test ', currentPassword: 'current-password' },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, updatedProfile);
});

test('staff profile cannot be changed with an incorrect current password', async () => {
  queryCalls.length = 0;
  promiseQuery = async sql => {
    assert.match(sql, /^SELECT password FROM users/);
    return [[{ password: 'current-password' }], []];
  };
  const response = await invoke(staffSettingsController.updateProfile, {
    user: { id: 12, role: 'staff' },
    body: { full_name: 'Changed Staff', email: 'staff@example.test', currentPassword: 'wrong-password' },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(queryCalls.some(({ sql }) => sql.startsWith('UPDATE users')), false);
});

test('staff profile update reports duplicate email as a conflict', async () => {
  promiseQuery = async () => {
    const error = new Error('Duplicate email');
    error.code = 'ER_DUP_ENTRY';
    throw error;
  };

  const response = await invoke(staffSettingsController.updateProfile, {
    user: { id: 12, role: 'staff' },
    body: { full_name: 'Staff Member', email: 'used@example.test', currentPassword: 'current-password' },
  });
  assert.equal(response.statusCode, 409);
  assert.match(response.body.error, /already in use/);
});

test('staff notification preferences default to true for the authenticated account', async () => {
  promiseQuery = async sql => {
    if (sql.startsWith('INSERT IGNORE')) return [{ affectedRows: 1 }, []];
    return [[Object.fromEntries(Object.keys(defaultPreferences).map(key => [key, 1]))], []];
  };

  const response = await invoke(staffSettingsController.getNotificationPreferences, {
    user: { id: 12, role: 'staff' },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, defaultPreferences);
});

test('staff notification update requires password and saves all preferences', async () => {
  queryCalls.length = 0;
  const saved = { ...defaultPreferences, announcements: false, duty_attendance: false };
  promiseQuery = async (sql, values) => {
    if (sql.startsWith('SELECT password FROM users')) return [[{ password: 'current-password' }], []];
    if (sql.startsWith('INSERT IGNORE')) return [{ affectedRows: 0 }, []];
    if (sql.startsWith('SELECT id FROM users')) return [[{ id: 12 }], []];
    if (sql.startsWith('UPDATE staff_notification_preferences_v2')) {
      assert.match(sql, /announcements = \?, task_assignments = \?, duty_attendance = \?, submission_updates = \?, makeup_requests = \?, system_updates = \?/);
      assert.deepEqual(values, [false, true, false, true, true, true, 12]);
      return [{ affectedRows: 1 }, []];
    }
    return [[Object.fromEntries(Object.entries(saved).map(([key, value]) => [key, Number(value)]))], []];
  };

  const response = await invoke(staffSettingsController.updateNotificationPreferences, {
    user: { id: 12, role: 'staff' },
    body: { ...defaultPreferences, announcements: false, duty_attendance: false, currentPassword: 'current-password' },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, saved);
});

test('staff notification update rejects non-boolean known values before database access', async () => {
  queryCalls.length = 0;
  const response = await invoke(staffSettingsController.updateNotificationPreferences, {
    user: { id: 12, role: 'staff' },
    body: { ...defaultPreferences, announcements: 'false', currentPassword: 'current-password' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(queryCalls.length, 0);
});

test('staff notification update rejects an incorrect current password without writing', async () => {
  queryCalls.length = 0;
  promiseQuery = async sql => {
    assert.match(sql, /^SELECT password FROM users/);
    return [[{ password: 'current-password' }], []];
  };
  const response = await invoke(staffSettingsController.updateNotificationPreferences, {
    user: { id: 12, role: 'staff' },
    body: { ...defaultPreferences, currentPassword: 'wrong-password' },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(queryCalls.some(({ sql }) => sql.startsWith('UPDATE staff_notification_preferences_v2')), false);
});

test('staff password change uses the shared hash handler and contract success message', async () => {
  const bcrypt = require('bcryptjs');
  const oldPasswordHash = await bcrypt.hash('current-password', 4);
  promiseQuery = async sql => {
    if (sql.startsWith('SELECT id, email, role, password')) {
      return [[{ id: 12, email: 'staff@example.test', role: 'staff', password: oldPasswordHash }], []];
    }
    return [{ affectedRows: 1 }, []];
  };

  const response = await invoke((req, res) => authController.changePassword(req, res, { successMessage: 'Password updated' }), {
    user: { id: 12, role: 'staff' },
    body: { current_password: 'current-password', new_password: 'new-password-123' },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { message: 'Password updated' });
  const update = queryCalls.find(call => call.sql.startsWith('UPDATE users SET password'));
  assert.equal(await bcrypt.compare('new-password-123', update.values[0]), true);
});

test('staff password change rejects an incorrect current password', async () => {
  const bcrypt = require('bcryptjs');
  const oldPasswordHash = await bcrypt.hash('current-password', 4);
  promiseQuery = async () => [[{
    id: 12,
    email: 'staff@example.test',
    role: 'staff',
    password: oldPasswordHash,
  }], []];

  const response = await invoke(authController.changePassword, {
    user: { id: 12, role: 'staff' },
    body: { current_password: 'wrong-password', new_password: 'new-password-123' },
  });
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error, /incorrect/);
});

test('staff settings password verification accepts and rejects the current password', async () => {
  const bcrypt = require('bcryptjs');
  queryCalls.length = 0;
  const passwordHash = await bcrypt.hash('current-password', 4);
  promiseQuery = async () => [[{ password: passwordHash }], []];
  const valid = await invoke(staffSettingsController.verifyPassword, {
    user: { id: 12, role: 'staff' },
    body: { currentPassword: 'current-password' },
  });
  const invalid = await invoke(staffSettingsController.verifyPassword, {
    user: { id: 12, role: 'staff' },
    body: { currentPassword: 'wrong-password' },
  });

  assert.equal(valid.statusCode, 200);
  assert.deepEqual(valid.body, { verified: true });
  assert.equal(invalid.statusCode, 401);
  assert.match(invalid.body.error, /password is incorrect/i);
});

test('staff settings routes require staff role and use the authenticated settings handlers', () => {
  const staffRoutes = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'staff', 'staffRoutes.js'),
    'utf8'
  );
  assert.match(staffRoutes, /router\.get\('\/profile', requireRole\(\['staff'\]\), staffSettings\.getProfile\)/);
  assert.match(staffRoutes, /router\.put\('\/profile', requireRole\(\['staff'\]\), staffSettings\.updateProfile\)/);
  assert.match(staffRoutes, /router\.post\('\/settings\/verify-password', requireRole\(\['staff'\]\), staffSettings\.verifyPassword\)/);
  assert.match(staffRoutes, /router\.post\('\/change-password', requireRole\(\['staff'\]\), \(req, res\) =>/);
  assert.match(staffRoutes, /authController\.changePassword\(req, res, \{ successMessage: 'Password updated' \}\)/);
  assert.match(staffRoutes, /router\.get\('\/settings\/notifications', requireRole\(\['staff'\]\), staffSettings\.getNotificationPreferences\)/);
  assert.match(staffRoutes, /router\.put\('\/settings\/notifications', requireRole\(\['staff'\]\), staffSettings\.updateNotificationPreferences\)/);
});
