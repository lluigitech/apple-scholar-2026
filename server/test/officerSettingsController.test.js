const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const assignmentsPath = require.resolve('../utils/officerAssignments');
let promiseQuery;
const queryCalls = [];
const fakeDb = {
  query(sql, values, callback) {
    queryCalls.push({ sql, values });
    callback(null, []);
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

const assignmentsModule = new Module(assignmentsPath, module);
assignmentsModule.filename = assignmentsPath;
assignmentsModule.loaded = true;
assignmentsModule.exports = {
  getAssignedYearLevels: async officerId => {
    assert.equal(officerId, 8);
    return ['Grade 12'];
  },
};
require.cache[assignmentsPath] = assignmentsModule;

const officerSettingsController = require('../controllers/officerSettingsController');
const authController = require('../controllers/authController');

delete require.cache[dbPath];
delete require.cache[assignmentsPath];

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

test('officer profile is loaded using the authenticated identity and assignment source', async () => {
  queryCalls.length = 0;
  promiseQuery = async sql => {
    assert.match(sql, /WHERE id = \? AND role = 'officer'/);
    return [[{
      officer_id: 8,
      full_name: 'Officer Name',
      email: 'officer@example.test',
      contact_number: '09123456789',
      role: 'officer',
    }], []];
  };

  const response = await invoke(officerSettingsController.getProfile, {
    user: { id: 8, role: 'officer' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.officer_id, 8);
  assert.deepEqual(response.body.assigned_year_levels, ['Grade 12']);
});

test('officer profile update rejects privilege fields before writing', async () => {
  queryCalls.length = 0;
  const response = await invoke(officerSettingsController.updateProfile, {
    user: { id: 8, role: 'officer' },
    body: {
      full_name: 'Officer Name',
      email: 'officer@example.test',
      contact_number: '',
      role: 'admin',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(queryCalls.length, 0);
});

test('officer profile update trims fields and scopes the database update to the authenticated officer', async () => {
  queryCalls.length = 0;
  promiseQuery = async sql => {
    assert.match(sql, /WHERE id = \? AND role = 'officer'/);
    return [{ affectedRows: 1 }, []];
  };

  const response = await invoke(officerSettingsController.updateProfile, {
    user: { id: 8, role: 'officer' },
    body: {
      full_name: '  Officer Name  ',
      email: '  OFFICER@example.test ',
      contact_number: '  09123456789 ',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    full_name: 'Officer Name',
    email: 'officer@example.test',
    contact_number: '09123456789',
  });
  assert.deepEqual(queryCalls[0].values, ['Officer Name', 'officer@example.test', '09123456789', 8]);
});

test('officer profile update treats an unchanged profile as successful', async () => {
  queryCalls.length = 0;
  promiseQuery = async sql => {
    if (sql.startsWith('UPDATE users')) return [{ affectedRows: 0 }, []];
    if (sql.startsWith('SELECT id FROM users')) return [[{ id: 8 }], []];
    return [[{
      full_name: 'Officer Name',
      email: 'officer@example.test',
      contact_number: '',
    }], []];
  };

  const response = await invoke(officerSettingsController.updateProfile, {
    user: { id: 8, role: 'officer' },
    body: {
      full_name: 'Officer Name',
      email: 'officer@example.test',
      contact_number: '',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(queryCalls.length, 3);
});

test('notification preferences are loaded and saved per authenticated officer', async () => {
  queryCalls.length = 0;
  promiseQuery = async (sql, values) => {
    if (sql.includes('INSERT IGNORE INTO officer_notification_preferences')) return [{ affectedRows: 1 }, []];
    assert.match(sql, /WHERE officer_id = \?/);
    assert.deepEqual(values, [8]);
    return [[{
      new_submissions: 1,
      pending_reviews: 0,
      deadlines: 1,
      returned_submissions: 0,
      announcements: 1,
    }], []];
  };

  const getResponse = await invoke(officerSettingsController.getNotificationPreferences, {
    user: { id: 8, role: 'officer' },
  });
  assert.deepEqual(getResponse.body, {
    new_submissions: true,
    pending_reviews: false,
    deadlines: true,
    returned_submissions: false,
    announcements: true,
  });

  queryCalls.length = 0;
  promiseQuery = async sql => {
    if (sql.includes('INSERT INTO officer_notification_preferences')) {
      assert.match(sql, /ON DUPLICATE KEY UPDATE/);
      return [{ affectedRows: 1 }, []];
    }
    if (sql.includes('SELECT id FROM users')) return [[{ id: 8 }], []];
    return [[{ id: 8 }], []];
  };
  const settings = {
    new_submissions: false,
    pending_reviews: true,
    deadlines: false,
    returned_submissions: true,
    announcements: false,
  };
  const putResponse = await invoke(officerSettingsController.updateNotificationPreferences, {
    user: { id: 8, role: 'officer' },
    body: settings,
  });
  assert.equal(putResponse.statusCode, 200);
  assert.deepEqual(putResponse.body, settings);
  assert.equal(queryCalls[0].values.at(-1), 8);
});

test('password change verifies current password and uses the shared auth handler', async () => {
  const bcrypt = require('bcryptjs');
  const oldPasswordHash = await bcrypt.hash('current-password', 4);
  queryCalls.length = 0;
  promiseQuery = async sql => {
    if (sql.startsWith('SELECT id, email, role, password')) {
      return [[{ id: 8, email: 'officer@example.test', role: 'officer', password: oldPasswordHash }], []];
    }
    return [{ affectedRows: 1 }, []];
  };
  const response = await invoke(authController.changePassword, {
    user: { id: 8, role: 'officer' },
    body: { current_password: 'current-password', new_password: 'new-password-123' },
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body.message, /successfully/);
  const updates = queryCalls.filter(({ sql }) => sql.startsWith('UPDATE users SET password'));
  assert.equal(updates.length, 1);
  assert.notEqual(updates[0].values[0], 'new-password-123');
  assert.equal(await bcrypt.compare('new-password-123', updates[0].values[0]), true);
});

test('Officer Settings routes are role-protected and reuse the shared password handler', () => {
  const officerRoutes = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'officer', 'officerRoutes.js'),
    'utf8'
  );
  const authRoutes = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'authRoutes.js'),
    'utf8'
  );
  assert.match(officerRoutes, /router\.use\(verifyToken, requireRole\(\['officer'\]/);
  assert.match(officerRoutes, /router\.get\('\/profile', officerSettingsController\.getProfile\)/);
  assert.match(officerRoutes, /router\.put\('\/profile', officerSettingsController\.updateProfile\)/);
  assert.match(officerRoutes, /router\.post\('\/change-password', authController\.changePassword\)/);
  assert.match(officerRoutes, /router\.get\('\/settings\/notifications', officerSettingsController\.getNotificationPreferences\)/);
  assert.match(officerRoutes, /router\.put\('\/settings\/notifications', officerSettingsController\.updateNotificationPreferences\)/);
  assert.match(authRoutes, /router\.post\('\/change-password', verifyToken, authController\.changePassword\)/);
});

test('malformed password input is rejected without reading or changing the account', async () => {
  queryCalls.length = 0;
  const response = await invoke(authController.changePassword, {
    user: { id: 8, role: 'officer' },
    body: { current_password: 'current-password', new_password: 'short' },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(queryCalls.length, 0);
});
