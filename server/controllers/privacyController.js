const db = require('../config/db');

const SETTINGS_COLUMNS = {
    roleBasedAccess: 'role_based_access',
    documentProtection: 'document_protection',
    accessLogging: 'access_logging',
    privacyMonitoring: 'privacy_monitoring',
};

const query = (sql, values = []) => new Promise((resolve, reject) => {
    db.query(sql, values, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const toSettings = (row) => Object.fromEntries(
    Object.entries(SETTINGS_COLUMNS).map(([key, column]) => [key, Boolean(row[column])])
);

exports.getSettings = async (req, res) => {
    try {
        const rows = await query('SELECT * FROM privacy_settings WHERE id = 1 LIMIT 1');
        if (!rows.length) return res.status(503).json({ error: 'Privacy settings have not been initialized. Run the privacy protection migration.' });
        res.json(toSettings(rows[0]));
    } catch (err) {
        console.error('Failed to load privacy settings:', err);
        res.status(500).json({ error: 'Failed to load privacy settings.' });
    }
};

exports.updateSettings = async (req, res) => {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)
        || Object.keys(SETTINGS_COLUMNS).some((key) => typeof incoming[key] !== 'boolean')) {
        return res.status(400).json({ error: 'All privacy settings must be provided as boolean values.' });
    }

    let connection;
    try {
        connection = await new Promise((resolve, reject) => {
            db.getConnection((err, conn) => (err ? reject(err) : resolve(conn)));
        });
        await new Promise((resolve, reject) => connection.beginTransaction((err) => (err ? reject(err) : resolve())));
        const oldRows = await new Promise((resolve, reject) => {
            connection.query('SELECT * FROM privacy_settings WHERE id = 1 FOR UPDATE', (err, rows) => (err ? reject(err) : resolve(rows)));
        });
        if (!oldRows.length) {
            await new Promise((resolve) => connection.rollback(resolve));
            return res.status(503).json({ error: 'Privacy settings have not been initialized. Run the privacy protection migration.' });
        }

        const oldSettings = toSettings(oldRows[0]);
        const newSettings = Object.fromEntries(Object.keys(SETTINGS_COLUMNS).map((key) => [key, incoming[key]]));
        const values = Object.keys(SETTINGS_COLUMNS).map((key) => newSettings[key]);
        values.push(req.user.id);
        await new Promise((resolve, reject) => {
            connection.query(
                `UPDATE privacy_settings
                 SET role_based_access = ?, document_protection = ?, access_logging = ?, privacy_monitoring = ?, updated_by = ?
                 WHERE id = 1`,
                values,
                (err) => (err ? reject(err) : resolve())
            );
        });
        const details = JSON.stringify({ old: oldSettings, new: newSettings });
        await new Promise((resolve, reject) => {
            connection.query(
                `INSERT INTO audit_logs (user_id, action, module, details, ip_address, result, created_at)
                 VALUES (?, 'UPDATE_PRIVACY_SETTINGS', 'Privacy & Data Protection', ?, ?, 'success', NOW())`,
                [req.user.id, details, req.ip || req.connection?.remoteAddress || null],
                (err) => (err ? reject(err) : resolve())
            );
        });
        await new Promise((resolve, reject) => connection.commit((err) => (err ? reject(err) : resolve())));
        res.json(newSettings);
    } catch (err) {
        if (connection) await new Promise((resolve) => connection.rollback(resolve));
        console.error('Failed to update privacy settings:', err);
        res.status(500).json({ error: 'Failed to save privacy settings and audit record.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.getAccessLogs = async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 25));
    const conditions = [];
    const values = [];

    for (const key of ['status', 'action', 'role']) {
        const value = req.query[key];
        if (!value || value === 'all') continue;
        conditions.push(key === 'role' ? 'user_role = ?' : `${key} = ?`);
        values.push(String(value).slice(0, 64));
    }
    if (req.query.search) {
        const search = `%${String(req.query.search).slice(0, 100)}%`;
        conditions.push('(action LIKE ? OR resource_type LIKE ? OR resource_id LIKE ?)');
        values.push(search, search, search);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
        const countRows = await query(`SELECT COUNT(*) AS total FROM privacy_access_logs ${where}`, values);
        const rows = await query(
            `SELECT id, user_id, user_role, action, resource_type, resource_id, status, ip_address, created_at
             FROM privacy_access_logs ${where}
             ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
            [...values, pageSize, (page - 1) * pageSize]
        );
        res.json({ data: rows, page, pageSize, total: Number(countRows[0]?.total || 0) });
    } catch (err) {
        console.error('Failed to load privacy access logs:', err);
        res.status(500).json({ error: 'Failed to load privacy access logs.' });
    }
};
