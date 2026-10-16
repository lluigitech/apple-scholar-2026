const db = require('../config/db');

const defaults = {
    min_compliance: '70.00',
    allowed_missed: 2,
    required_hours: 30,
    missed_submission_deduction: 2,
    service_hour_shortfall_deduction: 1,
    absent_duty_deduction: 2,
    late_submission_deduction: 1,
    quality_drop_deduction: 0.5,
    extra_service_bonus: 2,
    good_maintenance_bonus: 5,
    missed_submission_grace_count: 2,
    late_submission_grace_count: 2,
    recovery_enabled: 1,
    early_submission_bonus: 0.50,
    service_hours_completion_bonus: 2.00,
    consecutive_early_bonus: 1.00,
    perfect_attendance_bonus: 0.50,
    monthly_recovery_cap: 2.00,
};

const clampCompliance = (value) => Math.max(0, Math.min(100, Number(value.toFixed(2))));

const parseBooleanSetting = (value) => {
    return value === true || value === 1 || value === '1' || value === 'true';
};

const normalizeMonthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

const buildMonthSet = (monthsString) => {
    return new Set(
        (monthsString || '')
            .split(',')
            .map((monthKey) => monthKey.trim())
            .filter(Boolean)
    );
};

const calculateConsecutiveEarlyMonths = (earlyMonthSet, todayDate) => {
    if (!earlyMonthSet || earlyMonthSet.size === 0) return 0;

    let year = todayDate.getFullYear();
    let month = todayDate.getMonth() + 1;
    let count = 0;

    while (earlyMonthSet.has(normalizeMonthKey(year, month))) {
        count += 1;
        month -= 1;
        if (month === 0) {
            month = 12;
            year -= 1;
        }
        if (count >= 12) break;
    }

    return count;
};

const getComplianceSettings = (callback) => {
    db.query(
        `
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
        `,
        (err, rows) => {
            if (err) return callback(err, null);
            const settings = (rows && rows[0]) ? rows[0] : defaults;
            callback(null, settings);
        }
    );
};

const resolveGradeScale = (yearLevel) => {
    const normalized = typeof yearLevel === 'string' ? yearLevel.trim() : '';
    if (/^Grade\s+\d+$/i.test(normalized)) return 'k12';
    if (/^(1st|2nd|3rd|4th|5th)\s+Year(\s+College)?$/i.test(normalized)) return 'college';
    return 'k12';
};

