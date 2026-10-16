const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { logPrivacyAccess } = require('./privacyAccess');

const normalizeRole = (role) => (typeof role === 'string' ? role.toLowerCase().trim() : role);
const jwtSecret = process.env.JWT_SECRET || 'apple_scholar_secret_2026';

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Invalid or expired token' });

        db.query(
            'SELECT id, role, scholar_id FROM users WHERE id = ? LIMIT 1',
            [decoded.id],
            (userError, rows) => {
                if (userError) {
                    console.error('Failed to verify authenticated user:', userError);
                    return res.status(500).json({ message: 'Unable to verify authenticated user' });
                }
                if (!rows.length) return res.status(401).json({ message: 'Authenticated user no longer exists' });

                req.user = {
                    ...decoded,
                    id: rows[0].id,
                    role: normalizeRole(rows[0].role),
                    scholar_id: rows[0].scholar_id,
                };
                next();
            }
        );
    });
};

const requireRole = (roles, audit) => async (req, res, next) => {
    const allowedRoles = roles.map(normalizeRole);
    const allowed = Boolean(req.user && allowedRoles.includes(req.user.role));
    const auditAccess = async (status) => {
        if (!audit || (status === 'allowed' && audit.logAllowed === false)) return;
        await logPrivacyAccess(req, {
            action: status === 'denied' ? 'DENIED_ACCESS' : audit.action,
            resourceType: audit.resourceType,
            resourceId: audit.getResourceId
                ? audit.getResourceId(req)
                : req.params?.id || req.params?.scholar_id || req.params?.scholarId || null,
            status,
        });
    };

    try {
        await auditAccess(allowed ? 'allowed' : 'denied');
    } catch (auditError) {
        console.error('Failed to log protected access:', auditError);
        return res.status(500).json({ message: 'Unable to verify and log protected access' });
    }

    if (!allowed) {
        return res.status(403).json({ message: 'Access denied: insufficient role' });
    }
    next();
};

module.exports = { verifyToken, requireRole };