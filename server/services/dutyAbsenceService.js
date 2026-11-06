const db = require('../config/db');
const nodemailer = require('nodemailer');
const { buildDutyAbsenceEmail } = require('../utils/emailTemplates');

const LOCK_NAME = 'apple-scholar-duty-absence-sweep';

const getTransporter = () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
};

const notifyDutyAbsences = async (connection, sweepStartedAt) => {
    const [rows] = await connection.query(`
        SELECT d.id AS duty_id, d.title, d.duty_date, d.time_start, d.time_end, d.location,
               creator.id AS creator_id, creator.full_name AS creator_name,
               creator.email AS creator_email, creator.role AS creator_role,
               creatorPreferences.settings_json AS creator_preferences,
               scholar.scholar_id, scholar.full_name AS scholar_name,
               staff.id AS staff_id, staff.full_name AS staff_name, staff.email AS staff_email,
               staffPreferences.duty_attendance AS staff_duty_attendance
        FROM duty_attendance da
        JOIN duties d ON d.id = da.duty_id
        JOIN scholar_group_members gm ON gm.scholar_id = da.scholar_id
        JOIN duty_group_assignments dga ON dga.duty_id = d.id AND dga.group_id = gm.group_id
        JOIN scholar_groups g ON g.id = gm.group_id
        JOIN users scholar ON scholar.scholar_id = da.scholar_id
            AND scholar.role = 'scholar' AND scholar.status = 'active'
        LEFT JOIN users creator ON creator.id = d.created_by AND creator.status = 'active'
        LEFT JOIN admin_preferences creatorPreferences ON creatorPreferences.user_id = creator.id
        LEFT JOIN users staff ON staff.id = g.assigned_staff_id
            AND LOWER(staff.role) = 'staff' AND staff.status = 'active'
        LEFT JOIN staff_notification_preferences_v2 staffPreferences ON staffPreferences.staff_id = staff.id
        WHERE da.status = 'absent' AND da.method = 'system'
          AND da.marked_at >= ?
          AND LOWER(COALESCE(d.status, '')) <> 'cancelled'
          AND TIMESTAMP(d.duty_date, COALESCE(d.time_start, '00:00:00'))
              <= DATE_SUB(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), INTERVAL 1 HOUR)
        ORDER BY d.id, scholar.full_name
    `, [sweepStartedAt]);
    if (!rows.length) return { sentCount: 0, failedCount: 0 };

    const transporter = getTransporter();
    if (!transporter) {
        console.error('[duty-absence] SMTP is not configured; absence emails were not sent.');
        return { sentCount: 0, failedCount: 0 };
    }

    const dutyGroups = new Map();
    for (const row of rows) {
        const group = dutyGroups.get(row.duty_id) || { duty: row, recipients: new Map() };
        const addRecipient = (recipient, scholar, role) => {
            if (!recipient.email) return;
            const key = recipient.email.toLowerCase();
            const entry = group.recipients.get(key) || {
                ...recipient,
                role,
                scholars: new Map(),
            };
            entry.scholars.set(scholar.scholar_id, {
                scholar_id: scholar.scholar_id,
                full_name: scholar.scholar_name,
            });
            group.recipients.set(key, entry);
        };

        const scholar = { scholar_id: row.scholar_id, scholar_name: row.scholar_name };
        if (row.creator_email) {
            let shouldNotifyCreator = true;
            if (row.creator_role === 'admin') {
                try {
                    const preferences = row.creator_preferences ? JSON.parse(row.creator_preferences) : {};
                    shouldNotifyCreator = preferences.emailNotifications !== false;
                } catch (error) {
                    console.error('[duty-absence] Invalid creator notification preferences:', error);
                }
            }
            if (shouldNotifyCreator) {
                addRecipient({
                    id: row.creator_id,
                    email: row.creator_email,
                    full_name: row.creator_name,
                }, scholar, 'creator');
            }
        }

        if (row.staff_email && row.staff_duty_attendance !== 0) {
            addRecipient({
                id: row.staff_id,
                email: row.staff_email,
                full_name: row.staff_name,
            }, scholar, 'staff');
        }
        dutyGroups.set(row.duty_id, group);
    }

    let sentCount = 0;
    let failedCount = 0;
    for (const [dutyId, group] of dutyGroups) {
        for (const recipient of group.recipients.values()) {
            const detail = `duty:${dutyId}:stage:system-absence`;
            const [existing] = await connection.query(
                `SELECT id FROM notification_logs
                 WHERE recipient = ? AND type = 'duty_absence_notice' AND detail = ? AND status = 'sent'
                 LIMIT 1`,
                [recipient.email, detail]
            );
            if (existing.length) continue;

            try {
                const scholars = [...recipient.scholars.values()];
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: recipient.email,
                    subject: `Duty attendance: ${group.duty.title} — ${scholars.length} absent`,
                    text: `Hello ${recipient.full_name || ''},\n\nThe check-in window for "${group.duty.title}" closed on ${group.duty.duty_date}. The following assigned scholars were recorded absent:\n${scholars.map(scholar => `- ${scholar.full_name || 'Unnamed Scholar'} (${scholar.scholar_id})`).join('\n')}\n\nPlease review attendance${recipient.role === 'creator' ? ' and arrange a makeup duty if needed' : ''}.`,
                    html: buildDutyAbsenceEmail({
                        recipientName: recipient.full_name,
                        duty: group.duty,
                        scholars,
                    }),
                });
                await connection.query(
                    `INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail)
                     VALUES (NULL, ?, 'email', 'duty_absence_notice', 'sent', ?)`,
                    [recipient.email, detail]
                );
                sentCount += 1;
            } catch (error) {
                failedCount += 1;
                console.error(`[duty-absence] Failed sending absence notice for duty ${dutyId} to ${recipient.email}:`, error.message || error);
                try {
                    await connection.query(
                        `INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail)
                         VALUES (NULL, ?, 'email', 'duty_absence_notice', 'failed', ?)`,
                        [recipient.email, `${detail}:${String(error.message || error)}`]
                    );
                } catch (logError) {
                    console.error('[duty-absence] Failed to record notification failure:', logError.message || logError);
                }
            }
        }
    }
    return { sentCount, failedCount };
};

