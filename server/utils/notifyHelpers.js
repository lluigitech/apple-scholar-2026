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

// ─── AUTOMATED TASK DEADLINE REMINDERS ─────────────────────────────────────
exports.sendTaskDeadlineReminders = async () => {
    const transporter = getTransporter();
    if (!transporter) return { ok: false, skipped: true, reason: 'SMTP not configured' };

    const tasks = await queryDb(`
        SELECT id, title, type, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date, target_year_levels
        FROM tasks
        WHERE is_active = 1 AND due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
        ORDER BY due_date ASC
    `);
    if (!tasks.length) return { ok: true, sent_count: 0, message: 'No deadlines need reminders' };

    const scholars = await queryDb(`
        SELECT scholar_id, full_name, email, year_level
        FROM users WHERE role = 'scholar' AND status = 'active' AND email IS NOT NULL AND email <> ''
    `);
    let sentCount = 0;

    const parseLevels = value => normalizeTargetLevels(value);

    for (const task of tasks) {
        const targetLevels = parseLevels(task.target_year_levels);
        const recipients = scholars.filter(scholar => !targetLevels.length || targetLevels.includes(String(scholar.year_level)));
        const daysLeft = Math.ceil((new Date(`${task.due_date}T00:00:00`) - new Date()) / 86400000);
        if (daysLeft !== 3 && daysLeft !== 0) continue;
        const reminderStage = daysLeft === 0 ? 'due-today' : 'due-3-days';
        const dueDate = new Date(`${task.due_date}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

        for (const recipient of recipients) {
            const detail = `task:${task.id}:due:${task.due_date}:stage:${reminderStage}`;
            const existing = await queryDb(
                `SELECT id FROM notification_logs WHERE scholar_id = ? AND type = 'deadline_reminder' AND detail = ? LIMIT 1`,
                [recipient.scholar_id, detail]
            );
            if (existing.length) continue;

            try {
                const info = await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: recipient.email,
                    subject: `Kalinga Scholar — Deadline Reminder: ${task.title}`,
                    text: `Hello ${recipient.full_name || 'Scholar'},\n\nYour task is due ${daysLeft === 0 ? 'today' : 'in 3 days'}.\n\nTask: ${task.title}\nType: ${task.type}\nDeadline: ${dueDate}\n\nPlease submit the requirement through your Scholar Portal.`,
                });
                await logNotification({ scholar_id: recipient.scholar_id, recipient: recipient.email, channel: 'email', type: 'deadline_reminder', status: 'sent', detail });
                sentCount += 1;
                if (info?.messageId) console.log(`[deadline-reminder] sent to ${recipient.email} for task ${task.id}`);
            } catch (sendErr) {
                await logNotification({ scholar_id: recipient.scholar_id, recipient: recipient.email, channel: 'email', type: 'deadline_reminder', status: 'failed', detail: `${detail}:${String(sendErr)}` });
            }
        }
    }

    return { ok: true, sent_count: sentCount };
};

exports.sendComplianceAlerts = async () => {
    const transporter = getTransporter();
    if (!transporter) return { ok: false, skipped: true, reason: 'SMTP not configured' };

    const [tasks, scholars, staff] = await Promise.all([
        queryDb(`
            SELECT id, title, type, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date, created_at, target_year_levels
            FROM tasks WHERE is_active = 1 AND due_date < CURDATE()
        `),
        queryDb(`
            SELECT scholar_id, full_name, email, year_level FROM users
            WHERE role = 'scholar' AND status = 'active' AND email IS NOT NULL AND email <> ''
        `),
        queryDb(`
            SELECT id, email, full_name FROM users
            WHERE role IN ('admin', 'staff', 'officer') AND status = 'active' AND email IS NOT NULL AND email <> ''
        `),
    ]);

    const typeMap = { 'Monthly Report': 'letter', 'Report Card': 'report_card', 'COR Upload': 'cor' };
    const today = new Date().toISOString().slice(0, 10);
    let sentCount = 0;

    for (const task of tasks) {
        const targetLevels = normalizeTargetLevels(task.target_year_levels);
        const taskType = typeMap[task.type];
        if (!taskType) continue;
        const recipients = scholars.filter(scholar => !targetLevels.length || targetLevels.includes(String(scholar.year_level)));

        for (const scholar of recipients) {
            const records = taskType === 'report_card'
                ? await queryDb(`SELECT created_at AS submitted_at FROM grades WHERE scholar_id = ? AND verification_status = 'approved' AND created_at >= ? LIMIT 1`, [scholar.scholar_id, task.created_at])
                : await queryDb(`SELECT submitted_at FROM submissions WHERE scholar_id = ? AND submission_type = ? AND status = 'approved' AND submitted_at >= ? LIMIT 1`, [scholar.scholar_id, taskType, task.created_at]);
            if (records.length) continue;

            const detail = `overdue-task:${task.id}:scholar:${scholar.scholar_id}:date:${today}`;
            const existing = await queryDb(`SELECT id FROM notification_logs WHERE type = 'overdue_requirement' AND detail = ? LIMIT 1`, [detail]);
            if (existing.length) continue;
            const text = `Scholar ${scholar.full_name || scholar.scholar_id} has not completed the overdue requirement "${task.title}" (deadline: ${task.due_date}).`;
            try {
                await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: scholar.email, subject: `Overdue requirement: ${task.title}`, text: `Hello ${scholar.full_name || 'Scholar'},\n\n${text}\nPlease submit the requirement through your Scholar Portal.` });
                await logNotification({ scholar_id: scholar.scholar_id, recipient: scholar.email, channel: 'email', type: 'overdue_requirement', status: 'sent', detail });
                sentCount += 1;
                for (const recipient of staff) {
                    try {
                        await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: recipient.email, subject: `Scholar overdue requirement: ${task.title}`, text });
                        await logNotification({ scholar_id: scholar.scholar_id, recipient: recipient.email, channel: 'email', type: 'overdue_requirement', status: 'sent', detail });
                    } catch (staffErr) {
                        await logNotification({ scholar_id: scholar.scholar_id, recipient: recipient.email, channel: 'email', type: 'overdue_requirement', status: 'failed', detail: `${detail}:${String(staffErr)}` });
                    }
                }
            } catch (sendErr) {
                await logNotification({ scholar_id: scholar.scholar_id, recipient: scholar.email, channel: 'email', type: 'overdue_requirement', status: 'failed', detail: `${detail}:${String(sendErr)}` });
            }
        }
    }

    const risks = await queryDb(`
        SELECT u.scholar_id, u.full_name, COUNT(s.id) AS negative_letters
        FROM users u JOIN submissions s ON s.scholar_id = u.scholar_id
        WHERE u.role = 'scholar' AND u.status = 'active' AND s.submission_type = 'letter'
          AND s.sentiment_label LIKE '%Negative%' AND s.submitted_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        GROUP BY u.scholar_id, u.full_name HAVING COUNT(s.id) >= 2
    `);
    for (const risk of risks) {
        const detail = `repeated-risk:${risk.scholar_id}:date:${today}`;
        const existing = await queryDb(`SELECT id FROM notification_logs WHERE type = 'repeated_risk_flag' AND detail = ? LIMIT 1`, [detail]);
        if (existing.length) continue;
        const recipient = staff[0];
        if (!recipient) continue;
        const text = `${risk.full_name || risk.scholar_id} has ${risk.negative_letters} negative correspondence flags in the last 90 days and needs follow-up.`;
        try {
            await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: recipient.email, subject: `Repeated risk flag: ${risk.full_name || risk.scholar_id}`, text });
            await logNotification({ scholar_id: risk.scholar_id, recipient: recipient.email, channel: 'email', type: 'repeated_risk_flag', status: 'sent', detail });
            sentCount += 1;
        } catch (sendErr) {
            await logNotification({ scholar_id: risk.scholar_id, recipient: recipient.email, channel: 'email', type: 'repeated_risk_flag', status: 'failed', detail: `${detail}:${String(sendErr)}` });
        }
    }

    return { ok: true, sent_count: sentCount };
};
