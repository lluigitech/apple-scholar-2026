const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { getAssignedYearLevels } = require('../utils/officerAssignments');

const notificationKeys = [
    'new_submissions',
    'pending_reviews',
    'deadlines',
    'announcements',
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const query = (sql, values) => db.promise().query(sql, values);

const verifyOfficerPassword = async (officerId, password) => {
    if (typeof password !== 'string' || !password) {
        return { valid: false, status: 401, error: 'Enter your current password to save Officer settings.' };
    }
    const [rows] = await query(
        'SELECT password FROM users WHERE id = ? AND role = ? LIMIT 1',
        [officerId, 'officer']
    );
    if (!rows.length) return { valid: false, status: 404, error: 'Officer account not found.' };
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
        const result = await verifyOfficerPassword(req.user.id, body.currentPassword);
        if (!result.valid) return res.status(result.status).json({ error: result.error });
        return res.json({ verified: true });
    } catch (error) {
        console.error('Failed to verify Officer settings password:', error);
        return res.status(500).json({ error: 'Failed to verify current password.' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const [[users], assignedYearLevels] = await Promise.all([
            query(
                `SELECT scholar_id AS officer_id, full_name, email, role, created_at
                 FROM users
                 WHERE id = ? AND role = 'officer'
                 LIMIT 1`,
                [req.user.id]
            ),
            getAssignedYearLevels(req.user.id),
        ]);
        if (!users.length) return res.status(404).json({ error: 'Officer profile not found.' });
        return res.json({ ...users[0], assigned_year_levels: assignedYearLevels });
    } catch (error) {
        console.error('Failed to load officer profile:', error);
        return res.status(500).json({ error: 'Failed to load officer profile.' });
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
        typeof body.currentPassword !== 'string'
    ) {
        return res.status(400).json({ error: 'Provide profile fields and your current password.' });
    }

    const fullName = body.full_name.trim();
    const email = body.email.trim().toLowerCase();
    if (!fullName || fullName.length > 255) {
        return res.status(400).json({ error: 'Full name is required and must not exceed 255 characters.' });
    }
    if (!emailPattern.test(email) || email.length > 254) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    try {
        const passwordCheck = await verifyOfficerPassword(req.user.id, body.currentPassword);
        if (!passwordCheck.valid) return res.status(passwordCheck.status).json({ error: passwordCheck.error });
        const [result] = await query(
            `UPDATE users
             SET full_name = ?, email = ?
             WHERE id = ? AND role = 'officer'`,
            [fullName, email, req.user.id]
        );
        if (!result.affectedRows) {
            const [users] = await query(
                'SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1',
                [req.user.id, 'officer']
            );
            if (!users.length) return res.status(404).json({ error: 'Officer profile not found.' });
            const [[current]] = await query(
                `SELECT full_name, email
                 FROM users WHERE id = ? AND role = 'officer' LIMIT 1`,
                [req.user.id]
            );
            if (
                current.full_name !== fullName ||
                current.email !== email
            ) {
                return res.status(500).json({ error: 'Failed to update officer profile.' });
            }
        }
        return res.json({
            full_name: fullName,
            email,
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'That email address is already in use.' });
        }
        console.error('Failed to update officer profile:', error);
        return res.status(500).json({ error: 'Failed to update officer profile.' });
    }
};

exports.getNotificationPreferences = async (req, res) => {
    try {
        await query(
            `INSERT IGNORE INTO officer_notification_preferences (officer_id)
             SELECT id FROM users WHERE id = ? AND role = 'officer'`,
            [req.user.id]
        );
        const [rows] = await query(
            `SELECT new_submissions, pending_reviews, deadlines, announcements
             FROM officer_notification_preferences
             WHERE officer_id = ?
             LIMIT 1`,
            [req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Officer notification settings not found.' });
        return res.json(Object.fromEntries(notificationKeys.map(key => [key, Boolean(rows[0][key])])));
    } catch (error) {
        console.error('Failed to load officer notification preferences:', error);
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
        Object.keys(body).some(key => !allowedFields.has(key))
    ) {
        return res.status(400).json({ error: 'Provide boolean values for all notification preferences and your current password.' });
    }

    try {
        const passwordCheck = await verifyOfficerPassword(req.user.id, body.currentPassword);
        if (!passwordCheck.valid) return res.status(passwordCheck.status).json({ error: passwordCheck.error });
        await query(
            `INSERT INTO officer_notification_preferences
                (officer_id, new_submissions, pending_reviews, deadlines, announcements)
             SELECT id, ?, ?, ?, ?
             FROM users
             WHERE id = ? AND role = 'officer'
             ON DUPLICATE KEY UPDATE
                new_submissions = VALUES(new_submissions),
                pending_reviews = VALUES(pending_reviews),
                deadlines = VALUES(deadlines),
                announcements = VALUES(announcements)`,
            [...notificationKeys.map(key => settings[key]), req.user.id]
        );
        const [users] = await query(
            'SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1',
            [req.user.id, 'officer']
        );
        if (!users.length) return res.status(404).json({ error: 'Officer account not found.' });
        return res.json(settings);
    } catch (error) {
        console.error('Failed to save officer notification preferences:', error);
        return res.status(500).json({ error: 'Failed to save notification preferences.' });
    }
};
