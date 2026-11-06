const nodemailer = require('nodemailer');
const db = require('../config/db');
const {
    buildDutyReminderEmail,
    buildMakeupDutyAssignmentEmail,
    buildWelcomeEmail,
    buildPasswordResetEmail,
    buildAnnouncementEmail,
    buildDeadlineReminderEmail,
    buildRepeatedRiskEmail,
    buildUnsubmittedTaskSummaryEmail,
    buildTaskDeadlineSummaryEmail,
} = require('./emailTemplates');

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

const getPortalUrl = (path = '') => {
    const baseUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
    try {
        const parsed = new URL(baseUrl);
        return ['http:', 'https:'].includes(parsed.protocol) ? `${parsed.href.replace(/\/+$/, '')}${path}` : undefined;
    } catch (error) {
        console.error('Invalid CLIENT_URL for notification links:', error.message);
        return undefined;
    }
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

const normalizeYearLevel = (value) => {
    const normalized = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const collegeMatch = normalized.match(/^(?:college\s*(\d+)|(\d+)(?:st|nd|rd|th)?\s+year(?:\s+college)?)$/);
    if (collegeMatch) return `college ${collegeMatch[1] || collegeMatch[2]}`;
    const gradeMatch = normalized.match(/^grade\s*(\d+)$/);
    return gradeMatch ? `grade ${gradeMatch[1]}` : normalized;
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

    let sql = `SELECT u.id, u.scholar_id, u.full_name, u.email, u.role, u.year_level, p.settings_json AS preferences
               FROM users u LEFT JOIN admin_preferences p ON p.user_id = u.id
               WHERE u.status = 'active'`;
    const values = [];

    if (roles.includes('scholar')) {
        sql += ` AND u.role = 'scholar'`;
        if (targetLevels.length) {
            const placeholders = targetLevels.map(() => '?').join(', ');
            sql += ` AND (u.year_level IS NULL OR u.year_level IN (${placeholders}))`;
            values.push(...targetLevels);
        }
    } else {
        sql += ` AND u.role IN (${roles.map(() => '?').join(', ')})`;
        values.push(...roles);
    }

    sql += ' ORDER BY u.full_name';

    const rows = await queryDb(sql, values);
    const eligibleRecipients = rows.filter((recipient) => {
        if (recipient.role !== 'admin') return true;
        try {
            const preferences = recipient.preferences ? JSON.parse(recipient.preferences) : {};
            return preferences.emailNotifications !== false;
        } catch (error) {
            console.error('Invalid administrator notification preferences:', error);
            return true;
        }
    });

    return { announcement, recipients: eligibleRecipients };
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
                    html: buildDutyReminderEmail({
                        recipientName: recipient.full_name,
                        duty,
                        actionUrl: getPortalUrl('/scholar/duties'),
                    }),
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

exports.sendMakeupDutyAssignmentEmails = (scholarId, sourceDutyId, makeupDutyId, cb) => {
    (async () => {
        const [duties, scholars, staff] = await Promise.all([
            queryDb(
                `SELECT id, title, duty_date, time_start, time_end, location
                 FROM duties WHERE id = ? LIMIT 1`,
                [makeupDutyId]
            ),
            queryDb(
                `SELECT scholar_id, full_name, email
                 FROM users WHERE scholar_id = ? AND role = 'scholar' AND status = 'active' LIMIT 1`,
                [scholarId]
            ),
            queryDb(`
                SELECT DISTINCT u.id, u.full_name, u.email, preferences.makeup_requests
                FROM duty_group_assignments dga
                JOIN scholar_groups g ON g.id = dga.group_id
                JOIN users u ON u.id = g.assigned_staff_id
                    AND LOWER(u.role) = 'staff' AND u.status = 'active'
                LEFT JOIN staff_notification_preferences_v2 preferences ON preferences.staff_id = u.id
                WHERE dga.duty_id = ? AND u.email IS NOT NULL AND u.email <> ''
            `, [makeupDutyId]),
        ]);
        if (!duties.length) throw new Error('Makeup duty not found');
        if (!scholars.length) throw new Error('Active scholar not found');

        const scholar = scholars[0];
        const detail = `source:${sourceDutyId}:makeup:${makeupDutyId}:scholar:${scholarId}`;
        const recipients = [];
        if (scholar.email) recipients.push({ ...scholar, role: 'scholar', actionPath: '/scholar/duties' });
        for (const recipient of staff) {
            if (recipient.makeup_requests === 0) continue;
            recipients.push({ ...recipient, role: 'staff', actionPath: '/staff/duties' });
        }

        const transporter = getTransporter();
        if (!transporter) {
            return cb(null, {
                ok: false,
                sent_count: 0,
                failed_count: recipients.length,
                error: 'SMTP not configured',
            });
        }

        let sentCount = 0;
        const failures = [];
        for (const recipient of recipients) {
            try {
                const alreadySent = await queryDb(
                    `SELECT id FROM notification_logs
                     WHERE recipient = ? AND type = 'makeup_duty_assignment' AND detail = ? AND status = 'sent'
                     LIMIT 1`,
                    [recipient.email, detail]
                );
                if (alreadySent.length) continue;

                const text = recipient.role === 'scholar'
                    ? `Hello ${recipient.full_name || 'Scholar'},\n\nYou have been assigned to makeup duty "${duties[0].title}" on ${duties[0].duty_date}.\nPlease attend the duty to make up for the missed duty.`
                    : `Hello ${recipient.full_name || 'Staff'},\n\n${scholar.full_name || scholar.scholar_id} (${scholar.scholar_id}) has been assigned to makeup duty "${duties[0].title}" on ${duties[0].duty_date}.\nPlease note the scholar in the duty attendance list.`;
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: recipient.email,
                    subject: `Makeup duty assigned: ${duties[0].title}`,
                    text,
                    html: buildMakeupDutyAssignmentEmail({
                        recipientName: recipient.full_name,
                        scholarName: scholar.full_name,
                        scholarId: scholar.scholar_id,
                        duty: duties[0],
                        recipientRole: recipient.role,
                        actionUrl: getPortalUrl(recipient.actionPath),
                    }),
                });
                await logNotification({
                    scholar_id: recipient.role === 'scholar' ? scholar.scholar_id : null,
                    recipient: recipient.email,
                    channel: 'email',
                    type: 'makeup_duty_assignment',
                    status: 'sent',
                    detail,
                });
                sentCount += 1;
            } catch (error) {
                failures.push({ recipient: recipient.email, error: String(error.message || error) });
                await logNotification({
                    scholar_id: recipient.role === 'scholar' ? scholar.scholar_id : null,
                    recipient: recipient.email,
                    channel: 'email',
                    type: 'makeup_duty_assignment',
                    status: 'failed',
                    detail: `${detail}:${String(error.message || error)}`,
                });
            }
        }
        cb(null, { ok: failures.length === 0, sent_count: sentCount, failed_count: failures.length, failures });
    })().catch(error => cb(error));
};