const normalizeAcademicGrade = (gradeScale, rawGrade) => {
    const gradeValue = Number(rawGrade);
    if (!Number.isFinite(gradeValue)) return null;

    if (gradeScale === 'k12') {
        return Math.max(0, Math.min(100, gradeValue));
    }

    if (gradeScale === 'college') {
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

    if (normalizedScore >= 90) return 'Good Standing';
    if (normalizedScore >= 80) return 'Academic Watch';
    return 'Academic Probation';
};

const calculateComplianceScore = ({
    sub = null,
    att = null,
    settings = null,
    today = new Date(),
}) => {
    settings = settings || defaults;
    const requiredHoursNum = parseInt(settings.required_hours || defaults.required_hours, 10);
    const allowedMissedNum = parseInt(settings.allowed_missed || defaults.allowed_missed, 10);
    const missedGraceCount = parseInt(settings.missed_submission_grace_count ?? defaults.missed_submission_grace_count, 10);
    const lateGraceCount = parseInt(settings.late_submission_grace_count ?? defaults.late_submission_grace_count, 10);
    const recoveryEnabled = parseBooleanSetting(settings.recovery_enabled ?? defaults.recovery_enabled);
    const penalties = {
        missedSubmission: settings.missed_submission_deduction ?? defaults.missed_submission_deduction,
        serviceHourShortfall: settings.service_hour_shortfall_deduction ?? defaults.service_hour_shortfall_deduction,
        absentDuty: settings.absent_duty_deduction ?? defaults.absent_duty_deduction,
        lateSubmission: settings.late_submission_deduction ?? defaults.late_submission_deduction,
        qualityDrop: settings.quality_drop_deduction ?? defaults.quality_drop_deduction,
        extraServiceBonus: settings.extra_service_bonus ?? defaults.extra_service_bonus,
        goodMaintenanceBonus: settings.good_maintenance_bonus ?? defaults.good_maintenance_bonus,
    };
    const bonusSettings = {
        earlySubmissionBonus: parseFloat(settings.early_submission_bonus ?? defaults.early_submission_bonus),
        serviceHoursCompletionBonus: parseFloat(settings.service_hours_completion_bonus ?? defaults.service_hours_completion_bonus),
        consecutiveEarlyBonus: parseFloat(settings.consecutive_early_bonus ?? defaults.consecutive_early_bonus),
        perfectAttendanceBonus: parseFloat(settings.perfect_attendance_bonus ?? defaults.perfect_attendance_bonus),
        monthlyRecoveryCap: parseFloat(settings.monthly_recovery_cap ?? defaults.monthly_recovery_cap),
    };

    const todayDate = today instanceof Date ? today : new Date(today);
    const currentYear = todayDate.getFullYear();
    const termStart = todayDate.getMonth() < 6 ? new Date(currentYear, 0, 1) : new Date(currentYear, 6, 1);
    const termEnd = todayDate.getMonth() < 6 ? new Date(currentYear, 5, 30) : new Date(currentYear, 11, 31);
    const termDays = Math.max(1, Math.ceil((termEnd - termStart + 1) / (1000 * 60 * 60 * 24)));
    const elapsedTermDays = Math.max(1, Math.min(termDays, Math.ceil((todayDate - termStart + 1) / (1000 * 60 * 60 * 24))));
    const termProgress = Math.min(1, Math.max(0, elapsedTermDays / termDays));
    const expectedReports = Math.max(1, Math.round(6 * termProgress));
    const requiredHoursTarget = Math.max(0, Math.round(requiredHoursNum * termProgress));

    const totalSubs = Number(sub?.total_submissions || 0);
    const totalServiceHours = Number(sub?.total_service_hours || 0);
    const avgQuality = sub?.avg_quality ? Math.round(sub.avg_quality) : null;
    const negativeLetters = Number(sub?.negative_letters || 0);
    const lastSub = sub?.last_submission ? new Date(sub.last_submission) : null;
    const daysSinceSubmission = lastSub ? Math.floor((todayDate - lastSub) / (1000 * 60 * 60 * 24)) : null;
    const totalDuties = Number(att?.total_duties || 0);
    const presentCount = Number(att?.present || 0);
    const attendanceRate = totalDuties > 0 ? Math.round((presentCount / totalDuties) * 100) : null;
    const absentCount = Number(att?.absent || 0);

    const earlySubmissionCount = Number(sub?.early_submissions || 0);
    const earlySubmissionMonthSet = buildMonthSet(sub?.early_submission_months || '');
    const consecutiveEarlyMonths = calculateConsecutiveEarlyMonths(earlySubmissionMonthSet, todayDate);

    let totalDeduction = 0;
    const deductions = {};

    const rawMissingReports = Math.max(0, expectedReports - totalSubs);
    const penaltyMissedReports = Math.max(0, rawMissingReports - allowedMissedNum - missedGraceCount);
    const missedSubmissionPoints = penaltyMissedReports * penalties.missedSubmission;
    totalDeduction += missedSubmissionPoints;
    deductions.missedSubmission = {
        points: missedSubmissionPoints,
        missingReports: rawMissingReports,
        reportsTarget: Math.max(0, expectedReports - allowedMissedNum),
        allowedMissed: allowedMissedNum,
        graceCount: missedGraceCount,
        penalizedReports: penaltyMissedReports,
    };

    const missingHours = Math.max(0, requiredHoursTarget - totalServiceHours);
    const serviceHoursShortfallPoints = Math.round(missingHours * penalties.serviceHourShortfall);
    totalDeduction += serviceHoursShortfallPoints;
    deductions.serviceHourShortfall = { points: serviceHoursShortfallPoints, missingHours, requiredHoursTarget };

    const absentDutyPoints = attendanceRate !== null ? absentCount * penalties.absentDuty : 0;
    totalDeduction += absentDutyPoints;
    deductions.absentDuty = { points: absentDutyPoints, absentCount, attendanceRate };

    let lateSubmissionPoints = 0;
    let latePeriods = 0;
    let effectiveLatePeriods = 0;
    if (daysSinceSubmission === null) {
        latePeriods = 2;
    } else {
        const daysLate = Math.max(0, daysSinceSubmission - 30);
        latePeriods = Math.ceil(daysLate / 30);
    }
    effectiveLatePeriods = Math.max(0, latePeriods - lateGraceCount);
    lateSubmissionPoints = Math.min(penalties.lateSubmission * effectiveLatePeriods, penalties.lateSubmission * 4);
    totalDeduction += lateSubmissionPoints;
    deductions.lateSubmission = {
        points: lateSubmissionPoints,
        daysSinceSubmission,
        latePeriods,
        graceCount: lateGraceCount,
        penalizedPeriods: effectiveLatePeriods,
    };

    // Negative sentiment remains available for review and reporting, but it is
    // not a compliance deduction.
    deductions.negativeLetter = { points: 0, negativeLetters };

    let qualityDropPoints = 0;
    if (avgQuality !== null && avgQuality < 70) {
        const delta = Math.max(0, 70 - avgQuality);
        const buckets = Math.ceil(delta / 10);
        qualityDropPoints = Math.min(buckets * penalties.qualityDrop, penalties.qualityDrop * 3);
        totalDeduction += qualityDropPoints;
    }
    deductions.qualityDrop = { points: qualityDropPoints, avgQuality };

    const extraServiceBonusPoints = totalServiceHours > requiredHoursNum
        ? Math.round((totalServiceHours - requiredHoursNum) * penalties.extraServiceBonus)
        : 0;
    if (extraServiceBonusPoints > 0) {
        totalDeduction = Math.max(0, totalDeduction - extraServiceBonusPoints);
    }
    deductions.extraServiceBonus = {
        points: extraServiceBonusPoints,
        totalServiceHours,
        requiredHoursNum,
    };

    const averageQualityAndAttendance = (avgQuality !== null && attendanceRate !== null)
        ? Math.round((avgQuality + attendanceRate) / 2)
        : null;
    const hasNoComplianceHistory = totalSubs === 0 && totalDuties === 0 && totalServiceHours === 0 && negativeLetters === 0 && avgQuality === null;
    const goodMaintenanceBonusPoints = averageQualityAndAttendance !== null
        && averageQualityAndAttendance >= 85
        && totalSubs >= allowedMissedNum + 1
        ? penalties.goodMaintenanceBonus
        : 0;
    if (goodMaintenanceBonusPoints > 0) {
        totalDeduction = Math.max(0, totalDeduction - goodMaintenanceBonusPoints);
    }
    deductions.goodMaintenanceBonus = {
        points: goodMaintenanceBonusPoints,
        averageQualityAndAttendance,
        totalSubs,
        allowedMissedNum,
    };

    const bonuses = {
        earlySubmission: 0,
        consecutiveEarly: 0,
        serviceHoursCompletion: 0,
        perfectAttendance: 0,
        totalBonusPoints: 0,
    };

    if (recoveryEnabled) {
        if (earlySubmissionCount > 0) {
            bonuses.earlySubmission = bonusSettings.earlySubmissionBonus;
        }

        if (consecutiveEarlyMonths >= 2) {
            bonuses.consecutiveEarly = bonusSettings.consecutiveEarlyBonus * (consecutiveEarlyMonths - 1);
        }

        if (requiredHoursTarget > 0 && totalServiceHours >= requiredHoursTarget) {
            bonuses.serviceHoursCompletion = bonusSettings.serviceHoursCompletionBonus;
        }

        if (totalDuties > 0 && absentCount === 0 && attendanceRate === 100) {
            bonuses.perfectAttendance = bonusSettings.perfectAttendanceBonus;
        }

        bonuses.totalBonusPoints = Object.values(bonuses).reduce((sum, value) => sum + value, 0);
        if (bonuses.totalBonusPoints > bonusSettings.monthlyRecoveryCap) {
            const scale = bonusSettings.monthlyRecoveryCap / bonuses.totalBonusPoints;
            bonuses.earlySubmission = Math.round((bonuses.earlySubmission * scale + Number.EPSILON) * 100) / 100;
            bonuses.consecutiveEarly = Math.round((bonuses.consecutiveEarly * scale + Number.EPSILON) * 100) / 100;
            bonuses.serviceHoursCompletion = Math.round((bonuses.serviceHoursCompletion * scale + Number.EPSILON) * 100) / 100;
            bonuses.perfectAttendance = Math.round((bonuses.perfectAttendance * scale + Number.EPSILON) * 100) / 100;
            bonuses.totalBonusPoints = bonusSettings.monthlyRecoveryCap;
        }

        totalDeduction = Math.max(0, totalDeduction - bonuses.totalBonusPoints);
    }

    if (hasNoComplianceHistory) {
        return {
            overallCompliance: 100,
            riskScore: 0,
            totalDeduction: 0,
            totalBonusPoints: 0,
            recoverableCredits: 0,
            recoveryEnabled,
            bonuses: {
                earlySubmission: 0,
                consecutiveEarly: 0,
                serviceHoursCompletion: 0,
                perfectAttendance: 0,
                totalBonusPoints: 0,
            },
            minComplianceNum: parseFloat(settings.min_compliance || defaults.min_compliance),
            deductions: {
                missedSubmission: { points: 0, missingReports: 0, reportsTarget: 0, allowedMissed: allowedMissedNum, graceCount: missedGraceCount, penalizedReports: 0 },
                serviceHourShortfall: { points: 0, missingHours: 0, requiredHoursTarget: 0 },
                absentDuty: { points: 0, absentCount: 0, attendanceRate: 0 },
                lateSubmission: { points: 0, daysSinceSubmission: null, latePeriods: 0, graceCount: lateGraceCount, penalizedPeriods: 0 },
                negativeLetter: { points: 0, negativeLetters: 0 },
                qualityDrop: { points: 0, avgQuality: null },
                extraServiceBonus: { points: 0, totalServiceHours: 0, requiredHoursNum: requiredHoursNum },
                goodMaintenanceBonus: { points: 0, averageQualityAndAttendance: null, totalSubs: 0, allowedMissedNum },
            },
            stats: {
                total_submissions: totalSubs,
                total_service_hours: totalServiceHours,
                avg_quality: avgQuality,
                attendance_rate: attendanceRate,
                absent: absentCount,
                negative_letters: negativeLetters,
                days_since_submission: daysSinceSubmission,
                total_duties: totalDuties,
                present: presentCount,
                early_submission_count: earlySubmissionCount,
                consecutive_early_months: consecutiveEarlyMonths,
                recoverable_credits: 0,
            },
        };
    }

    const overallCompliance = clampCompliance(100 - totalDeduction);
    const riskScore = 100 - overallCompliance;
    const minComplianceNum = parseFloat(settings.min_compliance || defaults.min_compliance);
    const recoverableCredits = recoveryEnabled ? Math.max(0, bonuses.totalBonusPoints) : 0;

    return {
        overallCompliance,
        riskScore,
        totalDeduction,
        totalBonusPoints: bonuses.totalBonusPoints,
        recoverableCredits,
        recoveryEnabled,
        bonuses,
        minComplianceNum,
        deductions,
        stats: {
            total_submissions: totalSubs,
            total_service_hours: totalServiceHours,
            avg_quality: avgQuality,
            attendance_rate: attendanceRate,
            absent: absentCount,
            negative_letters: negativeLetters,
            days_since_submission: daysSinceSubmission,
            total_duties: totalDuties,
            present: presentCount,
            early_submission_count: earlySubmissionCount,
            consecutive_early_months: consecutiveEarlyMonths,
            recoverable_credits: recoverableCredits,
        },
    };
};

const calculateCurrentCompliance = (scholarId, callback) => {
    getComplianceSettings((settingsErr, settings) => {
        if (settingsErr) return callback(settingsErr, null);

        const today = new Date();

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
            [scholarId],
            (subErr, subRows) => {
                if (subErr) return callback(subErr, null);
                const sub = subRows && subRows[0] ? subRows[0] : null;

                db.query(
                    `
                        SELECT
                            COUNT(*) AS total_duties,
                            SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
                            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent
                        FROM duty_attendance
                        WHERE scholar_id = ?
                    `,
                    [scholarId],
                    (attErr, attRows) => {
                        if (attErr) return callback(attErr, null);
                        const att = attRows && attRows[0] ? attRows[0] : null;

                        const score = calculateComplianceScore({ sub, att, settings, today });
                        callback(null, score.overallCompliance, score.minComplianceNum, score);
                    }
                );
            }
        );
    });
};

