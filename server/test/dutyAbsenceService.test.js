const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const queryCalls = [];
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
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const { markEndedDutyAbsences } = require('../services/dutyAbsenceService');
delete require.cache[dbPath];

test('marks only unrecorded active scholars absent after a duty ends', async () => {
    queryCalls.length = 0;
    queryHandler = async sql => {
        if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }], []];
        if (sql.includes('INSERT INTO duty_attendance')) {
            assert.match(sql, /TIMESTAMP\(d\.duty_date, COALESCE\(d\.time_end/);
            assert.match(sql, /LOWER\(COALESCE\(d\.status, ''\)\) <> 'cancelled'/);
            assert.match(sql, /NOT EXISTS/);
            assert.match(sql, /u\.role = 'scholar' AND u\.status = 'active'/);
            return [{ affectedRows: 3 }, []];
        }
        if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }], []];
        throw new Error(`Unexpected query: ${sql}`);
    };

    const result = await markEndedDutyAbsences();

    assert.deepEqual(result, { skipped: false, markedCount: 3 });
    assert.equal(queryCalls.filter(call => call.sql.includes('INSERT INTO duty_attendance')).length, 1);
    assert.equal(queryCalls.filter(call => call.sql.includes('RELEASE_LOCK')).length, 1);
    assert.equal(queryCalls.at(-1).sql, 'RELEASE_CONNECTION');
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
