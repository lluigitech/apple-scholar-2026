const db = require('../config/db');
const ExcelJS = require('exceljs');
const { logAuditEvent } = require('../utils/auditLogger');
const { calculateComplianceScore, getAcademicTier, normalizeAcademicGrade } = require('../utils/complianceLogger');

const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const birth = new Date(`${birthDate}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
    return age >= 0 && age <= 120 ? age : null;
};

const ALL_LEVELS = [
    'grade_7', 'grade_8', 'grade_9', 'grade_10',
    'grade_11', 'grade_12',
    'college_1', 'college_2', 'college_3', 'college_4', 'college_5',
];

const YEAR_LEVEL_ALIASES = {
    'grade 7': 'grade_7',
    'grade7': 'grade_7',
    'g7': 'grade_7',
    'grade 8': 'grade_8',
    'grade8': 'grade_8',
    'grade 9': 'grade_9',
    'grade9': 'grade_9',
    'grade 10': 'grade_10',
    'grade10': 'grade_10',
    'grade 11': 'grade_11',
    'grade11': 'grade_11',
    'grade 12': 'grade_12',
    'grade12': 'grade_12',
    '1st year college': 'college_1',
    '1st year': 'college_1',
    'college 1': 'college_1',
    'college_1': 'college_1',
    '2nd year college': 'college_2',
    '2nd year': 'college_2',
    'college 2': 'college_2',
    'college_2': 'college_2',
    '3rd year college': 'college_3',
    '3rd year': 'college_3',
    'college 3': 'college_3',
    'college_3': 'college_3',
    '4th year college': 'college_4',
    '4th year': 'college_4',
    'college 4': 'college_4',
    'college_4': 'college_4',
    '5th year college': 'college_5',
    '5th year': 'college_5',
    'college 5': 'college_5',
    'college_5': 'college_5',
};

const normalizeYearLevel = (value) => {
    if (value === null || typeof value === 'undefined') return null;
    const normalized = String(value).trim().toLowerCase().replace(/_/g, ' ');
    if (!normalized) return null;
    if (YEAR_LEVEL_ALIASES[normalized]) return YEAR_LEVEL_ALIASES[normalized];
    if (ALL_LEVELS.includes(normalized.replace(/\s+/g, '_'))) return normalized.replace(/\s+/g, '_');
    return null;
};

// ─── GET SCHOLAR PROFILE ─────────────────────────────────────
exports.getProfile = (req, res) => {
    if (Number(req.user?.id) !== Number(req.params.id)) {
        return res.status(403).json({ error: 'You can only view your own profile.' });
    }
    const sql = `
        SELECT id, scholar_id, full_name, email, role, year_level, birth_date, age, course, school, phone, address, status, created_at
        FROM users WHERE id = ?
    `;
    db.query(sql, [req.params.id], (err, data) => {
        if (err) return res.status(500).json({ error: 'Error loading scholar profile' });
        if (!data.length) return res.status(404).json({ error: 'Scholar not found' });
        res.json(data[0]);
    });
};

// ─── UPDATE SCHOLAR PROFILE ───────────────────────────────────
exports.updateProfile = (req, res) => {
    const requestedId = req.params.id;
    const tokenUserId = req.user?.id;

    if (!tokenUserId || Number(tokenUserId) !== Number(requestedId)) {
        return res.status(403).json({ error: 'You can only update your own profile.' });
    }

    const allowedFields = ['full_name', 'email', 'year_level', 'birth_date', 'age', 'phone', 'address', 'course', 'school'];
    const updates = {};

    allowedFields.forEach((field) => {
        if (!(field in req.body) || typeof req.body[field] === 'undefined') return;

        let value = req.body[field];

        if (value === null || value === '') {
            value = field === 'age' ? null : '';
        }

        if (field === 'age') {
            const ageNum = Number(value);
            if (value === null || value === '' || value === undefined || Number.isNaN(ageNum)) {
                value = null;
            } else {
                value = Math.max(0, Math.min(120, ageNum));
            }
        }

        if (field === 'birth_date') {
            if (value === null || value === '') {
                value = null;
            } else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
                return res.status(400).json({ error: 'Birth date must use the YYYY-MM-DD format.' });
            }
        }

        if (field === 'year_level' && typeof value === 'string') {
            value = value.trim();
            if (!value) value = null;
        }

        if (field === 'full_name' && typeof value === 'string') value = value.trim();
        if (field === 'email' && typeof value === 'string') value = value.trim();
        if (field === 'phone' && typeof value === 'string') value = value.trim();
        if (field === 'address' && typeof value === 'string') value = value.trim();
        if (field === 'course' && typeof value === 'string') value = value.trim();
        if (field === 'school' && typeof value === 'string') value = value.trim();

        updates[field] = value;
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid profile fields provided.' });
    }

    const normalizedYearLevel = updates.year_level ? normalizeYearLevel(updates.year_level) : null;
    if (updates.year_level && !normalizedYearLevel) {
        return res.status(400).json({ error: 'Invalid year level.' });
    }
    if (normalizedYearLevel) {
        updates.year_level = normalizedYearLevel;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'birth_date')) {
        updates.age = calculateAge(updates.birth_date);
    }

    const sql = `UPDATE users SET ${Object.keys(updates).map((field) => `${field} = ?`).join(', ')} WHERE id = ?`;
    const params = [...Object.values(updates), requestedId];

    db.query(sql, params, (err) => {
        if (err) return res.status(500).json({ error: 'Error updating profile.' });

        const fetchSql = `
            SELECT id, scholar_id, full_name, email, role, year_level, birth_date, age, course, school, phone, address, status, created_at
            FROM users WHERE id = ?
        `;

        db.query(fetchSql, [requestedId], (err2, data) => {
            if (err2) return res.status(500).json({ error: 'Error fetching updated profile.' });
            if (!data.length) return res.status(404).json({ error: 'Scholar not found after update.' });
            res.json(data[0]);
        });
    });
};

// ─── GET ANNOUNCEMENTS ────────────────────────────────────────
const resolveNotificationSource = (type = '') => {
    const t = String(type).toLowerCase();
    if (t.includes('duty')) return 'duty';
    if (t.includes('submission') || t.includes('review') || t.includes('letter')) return 'submission';
    if (t.includes('task') || t.includes('deadline') || t.includes('reminder')) return 'task';
    return 'announcement';
};

const resolveNotificationType = (type = '', status = '') => {
    const t = String(type).toLowerCase();
    const normalizedStatus = String(status || '').toLowerCase();

    if (t.includes('deadline') || t.includes('reminder')) return 'reminder';
    if (t.includes('deadline')) return 'deadline';
    if (normalizedStatus === 'sent') return 'info';
    if (normalizedStatus === 'failed') return 'critical';
    if (t.includes('approval') || t.includes('approved')) return 'approved';
    if (t.includes('rejected') || t.includes('returned')) return 'rejected';
    if (t.includes('duty')) return 'important';
    if (t.includes('submission')) return 'pending';
    return 'info';
};

exports.getScholarNotifications = (req, res) => {
    const scholar_id = req.user?.scholar_id;
    if (!scholar_id) return res.status(401).json({ error: 'Scholar identity is missing from the authentication token.' });

    const sql = `
        SELECT id, scholar_id, recipient, channel, type, status, detail, is_read, read_at, created_at
        FROM notification_logs
        WHERE scholar_id = ?
        ORDER BY created_at DESC
    `;

    db.query(sql, [scholar_id], (err, rows) => {
        if (err) {
            console.error('Error fetching scholar notifications:', err);
            return res.status(500).json({ error: 'Error fetching notification feed.' });
        }

        const results = rows.map(row => ({
            id: row.id,
            source: resolveNotificationSource(row.type),
            type: resolveNotificationType(row.type, row.status),
            title: String(row.type || 'Notification').replace(/[_-]+/g, ' '),
            message: row.detail || 'You have a new notification.',
            date: row.created_at,
            read: Number(row.is_read) === 1,
            channel: row.channel,
            recipient: row.recipient,
            status: row.status,
            created_at: row.created_at,
        }));

        return res.json(results);
    });
};

exports.markAllNotificationsRead = (req, res) => {
    const scholar_id = req.user?.scholar_id;
    if (!scholar_id) return res.status(401).json({ error: 'Scholar identity is missing from the authentication token.' });

    const sql = `
        UPDATE notification_logs
        SET is_read = 1, read_at = CURRENT_TIMESTAMP
        WHERE scholar_id = ? AND COALESCE(is_read, 0) = 0
    `;

    db.query(sql, [scholar_id], (err, result) => {
        if (err) {
            console.error('Error marking scholar notifications read:', err);
            return res.status(500).json({ error: 'Unable to mark notifications as read.' });
        }

        return res.json({ ok: true, updated: result.affectedRows || 0 });
    });
};

exports.markNotificationRead = (req, res) => {
    const scholar_id = req.user?.scholar_id;
    if (!scholar_id) return res.status(401).json({ error: 'Scholar identity is missing from the authentication token.' });

    const notificationId = Number(req.params.id);
    if (!notificationId) return res.status(400).json({ error: 'Notification id is required.' });

    const sql = `
        UPDATE notification_logs
        SET is_read = 1, read_at = CURRENT_TIMESTAMP
        WHERE id = ? AND scholar_id = ?
    `;

    db.query(sql, [notificationId, scholar_id], (err, result) => {
        if (err) {
            console.error('Error marking scholar notification read:', err);
            return res.status(500).json({ error: 'Unable to mark the notification as read.' });
        }

        return res.json({ ok: true, updated: result.affectedRows || 0 });
    });
};

exports.getAnnouncements = (req, res) => {
    const { year_level } = req.query;

    const sql = `
        SELECT a.id, a.title, a.content, a.priority, a.target_roles, a.target_levels,
               a.created_by, a.created_by_role, a.created_at,
               u.full_name AS created_by_name
        FROM announcements a
        LEFT JOIN users u ON u.id = a.created_by
        ORDER BY a.created_at DESC
    `;

    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching announcements' });

        const results = data
            .map(row => ({
                ...row,
                target_roles: typeof row.target_roles === 'string'
                    ? JSON.parse(row.target_roles || '[]')
                    : (row.target_roles || []),
                target_levels: typeof row.target_levels === 'string'
                    ? JSON.parse(row.target_levels || '[]')
                    : (row.target_levels || []),
                created_by_role: String(row.created_by_role || '').trim().toLowerCase(),
                created_by_name: row.created_by_name || (row.created_by ? 'Unknown' : 'System'),
            }))
            .filter(row => {
                const levels = row.target_levels;
                if (!year_level) return true;
                const isAll = ALL_LEVELS.every(l => levels.includes(l));
                if (isAll) return true;
                return levels.includes(year_level);
            });

        res.json(results);
    });
};

// ─── SCHOLAR COMPLIANCE STATUS ─────────────────────────────────
exports.getComplianceStatus = (req, res) => {
    const scholar_id = req.user?.scholar_id;
    if (!scholar_id) {
        return res.status(403).json({ error: 'Scholar identity missing from token.' });
    }

    const settingsSql = `
        SELECT id, min_compliance, allowed_missed, required_hours,
            missed_submission_deduction, service_hour_shortfall_deduction,
            absent_duty_deduction, late_submission_deduction,
            negative_letter_deduction, quality_drop_deduction,
            extra_service_bonus, good_maintenance_bonus,
            missed_submission_grace_count, late_submission_grace_count,
            recovery_enabled, early_submission_bonus,
            service_hours_completion_bonus, consecutive_early_bonus,
            perfect_attendance_bonus, monthly_recovery_cap
        FROM compliance_settings WHERE id = 1 LIMIT 1
    `;

    const scholarSql = `
        SELECT u.year_level, g.units, g.grade, g.grade_scale
        FROM users u
        LEFT JOIN grades g ON g.scholar_id = u.scholar_id
        WHERE u.scholar_id = ?
    `;

    db.query(settingsSql, (settingsErr, settingsRows) => {
        if (settingsErr) {
            console.error('getComplianceStatus settings error:', settingsErr);
            return res.status(500).json({ error: 'Error loading compliance settings.' });
        }

        const settings = (settingsRows && settingsRows[0]) ? settingsRows[0] : null;

        db.query(
            `
                SELECT
                    COUNT(*) AS total_submissions,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                    AVG(quality_score) AS avg_quality,
                    SUM(CASE WHEN service_hours IS NOT NULL THEN service_hours ELSE 0 END) AS total_service_hours,
                    MAX(submitted_at) AS last_submission,
                    SUM(CASE WHEN sentiment_label LIKE '%Negative%' THEN 1 ELSE 0 END) AS negative_letters,
                    SUM(CASE WHEN submission_type = 'letter' AND submitted_at <= DATE_SUB(LAST_DAY(submitted_at), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS early_submissions,
                    GROUP_CONCAT(DISTINCT DATE_FORMAT(submitted_at, '%Y-%m') ORDER BY DATE_FORMAT(submitted_at, '%Y-%m') SEPARATOR ',') AS early_submission_months
                FROM submissions
                WHERE scholar_id = ?
            `,
            [scholar_id],
            (subErr, subRows) => {
                if (subErr) {
                    console.error('getComplianceStatus submissions error:', subErr);
                    return res.status(500).json({ error: 'Error loading submission metrics.' });
                }

                db.query(
                    `
                        SELECT
                            COUNT(*) AS total_duties,
                            SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
                            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent
                        FROM duty_attendance
                        WHERE scholar_id = ?
                    `,
                    [scholar_id],
                    (attErr, attRows) => {
                        if (attErr) {
                            console.error('getComplianceStatus attendance error:', attErr);
                            return res.status(500).json({ error: 'Error loading attendance metrics.' });
                        }

                        db.query(scholarSql, [scholar_id], (gradeErr, gradeRows) => {
                            if (gradeErr) {
                                console.error('getComplianceStatus grades error:', gradeErr);
                                return res.status(500).json({ error: 'Error loading academic grades.' });
                            }

                            const sub = subRows && subRows[0] ? subRows[0] : null;
                            const att = attRows && attRows[0] ? attRows[0] : null;
                            const score = calculateComplianceScore({ sub, att, settings, today: new Date() });

                            const academicGrades = Array.isArray(gradeRows) ? gradeRows : [];
                            let weightedSum = 0;
                            let totalUnits = 0;

                            academicGrades.forEach((row) => {
                                const gradeScale = row.grade_scale || 'k12';
                                const normalized = normalizeAcademicGrade(gradeScale, row.grade);
                                const units = Number(row.units) || 0;
                                if (normalized === null || units <= 0) return;
                                weightedSum += units * normalized;
                                totalUnits += units;
                            });

                            const academicScore = totalUnits > 0
                                ? Number((weightedSum / totalUnits).toFixed(2))
                                : null;
                            const academicStatus = getAcademicTier(academicScore);

                            const scholarFlags = [];
                            if (score.deductions.serviceHourShortfall.points > 0) {
                                scholarFlags.push({
                                    type: 'Service Hours',
                                    description: score.deductions.serviceHourShortfall.missingHours === 0
                                        ? 'You are meeting your current service hours target for this term.'
                                        : `You are ${score.deductions.serviceHourShortfall.missingHours} service hour${score.deductions.serviceHourShortfall.missingHours === 1 ? '' : 's'} short of your current target.`,
                                    severity: score.deductions.serviceHourShortfall.missingHours >= 5 ? 'medium' : 'low',
                                });
                            }
                            if (score.deductions.missedSubmission.points > 0) {
                                scholarFlags.push({
                                    type: 'Monthly Report',
                                    description: score.deductions.missedSubmission.missingReports === 0
                                        ? 'You are keeping up with your monthly reports.'
                                        : `You are missing ${score.deductions.missedSubmission.missingReports} monthly report${score.deductions.missedSubmission.missingReports === 1 ? '' : 's'} for the current term progress.`,
                                    severity: score.deductions.missedSubmission.missingReports >= 2 ? 'medium' : 'low',
                                });
                            }
                            if (score.deductions.absentDuty.points > 0) {
                                scholarFlags.push({
                                    type: 'Duty Attendance',
                                    description: `${score.deductions.absentDuty.absentCount} duty absence${score.deductions.absentDuty.absentCount === 1 ? '' : 's'} recorded.`,
                                    severity: score.deductions.absentDuty.absentCount >= 2 ? 'medium' : 'low',
                                });
                            }
                            if (score.deductions.lateSubmission.points > 0) {
                                scholarFlags.push({
                                    type: 'Report Timeliness',
                                    description: score.deductions.lateSubmission.daysSinceSubmission === null
                                        ? 'No reports submitted yet for this term.'
                                        : `Your last report was submitted ${score.deductions.lateSubmission.daysSinceSubmission} day${score.deductions.lateSubmission.daysSinceSubmission === 1 ? '' : 's'} ago.`,
                                    severity: 'medium',
                                });
                            }
                            if (score.deductions.negativeLetter.points > 0) {
                                scholarFlags.push({
                                    type: 'Letter Sentiment',
                                    description: `You have ${score.deductions.negativeLetter.negativeLetters} letter${score.deductions.negativeLetter.negativeLetters === 1 ? '' : 's'} that need a more positive tone.`,
                                    severity: 'low',
                                });
                            }
                            if (score.deductions.qualityDrop.points > 0) {
                                scholarFlags.push({
                                    type: 'Letter Quality',
                                    description: `Your average submission quality is ${score.deductions.qualityDrop.avgQuality}%.`,
                                    severity: score.deductions.qualityDrop.avgQuality < 50 ? 'medium' : 'low',
                                });
                            }
                            if (score.deductions.extraServiceBonus.points > 0) {
                                scholarFlags.push({
                                    type: 'Service Bonus',
                                    description: 'You have extra service hours and are earning bonus credit toward your compliance score.',
                                    severity: 'low',
                                });
                            }
                            if (score.deductions.goodMaintenanceBonus.points > 0) {
                                scholarFlags.push({
                                    type: 'Good Progress',
                                    description: 'Your consistent work has earned you a maintenance bonus.',
                                    severity: 'low',
                                });
                            }

                            res.json({
                                overall_compliance: score.overallCompliance,
                                risk_level: score.overallCompliance >= 70 ? 'low' : score.overallCompliance >= 50 ? 'medium' : 'high',
                                recoverable_credits: Number(score.recoverableCredits || 0),
                                total_bonus_points: Number(score.totalBonusPoints || 0),
                                recovery_enabled: Boolean(score.recoveryEnabled),
                                flags: scholarFlags,
                                academic_status: academicStatus,
                                normalized_academic_score: academicScore,
                            });
                        });
                    }
                );
            }
        );
    });
};

// ─── GET MY DUTIES ──────────────────────────────────────────────
// Group-based lang: makikita LANG ng scholar yung duty kung member siya
// ng isang group na naka-assign dito. scholar_id GALING SA JWT.
exports.getMyDuties = (req, res) => {
    const scholar_id = req.user.scholar_id;

    const sql = `
        SELECT DISTINCT d.id, d.title, d.description,
            d.duty_date, d.time_start, d.time_end, d.location, d.status,
            g.group_name,
            assigned_staff.full_name AS assigned_staff_name,
            da.status AS attendance_status, da.method, da.marked_at, da.is_makeup,
            CASE
                WHEN da.status = 'present' THEN 'completed'
                WHEN CURDATE() <= DATE_ADD(d.duty_date, INTERVAL 7 DAY) THEN 'pending'
                ELSE 'missed'
            END AS computed_status
        FROM duties d
        JOIN duty_group_assignments dga ON dga.duty_id = d.id
        LEFT JOIN scholar_group_members m ON m.group_id = dga.group_id AND m.scholar_id = ?
        LEFT JOIN scholar_groups g ON g.id = dga.group_id
        LEFT JOIN users assigned_staff ON assigned_staff.id = g.assigned_staff_id
            AND LOWER(assigned_staff.role) IN ('staff', 'officer')
        LEFT JOIN duty_makeup_permissions p ON p.makeup_duty_id = d.id
            AND p.scholar_id = ? AND p.status = 'approved' AND p.used_at IS NULL
        LEFT JOIN duty_attendance da ON da.duty_id = d.id AND da.scholar_id = ?
        WHERE (m.scholar_id = ? OR p.scholar_id = ? OR da.scholar_id = ?)
        ORDER BY d.duty_date DESC
    `;
    db.query(sql, [scholar_id, scholar_id, scholar_id, scholar_id, scholar_id, scholar_id], (err, data) => {
        if (err) {
            console.error('Error fetching duties (getMyDuties):', err);
            return res.status(500).json({ error: 'Error fetching your duties' });
        }
        res.json(data);
    });
};

// ─── CHECK-IN VIA QR SCAN ────────────────────────────────────────
// Tinatawag ito ng app pagkatapos i-scan ng scholar yung QR code na naka-post
// sa duty location. Ang QR ay naka-encode lang ng `qr_token` (hindi duty_id
// mismo), kaya kailangan i-lookup muna yung duty base dito.
// scholar_id GALING SA JWT (req.user.scholar_id) -- HINDI sa req.body,
// para hindi pwede mag-check-in bilang ibang scholar.
exports.checkInToDuty = (req, res) => {
    const scholar_id = req.user.scholar_id;
    const { qr_token } = req.body;

    if (!qr_token)
        return res.status(400).json({ error: 'qr_token is required' });

    // Step 1: Hanapin yung duty base sa QR token
    const dutySql = `
        SELECT id, title, duty_date, time_start, time_end,
               TIMESTAMP(duty_date, COALESCE(time_end, '23:59:59')) <= NOW() AS duty_ended,
               time_start IS NOT NULL AND NOW() > DATE_ADD(
                   TIMESTAMP(duty_date, time_start),
                   INTERVAL 30 MINUTE
               ) AS is_late
        FROM duties
        WHERE qr_token = ?
    `;
    db.query(dutySql, [qr_token], (err, dutyRows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (dutyRows.length === 0)
            return res.status(404).json({ error: 'Invalid QR code.' });

        const duty = dutyRows[0];
        const logAttendanceNotification = (type, detail) => {
            db.query('SELECT email FROM users WHERE scholar_id = ? LIMIT 1', [scholar_id], (userErr, userRows) => {
                if (userErr || !userRows || userRows.length === 0) return;
                const recipient = userRows[0].email;
                db.query(
                    'INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail) VALUES (?, ?, ?, ?, ?, ?)',
                    [scholar_id, recipient, 'system', type, 'generated', detail],
                    () => { /* ignore logging errors */ }
                );
            });
        };
        const logLateAttendance = () => {
            logAttendanceNotification('attendance_late', `Late check-in recorded for duty "${duty.title || 'Duty'}" (duty_id=${duty.id}).`);
        };
        const logMakeupAttendance = () => {
            logAttendanceNotification('attendance_makeup', `Makeup attendance recorded for duty "${duty.title || 'Duty'}" (duty_id=${duty.id}).`);
        };
        if (Boolean(duty.duty_ended)) {
            return res.status(410).json({ error: 'Duty has ended. Contact staff to arrange a makeup duty.' });
        }

        // Step 2: Verify normal group membership or an approved one-duty makeup permission.
        const verifySql = `
            SELECT MAX(is_group_member) AS is_group_member, MAX(has_makeup_permission) AS has_makeup_permission
            FROM (
                SELECT 1 AS is_group_member, 0 AS has_makeup_permission
                FROM duty_group_assignments dga
                JOIN scholar_group_members m ON m.group_id = dga.group_id
                WHERE dga.duty_id = ? AND m.scholar_id = ?
                UNION ALL
                SELECT 0 AS is_group_member, 1 AS has_makeup_permission
                FROM duty_makeup_permissions p
                WHERE p.makeup_duty_id = ? AND p.scholar_id = ?
                  AND p.status = 'approved' AND p.used_at IS NULL
            ) access_check
        `;
        db.query(verifySql, [duty.id, scholar_id, duty.id, scholar_id], (err, check) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            if (!check.length || (!check[0].is_group_member && !check[0].has_makeup_permission)) {
                return res.status(403).json({ error: 'This duty is not assigned to your group.' });
            }
            const permissionUsed = Boolean(check[0].has_makeup_permission && !check[0].is_group_member);

            // Step 3: Prevent duplicate check-in
            const dupSql = `SELECT id FROM duty_attendance WHERE duty_id = ? AND scholar_id = ?`;
            db.query(dupSql, [duty.id, scholar_id], (err, existing) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                if (existing.length > 0)
                    return res.status(409).json({ error: 'Already checked in for this duty.' });

                // Step 4: Check kung nasa loob pa ng 7-day makeup window
                const today = new Date().toISOString().split('T')[0];
                const dutyDateStr = new Date(duty.duty_date).toISOString().split('T')[0];

                const deadline = new Date(duty.duty_date);
                deadline.setDate(deadline.getDate() + 7);
                const deadlineStr = deadline.toISOString().split('T')[0];

                if (today > deadlineStr) {
                    return res.status(410).json({ error: 'Makeup window for this duty has already closed.' });
                }

                const isMakeup = permissionUsed || today !== dutyDateStr ? 1 : 0;
                const isLate = Boolean(duty.is_late);
                const attendanceStatus = isLate ? 'late' : 'present';

                // Step 5: Insert attendance
                const insertSql = `
                    INSERT INTO duty_attendance (duty_id, scholar_id, status, method, marked_at, is_makeup)
                    VALUES (?, ?, ?, 'qr', NOW(), ?)
                `;
                db.query(insertSql, [duty.id, scholar_id, attendanceStatus, isMakeup], (err, result) => {
                    if (err) return res.status(500).json({ error: 'Error recording attendance' });
                    if (permissionUsed) {
                        db.query(
                            `UPDATE duty_makeup_permissions SET status = 'used', used_at = NOW()
                             WHERE makeup_duty_id = ? AND scholar_id = ? AND status = 'approved' AND used_at IS NULL`,
                            [duty.id, scholar_id],
                            () => {}
                        );
                    }
                    if (isLate) logLateAttendance();
                    if (isMakeup) logMakeupAttendance();
                    res.status(201).json({
                        message: isLate ? 'Checked in late' : (isMakeup ? 'Checked in (makeup)' : 'Checked in successfully'),
                        id: result.insertId,
                        status: attendanceStatus,
                        is_makeup: !!isMakeup,
                        is_late: !!isLate,
                    });
                });
            });
        });
    });
};

exports.getDataConsent = (req, res) => {
    db.query('SELECT purpose, consented, consented_at, revoked_at FROM data_consents WHERE user_id = ? AND purpose = ?', [req.user.id, 'scholar_data_collection'], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to load data consent.' });
        res.json(rows[0] || { purpose: 'scholar_data_collection', consented: 0, consented_at: null, revoked_at: null });
    });
};

exports.updateDataConsent = async (req, res) => {
    const consented = req.body?.consented === true;
    const sql = `INSERT INTO data_consents (user_id, purpose, consented, consented_at, revoked_at)
        VALUES (?, 'scholar_data_collection', ?, IF(? = 1, NOW(), NULL), IF(? = 1, NULL, NOW()))
        ON DUPLICATE KEY UPDATE consented = VALUES(consented), consented_at = VALUES(consented_at), revoked_at = VALUES(revoked_at)`;
    db.query(sql, [req.user.id, consented ? 1 : 0, consented ? 1 : 0, consented ? 1 : 0], async (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update data consent.' });
        await logAuditEvent({ req, action: consented ? 'consent' : 'revoke', module: 'Data Privacy', details: `Scholar data collection consent ${consented ? 'granted' : 'revoked'}`, result: 'success' });
        res.json({ consented });
    });
};

exports.getPrivacyRequests = (req, res) => {
    db.query(
        `SELECT id, request_type, status, requested_at, processed_at, notes
         FROM privacy_requests WHERE user_id = ? ORDER BY requested_at DESC`,
        [req.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Failed to load privacy requests.' });
            res.json(rows);
        }
    );
};

exports.createPrivacyRequest = async (req, res) => {
    const requestType = req.body?.request_type;
    if (!['export', 'deletion'].includes(requestType)) {
        return res.status(400).json({ error: 'Request type must be export or deletion.' });
    }

    db.query(
        `SELECT id FROM privacy_requests
         WHERE user_id = ? AND request_type = ? AND status = 'pending' LIMIT 1`,
        [req.user.id, requestType],
        (checkErr, existing) => {
            if (checkErr) return res.status(500).json({ error: 'Failed to check existing privacy requests.' });
            if (existing.length) return res.status(409).json({ error: 'A request of this type is already pending.' });

            db.query(
                'INSERT INTO privacy_requests (user_id, request_type) VALUES (?, ?)',
                [req.user.id, requestType],
                async (insertErr, result) => {
                    if (insertErr) return res.status(500).json({ error: 'Failed to create privacy request.' });
                    await logAuditEvent({ req, action: `privacy_${requestType}_request`, module: 'Data Privacy', details: `Scholar requested ${requestType} of personal data`, result: 'success' });
                    res.status(201).json({ id: result.insertId, request_type: requestType, status: 'pending' });
                }
            );
        }
    );
};

const queryRows = (sql, params = []) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

exports.exportMyData = async (req, res) => {
    try {
        const userId = req.user.id;
        const scholarId = req.user.scholar_id;
        const [profile, submissions, grades, attendance, consent, requests] = await Promise.all([
            queryRows(`SELECT id, scholar_id, full_name, email, role, year_level, age, phone, address, course, school, status, created_at FROM users WHERE id = ? AND role = 'scholar'`, [userId]),
            queryRows(`SELECT id, submission_type, letter_content, sentiment_score, sentiment_label, report_card_path, cor_path, service_activity, service_hours, service_date, quality_score, quality_status, status, officer_comment, submitted_at, reviewed_at FROM submissions WHERE scholar_id = ? ORDER BY submitted_at DESC`, [scholarId]),
            queryRows(`SELECT semester, academic_year, subject_name, units, grade, grade_scale, proof_path, verification_status, officer_comment, created_at FROM grades WHERE scholar_id = ? ORDER BY created_at DESC`, [scholarId]),
            queryRows(`SELECT da.duty_id, d.title AS duty, d.location, d.duty_date, da.status, da.method, da.marked_at, da.is_makeup FROM duty_attendance da LEFT JOIN duties d ON d.id = da.duty_id WHERE da.scholar_id = ? ORDER BY da.marked_at DESC`, [scholarId]),
            queryRows(`SELECT purpose, consented, consented_at, revoked_at FROM data_consents WHERE user_id = ? ORDER BY purpose`, [userId]),
            queryRows(`SELECT id, request_type, status, requested_at, processed_at, notes FROM privacy_requests WHERE user_id = ? ORDER BY requested_at DESC`, [userId]),
        ]);

        if (!profile.length) return res.status(404).json({ error: 'Scholar profile not found.' });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Apple Scholar System';
        workbook.created = new Date();
        const addSheet = (name, rows) => {
            const sheet = workbook.addWorksheet(name);
            const columns = rows.length ? Object.keys(rows[0]) : [];
            sheet.columns = columns.map(key => ({ header: key, key, width: Math.min(Math.max(key.length + 4, 16), 32) }));
            rows.forEach(row => sheet.addRow(row));
            if (columns.length) {
                sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F2D3A' } };
                sheet.views = [{ state: 'frozen', ySplit: 1 }];
                sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` };
            }
        };

        addSheet('Profile', profile);
        addSheet('Submissions', submissions);
        addSheet('Grades', grades);
        addSheet('Attendance', attendance);
        addSheet('Consent', consent);
        addSheet('Privacy Requests', requests);

        await logAuditEvent({ req, action: 'export', module: 'Data Privacy', details: `Scholar exported personal data (${scholarId})`, result: 'success' });
        const filename = `apple-scholar-data-export-${scholarId}-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Scholar data export error:', err);
        res.status(500).json({ error: 'Failed to generate your data export.' });
    }
};

exports.getMakeupOptions = (req, res) => {
    const scholarId = req.user.scholar_id;
    const sourceDutyId = req.params.source_duty_id;
    db.query(`
        SELECT COALESCE(da.status, 'absent') AS source_status, d.duty_date AS source_duty_date
        FROM duties d
        LEFT JOIN duty_attendance da ON da.duty_id = d.id AND da.scholar_id = ?
        WHERE d.id = ? AND da.status IN ('absent', 'excused')
        LIMIT 1
    `, [scholarId, sourceDutyId], (sourceErr, sourceRows) => {
        if (sourceErr) return res.status(500).json({ error: 'Error checking duty attendance' });
        if (!sourceRows.length) return res.status(400).json({ error: 'Only absent or excused duties can request makeup' });

        db.query(`
            SELECT id, title, duty_date, time_start, time_end, location
            FROM duties
            WHERE duty_date > ? AND duty_date <= DATE_ADD(?, INTERVAL 14 DAY)
              AND status <> 'cancelled'
              AND id <> ?
            ORDER BY duty_date ASC
        `, [sourceRows[0].source_duty_date, sourceRows[0].source_duty_date, sourceDutyId], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error fetching makeup duties' });
            res.json({ source_status: sourceRows[0].source_status, options: rows });
        });
    });
};

exports.getMyMakeupRequests = (req, res) => {
    db.query(`
        SELECT p.id, p.source_duty_id, p.makeup_duty_id, p.reason, p.status,
               source.title AS source_duty_title, source.duty_date AS source_duty_date,
               target.title AS makeup_duty_title, target.duty_date AS makeup_duty_date
        FROM duty_makeup_permissions p
        JOIN duties source ON source.id = p.source_duty_id
        JOIN duties target ON target.id = p.makeup_duty_id
        WHERE p.scholar_id = ?
        ORDER BY p.created_at DESC
    `, [req.user.scholar_id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error fetching makeup requests' });
        res.json(rows);
    });
};

exports.requestMakeup = (req, res) => {
    const scholarId = req.user.scholar_id;
    const { source_duty_id, makeup_duty_id, reason } = req.body;
    if (!source_duty_id || !makeup_duty_id) {
        return res.status(400).json({ error: 'source_duty_id and makeup_duty_id are required' });
    }

    db.query(`
        SELECT d.duty_date AS source_duty_date
        FROM duties d
        LEFT JOIN duty_attendance da ON da.duty_id = d.id AND da.scholar_id = ?
        WHERE d.id = ? AND da.status IN ('absent', 'excused')
        LIMIT 1
    `, [scholarId, source_duty_id], (sourceErr, sourceRows) => {
        if (sourceErr) return res.status(500).json({ error: 'Error checking source duty' });
        if (!sourceRows.length) return res.status(400).json({ error: 'Only absent or excused duties can request makeup' });

        db.query(`
            SELECT id FROM duties
            WHERE id = ? AND duty_date > ? AND duty_date <= DATE_ADD(?, INTERVAL 14 DAY)
              AND status <> 'cancelled'
            LIMIT 1
        `, [makeup_duty_id, sourceRows[0].source_duty_date, sourceRows[0].source_duty_date], (targetErr, targetRows) => {
            if (targetErr) return res.status(500).json({ error: 'Error checking makeup duty' });
            if (!targetRows.length) return res.status(400).json({ error: 'Selected duty is not a valid makeup duty' });

            db.query(`
                INSERT INTO duty_makeup_permissions
                    (scholar_id, source_duty_id, makeup_duty_id, reason, status)
                VALUES (?, ?, ?, ?, 'pending')
                ON DUPLICATE KEY UPDATE
                    reason = VALUES(reason), status = 'pending', used_at = NULL
            `, [scholarId, source_duty_id, makeup_duty_id, reason || null], (insertErr) => {
                if (insertErr) return res.status(500).json({ error: 'Failed to submit makeup request' });
                res.status(201).json({ message: 'Makeup request submitted for approval' });
            });
        });
    });
};