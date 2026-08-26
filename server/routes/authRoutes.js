const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAuditEvent } = require('../utils/auditLogger');
const { verifyToken } = require('../middleware/authMiddleware');

const jwtSecret = process.env.JWT_SECRET || 'apple_scholar_secret_2026';

console.log('[authRoutes] module loaded');

// ─── LOGIN ───────────────────────────────────────────────────
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    console.log('[LOGIN INVOKED]', { email, passwordProvided: !!password });
    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], async (err, data) => {
        try {
            if (err) {
                console.error('[LOGIN ERROR] db query failed:', err);
                return res.status(500).json({ error: "Login error in server" });
            }

            if (!Array.isArray(data) || data.length === 0) {
                console.log('[LOGIN] no user found for email', email);
                return res.status(401).json({ message: "Invalid email or password" });
            }

            const user = data[0];
            console.log('[LOGIN USER]', { id: user.id, email: user.email, role: user.role, passwordPresent: !!user.password });
            const normalizedRole = typeof user.role === 'string' ? user.role.toLowerCase().trim() : user.role;

            let match = false;
            if (!user.password) {
                console.log('[LOGIN] user has no password');
                logAuditEvent({
                    req,
                    userId: user.id,
                    role: normalizedRole,
                    action: 'login',
                    module: 'Authentication',
                    details: `Failed login attempt for ${user.email}`,
                    result: 'failed',
                }).catch(() => {});
                return res.status(401).json({ message: "Invalid email or password" });
            }

            if (typeof user.password === 'string' && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$'))) {
                match = await bcrypt.compare(password, user.password);
            } else {
                match = String(password) === String(user.password);
            }

            console.log('[LOGIN] password match:', match);
            if (!match) {
                logAuditEvent({
                    req,
                    userId: user.id,
                    role: normalizedRole,
                    action: 'login',
                    module: 'Authentication',
                    details: `Failed login attempt for ${user.email}`,
                    result: 'failed',
                }).catch(() => {});
                return res.status(401).json({ message: "Invalid email or password" });
            }

            // Debug: ensure JWT secret is available (helps identify signing errors)
            try {
                const secretPresent = !!process.env.JWT_SECRET;
                console.log('[LOGIN] JWT_SECRET present:', secretPresent);
            } catch (e) {
                console.log('[LOGIN] JWT_SECRET check failed:', e && e.message ? e.message : e);
            }

            const token = jwt.sign(
                { id: user.id, role: normalizedRole, email: user.email, scholar_id: user.scholar_id },
                jwtSecret,
                { expiresIn: '8h' }
            );

            // Fire audit logging in the background so login response is not delayed.
            logAuditEvent({
                req,
                userId: user.id,
                role: normalizedRole,
                action: 'login',
                module: 'Authentication',
                details: `User ${user.email} logged in successfully`,
                result: 'success',
            }).catch((auditErr) => {
                console.warn('[LOGIN] audit logging failed, continuing:', auditErr && auditErr.message ? auditErr.message : auditErr);
            });

            return res.json({
                status: "Success",
                token,
                role: normalizedRole,
                name: user.full_name,
                email: user.email,
                id: user.id,
                scholar_id: user.scholar_id,
                must_change_password: user.must_change_password === 1
            });
        } catch (err) {
            console.error('[LOGIN ERROR] unexpected:', err);
            return res.status(500).json({ error: 'Login error in server' });
        }
    });
});

router.post('/logout', verifyToken, async (req, res) => {
    await logAuditEvent({
        req,
        action: 'logout',
        module: 'Authentication',
        details: `User ${req.user.email || req.user.id} logged out`,
        result: 'success',
    });
    return res.json({ status: 'Success', message: 'Logged out successfully' });
});

// ─── CHANGE PASSWORD ─────────────────────────────────────────
router.post('/change-password', verifyToken, async (req, res) => {
    const { email, new_password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(new_password, 10);
        const sql = "UPDATE users SET password = ?, must_change_password = 0 WHERE email = ?";

        db.query(sql, [hashedPassword, email], (err, result) => {
            if (err) return res.status(500).json({ error: "Error changing password" });
            if (!result.affectedRows) return res.status(404).json({ error: "User not found" });
            db.query('SELECT id, role FROM users WHERE email = ? LIMIT 1', [email], (lookupErr, rows) => {
                if (!lookupErr && rows?.[0]) {
                    logAuditEvent({ req, userId: rows[0].id, role: rows[0].role, action: 'edit', module: 'Authentication', details: 'Password changed successfully', result: 'success' });
                }
            });
            return res.json({ message: "Password changed successfully" });
        });
    } catch (err) {
        return res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;