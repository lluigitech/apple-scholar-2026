const IDENTIFIER_PATTERN = /^[A-Za-z0-9_]+$/;

const assertIdentifier = (identifier) => {
    if (!IDENTIFIER_PATTERN.test(identifier)) {
        throw new Error(`Invalid MySQL identifier: ${identifier}`);
    }
};

const runQuery = (db, sql, parameters = []) => new Promise((resolve, reject) => {
    db.query(sql, parameters, (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
    });
});

const isDuplicateColumnError = (error) =>
    error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060;

const isDuplicateIndexError = (error) =>
    error.code === 'ER_DUP_KEYNAME' || error.errno === 1061;

const ensureColumns = async (db, table, columnDefinitions) => {
    assertIdentifier(table);
    const columnNames = Object.keys(columnDefinitions);
    columnNames.forEach(assertIdentifier);

    const rows = await runQuery(db, `SHOW COLUMNS FROM \`${table}\``);
    const existingColumns = new Set(rows.map((row) => row.Field));

    for (const column of columnNames) {
        if (existingColumns.has(column)) continue;

        try {
            await runQuery(
                db,
                `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${columnDefinitions[column]}`
            );
            existingColumns.add(column);
        } catch (error) {
            if (!isDuplicateColumnError(error)) throw error;
            existingColumns.add(column);
        }
    }
};

const ensureIndexes = async (db, table, indexes) => {
    assertIdentifier(table);
    Object.entries(indexes).forEach(([name, columns]) => {
        assertIdentifier(name);
        if (!Array.isArray(columns) || columns.length === 0) {
            throw new Error(`Index ${name} must have at least one column`);
        }
        columns.forEach((column) => assertIdentifier(column));
    });

    const rows = await runQuery(db, `SHOW INDEX FROM \`${table}\``);
    const existingIndexes = new Set(rows.map((row) => row.Key_name));

    for (const [name, columns] of Object.entries(indexes)) {
        if (existingIndexes.has(name)) continue;

        try {
            const columnList = columns.map((column) => `\`${column}\``).join(', ');
            await runQuery(
                db,
                `ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (${columnList})`
            );
            existingIndexes.add(name);
        } catch (error) {
            if (!isDuplicateIndexError(error)) throw error;
            existingIndexes.add(name);
        }
    }
};

module.exports = { ensureColumns, ensureIndexes, runQuery };
