const db = require('../config/db');
const { calculateComplianceScore } = require('../utils/complianceLogger');

const normalizeAcademicGrade = (gradeScale, rawGrade) => {
    const gradeValue = Number(rawGrade);
    if (!Number.isFinite(gradeValue)) return null;

    if (gradeScale === 'k12') {
        return Math.max(0, Math.min(100, gradeValue));
    }

    if (gradeScale === 'college') {
        // TODO: confirm exact values with foundation policy.
        const collegeScaleMap = {
            1.00: 100,
            1.25: 96,
            1.50: 92,
            1.75: 88,
            2.00: 84,
            2.25: 80,
            2.50: 76,
            2.75: 72,
            3.00: 68,
            3.25: 64,
            3.50: 60,
            3.75: 56,
            4.00: 52,
            4.25: 48,
            4.50: 44,
            4.75: 40,
            5.00: 36,
        };

        const exactMatch = collegeScaleMap[gradeValue];
        if (exactMatch !== undefined) {
            return exactMatch;
        }

        const clamped = Math.max(1, Math.min(5, gradeValue));
        const floorKey = Math.floor(clamped * 4) / 4;
        const ceilKey = Math.ceil(clamped * 4) / 4;

        const floorValue = collegeScaleMap[floorKey];
        const ceilValue = collegeScaleMap[ceilKey];

        if (floorValue === undefined || ceilValue === undefined) {
            return null;
        }

        const ratio = (clamped - floorKey) / (ceilKey - floorKey || 1);
        return Math.round((floorValue + (ceilValue - floorValue) * ratio));
    }

    return null;
};

