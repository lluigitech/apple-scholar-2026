const db = require('../config/db');
const { getAssignedYearLevels, normalizeYearLevel } = require('../utils/officerAssignments');

const query = (sql, values = []) => new Promise((resolve, reject) => {
    db.query(sql, values, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const getSettings = async () => {
    const rows = await query('SELECT * FROM privacy_settings WHERE id = 1 LIMIT 1');
    if (!rows.length) throw new Error('Privacy settings migration has not been run.');
    return {
        roleBasedAccess: Boolean(rows[0].role_based_access),
        documentProtection: Boolean(rows[0].document_protection),
        accessLogging: Boolean(rows[0].access_logging),
        privacyMonitoring: Boolean(rows[0].privacy_monitoring),
    };
};

const logPrivacyAccess = async (req, { action, resourceType, resourceId, status }) => {
    const settings = await getSettings();
    if (!settings.accessLogging && !(status === 'denied' && settings.privacyMonitoring)) return;
    await query(
        `INSERT INTO privacy_access_logs (user_id, user_role, action, resource_type, resource_id, status, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            req.user?.id || null,
            String(req.user?.role || 'unknown').toLowerCase(),
            action,
            resourceType,
            resourceId == null ? null : String(resourceId).slice(0, 255),
            status,
            req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || null,
        ]
    );
};

const canAccessScholar = async (req, scholarId, { document = false } = {}) => {
    const role = String(req.user?.role || '').toLowerCase();
    if (role === 'admin') return true;
    const settings = await getSettings();
    if (document && !settings.documentProtection) return false;
    if (role === 'scholar') return String(req.user.scholar_id || '') === String(scholarId);
    if (!settings.roleBasedAccess) return false;
    if (role !== 'officer') return false;

    const rows = await query(
        'SELECT year_level FROM users WHERE scholar_id = ? AND role = ? LIMIT 1',
        [scholarId, 'scholar']
    );
    if (!rows.length) return false;
    const assigned = await getAssignedYearLevels(req.user.id);
    const level = normalizeYearLevel(rows[0].year_level);
    return Boolean(level) && assigned.some((item) => normalizeYearLevel(item) === level);
};

const authorizeScholarAccess = ({ getScholarId, action = 'VIEW_SCHOLAR', resourceType = 'scholar' }) => async (req, res, next) => {
    let scholarId;
    try {
        scholarId = getScholarId(req);
        if (!scholarId) return res.status(400).json({ error: 'Scholar identifier is required.' });
        const allowed = await canAccessScholar(req, scholarId);
        await logPrivacyAccess(req, {
            action: allowed ? action : 'DENIED_ACCESS',
            resourceType,
            resourceId: scholarId,
            status: allowed ? 'allowed' : 'denied',
        });
        if (!allowed) return res.status(403).json({ error: 'You are not authorized to access this scholar information.' });
        next();
    } catch (err) {
        console.error('Scholar access authorization failed:', err);
        res.status(500).json({ error: 'Unable to verify scholar access.' });
    }
};

module.exports = { authorizeScholarAccess, canAccessScholar, getSettings, logPrivacyAccess };