const logComplianceIncident = (scholarId, incidentType, deductionPoints, beforeCompliance, afterCompliance, details) => {
    db.query(
        `
            INSERT INTO compliance_incident_log
                (scholar_id, incident_type, deduction_points, before_compliance, after_compliance, details, triggered_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [scholarId, incidentType, deductionPoints, beforeCompliance, afterCompliance, details, null],
        (err) => {
            if (err) {
                console.error('logComplianceIncident error:', err);
            }

            db.query('SELECT email FROM users WHERE scholar_id = ? LIMIT 1', [scholarId], (userErr, userRows) => {
                if (userErr || !userRows || userRows.length === 0) return;
                const recipient = userRows[0].email;
                db.query(
                    'INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail) VALUES (?, ?, ?, ?, ?, ?)',
                    [scholarId, recipient, 'system', 'compliance_flag_triggered', 'generated', `${incidentType}: ${details || 'Compliance flag triggered.'}`],
                    () => { /* ignore logging errors */ }
                );
            });
        }
    );
};

const logComplianceBonus = (scholarId, bonusType, bonusPoints, beforeCompliance, afterCompliance, details) => {
    db.query(
        `
            INSERT INTO compliance_bonus_log
                (scholar_id, bonus_type, bonus_points, before_compliance, after_compliance, details, triggered_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [scholarId, bonusType, bonusPoints, beforeCompliance, afterCompliance, details, null],
        (err) => {
            if (err) {
                console.error('logComplianceBonus error:', err);
            }
        }
    );
};

module.exports = {
    defaults,
    clampCompliance,
    getComplianceSettings,
    resolveGradeScale,
    normalizeAcademicGrade,
    getAcademicTier,
    calculateComplianceScore,
    calculateCurrentCompliance,
    logComplianceIncident,
    logComplianceBonus,
};