const getAcademicTier = (normalizedScore) => {
    if (normalizedScore === null || normalizedScore === undefined) return 'No Academic Record';

    // TODO: confirm exact values with foundation policy.
    if (normalizedScore >= 90) return 'Good Standing';
    if (normalizedScore >= 80) return 'Academic Watch';
    return 'Academic Probation';
};

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
                SUM(CASE WHEN sentiment_label LIKE '%Negative%' THEN 1 ELSE 0 END) AS negative_letters,
                SUM(CASE WHEN submission_type = 'letter' AND submitted_at <= DATE_SUB(LAST_DAY(submitted_at), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS early_submissions,
                GROUP_CONCAT(DISTINCT DATE_FORMAT(submitted_at, '%Y-%m') ORDER BY DATE_FORMAT(submitted_at, '%Y-%m') SEPARATOR ',') AS early_submission_months
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
            extra_service_bonus, good_maintenance_bonus,
            missed_submission_grace_count, late_submission_grace_count,
            recovery_enabled, early_submission_bonus,
            service_hours_completion_bonus, consecutive_early_bonus,
            perfect_attendance_bonus, monthly_recovery_cap
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
                missed_submission_grace_count: 2,
                late_submission_grace_count: 2,
                recovery_enabled: 1,
                early_submission_bonus: 0.50,
                service_hours_completion_bonus: 2.00,
                consecutive_early_bonus: 1.00,
                perfect_attendance_bonus: 0.50,
                monthly_recovery_cap: 3.00,
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
                        SELECT g.scholar_id, g.units, g.grade, g.grade_scale
                        FROM grades g
                        WHERE g.scholar_id IN (${placeholders})
                    `;

                    db.query(gradesSql, scholarIds, (err, gradeRows) => {
                        const academicMap = {};
                        if (!err && Array.isArray(gradeRows)) {
                            const normalizedScores = {};

                            gradeRows.forEach(row => {
                                const scholarId = row.scholar_id;
                                const gradeScale = row.grade_scale || 'k12';
                                const normalizedGrade = normalizeAcademicGrade(gradeScale, row.grade);
                                const units = Number(row.units) || 0;

                                if (normalizedGrade === null || units <= 0) return;

                                if (!normalizedScores[scholarId]) {
                                    normalizedScores[scholarId] = { weightedSum: 0, totalUnits: 0 };
                                }

                                normalizedScores[scholarId].weightedSum += units * normalizedGrade;
                                normalizedScores[scholarId].totalUnits += units;
                            });

                            Object.entries(normalizedScores).forEach(([scholarId, summary]) => {
                                if (summary.totalUnits > 0) {
                                    academicMap[scholarId] = Number((summary.weightedSum / summary.totalUnits).toFixed(2));
                                }
                            });
                        }

                        const today = new Date();
                        const results = [];

                        scholars.forEach(scholar => {
                            const sub = subMap[scholar.scholar_id] || null;
                            const att = attMap[scholar.scholar_id] || null;

                            const normalizedAcademicScore = academicMap[scholar.scholar_id] !== undefined
                                ? academicMap[scholar.scholar_id]
                                : null;
                            const academicStatus = getAcademicTier(normalizedAcademicScore);

                            const score = calculateComplianceScore({ sub, att, settings, today });
                            const overallCompliance = score.overallCompliance;
                            const riskScore = score.riskScore;
                            const flags = [];

                            const addFlag = (type, description, severity) => {
                                flags.push({ type, description, severity });
                            };

                            if (score.deductions.missedSubmission.points > 0) {
                                addFlag(
                                    'Missed Submission',
                                    score.deductions.missedSubmission.missingReports === 0
                                        ? `Submitted ${sub?.total_submissions || 0} reports, meeting expected target of ${score.deductions.missedSubmission.reportsTarget}.`
                                        : `${score.deductions.missedSubmission.missingReports} missing report${score.deductions.missedSubmission.missingReports === 1 ? '' : 's'} out of ${score.deductions.missedSubmission.reportsTarget} expected (term progress ${Math.round((Math.max(1, Math.min(365, Math.ceil((today - new Date(today.getFullYear(), today.getMonth() < 6 ? 0 : 6, 1) + 1) / (1000 * 60 * 60 * 24))) / Math.max(1, Math.ceil((new Date(today.getFullYear(), today.getMonth() < 6 ? 5 : 11, 31) - new Date(today.getFullYear(), today.getMonth() < 6 ? 0 : 6, 1) + 1) / (1000 * 60 * 60 * 24)))) * 100))}%)`,
                                    score.deductions.missedSubmission.missingReports >= 2 ? 'high' : 'medium'
                                );
                            }

                            if (score.deductions.serviceHourShortfall.points > 0) {
                                addFlag(
                                    'Insufficient Service Hours',
                                    score.deductions.serviceHourShortfall.missingHours === 0
                                        ? `Completed service hours for current term progress (${score.stats.total_service_hours}/${score.deductions.serviceHourShortfall.requiredHoursTarget}h).`
                                        : `Short by ${score.deductions.serviceHourShortfall.missingHours} service hour${score.deductions.serviceHourShortfall.missingHours === 1 ? '' : 's'} for current term progress.`,
                                    score.deductions.serviceHourShortfall.missingHours >= 5 ? 'high' : 'medium'
                                );
                            }

                            if (score.deductions.absentDuty.points > 0) {
                                addFlag(
                                    'Absent Duty',
                                    `${score.deductions.absentDuty.absentCount} missed duty attendance${score.deductions.absentDuty.absentCount === 1 ? '' : 's'} out of ${score.stats.total_duties}`,
                                    score.deductions.absentDuty.absentCount >= 2 ? 'high' : 'medium'
                                );
                            }

                            if (score.deductions.lateSubmission.points > 0) {
                                addFlag(
                                    'Late Submission',
                                    score.deductions.lateSubmission.daysSinceSubmission === null
                                        ? 'No reports submitted yet.'
                                        : `Last submission was ${score.deductions.lateSubmission.daysSinceSubmission} days ago.`,
                                    score.deductions.lateSubmission.daysSinceSubmission === null ? 'high' : 'medium'
                                );
                            }

                            if (score.deductions.negativeLetter.points > 0) {
                                addFlag(
                                    'Negative Sentiment',
                                    `${score.deductions.negativeLetter.negativeLetters} letter${score.deductions.negativeLetter.negativeLetters === 1 ? '' : 's'} flagged for negative sentiment`,
                                    score.deductions.negativeLetter.negativeLetters >= 2 ? 'high' : 'medium'
                                );
                            }

                            if (score.deductions.qualityDrop.points > 0) {
                                addFlag(
                                    'Low Quality Score',
                                    `Average submission quality is ${score.deductions.qualityDrop.avgQuality}%`,
                                    score.deductions.qualityDrop.avgQuality < 50 ? 'high' : 'medium'
                                );
                            }

                            if (score.deductions.extraServiceBonus.points > 0) {
                                addFlag(
                                    'Extra Service Hours',
                                    `Completed ${score.deductions.extraServiceBonus.totalServiceHours} service hours, ${score.deductions.extraServiceBonus.points} bonus deduction removed`,
                                    'low'
                                );
                            }

                            if (score.deductions.goodMaintenanceBonus.points > 0) {
                                addFlag(
                                    'Good Compliance Maintenance',
                                    `Low-risk performance earned ${score.deductions.goodMaintenanceBonus.points} bonus deduction reduction`,
                                    'low'
                                );
                            }

                            if (overallCompliance >= score.minComplianceNum || flags.length === 0) return;

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
                                    total_submissions:    sub?.total_submissions || 0,
                                    approved:             sub?.approved || 0,
                                    rejected:             sub?.rejected || 0,
                                    avg_quality:          sub?.avg_quality ? Math.round(sub.avg_quality) : 0,
                                    attendance_rate:      score.stats.attendance_rate ?? 0,
                                    total_duties:         score.stats.total_duties,
                                    present:              score.stats.present,
                                    absent:               score.stats.absent,
                                    negative_letters:     score.stats.negative_letters,
                                    gwa: normalizedAcademicScore,
                                    min_compliance:        score.minComplianceNum,
                                    days_since_submission: score.stats.days_since_submission,
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