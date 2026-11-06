const assert = require('node:assert/strict');
const test = require('node:test');
const { ensureColumns, ensureIndexes } = require('../utils/mysqlSchemaMigrations');

const createFakeDb = ({ columns = [], indexes = [], duplicateColumns = [], duplicateIndexes = [] } = {}) => {
    const calls = [];
    const existingColumns = new Set(columns);
    const existingIndexes = new Set(indexes);

    return {
        calls,
        query(sql, parameters, callback) {
            calls.push(sql);
            if (typeof parameters === 'function') callback = parameters;

            if (sql.startsWith('SHOW COLUMNS')) {
                callback(null, [...existingColumns].map((Field) => ({ Field })));
                return;
            }
            if (sql.startsWith('SHOW INDEX')) {
                callback(null, [...existingIndexes].map((Key_name) => ({ Key_name })));
                return;
            }

            const columnMatch = sql.match(/ADD COLUMN `([A-Za-z0-9_]+)`/);
            if (columnMatch) {
                const [, column] = columnMatch;
                if (duplicateColumns.includes(column)) {
                    callback(Object.assign(new Error('Duplicate column name'), {
                        code: 'ER_DUP_FIELDNAME',
                        errno: 1060,
                    }));
                    return;
                }
                existingColumns.add(column);
                callback(null, { affectedRows: 0 });
                return;
            }

            const indexMatch = sql.match(/ADD INDEX `([A-Za-z0-9_]+)`/);
            if (indexMatch) {
                const [, index] = indexMatch;
                if (duplicateIndexes.includes(index)) {
                    callback(Object.assign(new Error('Duplicate key name'), {
                        code: 'ER_DUP_KEYNAME',
                        errno: 1061,
                    }));
                    return;
                }
                existingIndexes.add(index);
                callback(null, { affectedRows: 0 });
                return;
            }

            callback(new Error(`Unexpected SQL in test: ${sql}`));
        },
    };
};

test('ensureColumns adds only missing columns and handles duplicate-column races', async () => {
    const db = createFakeDb({
        columns: ['existing_column'],
        duplicateColumns: ['raced_column'],
    });

    await ensureColumns(db, 'sample_table', {
        existing_column: 'INT DEFAULT NULL',
        new_column: 'VARCHAR(64) DEFAULT NULL',
        raced_column: 'TINYINT(1) NOT NULL DEFAULT 0',
    });

    assert.deepEqual(
        db.calls.filter((sql) => sql.startsWith('ALTER TABLE')),
        [
            'ALTER TABLE `sample_table` ADD COLUMN `new_column` VARCHAR(64) DEFAULT NULL',
            'ALTER TABLE `sample_table` ADD COLUMN `raced_column` TINYINT(1) NOT NULL DEFAULT 0',
        ]
    );
});

test('ensureIndexes adds only missing indexes and handles duplicate-index races', async () => {
    const db = createFakeDb({
        indexes: ['PRIMARY', 'existing_index'],
        duplicateIndexes: ['raced_index'],
    });

    await ensureIndexes(db, 'sample_table', {
        existing_index: ['id'],
        new_index: ['scholar_id', 'created_at'],
        raced_index: ['status'],
    });

    assert.deepEqual(
        db.calls.filter((sql) => sql.startsWith('ALTER TABLE')),
        [
            'ALTER TABLE `sample_table` ADD INDEX `new_index` (`scholar_id`, `created_at`)',
            'ALTER TABLE `sample_table` ADD INDEX `raced_index` (`status`)',
        ]
    );
});

test('ensureColumns rejects unsafe table and column identifiers', async () => {
    const db = createFakeDb();

    await assert.rejects(
        ensureColumns(db, 'sample_table; DROP TABLE users', { name: 'TEXT' }),
        /Invalid MySQL identifier/
    );
    await assert.rejects(
        ensureColumns(db, 'sample_table', { 'name; DROP TABLE users': 'TEXT' }),
        /Invalid MySQL identifier/
    );
    assert.deepEqual(db.calls, []);
});
