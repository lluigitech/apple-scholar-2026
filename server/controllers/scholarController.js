const db = require('../config/db');
const { calculateComplianceScore, getAcademicTier, normalizeAcademicGrade } = require('../utils/complianceLogger');

const ALL_LEVELS = [
    'grade_7', 'grade_8', 'grade_9', 'grade_10',
    'grade_11', 'grade_12',
    'college_1', 'college_2', 'college_3', 'college_4', 'college_5',
];

// ─── GET SCHOLAR PROFILE ─────────────────────────────────────
exports.getProfile = (req, res) => {
    const sql = `
        SELECT id, scholar_id, full_name, email, role, year_level, status, created_at,
               qr_code
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

    const allowedFields = ['full_name', 'email', 'year_level', 'qr_code'];
    const updates = {};

    allowedFields.forEach((field) => {
        if (field in req.body && typeof req.body[field] !== 'undefined') {
            updates[field] = req.body[field];
        }
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid profile fields provided.' });
    }

    if (updates.year_level && !ALL_LEVELS.includes(updates.year_level)) {
        return res.status(400).json({ error: 'Invalid year level.' });
    }

    const sql = `UPDATE users SET ${Object.keys(updates).map((field) => `${field} = ?`).join(', ')} WHERE id = ?`;
    const params = [...Object.values(updates), requestedId];

    db.query(sql, params, (err) => {
        if (err) return res.status(500).json({ error: 'Error updating profile.' });

        const fetchSql = `
            SELECT id, scholar_id, full_name, email, role, year_level, status, created_at,
                   qr_code
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
                                risk_level: score.riskScore >= 60 ? 'high' : score.riskScore >= 40 ? 'medium' : 'low',
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
            da.status AS attendance_status, da.method, da.marked_at, da.is_makeup,
            CASE
                WHEN da.status = 'present' THEN 'completed'
                WHEN CURDATE() <= DATE_ADD(d.duty_date, INTERVAL 7 DAY) THEN 'pending'
                ELSE 'missed'
            END AS computed_status
        FROM duties d
        JOIN duty_group_assignments dga ON dga.duty_id = d.id
        JOIN scholar_group_members m ON m.group_id = dga.group_id
        JOIN scholar_groups g ON g.id = dga.group_id
        LEFT JOIN duty_attendance da ON da.duty_id = d.id AND da.scholar_id = m.scholar_id
        WHERE m.scholar_id = ?
        ORDER BY d.duty_date DESC
    `;
    db.query(sql, [scholar_id], (err, data) => {
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
    const dutySql = `SELECT id, duty_date FROM duties WHERE qr_token = ?`;
    db.query(dutySql, [qr_token], (err, dutyRows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (dutyRows.length === 0)
            return res.status(404).json({ error: 'Invalid QR code.' });

        const duty = dutyRows[0];

        // Step 2: Verify na member siya ng group na naka-assign sa duty na ito
        const verifySql = `
            SELECT 1
            FROM duty_group_assignments dga
            JOIN scholar_group_members m ON m.group_id = dga.group_id
            WHERE dga.duty_id = ? AND m.scholar_id = ?
            LIMIT 1
        `;
        db.query(verifySql, [duty.id, scholar_id], (err, check) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            if (check.length === 0) {
                // Hindi siya member ng naka-assign na group -- reject kahit valid ang QR
                return res.status(403).json({ error: 'This duty is not assigned to your group.' });
            }

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

                const isMakeup = today !== dutyDateStr ? 1 : 0;

                // Step 5: Insert attendance
                const insertSql = `
                    INSERT INTO duty_attendance (duty_id, scholar_id, status, method, marked_at, is_makeup)
                    VALUES (?, ?, 'present', 'qr', NOW(), ?)
                `;
                db.query(insertSql, [duty.id, scholar_id, isMakeup], (err, result) => {
                    if (err) return res.status(500).json({ error: 'Error recording attendance' });
                    res.status(201).json({
                        message: isMakeup ? 'Checked in (makeup)' : 'Checked in successfully',
                        id: result.insertId,
                        is_makeup: !!isMakeup
                    });
                });
            });
        });
    });
};