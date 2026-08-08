const db = require('../config/db');

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

const clampCompliance = (value) => Math.max(0, Math.min(100, Number(value.toFixed(2))));

const getComplianceSettings = (callback) => {
    db.query(
        `
            SELECT id, min_compliance, allowed_missed, required_hours,
                missed_submission_deduction, service_hour_shortfall_deduction,
                absent_duty_deduction, late_submission_deduction,
                negative_letter_deduction, quality_drop_deduction,
                extra_service_bonus, good_maintenance_bonus
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
    if (/^(1st|2nd|3rd|4th|5th)\s+Year$/i.test(normalized)) return 'college';
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
    settings = defaults,
    today = new Date(),
}) => {
    const requiredHoursNum = parseInt(settings.required_hours || defaults.required_hours, 10);
    const allowedMissedNum = parseInt(settings.allowed_missed || defaults.allowed_missed, 10);
    const penalties = {
        missedSubmission: settings.missed_submission_deduction ?? defaults.missed_submission_deduction,
        serviceHourShortfall: settings.service_hour_shortfall_deduction ?? defaults.service_hour_shortfall_deduction,
        absentDuty: settings.absent_duty_deduction ?? defaults.absent_duty_deduction,
        lateSubmission: settings.late_submission_deduction ?? defaults.late_submission_deduction,
        negativeLetter: settings.negative_letter_deduction ?? defaults.negative_letter_deduction,
        qualityDrop: settings.quality_drop_deduction ?? defaults.quality_drop_deduction,
        extraServiceBonus: settings.extra_service_bonus ?? defaults.extra_service_bonus,
        goodMaintenanceBonus: settings.good_maintenance_bonus ?? defaults.good_maintenance_bonus,
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

    let totalDeduction = 0;
    const deductions = {};

    const reportsTarget = Math.max(0, expectedReports - allowedMissedNum);
    const missingReports = Math.max(0, reportsTarget - totalSubs);
    const missedSubmissionPoints = missingReports * penalties.missedSubmission;
    totalDeduction += missedSubmissionPoints;
    deductions.missedSubmission = { points: missedSubmissionPoints, missingReports, reportsTarget };

    const missingHours = Math.max(0, requiredHoursTarget - totalServiceHours);
    const serviceHoursShortfallPoints = Math.round(missingHours * penalties.serviceHourShortfall);
    totalDeduction += serviceHoursShortfallPoints;
    deductions.serviceHourShortfall = { points: serviceHoursShortfallPoints, missingHours, requiredHoursTarget };

    const absentDutyPoints = attendanceRate !== null ? absentCount * penalties.absentDuty : 0;
    totalDeduction += absentDutyPoints;
    deductions.absentDuty = { points: absentDutyPoints, absentCount, attendanceRate };

    let lateSubmissionPoints = 0;
    if (daysSinceSubmission === null) {
        lateSubmissionPoints = penalties.lateSubmission * 2;
    } else {
        const daysLate = Math.max(0, daysSinceSubmission - 30);
        const periodsLate = Math.ceil(daysLate / 30);
        lateSubmissionPoints = Math.min(penalties.lateSubmission * periodsLate, penalties.lateSubmission * 4);
    }
    totalDeduction += lateSubmissionPoints;
    deductions.lateSubmission = {
        points: lateSubmissionPoints,
        daysSinceSubmission,
    };

    const negativeLetterPoints = negativeLetters * penalties.negativeLetter;
    totalDeduction += negativeLetterPoints;
    deductions.negativeLetter = { points: negativeLetterPoints, negativeLetters };

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

    const overallCompliance = clampCompliance(100 - totalDeduction);
    const riskScore = 100 - overallCompliance;
    const minComplianceNum = parseFloat(settings.min_compliance || defaults.min_compliance);

    return {
        overallCompliance,
        riskScore,
        totalDeduction,
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
                    SUM(CASE WHEN sentiment_label LIKE '%Negative%' THEN 1 ELSE 0 END) AS negative_letters
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
                        callback(null, score.overallCompliance, score.minComplianceNum);
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