exports.markEndedDutyAbsences = async () => {
    const connection = await db.promise().getConnection();
    let lockAcquired = false;

    try {
        const [lockRows] = await connection.query(
            'SELECT GET_LOCK(?, 0) AS acquired',
            [LOCK_NAME]
        );
        lockAcquired = Number(lockRows[0]?.acquired) === 1;
        if (!lockAcquired) return { skipped: true, markedCount: 0 };

        const [sweepRows] = await connection.query('SELECT CURRENT_TIMESTAMP AS sweep_started_at');
        const [result] = await connection.query(`
            INSERT INTO duty_attendance (duty_id, scholar_id, status, method, marked_at, is_makeup)
            SELECT eligible.duty_id, eligible.scholar_id, 'absent', 'system', NOW(), eligible.is_makeup
            FROM (
                SELECT duty_id, scholar_id, MAX(is_makeup) AS is_makeup
                FROM (
                    SELECT dga.duty_id, gm.scholar_id, 0 AS is_makeup
                    FROM duty_group_assignments dga
                    JOIN scholar_group_members gm ON gm.group_id = dga.group_id
                    UNION ALL
                    SELECT p.makeup_duty_id AS duty_id, p.scholar_id, 1 AS is_makeup
                    FROM duty_makeup_permissions p
                    WHERE p.status = 'approved' AND p.used_at IS NULL
                ) assigned_scholars
                GROUP BY duty_id, scholar_id
            ) eligible
            JOIN duties d ON d.id = eligible.duty_id
            JOIN users u ON u.scholar_id = eligible.scholar_id
                AND u.role = 'scholar' AND u.status = 'active'
            WHERE LOWER(COALESCE(d.status, '')) <> 'cancelled'
              AND TIMESTAMP(d.duty_date, COALESCE(d.time_start, '00:00:00'))
                  <= DATE_SUB(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), INTERVAL 1 HOUR)
              AND NOT EXISTS (
                  SELECT 1
                  FROM duty_attendance existing
                  WHERE existing.duty_id = eligible.duty_id
                    AND existing.scholar_id = eligible.scholar_id
              )
        `);

        const notifications = await notifyDutyAbsences(connection, sweepRows[0].sweep_started_at);
        return { skipped: false, markedCount: result.affectedRows, ...notifications };
    } finally {
        if (lockAcquired) {
            try {
                await connection.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
            } catch (error) {
                console.error('[duty-absence] failed to release scheduler lock:', error.message || error);
            }
        }
        connection.release();
    }
};
