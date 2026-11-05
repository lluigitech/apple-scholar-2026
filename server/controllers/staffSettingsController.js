const db = require('../config/db');
const bcrypt = require('bcryptjs');

const notificationKeys = [
    'announcements',
    'task_assignments',
    'duty_attendance',
    'submission_updates',
    'makeup_requests',
    'system_updates',
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const query = (sql, values) => db.promise().query(sql, values);

const verifyStaffPassword = async (staffId, password) => {
    if (typeof password !== 'string' || !password) {
        return { valid: false, status: 401, error: 'Enter your current password to save Staff settings.' };
    }
    const [rows] = await query(
        'SELECT password FROM users WHERE id = ? AND role = ? LIMIT 1',
        [staffId, 'staff']
    );
    if (!rows.length) return { valid: false, status: 404, error: 'Staff account not found.' };
    const storedPassword = String(rows[0].password || '');
    const valid = storedPassword.startsWith('$2')
        ? await bcrypt.compare(password, storedPassword)
        : password === storedPassword;
    return valid
        ? { valid: true }
        : { valid: false, status: 401, error: 'The current password is incorrect.' };
};

exports.verifyPassword = async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).length !== 1
        || typeof body.currentPassword !== 'string' || !body.currentPassword) {
        return res.status(400).json({ error: 'Enter your current password.' });
    }
    try {
        const result = await verifyStaffPassword(req.user.id, body.currentPassword);
        if (!result.valid) return res.status(result.status).json({ error: result.error });
        return res.json({ verified: true });
    } catch (error) {
        console.error('Failed to verify Staff settings password:', error);
        return res.status(500).json({ error: 'Failed to verify current password.' });
    }
};

const loadStaffProfile = async (staffId) => {
    const [rows] = await query(
        `SELECT scholar_id AS staff_id, full_name, email, role, status
         FROM users
         WHERE id = ? AND role = 'staff'
         LIMIT 1`,
        [staffId]
    );
    return rows[0] || null;
};

exports.getProfile = async (req, res) => {
    try {
        const profile = await loadStaffProfile(req.user.id);
        if (!profile) return res.status(404).json({ error: 'Staff profile not found.' });
        return res.json(profile);
    } catch (error) {
        console.error('Failed to load staff profile:', error);
        return res.status(500).json({ error: 'Failed to load staff profile.' });
    }
};

exports.updateProfile = async (req, res) => {
    const body = req.body;
    const allowedFields = new Set(['full_name', 'email', 'currentPassword']);
    if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).some(key => !allowedFields.has(key)) ||
        typeof body.full_name !== 'string' ||
        typeof body.email !== 'string' ||
        typeof body.currentPassword !== 'string' ||
        !body.currentPassword
    ) {
        return res.status(400).json({ error: 'Provide profile fields and your current password.' });
    }

    const fullName = body.full_name.trim();
    const email = body.email.trim().toLowerCase();
    if (!fullName || fullName.length > 255) {
        return res.status(400).json({ error: 'Full name is required and must not exceed 255 characters.' });
    }
    if (!emailPattern.test(email) || email.length > 255) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    try {
        const passwordCheck = await verifyStaffPassword(req.user.id, body.currentPassword);
        if (!passwordCheck.valid) return res.status(passwordCheck.status).json({ error: passwordCheck.error });
        const [result] = await query(
            `UPDATE users SET full_name = ?, email = ?
             WHERE id = ? AND role = 'staff'`,
            [fullName, email, req.user.id]
        );
        if (!result.affectedRows) {
            const currentProfile = await loadStaffProfile(req.user.id);
            if (!currentProfile) return res.status(404).json({ error: 'Staff profile not found.' });
            if (
                currentProfile.full_name !== fullName ||
                currentProfile.email !== email
            ) {
                return res.status(500).json({ error: 'Failed to update staff profile.' });
            }
        }

        const profile = await loadStaffProfile(req.user.id);
        if (!profile) return res.status(404).json({ error: 'Staff profile not found.' });
        return res.json(profile);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'That email address is already in use.' });
        }
        console.error('Failed to update staff profile:', error);
        return res.status(500).json({ error: 'Failed to update staff profile.' });
    }
};

exports.getNotificationPreferences = async (req, res) => {
    try {
        await query(
            `INSERT IGNORE INTO staff_notification_preferences_v2 (staff_id)
             SELECT id FROM users WHERE id = ? AND role = 'staff'`,
            [req.user.id]
        );
        const [rows] = await query(
            `SELECT ${notificationKeys.join(', ')}
             FROM staff_notification_preferences_v2
             WHERE staff_id = ?
             LIMIT 1`,
            [req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Staff notification settings not found.' });
        return res.json(Object.fromEntries(notificationKeys.map(key => [key, Boolean(rows[0][key])])));
    } catch (error) {
        console.error('Failed to load staff notification preferences:', error);
        return res.status(500).json({ error: 'Failed to load notification preferences.' });
    }
};

exports.updateNotificationPreferences = async (req, res) => {
    const body = req.body;
    const settings = body && typeof body === 'object' && !Array.isArray(body)
        ? Object.fromEntries(notificationKeys.filter(key => Object.prototype.hasOwnProperty.call(body, key)).map(key => [key, body[key]]))
        : null;
    const allowedFields = new Set([...notificationKeys, 'currentPassword']);
    if (
        !settings ||
        Object.keys(settings).length !== notificationKeys.length ||
        notificationKeys.some(key => typeof settings[key] !== 'boolean') ||
        typeof body.currentPassword !== 'string' ||
        !body.currentPassword ||
        Object.keys(body).some(key => !allowedFields.has(key))
    ) {
        return res.status(400).json({ error: 'Provide all notification preferences and your current password.' });
    }

    try {
        const passwordCheck = await verifyStaffPassword(req.user.id, body.currentPassword);
        if (!passwordCheck.valid) return res.status(passwordCheck.status).json({ error: passwordCheck.error });
        await query(
            `INSERT IGNORE INTO staff_notification_preferences_v2 (staff_id)
             SELECT id FROM users WHERE id = ? AND role = 'staff'`,
            [req.user.id]
        );
        const [users] = await query(
            `SELECT id FROM users WHERE id = ? AND role = 'staff' LIMIT 1`,
            [req.user.id]
        );
        if (!users.length) return res.status(404).json({ error: 'Staff account not found.' });

        await query(
            `UPDATE staff_notification_preferences_v2
             SET ${notificationKeys.map(key => `${key} = ?`).join(', ')}
             WHERE staff_id = ?`,
            [...notificationKeys.map(key => settings[key]), req.user.id]
        );

        const [rows] = await query(
            `SELECT ${notificationKeys.join(', ')}
             FROM staff_notification_preferences_v2
             WHERE staff_id = ?
             LIMIT 1`,
            [req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Staff notification settings not found.' });
        return res.json(Object.fromEntries(notificationKeys.map(key => [key, Boolean(rows[0][key])])));
    } catch (error) {
        console.error('Failed to save staff notification preferences:', error);
        return res.status(500).json({ error: 'Failed to save notification preferences.' });
    }
};