exports.sendWelcomeEmail = (user, plainPassword, cb) => {
    (async () => {
        const transporter = getTransporter();
        if (!transporter) return cb(null, { ok: false, error: 'SMTP not configured' });
        if (!user.email) return cb(null, { ok: false, error: 'No email on file for this user' });

        const subject = 'Welcome to Kalinga Scholar — Your Account Details';
        const portalUrl = `${(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '')}/account/setup`;
        const text = `Hello ${user.full_name || ''},\n\n` +
            `An account has been created for you on Kalinga Scholar.\n\n` +
            `Login ID: ${user.generatedId}\n` +
            `Email: ${user.email}\n` +
            `Temporary Password: ${plainPassword}\n\n` +
            `Complete your account setup here: ${portalUrl}\n\n` +
            `Please log in and change your password immediately, as required on first login.\n\n` +
            `— Kalinga at Pag-ibig Foundation`;

        try {
            const info = await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: user.email,
                subject,
                text,
                html: buildWelcomeEmail({
                    fullName: user.full_name,
                    loginId: user.generatedId,
                    email: user.email,
                    temporaryPassword: plainPassword,
                    setupUrl: portalUrl,
                }),
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

exports.sendPasswordResetEmail = (user, resetUrl, cb) => {
    (async () => {
        const transporter = getTransporter();
        if (!transporter) return cb(null, { ok: false, error: 'SMTP not configured' });

        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: user.email,
            subject: 'Kalinga Scholar - Reset your password',
            text: `Hello ${user.full_name || ''},\n\nUse this link to reset your Scholar Portal password:\n${resetUrl}\n\nThis link expires in 15 minutes. If you did not request this, you can ignore this email.`,
            html: buildPasswordResetEmail({
                fullName: user.full_name,
                resetUrl,
                expiresInMinutes: 15,
            }),
        });
        await logNotification({
            scholar_id: user.scholar_id,
            recipient: user.email,
            channel: 'email',
            type: 'password_reset',
            status: 'sent',
            detail: info.messageId || 'sent',
        });
        cb(null, { ok: true, sent: true });
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
                    html: buildAnnouncementEmail({
                        title: announcement.title,
                        content: announcement.content,
                        actionUrl: getPortalUrl({
                            scholar: '/scholar/announcements',
                            officer: '/officer/announcements',
                            staff: '/staff/announcements',
                            admin: '/admin/announcements',
                        }[String(recipient.role || '').toLowerCase()] || '/'),
                    }),
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
                    html: buildDeadlineReminderEmail({
                        recipientName: recipient.full_name,
                        taskTitle: task.title,
                        taskType: task.type,
                        dueDate: task.due_date,
                        daysLeft,
                        actionUrl: getPortalUrl('/scholar/submission'),
                    }),
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

    const [tasks, expiredTasks, scholars, assignedOfficers, staff] = await Promise.all([
        queryDb(`
            SELECT id, title, type, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date, created_at, target_year_levels
            FROM tasks
            WHERE is_active = 1 AND due_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            ORDER BY due_date ASC, id ASC
        `),
        queryDb(`
            SELECT t.id, t.title, t.type, DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
                   t.created_at, t.target_year_levels, u.email AS creator_email,
                   u.full_name AS creator_name, p.settings_json AS creator_preferences
            FROM tasks t
            JOIN users u ON u.id = t.created_by
            LEFT JOIN admin_preferences p ON p.user_id = u.id
            WHERE t.is_active = 1 AND t.created_by_role = 'admin'
              AND t.due_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
              AND u.role = 'admin' AND u.status = 'active'
              AND u.email IS NOT NULL AND u.email <> ''
            ORDER BY t.due_date ASC, t.id ASC
        `),
        queryDb(`
            SELECT scholar_id, full_name, year_level FROM users
            WHERE role = 'scholar' AND status = 'active'
        `),
        queryDb(`
            SELECT DISTINCT u.id, u.email, u.full_name, u.role, oya.year_level
            FROM officer_year_level_assignments oya
            JOIN users u ON u.id = oya.officer_id
            WHERE u.role = 'officer'
              AND u.status = 'active' AND u.email IS NOT NULL AND u.email <> ''
        `),
        queryDb(`
            SELECT u.id, u.email, u.full_name, u.role, p.settings_json AS preferences
            FROM users u
            LEFT JOIN admin_preferences p ON p.user_id = u.id
            WHERE u.role IN ('admin', 'staff', 'officer')
              AND u.status = 'active' AND u.email IS NOT NULL AND u.email <> ''
        `),
    ]);
    const staffRecipients = staff.filter((recipient) => {
        if (recipient.role !== 'admin') return true;
        try {
            const preferences = recipient.preferences ? JSON.parse(recipient.preferences) : {};
            return preferences.emailNotifications !== false && preferences.securityAlerts !== false;
        } catch (error) {
            console.error('Invalid administrator notification preferences:', error);
            return true;
        }
    });

    const submissionTypeMap = {
        'Monthly Report': 'letter',
        'Report Card': 'report_card',
        'COR Upload': 'cor',
        'Other Documents': 'other',
    };
    const today = new Date().toISOString().slice(0, 10);
    let sentCount = 0;

    for (const task of tasks) {
        const targetLevels = normalizeTargetLevels(task.target_year_levels);
        const submissionType = submissionTypeMap[task.type];
        if (!submissionType) continue;
        const targetedScholars = scholars.filter(scholar =>
            !targetLevels.length || targetLevels.some(level => normalizeYearLevel(level) === normalizeYearLevel(scholar.year_level))
        );
        const scholarIds = targetedScholars.map(scholar => scholar.scholar_id);
        if (!scholarIds.length) continue;

        const placeholders = scholarIds.map(() => '?').join(', ');
        const submittedRows = submissionType === 'report_card'
            ? await queryDb(
                `SELECT DISTINCT scholar_id FROM grades WHERE created_at >= ? AND scholar_id IN (${placeholders})`,
                [task.created_at, ...scholarIds]
            )
            : await queryDb(
                `SELECT DISTINCT scholar_id FROM submissions WHERE submission_type = ? AND submitted_at >= ? AND scholar_id IN (${placeholders})`,
                [submissionType, task.created_at, ...scholarIds]
            );
        const submittedIds = new Set(submittedRows.map(row => String(row.scholar_id)));
        const unsubmittedScholars = targetedScholars.filter(scholar => !submittedIds.has(String(scholar.scholar_id)));
        if (!unsubmittedScholars.length) continue;

        const detail = `task:${task.id}:due:${task.due_date}:stage:unsubmitted-summary`;
        const officersById = new Map();
        for (const assignment of assignedOfficers) {
            const officer = officersById.get(assignment.id) || { ...assignment, assignedLevels: new Set() };
            officer.assignedLevels.add(normalizeYearLevel(assignment.year_level));
            officersById.set(assignment.id, officer);
        }
        for (const recipient of officersById.values()) {
            const recipientScholars = unsubmittedScholars.filter(scholar =>
                recipient.assignedLevels.has(normalizeYearLevel(scholar.year_level))
            );
            if (!recipientScholars.length) continue;
            try {
                const alreadySent = await queryDb(
                    `SELECT id FROM notification_logs
                     WHERE recipient = ? AND type = 'unsubmitted_task_summary' AND detail = ? AND status = 'sent'
                     LIMIT 1`,
                    [recipient.email, detail]
                );
                if (alreadySent.length) continue;

                const scholarLines = recipientScholars.map((scholar, index) =>
                    `${index + 1}. ${scholar.full_name || 'Unnamed Scholar'} (${scholar.scholar_id})${scholar.year_level ? ` — ${scholar.year_level}` : ''}`
                );
                const text = `The deadline for "${task.title}" is tomorrow (${task.due_date}).\n\nScholars who have not submitted:\n${scholarLines.join('\n')}\n\nPlease review the task before it closes.`;
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: recipient.email,
                    subject: `Task deadline tomorrow: ${task.title} (${recipientScholars.length} not submitted)`,
                    text,
                    html: buildUnsubmittedTaskSummaryEmail({
                        taskTitle: task.title,
                        taskType: task.type,
                        dueDate: task.due_date,
                        scholars: recipientScholars,
                        actionUrl: getPortalUrl('/officer/task-assignment'),
                    }),
                });
                await logNotification({ recipient: recipient.email, channel: 'email', type: 'unsubmitted_task_summary', status: 'sent', detail });
                sentCount += 1;
            } catch (sendErr) {
                await logNotification({ recipient: recipient.email, channel: 'email', type: 'unsubmitted_task_summary', status: 'failed', detail: `${detail}:${String(sendErr)}` });
            }
        }
    }

    for (const task of expiredTasks) {
        try {
            const preferences = task.creator_preferences ? JSON.parse(task.creator_preferences) : {};
            if (preferences.emailNotifications === false || preferences.securityAlerts === false) continue;
        } catch (error) {
            console.error('Invalid administrator notification preferences:', error);
        }
        const detail = `task:${task.id}:due:${task.due_date}:stage:deadline-summary`;
        try {
            const alreadySent = await queryDb(
                `SELECT id FROM notification_logs
                 WHERE recipient = ? AND type = 'task_deadline_summary' AND detail = ? AND status = 'sent'
                 LIMIT 1`,
                [task.creator_email, detail]
            );
            if (alreadySent.length) continue;

            await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: task.creator_email,
                subject: `Task deadline passed: ${task.title}`,
                text: `Hello ${task.creator_name || 'Admin'},\n\nThe deadline for "${task.title}" has passed (${task.due_date}).\n\nYou can check the task now to see who submitted and who did not.`,
                html: buildTaskDeadlineSummaryEmail({
                    recipientName: task.creator_name,
                    taskTitle: task.title,
                    taskType: task.type,
                    dueDate: task.due_date,
                    actionUrl: getPortalUrl('/admin/task-assignment'),
                }),
            });
            await logNotification({ recipient: task.creator_email, channel: 'email', type: 'task_deadline_summary', status: 'sent', detail });
            sentCount += 1;
        } catch (sendErr) {
            await logNotification({ recipient: task.creator_email, channel: 'email', type: 'task_deadline_summary', status: 'failed', detail: `${detail}:${String(sendErr)}` });
        }
    }

    const risks = await queryDb(`
        SELECT u.scholar_id, u.full_name, COUNT(s.id) AS negative_letters
        FROM users u JOIN submissions s ON s.scholar_id = u.scholar_id
        WHERE u.role = 'scholar' AND u.status = 'active' AND s.submission_type = 'letter'
          AND s.sentiment_label LIKE '%Negative%' AND s.submitted_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        GROUP BY u.scholar_id, u.full_name HAVING COUNT(s.id) >= 3
    `);
    for (const risk of risks) {
        const detail = `repeated-risk:${risk.scholar_id}:date:${today}`;
        const text = `${risk.full_name || risk.scholar_id} has ${risk.negative_letters} negative correspondence flags in the last 90 days and needs follow-up.`;
        const adminRecipients = staffRecipients.filter(recipient => recipient.role === 'admin');
        for (const recipient of adminRecipients) {
            try {
                const existing = await queryDb(
                    `SELECT id FROM notification_logs
                     WHERE recipient = ? AND type = 'repeated_risk_flag' AND detail = ? AND status = 'sent'
                     LIMIT 1`,
                    [recipient.email, detail]
                );
                if (existing.length) continue;

                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: recipient.email,
                    subject: `Repeated risk flag: ${risk.full_name || risk.scholar_id}`,
                    text,
                    html: buildRepeatedRiskEmail({
                        recipientName: recipient.full_name,
                        scholarName: risk.full_name,
                        scholarId: risk.scholar_id,
                        negativeCount: risk.negative_letters,
                        actionUrl: getPortalUrl('/admin/flagged'),
                    }),
                });
                await logNotification({ scholar_id: risk.scholar_id, recipient: recipient.email, channel: 'email', type: 'repeated_risk_flag', status: 'sent', detail });
                sentCount += 1;
            } catch (sendErr) {
                await logNotification({ scholar_id: risk.scholar_id, recipient: recipient.email, channel: 'email', type: 'repeated_risk_flag', status: 'failed', detail: `${detail}:${String(sendErr)}` });
            }
        }
    }

    return { ok: true, sent_count: sentCount };
};
