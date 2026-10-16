const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { logAuditEvent } = require('../utils/auditLogger');

exports.changePassword = async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (
        typeof current_password !== 'string' ||
        typeof new_password !== 'string' ||
        !current_password ||
        new_password.length < 8
    ) {
        return res.status(400).json({
            error: 'Current password and a new password of at least 8 characters are required.',
        });
    }

    try {
        const [users] = await db.promise().query(
            'SELECT id, email, role, password FROM users WHERE id = ? LIMIT 1',
            [req.user.id]
        );
        if (!users.length) return res.status(404).json({ error: 'User not found.' });

        const user = users[0];
        const currentMatches = user.password?.startsWith('$2')
            ? await bcrypt.compare(current_password, user.password)
            : current_password === String(user.password || '');
        if (!currentMatches) return res.status(401).json({ error: 'Current password is incorrect.' });
        if (current_password === new_password) {
            return res.status(400).json({ error: 'New password must be different from the current password.' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        const [result] = await db.promise().query(
            'UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?',
            [hashedPassword, req.user.id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'User not found.' });

        await logAuditEvent({
            req,
            userId: user.id,
            role: user.role,
            action: 'edit',
            module: 'Authentication',
            details: 'Password changed successfully',
            result: 'success',
        });
        return res.json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Failed to change account password:', error);
        return res.status(500).json({ error: 'Failed to change password.' });
    }
};
