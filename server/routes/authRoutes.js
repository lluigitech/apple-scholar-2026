const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAuditEvent } = require('../utils/auditLogger');
const { verifyToken } = require('../middleware/authMiddleware');
const { sendPasswordResetEmail } = require('../utils/notifyHelpers');
const authController = require('../controllers/authController');

const jwtSecret = process.env.JWT_SECRET || 'apple_scholar_secret_2026';

const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const birth = new Date(`${birthDate}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const beforeBirthday = today.getMonth() < birth.getMonth()
        || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
    if (beforeBirthday) age -= 1;
    return age >= 0 && age <= 120 ? age : null;
};

console.log('[authRoutes] module loaded');

router.post('/forgot-password', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const response = { message: 'If an account uses that email, a password reset link has been sent.' };
    if (!email) return res.json(response);

    db.query('SELECT id, scholar_id, full_name, email FROM users WHERE LOWER(email) = ? LIMIT 1', [email], (err, users) => {
        if (err || !users.length) return res.json(response);

        const resetToken = jwt.sign({ id: users[0].id, purpose: 'password_reset' }, jwtSecret, { expiresIn: '15m' });
        const portalUrl = `${(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '')}/forgot-password?token=${encodeURIComponent(resetToken)}`;
        sendPasswordResetEmail(users[0], portalUrl, (mailErr) => {
            if (mailErr) console.error('[PASSWORD RESET EMAIL ERROR]', mailErr);
        });
        return res.json(response);
    });
});

router.post('/reset-password', async (req, res) => {
    const { token, new_password } = req.body || {};
    if (!token || !new_password || String(new_password).length < 8) {
        return res.status(400).json({ error: 'A valid reset token and a password of at least 8 characters are required.' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        if (decoded.purpose !== 'password_reset') throw new Error('Invalid reset purpose');
        const hashedPassword = await bcrypt.hash(new_password, 10);
        db.query('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?', [hashedPassword, decoded.id], (err, result) => {
            if (err) return res.status(500).json({ error: 'Unable to reset password.' });
            if (!result.affectedRows) return res.status(400).json({ error: 'Reset link is invalid or expired.' });
            return res.json({ message: 'Password reset successfully.' });
        });
    } catch {
        return res.status(400).json({ error: 'Reset link is invalid or expired.' });
    }
});

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
            const currentAge = calculateAge(user.birth_date);
            if (currentAge !== null && currentAge !== Number(user.age)) {
                db.query('UPDATE users SET age = ? WHERE id = ?', [currentAge, user.id], (ageError) => {
                    if (ageError) console.warn('[LOGIN] age refresh failed:', ageError.message);
                });
            }

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
                must_change_password: user.must_change_password === 1,
                birth_date: user.birth_date || null,
                age: currentAge ?? user.age ?? null,
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
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;