const db = require('../config/db');

// ─── GET FLAGGED SCHOLARS (shared ng Officer at Admin portals) ─────────
// Isang unified, proportional na compliance/risk formula.
// Walang duplicate scoring, walang double-counting, at bawat flag ay
// may kaakibat na malinaw na plain-English description.
exports.getFlaggedScholars = (req, res) => {
    const scholarSql = `
        SELECT id, scholar_id, full_name, email, year_level, status, created_at
        FROM users
        WHERE role = 'scholar' AND status = 'active'
    `;

    db.query(scholarSql, (err, scholars) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch scholars.' });
        if (scholars.length === 0) return res.json([]);

        const scholarIds = scholars.map(s => s.scholar_id);
        const placeholders = scholarIds.map(() => '?').join(', ');

        const submissionSql = `
            SELECT
                scholar_id,
                COUNT(*) AS total_submissions,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) AS pending,
                AVG(quality_score) AS avg_quality,
                SUM(CASE WHEN service_hours IS NOT NULL THEN service_hours ELSE 0 END) AS total_service_hours,
                MAX(submitted_at) AS last_submission,
                SUM(CASE WHEN sentiment_label LIKE '%Negative%' THEN 1 ELSE 0 END) AS negative_letters
            FROM submissions
            WHERE scholar_id IN (${placeholders})
            GROUP BY scholar_id
        `;

        const attendanceSql = `
            SELECT
                da.scholar_id,
                COUNT(*) AS total_duties,
                SUM(CASE WHEN da.status = 'present' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN da.status = 'absent'  THEN 1 ELSE 0 END) AS absent
            FROM duty_attendance da
            WHERE da.scholar_id IN (${placeholders})
            GROUP BY da.scholar_id
        `;

        const settingsSql = `SELECT id, min_compliance, allowed_missed, required_hours,
            missed_submission_deduction, service_hour_shortfall_deduction,
            absent_duty_deduction, late_submission_deduction,
            negative_letter_deduction, quality_drop_deduction,
            extra_service_bonus, good_maintenance_bonus
            FROM compliance_settings WHERE id = 1 LIMIT 1`;

        db.query(settingsSql, (err, settingsRows) => {
            const defaults = {
                min_compliance: '70.00',
                allowed_missed: 2,
                required_hours: 30,
                missed_submission_deduction: 12,
                service_hour_shortfall_deduction: 2,
                absent_duty_deduction: 6,
                late_submission_deduction: 5,
                negative_letter_deduction: 8,
                quality_drop_deduction: 4,
                extra_service_bonus: 2,
                good_maintenance_bonus: 5,
            };
            const settings = (settingsRows && settingsRows[0]) ? settingsRows[0] : defaults;

            db.query(submissionSql, scholarIds, (err, subStats) => {
                if (err) return res.status(500).json({ message: 'Failed to fetch submission stats.' });

                db.query(attendanceSql, scholarIds, (err, attStats) => {
                    if (err) return res.status(500).json({ message: 'Failed to fetch attendance stats.' });

                    const subMap = {};
                    subStats.forEach(s => { subMap[s.scholar_id] = s; });

                    const attMap = {};
                    attStats.forEach(a => { attMap[a.scholar_id] = a; });

                    const gradesSql = `
                        SELECT scholar_id,
                            CASE WHEN SUM(units) > 0 THEN ROUND(SUM(units * grade) / SUM(units), 2) ELSE NULL END AS gwa
                        FROM grades
                        WHERE scholar_id IN (${placeholders})
                        GROUP BY scholar_id
                    `;

                    db.query(gradesSql, scholarIds, (err, gradeRows) => {
                        const gpaMap = {};
                        if (!err && Array.isArray(gradeRows)) {
                            gradeRows.forEach(g => { gpaMap[g.scholar_id] = g.gwa; });
                        }

                        const today = new Date();
                        const results = [];

                        const minComplianceNum = settings && settings.min_compliance ? parseFloat(settings.min_compliance) : 70;
                        const requiredHoursNum = settings && settings.required_hours ? parseInt(settings.required_hours, 10) : 0;
                        const allowedMissedNum = settings && settings.allowed_missed ? parseInt(settings.allowed_missed, 10) : 0;

                        const penalties = {
                            missedSubmission:      settings.missed_submission_deduction ?? defaults.missed_submission_deduction,
                            serviceHourShortfall:  settings.service_hour_shortfall_deduction ?? defaults.service_hour_shortfall_deduction,
                            absentDuty:            settings.absent_duty_deduction ?? defaults.absent_duty_deduction,
                            lateSubmission:        settings.late_submission_deduction ?? defaults.late_submission_deduction,
                            negativeLetter:        settings.negative_letter_deduction ?? defaults.negative_letter_deduction,
                            qualityDrop:           settings.quality_drop_deduction ?? defaults.quality_drop_deduction,
                            extraServiceBonus:     settings.extra_service_bonus ?? defaults.extra_service_bonus,
                            goodMaintenanceBonus:  settings.good_maintenance_bonus ?? defaults.good_maintenance_bonus,
                        };

                        const currentYear = today.getFullYear();
                        const termStart = today.getMonth() < 6 ? new Date(currentYear, 0, 1) : new Date(currentYear, 6, 1);
                        const termEnd = today.getMonth() < 6 ? new Date(currentYear, 5, 30) : new Date(currentYear, 11, 31);
                        const termDays = Math.max(1, Math.ceil((termEnd - termStart + 1) / (1000 * 60 * 60 * 24)));
                        const elapsedTermDays = Math.max(1, Math.min(termDays, Math.ceil((today - termStart + 1) / (1000 * 60 * 60 * 24))));
                        const termProgress = Math.min(1, Math.max(0, elapsedTermDays / termDays));
                        const expectedReports = Math.max(1, Math.round(6 * termProgress));
                        const requiredHoursTarget = Math.max(0, Math.round(requiredHoursNum * termProgress));

                        scholars.forEach(scholar => {
                            const sub = subMap[scholar.scholar_id] || null;
                            const att = attMap[scholar.scholar_id] || null;

                            // FIX: mysql2 can return DECIMAL/ROUND(...) results as
                            // STRINGS (e.g. "2.50") instead of numbers, depending on
                            // driver config. Coerce to a real Number here, once, so
                            // every downstream use (comparisons, .toFixed()) is safe.
                            // If the value is somehow unparsable, treat it as "no GWA
                            // on record" (null) instead of crashing the whole request.
                            const gwaRaw = gpaMap[scholar.scholar_id] !== undefined ? gpaMap[scholar.scholar_id] : null;
                            const gwaNum = gwaRaw !== null && gwaRaw !== undefined ? Number(gwaRaw) : null;
                            const gwa = Number.isFinite(gwaNum) ? gwaNum : null;

                            const lastSub = sub?.last_submission ? new Date(sub.last_submission) : null;
                            const daysSinceSubmission = lastSub
                                ? Math.floor((today - lastSub) / (1000 * 60 * 60 * 24))
                                : null; // null = wala pang submission kahit isa

                            const totalDuties    = att?.total_duties || 0;
                            const presentCount   = att?.present || 0;
                            const attendanceRate = totalDuties > 0
                                ? Math.round((presentCount / totalDuties) * 100)
                                : null; // null = walang naka-schedule na duty pa, hindi dapat parusahan

                            const avgQuality        = sub?.avg_quality ? Math.round(sub.avg_quality) : null;
                            const negativeLetters    = sub?.negative_letters || 0;
                            const totalSubs          = sub?.total_submissions || 0;
                            const totalServiceHours  = sub?.total_service_hours || 0;

                            const flags = [];
                            let totalDeduction = 0;

                            const addDeduction = (points, type, description, severity) => {
                                totalDeduction += points;
                                if (points <= 0) return;
                                flags.push({ type, description, severity });
                            };

                            // 1. Missed submissions (strong incident-based deduction)
                            {
                                const reportsTarget = Math.max(0, expectedReports - allowedMissedNum);
                                const missingReports = Math.max(0, reportsTarget - totalSubs);
                                const points = missingReports * penalties.missedSubmission;
                                addDeduction(points, 'Missed Submission',
                                    missingReports === 0
                                        ? `Submitted ${totalSubs} reports, meeting expected target of ${reportsTarget}.`
                                        : `${missingReports} missing report${missingReports === 1 ? '' : 's'} out of ${reportsTarget} expected (term progress ${Math.round(termProgress * 100)}%)`,
                                    missingReports >= 2 ? 'high' : 'medium');
                            }

                            // 2. Service hours shortfall (per-hour deduction)
                            {
                                const missingHours = Math.max(0, requiredHoursTarget - totalServiceHours);
                                const points = Math.round(missingHours * penalties.serviceHourShortfall);
                                addDeduction(points, 'Insufficient Service Hours',
                                    missingHours === 0
                                        ? `Completed service hours for current term progress (${totalServiceHours}/${requiredHoursTarget}h).`
                                        : `Short by ${missingHours} service hour${missingHours === 1 ? '' : 's'} for current term progress.`,
                                    missingHours >= 5 ? 'high' : 'medium');
                            }

                            // 3. Duty absence incidents
                            if (attendanceRate !== null) {
                                const absentCount = att?.absent || 0;
                                const points = absentCount * penalties.absentDuty;
                                addDeduction(points, 'Absent Duty',
                                    absentCount === 0
                                        ? `No duty absences recorded (${presentCount}/${totalDuties} present).`
                                        : `${absentCount} missed duty attendance${absentCount === 1 ? '' : 's'} out of ${totalDuties}`,
                                    absentCount >= 2 ? 'high' : 'medium');
                            }

                            // 4. Late submissions (stale reporting)
                            {
                                const daysLate = daysSinceSubmission === null ? 999 : Math.max(0, daysSinceSubmission - 30);
                                const periodsLate = Math.ceil(daysLate / 30);
                                const points = daysSinceSubmission === null ? penalties.lateSubmission * 2 : Math.min(penalties.lateSubmission * periodsLate, penalties.lateSubmission * 4);
                                addDeduction(points, 'Late Submission',
                                    daysSinceSubmission === null
                                        ? 'No reports submitted yet.'
                                        : `Last submission was ${daysSinceSubmission} days ago.`,
                                    daysSinceSubmission === null || daysLate >= 60 ? 'high' : 'medium');
                            }

                            // 5. Negative sentiment incidents
                            if (negativeLetters > 0) {
                                const points = negativeLetters * penalties.negativeLetter;
                                addDeduction(points, 'Negative Sentiment',
                                    `${negativeLetters} letter${negativeLetters === 1 ? '' : 's'} flagged for negative sentiment`,
                                    negativeLetters >= 2 ? 'high' : 'medium');
                            }

                            // 6. Quality drop incidents
                            if (avgQuality !== null && avgQuality < 70) {
                                const delta = Math.max(0, 70 - avgQuality);
                                const buckets = Math.ceil(delta / 10);
                                const points = Math.min(buckets * penalties.qualityDrop, penalties.qualityDrop * 3);
                                addDeduction(points, 'Low Quality Score',
                                    `Average submission quality is ${avgQuality}%`,
                                    avgQuality < 50 ? 'high' : 'medium');
                            }

                            // 7. Academic status is recorded for context only
                            const academicStatus = gwa !== null ? (gwa <= 2.5 ? 'good' : gwa <= 3.0 ? 'borderline' : 'at-risk') : 'no-record';
                            const averageQualityAndAttendance = (avgQuality !== null && attendanceRate !== null)
                                ? Math.round((avgQuality + attendanceRate) / 2)
                                : null;

                            // 8. Bonus credits for over-compliance
                            if (totalServiceHours > requiredHoursNum) {
                                const bonus = Math.round((totalServiceHours - requiredHoursNum) * penalties.extraServiceBonus);
                                totalDeduction = Math.max(0, totalDeduction - bonus);
                                if (bonus > 0) {
                                    flags.push({ type: 'Extra Service Hours', description: `Completed ${totalServiceHours} service hours, ${bonus} bonus deduction removed`, severity: 'low' });
                                }
                            }

                            if (averageQualityAndAttendance !== null && averageQualityAndAttendance >= 85 && totalSubs >= allowedMissedNum + 1) {
                                const bonus = penalties.goodMaintenanceBonus;
                                totalDeduction = Math.max(0, totalDeduction - bonus);
                                flags.push({ type: 'Good Compliance Maintenance', description: `Low-risk performance earned ${bonus} bonus deduction reduction`, severity: 'low' });
                            }

                            const overallCompliance = Math.max(0, Math.min(100, 100 - totalDeduction));
                            const riskScore = 100 - overallCompliance;

                            if (overallCompliance >= minComplianceNum || flags.length === 0) return;

                            results.push({
                                scholar_id:   scholar.scholar_id,
                                full_name:    scholar.full_name,
                                email:        scholar.email,
                                year_level:   scholar.year_level || 'N/A',
                                risk_score:   riskScore,
                                overall_compliance: overallCompliance,
                                risk_level:   riskScore >= 60 ? 'high' : 'medium',
                                flags,
                                academic_status: academicStatus,
                                stats: {
                                    total_submissions:    totalSubs,
                                    approved:             sub?.approved || 0,
                                    rejected:             sub?.rejected || 0,
                                    avg_quality:          avgQuality ?? 0,
                                    attendance_rate:      attendanceRate ?? 0,
                                    total_duties:         totalDuties,
                                    present:              presentCount,
                                    absent:               att?.absent || 0,
                                    negative_letters:     negativeLetters,
                                    gwa,
                                    min_compliance:        minComplianceNum,
                                    days_since_submission: daysSinceSubmission,
                                    last_submission:      sub?.last_submission || null,
                                },
                            });
                        });

                        results.sort((a, b) => b.risk_score - a.risk_score);
                        res.json(results);
                    });
                });
            });
        });
    });
};

