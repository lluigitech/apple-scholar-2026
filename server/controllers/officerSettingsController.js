const db = require('../config/db');
const { getAssignedYearLevels } = require('../utils/officerAssignments');

const notificationKeys = [
    'new_submissions',
    'pending_reviews',
    'deadlines',
    'returned_submissions',
    'announcements',
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const query = (sql, values) => db.promise().query(sql, values);

exports.getProfile = async (req, res) => {
    try {
        const [[users], assignedYearLevels] = await Promise.all([
            query(
                `SELECT id AS officer_id, full_name, email, phone AS contact_number, role, created_at
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
    const allowedFields = new Set(['full_name', 'email', 'contact_number']);
    if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).some(key => !allowedFields.has(key)) ||
        typeof body.full_name !== 'string' ||
        typeof body.email !== 'string' ||
        typeof body.contact_number !== 'string'
    ) {
        return res.status(400).json({ error: 'Only full_name, email, and contact_number are accepted.' });
    }

    const fullName = body.full_name.trim();
    const email = body.email.trim().toLowerCase();
    const contactNumber = body.contact_number.trim();
    if (!fullName || fullName.length > 255) {
        return res.status(400).json({ error: 'Full name is required and must not exceed 255 characters.' });
    }
    if (!emailPattern.test(email) || email.length > 254) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (contactNumber.length > 64) {
        return res.status(400).json({ error: 'Contact number must not exceed 64 characters.' });
    }

    try {
        const [result] = await query(
            `UPDATE users
             SET full_name = ?, email = ?, phone = ?
             WHERE id = ? AND role = 'officer'`,
            [fullName, email, contactNumber || null, req.user.id]
        );
        if (!result.affectedRows) {
            const [users] = await query(
                'SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1',
                [req.user.id, 'officer']
            );
            if (!users.length) return res.status(404).json({ error: 'Officer profile not found.' });
            const [[current]] = await query(
                `SELECT full_name, email, phone AS contact_number
                 FROM users WHERE id = ? AND role = 'officer' LIMIT 1`,
                [req.user.id]
            );
            if (
                current.full_name !== fullName ||
                current.email !== email ||
                (current.contact_number || '') !== contactNumber
            ) {
                return res.status(500).json({ error: 'Failed to update officer profile.' });
            }
        }
        return res.json({
            full_name: fullName,
            email,
            contact_number: contactNumber,
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
            `SELECT new_submissions, pending_reviews, deadlines, returned_submissions, announcements
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
    if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).length !== notificationKeys.length ||
        notificationKeys.some(key => typeof body[key] !== 'boolean') ||
        Object.keys(body).some(key => !notificationKeys.includes(key))
    ) {
        return res.status(400).json({ error: 'Provide boolean values for all notification preferences.' });
    }

    try {
        await query(
            `INSERT INTO officer_notification_preferences
                (officer_id, new_submissions, pending_reviews, deadlines, returned_submissions, announcements)
             SELECT id, ?, ?, ?, ?, ?
             FROM users
             WHERE id = ? AND role = 'officer'
             ON DUPLICATE KEY UPDATE
                new_submissions = VALUES(new_submissions),
                pending_reviews = VALUES(pending_reviews),
                deadlines = VALUES(deadlines),
                returned_submissions = VALUES(returned_submissions),
                announcements = VALUES(announcements)`,
            [...notificationKeys.map(key => body[key]), req.user.id]
        );
        const [users] = await query(
            'SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1',
            [req.user.id, 'officer']
        );
        if (!users.length) return res.status(404).json({ error: 'Officer account not found.' });
        return res.json(Object.fromEntries(notificationKeys.map(key => [key, body[key]])));
    } catch (error) {
        console.error('Failed to save officer notification preferences:', error);
        return res.status(500).json({ error: 'Failed to save notification preferences.' });
    }
};
