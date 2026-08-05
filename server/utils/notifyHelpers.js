const nodemailer = require('nodemailer');
const db = require('../config/db');

const getTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) return null;

    return nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass },
    });
};

const queryDb = (sql, params = []) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
    });
});

const logNotification = async (payload) => {
    try {
        await queryDb(
            `INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [payload.scholar_id || null, payload.recipient, payload.channel, payload.type, payload.status, payload.detail || null]
        );
    } catch (logErr) {
        console.error('Notification log failed:', logErr);
    }
};

const parseJsonArray = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value !== 'string') return [];

    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [parsed].filter(Boolean);
    } catch (err) {
        return [trimmed];
    }
};

const normalizeRoleList = (value) => parseJsonArray(value);

const LEVEL_MAP = {
    college_1: ['1st Year College', '1st Year'],
    college_2: ['2nd Year College', '2nd Year'],
    college_3: ['3rd Year College', '3rd Year'],
    college_4: ['4th Year College', '4th Year'],
    college_5: ['5th Year College', '5th Year'],
};

const normalizeTargetLevels = (levels) => {
    const values = [];
    const seen = new Set();

    const addValue = (value) => {
        if (!value) return;
        const text = String(value).trim();
        if (!text || seen.has(text)) return;
        seen.add(text);
        values.push(text);
    };

    for (const raw of parseJsonArray(levels)) {
        const text = String(raw).trim();
        if (!text) continue;

        const normalizedKey = text.toLowerCase();
        const mapped = LEVEL_MAP[normalizedKey];
        if (Array.isArray(mapped)) {
            mapped.forEach(addValue);
        } else {
            addValue(text);
        }
    }

    return values;
};

const buildRecipientEmailText = (title, content, scope) => {
    const intro = `You have a new ${scope} notification from Kalinga Scholar.`;
    return `${intro}\n\nTitle: ${title}\n\n${content}\n\nPlease check your dashboard for more details.`;
};

const getDutyRecipients = async (dutyId) => {
    const dutyRows = await queryDb('SELECT id, title, description, location, duty_date, time_start, time_end FROM duties WHERE id = ?', [dutyId]);
    if (!dutyRows.length) throw new Error('Duty not found');

    const rows = await queryDb(`
        SELECT DISTINCT u.id, u.scholar_id, u.full_name, u.email, u.role
        FROM duty_group_assignments dga
        JOIN scholar_group_members m ON m.group_id = dga.group_id
        JOIN users u ON u.scholar_id = m.scholar_id
        WHERE dga.duty_id = ? AND u.role = 'scholar' AND u.status = 'active'
        ORDER BY u.full_name
    `, [dutyId]);

    return { duty: dutyRows[0], recipients: rows };
};

const getAnnouncementRecipients = async (announcementId) => {
    const announcementRows = await queryDb(
        'SELECT id, title, content, target_roles, target_levels, created_by_role FROM announcements WHERE id = ? AND is_active = 1',
        [announcementId]
    );
    if (!announcementRows.length) throw new Error('Announcement not found');

    const announcement = announcementRows[0];
    const targetRoles = normalizeRoleList(announcement.target_roles);
    const targetLevels = normalizeTargetLevels(announcement.target_levels);
    const roles = targetRoles.length ? targetRoles : (announcement.created_by_role ? [announcement.created_by_role] : ['scholar', 'staff', 'officer']);

    let sql = `SELECT id, scholar_id, full_name, email, role, year_level FROM users WHERE status = 'active'`;
    const values = [];

    if (roles.includes('scholar')) {
        sql += ` AND role = 'scholar'`;
        if (targetLevels.length) {
            const placeholders = targetLevels.map(() => '?').join(', ');
            sql += ` AND (year_level IS NULL OR year_level IN (${placeholders}))`;
            values.push(...targetLevels);
        }
    } else {
        sql += ` AND role IN (${roles.map(() => '?').join(', ')})`;
        values.push(...roles);
    }

    sql += ' ORDER BY full_name';

    const rows = await queryDb(sql, values);

    return { announcement, recipients: rows };
};

exports.sendDutyNotifyEmails = (dutyId, cb) => {
    (async () => {
        const { duty, recipients } = await getDutyRecipients(dutyId);
        const transporter = getTransporter();

        if (!transporter) {
            return cb(null, { ok: false, error: 'SMTP not configured' });
        }

        if (!recipients.length) {
            return cb(null, { ok: true, sent: 0, message: 'No scholars found for this duty' });
        }

        const sent = [];
        const failures = [];
        const subject = `Kalinga Scholar — Duty Reminder: ${duty.title}`;
        const dateStr = duty.duty_date ? new Date(duty.duty_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBA';
        const timeStr = duty.time_start ? `${duty.time_start}${duty.time_end ? ' - ' + duty.time_end : ''}` : '';
        const text = `You have a new duty assigned:\n\n${duty.title}\nDate: ${dateStr}\n${timeStr ? `Time: ${timeStr}\n` : ''}Location: ${duty.location || 'TBA'}\n\n${duty.description || ''}`;

        for (const recipient of recipients) {
            try {
                const info = await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: recipient.email,
                    subject,
                    text,
                });

                sent.push({ recipient: recipient.email, messageId: info.messageId || null });
                await logNotification({
                    scholar_id: recipient.scholar_id,
                    recipient: recipient.email,
                    channel: 'email',
                    type: 'duty_notification',
                    status: 'sent',
                    detail: info.messageId || 'sent',
                });
            } catch (sendErr) {
                failures.push({ recipient: recipient.email, error: String(sendErr) });
                await logNotification({
                    scholar_id: recipient.scholar_id,
                    recipient: recipient.email,
                    channel: 'email',
                    type: 'duty_notification',
                    status: 'failed',
                    detail: String(sendErr),
                });
            }
        }

        cb(null, {
            ok: failures.length === 0,
            duty_id: duty.id,
            duty_title: duty.title,
            sent_count: sent.length,
            failed_count: failures.length,
            sent,
            failures,
        });
    })().catch((err) => cb(err));
};

exports.sendWelcomeEmail = (user, plainPassword, cb) => {
    (async () => {
        const transporter = getTransporter();
        if (!transporter) return cb(null, { ok: false, error: 'SMTP not configured' });
        if (!user.email) return cb(null, { ok: false, error: 'No email on file for this user' });

        const subject = 'Welcome to Kalinga Scholar — Your Account Details';
        const text = `Hello ${user.full_name || ''},\n\n` +
            `An account has been created for you on Kalinga Scholar.\n\n` +
            `Login ID: ${user.generatedId}\n` +
            `Email: ${user.email}\n` +
            `Temporary Password: ${plainPassword}\n\n` +
            `Please log in and change your password immediately, as required on first login.\n\n` +
            `— Kalinga at Pag-ibig Foundation`;

        try {
            const info = await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: user.email,
                subject,
                text,
            });
            await logNotification({
                scholar_id: user.generatedId,
                recipient: user.email,
                channel: 'email',
                type: 'welcome_email',
                status: 'sent',
                detail: info.messageId || 'sent',
            });
            cb(null, { ok: true, sent: true });
        } catch (err) {
            await logNotification({
                scholar_id: user.generatedId,
                recipient: user.email,
                channel: 'email',
                type: 'welcome_email',
                status: 'failed',
                detail: String(err),
            });
            cb(null, { ok: false, error: String(err) });
        }
    })().catch((err) => cb(err));
};

exports.sendAnnouncementNotifyEmails = (announcementId, cb) => {
    (async () => {
        const { announcement, recipients } = await getAnnouncementRecipients(announcementId);
        const transporter = getTransporter();

        if (!transporter) {
            return cb(null, { ok: false, error: 'SMTP not configured' });
        }

        if (!recipients.length) {
            return cb(null, { ok: true, sent: 0, message: 'No matching recipients found for this announcement' });
        }

        const sent = [];
        const failures = [];
        const subject = `Kalinga Scholar — Announcement: ${announcement.title}`;
        const text = buildRecipientEmailText(announcement.title, announcement.content, 'announcement');

        for (const recipient of recipients) {
            try {
                const info = await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: recipient.email,
                    subject,
                    text,
                });

                sent.push({ recipient: recipient.email, messageId: info.messageId || null });
                await logNotification({
                    scholar_id: recipient.scholar_id,
                    recipient: recipient.email,
                    channel: 'email',
                    type: 'announcement_notification',
                    status: 'sent',
                    detail: info.messageId || 'sent',
                });
            } catch (sendErr) {
                failures.push({ recipient: recipient.email, error: String(sendErr) });
                await logNotification({
                    scholar_id: recipient.scholar_id,
                    recipient: recipient.email,
                    channel: 'email',
                    type: 'announcement_notification',
                    status: 'failed',
                    detail: String(sendErr),
                });
            }
        }

        cb(null, {
            ok: failures.length === 0,
            announcement_id: announcement.id,
            announcement_title: announcement.title,
            sent_count: sent.length,
            failed_count: failures.length,
            sent,
            failures,
        });
    })().catch((err) => cb(err));
};