// ─── LOG HOME VISIT REQUEST ─────────────────────────────────────────
// Called right before the frontend opens the Gmail compose window.
// Just records that a home visit was requested for this scholar, by
// whom (if the auth middleware sets req.user), and any note attached.
exports.logHomeVisit = (req, res) => {
    const { scholarId } = req.params;
    const { note } = req.body || {};

    if (!scholarId) {
        return res.status(400).json({ message: 'scholarId is required.' });
    }

    // If your auth middleware decodes the JWT and attaches the user to
    // req.user (e.g. { id, role, ... }), this will pick it up automatically.
    // If it doesn't yet, performed_by just stays null — safe either way.
    const performedBy = req.user?.id || null;

    const sql = `
        INSERT INTO scholar_interventions (scholar_id, type, note, performed_by)
        VALUES (?, 'home_visit', ?, ?)
    `;

    db.query(sql, [scholarId, note || null, performedBy], (err, result) => {
        if (err) {
            console.error('logHomeVisit error:', err);
            return res.status(500).json({ message: 'Failed to log home visit request.' });
        }
        res.status(201).json({ message: 'Home visit request logged.', id: result.insertId });
    });
};

// ─── LOG CONTACT SCHOLAR ACTION ─────────────────────────────────────
// Called when staff clicks "Contact Scholar" (mailto link), so there's
// a record of who was contacted and when.
exports.logContact = (req, res) => {
    const { scholarId } = req.params;
    const { note } = req.body || {};

    if (!scholarId) {
        return res.status(400).json({ message: 'scholarId is required.' });
    }

    const performedBy = req.user?.id || null;

    const sql = `
        INSERT INTO scholar_interventions (scholar_id, type, note, performed_by)
        VALUES (?, 'contact', ?, ?)
    `;

    db.query(sql, [scholarId, note || null, performedBy], (err, result) => {
        if (err) {
            console.error('logContact error:', err);
            return res.status(500).json({ message: 'Failed to log contact action.' });
        }
        res.status(201).json({ message: 'Contact action logged.', id: result.insertId });
    });
};

// ─── GET INTERVENTION HISTORY FOR A SCHOLAR ─────────────────────────
// Optional but handy: powers a "history" list under a scholar card
// showing every home visit / contact action logged for them.
exports.getInterventions = (req, res) => {
    const { scholarId } = req.params;

    const sql = `
        SELECT id, scholar_id, type, note, performed_by, created_at
        FROM scholar_interventions
        WHERE scholar_id = ?
        ORDER BY created_at DESC
    `;

    db.query(sql, [scholarId], (err, rows) => {
        if (err) {
            console.error('getInterventions error:', err);
            return res.status(500).json({ message: 'Failed to fetch intervention history.' });
        }
        res.json(rows);
    });
};