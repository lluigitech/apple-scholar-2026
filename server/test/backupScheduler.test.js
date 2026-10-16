const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === '../config/db' && parent.filename.endsWith('backupRecoveryService.js')) {
        return {};
    }
    return originalLoad.call(this, request, parent, isMain);
};
const { isScheduledTimeReached, shouldCreateDailyBackup } = require('../services/backupRecoveryService');
Module._load = originalLoad;

const completedBackup = (date) => ({
    type: 'Full',
    status: 'Completed',
    createdAt: `${date}T12:00:00.000Z`,
});

assert.strictEqual(isScheduledTimeReached({ hour: '23', minute: '59' }, '23:59'), true);
assert.strictEqual(isScheduledTimeReached({ hour: '23', minute: '58' }, '23:59'), false);

assert.strictEqual(
    shouldCreateDailyBackup(
        [completedBackup('2026-10-05')],
        { dateKey: '2026-10-07', hour: '10', minute: '40' },
        '23:59'
    ),
    true,
    'Create a current-day catch-up backup when a full backup day was missed.'
);

assert.strictEqual(
    shouldCreateDailyBackup(
        [{ ...completedBackup('2026-10-07'), backupScope: 'daily', scheduledDate: '2026-10-07' }],
        { dateKey: '2026-10-07', hour: '10', minute: '40' },
        '23:59'
    ),
    false,
    'Do not create a duplicate after today already has a completed backup.'
);

assert.strictEqual(
    shouldCreateDailyBackup(
        [completedBackup('2026-10-06')],
        { dateKey: '2026-10-07', hour: '10', minute: '40' },
        '23:59'
    ),
    false,
    'Keep the configured schedule when yesterday has a completed backup.'
);

assert.strictEqual(
    shouldCreateDailyBackup(
        [completedBackup('2026-10-06')],
        { dateKey: '2026-10-07', hour: '23', minute: '59' },
        '23:59'
    ),
    true,
    'Run when the configured schedule time has passed.'
);

console.log('backupScheduler test passed');
