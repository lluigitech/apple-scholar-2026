const db = require('../config/db');
const exportController = require('./exportcontroller');
const { sendAnnouncementNotifyEmails } = require('../utils/notifyHelpers');
const { logComplianceIncident, clampCompliance } = require('../utils/complianceLogger');
const { applyOfficerYearLevelFilter, getAssignedYearLevels, normalizeYearLevel, yearLevelSqlExpression } = require('../utils/officerAssignments');
const submissionController = require('./submissionController');
const { logPrivacyAccess } = require('../middleware/privacyAccess');

const formatDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const mm = `${d.getMonth() + 1}`.padStart(2, '0');
    const dd = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
};

const buildPeriodRange = (period, dateFrom, dateTo) => {
    const today = new Date();
    const year = today.getFullYear();

    if (/^\d{4}-\d{2}$/.test(period || '')) {
        const [selectedYear, selectedMonth] = period.split('-').map(Number);
        const start = new Date(selectedYear, selectedMonth - 1, 1);
        const end = new Date(selectedYear, selectedMonth, 0);
        return { start: formatDate(start), end: formatDate(end) };
    }

    if (period === 'Current Month') {
        const start = new Date(year, today.getMonth(), 1);
        const end = new Date(year, today.getMonth() + 1, 0);
        return { start: formatDate(start), end: formatDate(end) };
    }

    if (period === 'Last Month') {
        const start = new Date(year, today.getMonth() - 1, 1);
        const end = new Date(year, today.getMonth(), 0);
        return { start: formatDate(start), end: formatDate(end) };
    }

    if (period === 'Current Semester') {
        if (today.getMonth() < 6) {
            return { start: `${year}-01-01`, end: `${year}-06-30` };
        }
        return { start: `${year}-07-01`, end: `${year}-12-31` };
    }

    if (period === 'Academic Year 2026') {
        return { start: '2026-01-01', end: '2026-12-31' };
    }

    if (period === 'Custom Range' && dateFrom && dateTo) {
        const start = formatDate(dateFrom);
        const end = formatDate(dateTo);
        if (start && end) return { start, end };
    }

    return null;
};

exports.getAssignedYearLevels = async (req, res) => {
    try {
        res.json(await require('../utils/officerAssignments').getAssignedYearLevels(req.user.id));
    } catch (error) {
        console.error('Failed to fetch officer year levels:', error);
        res.status(500).json({ error: 'Failed to fetch assigned year levels.' });
    }
};

exports.getComplianceDueReminders = async (req, res) => {
    try {
        const assignedLevels = await getAssignedYearLevels(req.user.id);
        if (!assignedLevels.length) return res.json([]);

        const normalizedLevels = assignedLevels.map(normalizeYearLevel);
        const [tasks] = await db.promise().query(
            `SELECT id, title, type, due_date, created_at, target_year_levels,
                    DATEDIFF(due_date, CURDATE()) AS days_remaining
             FROM tasks
             WHERE is_active = 1
               AND due_date IS NOT NULL
               AND DATE(due_date) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
             ORDER BY due_date ASC, id ASC`
        );
        if (!tasks.length) return res.json([]);

        const levelWhere = yearLevelSqlExpression('u.year_level');
        const levelPlaceholders = normalizedLevels.map(() => '?').join(', ');
        const [scholars] = await db.promise().query(
            `SELECT u.scholar_id, u.full_name, u.year_level
             FROM users u
             WHERE u.role = 'scholar' AND u.status = 'active'
               AND ${levelWhere} IN (${levelPlaceholders})`,
            normalizedLevels
        );
        if (!scholars.length) return res.json([]);

        const scholarIds = scholars.map(scholar => scholar.scholar_id);
        const [submissions] = await db.promise().query(
            `SELECT scholar_id, submission_type, status, submitted_at
             FROM submissions
             WHERE scholar_id IN (?)`,
            [scholarIds]
        );
        const [grades] = await db.promise().query(
            `SELECT scholar_id, 'grades' AS submission_type,
                    verification_status AS status, created_at AS submitted_at
             FROM grades
             WHERE scholar_id IN (?)`,
            [scholarIds]
        );
        const records = [...submissions, ...grades];
        const taskTypes = {
            'monthly report': ['letter'],
            'report card': ['report_card', 'grades'],
            'cor upload': ['cor'],
            'other documents': ['other'],
        };
        const parseLevels = value => {
            if (Array.isArray(value)) return value;
            try {
                const parsed = JSON.parse(value || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        };
        const dateValue = value => {
            if (!value) return null;
            const normalized = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
            const timestamp = normalized.getTime();
            return Number.isNaN(timestamp) ? null : timestamp;
        };

        const reminders = tasks.map(task => {
            const matchedTypes = taskTypes[String(task.type || '').trim().toLowerCase()];
            if (!matchedTypes) return null;

            const targetLevels = parseLevels(task.target_year_levels).map(normalizeYearLevel);
            const taskCreatedAt = dateValue(task.created_at);
            const outstandingScholars = scholars.filter(scholar => {
                if (targetLevels.length && !targetLevels.includes(normalizeYearLevel(scholar.year_level))) return false;

                const latest = records
                    .filter(record => record.scholar_id === scholar.scholar_id
                        && matchedTypes.includes(record.submission_type)
                        && (taskCreatedAt == null || (dateValue(record.submitted_at) || 0) >= taskCreatedAt))
                    .sort((a, b) => (dateValue(b.submitted_at) || 0) - (dateValue(a.submitted_at) || 0))[0];

                if (!latest) return true;
                return ['returned', 'rejected', 'needs_revision', 'needs-revision', 'needs revision']
                    .includes(String(latest.status || '').trim().toLowerCase());
            }).map(({ scholar_id, full_name }) => ({ scholar_id, full_name }));

            if (!outstandingScholars.length) return null;
            return {
                id: task.id,
                title: task.title,
                type: task.type,
                due_date: task.due_date,
                days_remaining: Number(task.days_remaining),
                outstanding_count: outstandingScholars.length,
                scholars: outstandingScholars,
            };
        }).filter(Boolean);

        return res.json(reminders);
    } catch (error) {
        console.error('Failed to fetch Officer compliance due reminders:', error);
        return res.status(500).json({ error: 'Failed to fetch compliance due reminders.' });
    }
};

// ─── GET ANNOUNCEMENTS ────────────────────────────────────────
exports.getAnnouncements = (req, res) => {
    const sql = `
        SELECT a.id, a.title, a.content, a.priority, a.target_roles, a.target_levels,
               a.created_by, a.created_by_role, a.is_active, a.created_at,
               u.full_name AS created_by_name
        FROM announcements a
        LEFT JOIN users u ON u.id = a.created_by
        WHERE a.is_active = 1 AND (JSON_CONTAINS(a.target_roles, '"officer"') OR a.created_by_role = 'officer')
        ORDER BY a.created_at DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching officer announcements:', err);
            return res.status(500).json({ message: 'Failed to fetch announcements.' });
        }

        const parsed = results.map(row => ({
            ...row,
            target_roles: typeof row.target_roles === 'string' ? JSON.parse(row.target_roles || '[]') : (row.target_roles || []),
            target_levels: typeof row.target_levels === 'string' ? JSON.parse(row.target_levels || '[]') : (row.target_levels || []),
            created_by_role: String(row.created_by_role || '').trim().toLowerCase(),
            created_by_name: row.created_by_name || (row.created_by ? 'Unknown' : 'System'),
        }));

        res.json(parsed);
    });
};

exports.generateComplianceSummaryPdf = async (req, res) => {
    try {
        // Merge body into query and derive a descriptive report title + date range
        const incoming = { ...req.query, ...req.body };
        const period = incoming.period || incoming.period_range || incoming.range;
        // derive date range if period provided
        const range = buildPeriodRange(period, incoming.dateFrom || incoming.date_from, incoming.dateTo || incoming.date_to);

        const dateFrom = range?.start || incoming.date_from || incoming.dateFrom || null;
        const dateTo = range?.end   || incoming.date_to   || incoming.dateTo   || null;

        const titleParts = ['Compliance Summary'];
        if (period) titleParts.push(period);
        else if (dateFrom || dateTo) titleParts.push(`${dateFrom || '—'} to ${dateTo || '—'}`);

        const reportTitle = titleParts.join(' — ');

        req.query = {
            ...req.query,
            ...req.body,
            type: 'compliance',
            date_from: dateFrom,
            date_to: dateTo,
            spreadsheet_title: reportTitle,
        };

        await exportController.exportPDF(req, res);
    } catch (err) {
        console.error('Error generating officer compliance summary PDF:', err);
        res.status(500).json({ error: 'Failed to generate compliance summary PDF.' });
    }
};

// ─── CREATE ANNOUNCEMENT ──────────────────────────────────────
exports.createAnnouncement = (req, res) => {
    const { title, content, priority = 'info', created_by, target_roles = [], target_levels = [] } = req.body;

    if (!title || !content || !created_by) {
        return res.status(400).json({ message: 'title, content, and created_by are required.' });
    }

    const roles = target_roles.filter(r => ['scholar', 'staff'].includes(r));
    if (!roles.length) {
        return res.status(400).json({ message: 'Select at least one audience (Scholar or Staff).' });
    }

    const levels = roles.includes('scholar') ? target_levels : [];

    const creatorId = created_by === undefined || created_by === null || created_by === '' ? null : Number(created_by);
    const sql = `
        INSERT INTO announcements (title, content, priority, target_roles, target_levels, created_by, created_by_role, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'officer', 1, NOW())
    `;

    db.query(sql, [title, content, priority, JSON.stringify(roles), JSON.stringify(levels), creatorId], (err, result) => {
        if (err) {
            console.error('Error creating officer announcement:', err);
            return res.status(500).json({ message: 'Failed to create announcement.' });
        }
        res.status(201).json({ message: 'Announcement posted successfully.', id: result.insertId });
    });
};

exports.notifyAnnouncement = (req, res) => {
    const { id } = req.params;
    sendAnnouncementNotifyEmails(id, (err, result) => {
        if (err) return res.status(400).json({ error: 'Failed to send announcement notifications', detail: String(err) });
        if (result && result.error) return res.status(400).json(result);
        res.json(result);
    });
};

// ─── GET DUTIES (for attendance dropdown) ─────────────────────
exports.getDuties = (req, res) => {
    const sql = `SELECT id, title, due_date, status FROM officer_duties ORDER BY created_at DESC`;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching officer duties:', err);
            return res.status(500).json({ message: 'Failed to fetch duties.' });
        }
        res.json(results);
    });
};

// ─── GET ATTENDANCE (by duty_id) ──────────────────────────────
exports.getAttendance = (req, res) => {
    const { duty_id } = req.query;
    if (!duty_id) return res.status(400).json({ message: 'duty_id is required.' });

    const sql = `
        SELECT
            oa.id,
            oa.officer_id,
            oa.duty_id,
            oa.check_in,
            oa.check_out,
            oa.method,
            oa.marked_by,
            oa.remarks,
            u.full_name,
            u.scholar_id
        FROM officer_attendance oa
        LEFT JOIN users u ON u.id = oa.officer_id
        WHERE oa.duty_id = ?
        ORDER BY oa.check_in DESC
    `;
    db.query(sql, [duty_id], (err, results) => {
        if (err) {
            console.error('Error fetching attendance:', err);
            return res.status(500).json({ message: 'Failed to fetch attendance.' });
        }
        res.json(results);
    });
};

// ─── MARK CHECK-IN ────────────────────────────────────────────
exports.markAttendance = (req, res) => {
    const { officer_id, duty_id, method = 'manual', marked_by, remarks = '' } = req.body;

    if (!officer_id || !duty_id || !marked_by) {
        return res.status(400).json({ message: 'officer_id, duty_id, and marked_by are required.' });
    }

    // Check if already checked in for this duty
    const checkSql = `
        SELECT id FROM officer_attendance
        WHERE officer_id = ? AND duty_id = ? AND check_out IS NULL
    `;
    db.query(checkSql, [officer_id, duty_id], (err, existing) => {
        if (err) return res.status(500).json({ message: 'DB error.' });

        if (existing.length > 0) {
            return res.status(409).json({ message: 'Scholar is already checked in for this duty.' });
        }

        const sql = `
            INSERT INTO officer_attendance (officer_id, duty_id, check_in, method, marked_by, remarks)
            VALUES (?, ?, NOW(), ?, ?, ?)
        `;
        db.query(sql, [officer_id, duty_id, method, marked_by, remarks], (err, result) => {
            if (err) {
                console.error('Error marking attendance:', err);
                return res.status(500).json({ message: 'Failed to mark attendance.' });
            }
            res.status(201).json({ message: 'Attendance marked.', id: result.insertId });
        });
    });
};

// ─── MARK CHECK-OUT ───────────────────────────────────────────
exports.markCheckout = (req, res) => {
    const { id } = req.params;
    const sql = `UPDATE officer_attendance SET check_out = NOW() WHERE id = ?`;
    db.query(sql, [id], (err) => {
        if (err) {
            console.error('Error marking checkout:', err);
            return res.status(500).json({ message: 'Failed to mark checkout.' });
        }
        res.json({ message: 'Checkout marked.' });
    });
};

// ============================================================
// ADD THESE TO officerController.js
// (kasama na ang mga existing exports mo doon — dagdag lang ito)
//
// Ginamit ko yung parehong SQL pattern ng existing exports.getFlaggedScholars
// para sa compliance summary, at yung schema ng `submissions` /
// `submission_media` table (galing sa submission/grades controller mo)
// para sa monthly reports review.
// ============================================================

// ─── GET COMPLIANCE SUMMARY (ALL active scholars, hindi lang flagged) ──
// Same risk formula gaya ng getFlaggedScholars, pero lahat isasauli
// (hindi lang yung risk_score >= 40), at completionRate = 100 - riskScore.
exports.getComplianceSummary = (req, res) => {
    const { period, scholar_group, date_from, date_to } = req.query;
    const range = buildPeriodRange(period, date_from, date_to);

    const scholarConditions = ["role = 'scholar'", "status = 'active'"];
    const scholarValues = [];
    applyOfficerYearLevelFilter(req, scholarConditions, scholarValues).then(() => {
    const scholarSql = `
        SELECT id, scholar_id, full_name, email, year_level, status
        FROM users u
        WHERE ${scholarConditions.join(' AND ')}
    `;

    db.query(scholarSql, scholarValues, (err, scholars) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch scholars.' });
        if (scholars.length === 0) return res.json([]);

        const scholarIds = scholars.map(s => s.scholar_id);
        const placeholders = scholarIds.map(() => '?').join(', ');

        let submissionSql = `
            SELECT
                scholar_id,
                COUNT(*) AS total_submissions,
                SUM(CASE WHEN status IN ('approved', 'archived') THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                AVG(quality_score) AS avg_quality,
                MAX(submitted_at) AS last_submission,
                SUM(CASE WHEN sentiment_label LIKE '%Negative%' THEN 1 ELSE 0 END) AS negative_letters
            FROM submissions
            WHERE scholar_id IN (${placeholders})
        `;

        let attendanceSql = `
            SELECT
                scholar_id,
                COUNT(*) AS total_duties,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present
            FROM duty_attendance
            WHERE scholar_id IN (${placeholders})
              AND (COALESCE(is_makeup, 0) = 0 OR check_out_at IS NOT NULL)
        `;

        const values = [...scholarIds];
        const attendanceValues = [...scholarIds];

        if (range) {
            submissionSql += ' AND DATE(submitted_at) BETWEEN ? AND ?';
            attendanceSql += ' AND DATE(marked_at) BETWEEN ? AND ?';
            values.push(range.start, range.end);
            attendanceValues.push(range.start, range.end);
        }

        submissionSql += ' GROUP BY scholar_id';
        attendanceSql += ' GROUP BY scholar_id';

        db.query(submissionSql, values, (err, subStats) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch submission stats.' });

            db.query(attendanceSql, attendanceValues, (err, attStats) => {
                if (err) return res.status(500).json({ error: 'Failed to fetch attendance stats.' });

                const subMap = {};
                subStats.forEach(s => { subMap[s.scholar_id] = s; });
                const attMap = {};
                attStats.forEach(a => { attMap[a.scholar_id] = a; });

                const today = new Date();

                const results = scholars.map(scholar => {
                    const sub = subMap[scholar.scholar_id] || null;
                    const att = attMap[scholar.scholar_id] || null;

                    const lastSub = sub?.last_submission ? new Date(sub.last_submission) : null;
                    const daysSinceSubmission = lastSub
                        ? Math.floor((today - lastSub) / (1000 * 60 * 60 * 24))
                        : 999;

                    const totalDuties  = att?.total_duties || 0;
                    const presentCount = att?.present || 0;
                    const attendanceRate = totalDuties > 0
                        ? Math.round((presentCount / totalDuties) * 100)
                        : 0;

                    const avgQuality      = sub?.avg_quality ? Math.round(sub.avg_quality) : 0;
                    const negativeLetters = sub?.negative_letters || 0;
                    const totalSubs       = sub?.total_submissions || 0;

                    let riskScore = 0;
                    if (daysSinceSubmission >= 60)      riskScore += 40;
                    else if (daysSinceSubmission >= 30) riskScore += 30;
                    else if (daysSinceSubmission >= 14) riskScore += 15;

                    if (attendanceRate === 0)     riskScore += 25;
                    else if (attendanceRate < 50) riskScore += 20;
                    else if (attendanceRate < 75) riskScore += 10;

                    if (avgQuality < 40)      riskScore += 20;
                    else if (avgQuality < 60) riskScore += 10;

                    riskScore += Math.min(negativeLetters * 5, 15);
                    if (totalSubs === 0) riskScore += 20;
                    riskScore = Math.min(riskScore, 100);

                    return {
                        id: scholar.id,
                        name: scholar.full_name,
                        studentId: scholar.scholar_id,
                        completionRate: Math.max(0, 100 - riskScore),
                        riskStatus: riskScore >= 40 ? 'at-risk' : riskScore >= 20 ? 'good' : 'excellent',
                        year_level: scholar.year_level || 'N/A',
                        riskScore,
                    };
                });

                const filtered = results.filter(row => {
                    if (scholar_group?.startsWith('Year Level ')) {
                        const level = scholar_group.replace('Year Level ', '').trim();
                        if (String(row.year_level) !== level) return false;
                    }
                    if (scholar_group === 'At Risk Only' && row.riskScore < 40) {
                        return false;
                    }
                    return true;
                });

                filtered.sort((a, b) => a.completionRate - b.completionRate);
                res.json(filtered.map(({ riskScore, ...rest }) => ({
                    ...rest,
                    riskScore,
                    riskStatus: riskScore >= 40 ? 'at-risk' : riskScore >= 20 ? 'good' : 'excellent',
                })));

            });
        });
    });
    }).catch(() => res.status(500).json({ error: 'Failed to resolve officer assignments.' }));
};

exports.getSubmissionRecords = async (req, res) => {
    const { month, date_from, date_to, year_level, document_type = 'all' } = req.query;
    const supportedTypes = new Set(['all', 'letter', 'grades', 'cor', 'other']);
    if (!supportedTypes.has(document_type)) {
        return res.status(400).json({ error: 'A supported document type is required.' });
    }
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) {
        return res.status(400).json({ error: 'Month must use YYYY-MM format.' });
    }
    const validDate = value => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };
    if ((date_from && !validDate(date_from)) || (date_to && !validDate(date_to))) {
        return res.status(400).json({ error: 'Date filters must use YYYY-MM-DD format.' });
    }
    if (date_from && date_to && date_from > date_to) {
        return res.status(400).json({ error: 'The start date must not be after the end date.' });
    }

    try {
        const scholarConditions = ["u.role = 'scholar'", "u.status = 'active'"];
        const scholarValues = [];
        await applyOfficerYearLevelFilter(req, scholarConditions, scholarValues, 'u.year_level');
        if (year_level) {
            scholarConditions.push(`${yearLevelSqlExpression('u.year_level')} = ?`);
            scholarValues.push(normalizeYearLevel(year_level));
        }

        const [scholars] = await db.promise().query(
            `SELECT u.scholar_id, u.full_name, u.year_level
             FROM users u
             WHERE ${scholarConditions.join(' AND ')}`,
            scholarValues
        );
        if (!scholars.length) return res.json({ totalScholars: 0, records: [] });

        const scholarIds = scholars.map(scholar => scholar.scholar_id);
        const submissionConditions = [
            's.scholar_id IN (?)',
            'COALESCE(s.archived_at, s.archive_at) IS NULL',
            "(LOWER(COALESCE(s.status, '')) <> 'approved' OR s.finalized_at IS NOT NULL)",
        ];
        const submissionValues = [scholarIds];
        if (document_type === 'letter') submissionConditions.push("s.submission_type = 'letter'");
        if (document_type === 'grades') submissionConditions.push("s.submission_type = 'report_card'");
        if (document_type === 'cor') submissionConditions.push("s.submission_type = 'cor'");
        if (document_type === 'other') submissionConditions.push("s.submission_type = 'other'");
        if (month) {
            submissionConditions.push("DATE_FORMAT(s.submitted_at, '%Y-%m') = ?");
            submissionValues.push(month);
        }
        if (date_from) {
            submissionConditions.push('DATE(s.submitted_at) >= ?');
            submissionValues.push(date_from);
        }
        if (date_to) {
            submissionConditions.push('DATE(s.submitted_at) <= ?');
            submissionValues.push(date_to);
        }

        const [submissions] = await db.promise().query(
            `SELECT s.*, u.full_name AS scholar_name, u.year_level,
                    (SELECT sm.file_path FROM submission_media sm
                     WHERE sm.submission_id = s.id ORDER BY sm.id LIMIT 1) AS media_path
             FROM submissions s
             INNER JOIN users u ON u.scholar_id = s.scholar_id
             WHERE ${submissionConditions.join(' AND ')}
             ORDER BY s.submitted_at DESC, s.id DESC`,
            submissionValues
        );

        let grades = [];
        if (document_type === 'all' || document_type === 'grades') {
            const gradeConditions = [
                'g.scholar_id IN (?)',
                "(LOWER(COALESCE(g.verification_status, '')) <> 'approved' OR g.finalized_at IS NOT NULL)",
            ];
            const gradeValues = [scholarIds];
            if (month) {
                gradeConditions.push("DATE_FORMAT(g.created_at, '%Y-%m') = ?");
                gradeValues.push(month);
            }
            if (date_from) {
                gradeConditions.push('DATE(g.created_at) >= ?');
                gradeValues.push(date_from);
            }
            if (date_to) {
                gradeConditions.push('DATE(g.created_at) <= ?');
                gradeValues.push(date_to);
            }
            const [gradeRows] = await db.promise().query(
                `SELECT g.id, g.scholar_id, g.proof_path, g.verification_status AS status,
                        g.created_at AS submitted_at, u.full_name AS scholar_name, u.year_level
                 FROM grades g
                 INNER JOIN users u ON u.scholar_id = g.scholar_id
                 WHERE ${gradeConditions.join(' AND ')}
                 ORDER BY g.created_at DESC, g.id DESC`,
                gradeValues
            );
            grades = gradeRows.map(row => ({ ...row, id: `grade-${row.id}`, submission_type: 'grades', file_path: row.proof_path }));
        }

        const taskConditions = ['t.is_active = 1', 't.due_date IS NOT NULL', 't.due_date <= CURDATE()'];
        const taskValues = [];
        if (month) {
            taskConditions.push("DATE_FORMAT(t.due_date, '%Y-%m') = ?");
            taskValues.push(month);
        }
        if (date_from) {
            taskConditions.push('DATE(t.due_date) >= ?');
            taskValues.push(date_from);
        }
        if (date_to) {
            taskConditions.push('DATE(t.due_date) <= ?');
            taskValues.push(date_to);
        }
        const [tasks] = await db.promise().query(
            `SELECT t.id, t.type, t.due_date, t.created_at, t.target_year_levels
             FROM tasks t
             WHERE ${taskConditions.join(' AND ')}
             ORDER BY t.due_date ASC, t.id ASC`,
            taskValues
        );

        const labels = {
            letter: 'Monthly Letter',
            report_card: 'Grades',
            grades: 'Grades',
            cor: 'COR',
            other: 'Other Documents',
        };
        const taskTypes = {
            'monthly report': { submissionType: 'letter', requirement: 'Monthly Letter' },
            'report card': { submissionType: 'report_card', requirement: 'Grades' },
            'cor upload': { submissionType: 'cor', requirement: 'COR' },
            'other documents': { submissionType: 'other', requirement: 'Other Documents' },
        };
        const matchesSelectedType = type => (
            document_type === 'all'
            || (document_type === 'grades' && ['grades', 'report_card'].includes(type))
            || type === document_type
        );
        const allSubmittedRows = [...submissions, ...grades].map(row => ({
            id: row.id,
            scholarId: row.scholar_id,
            scholarName: row.scholar_name,
            yearLevel: row.year_level || '—',
            requirement: labels[row.submission_type] || row.submission_type,
            submissionType: row.submission_type,
            submittedAt: row.submitted_at,
            status: String(row.status || 'pending').toLowerCase(),
            qualityStatus: row.quality_status || null,
            filePath: row.file_path || row.generated_pdf_path || row.report_card_path || row.cor_path || row.media_path || null,
        }));
        const submittedRows = allSubmittedRows.filter(row => matchesSelectedType(row.submissionType));
        const dateTimeValue = value => {
            if (!value) return '';
            if (!(value instanceof Date)) return String(value).replace('T', ' ').slice(0, 19);
            const pad = part => String(part).padStart(2, '0');
            return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
        };
        const reportRecords = submittedRows.map(row => ({
            ...row,
            period: dateTimeValue(row.submittedAt).slice(0, 7) || month || '—',
        }));
        const parseTargetLevels = value => {
            if (Array.isArray(value)) return value;
            if (typeof value !== 'string' || !value.trim()) return [];
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        };
        const missingRecords = [];
        const processedRequirementKeys = new Set();
        for (const task of tasks) {
            const taskRequirement = taskTypes[String(task.type || '').trim().toLowerCase()];
            if (!taskRequirement || !matchesSelectedType(taskRequirement.submissionType)) continue;

            const targetLevels = parseTargetLevels(task.target_year_levels).map(normalizeYearLevel);
            const dueDate = task.due_date instanceof Date
                ? formatDate(task.due_date)
                : String(task.due_date || '').slice(0, 10);
            const taskCreatedAt = dateTimeValue(task.created_at);
            const period = dueDate.slice(0, 7) || taskCreatedAt.slice(0, 7);
            const assignedScholars = targetLevels.length
                ? scholars.filter(scholar => targetLevels.includes(normalizeYearLevel(scholar.year_level)))
                : scholars;

            for (const scholar of assignedScholars) {
                const keyType = taskRequirement.submissionType;
                const requirementKey = `${scholar.scholar_id}:${keyType}:${period}`;
                if (processedRequirementKeys.has(requirementKey)) continue;
                processedRequirementKeys.add(requirementKey);

                const matchingSubmissions = submittedRows.filter(row => {
                    const rowType = row.submissionType === 'grades' ? 'report_card' : row.submissionType;
                    return row.scholarId === scholar.scholar_id
                        && rowType === keyType
                        && dateTimeValue(row.submittedAt) >= taskCreatedAt;
                });
                if (matchingSubmissions.length) continue;

                missingRecords.push({
                    id: `missing-${scholar.scholar_id}-${task.id}`,
                    scholarId: scholar.scholar_id,
                    scholarName: scholar.full_name,
                    yearLevel: scholar.year_level || '—',
                    requirement: taskRequirement.requirement,
                    submissionType: keyType,
                    submittedAt: null,
                    period,
                    status: 'not-submitted',
                    qualityStatus: null,
                    filePath: null,
                    isMissing: true,
                });
            }
        }
        const records = [...reportRecords, ...missingRecords];
        records.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

        logPrivacyAccess(req, {
            action: 'VIEW_SCHOLAR',
            resourceType: 'submission_report',
            resourceId: document_type,
            status: 'allowed',
        }).catch(auditError => console.error('Failed to log officer submission records access:', auditError));

        return res.json({ totalScholars: scholars.length, records });
    } catch (error) {
        console.error('Failed to fetch officer submission records:', error);
        return res.status(500).json({ error: 'Failed to fetch submission records.' });
    }
};

// ─── MONTHLY LETTER REVIEW ────────────────────────────────────────────
exports.getMonthlySubmissions = async (req, res) => {
    const { year_level, month, date_from, date_to } = req.query;
    const conditions = [
        "s.submission_type = 'letter'",
        'COALESCE(s.archived_at, s.archive_at) IS NULL',
        "(LOWER(COALESCE(s.status, '')) <> 'approved' OR s.finalized_at IS NOT NULL)",
    ];
    const values = [];
    const validDate = value => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };

    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) {
        return res.status(400).json({ error: 'Month must use YYYY-MM format.' });
    }
    if ((date_from && !validDate(date_from)) || (date_to && !validDate(date_to))) {
        return res.status(400).json({ error: 'Date filters must use YYYY-MM-DD format.' });
    }
    if (date_from && date_to && date_from > date_to) {
        return res.status(400).json({ error: 'The start date must not be after the end date.' });
    }

    try {
        await applyOfficerYearLevelFilter(req, conditions, values, 'u.year_level');

        if (year_level) {
            conditions.push(`${yearLevelSqlExpression('u.year_level')} = ?`);
            values.push(normalizeYearLevel(year_level));
        }
        if (month) {
            conditions.push("DATE_FORMAT(s.submitted_at, '%Y-%m') = ?");
            values.push(month);
        }
        if (date_from) {
            conditions.push('DATE(COALESCE(s.service_date, s.submitted_at)) >= ?');
            values.push(date_from);
        }
        if (date_to) {
            conditions.push('DATE(COALESCE(s.service_date, s.submitted_at)) <= ?');
            values.push(date_to);
        }

        const sql = `
            SELECT
                s.id,
                s.scholar_id,
                s.submission_type,
                s.generated_pdf_path,
                s.letter_content,
                s.quality_score,
                s.quality_status,
                s.quality_label,
                s.content_score,
                s.content_breakdown,
                s.sentiment_score,
                s.sentiment_label,
                s.status AS review_status,
                s.officer_comment AS staff_comment,
                s.submitted_at,
                s.service_date,
                s.reviewed_at,
                s.approved_at,
                s.returned_at,
                s.finalized_at,
                s.export_available_at,
                u.full_name,
                u.year_level,
                (
                    SELECT GROUP_CONCAT(
                        CONCAT_WS('||', IFNULL(sm.file_path, ''), IFNULL(sm.description, ''))
                        SEPARATOR ';;'
                    )
                    FROM submission_media sm
                    WHERE sm.submission_id = s.id
                ) AS media_raw
            FROM submissions s
            INNER JOIN users u ON u.scholar_id = s.scholar_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY s.submitted_at DESC, s.id DESC
        `;
        db.query(sql, values, (err, rows) => {
            if (err) {
                console.error('Error fetching monthly letter submissions:', err);
                return res.status(500).json({ error: 'Error fetching monthly letter submissions.' });
            }

            const qualityStatusMap = { accepted: 'accepted', medium_risk: 'medium-risk', high_risk: 'high-risk' };
            const staffActionMap = {
                approved: 'approved',
                returned: 'needs-revision',
                rejected: 'needs-revision',
                needs_revision: 'needs-revision',
                'needs-revision': 'needs-revision',
            };
            const results = rows.map(row => {
                const wordCount = (row.letter_content || '').trim().split(/\s+/).filter(Boolean).length;
                const reviewStatus = row.review_status || 'pending';
                const qualityStatus = row.quality_status || null;
                const qualityScore = row.quality_score == null ? null : Number(row.quality_score);
                const photos = (row.media_raw || '')
                    .split(';;')
                    .filter(Boolean)
                    .map(chunk => {
                        const [url, description] = chunk.split('||');
                        return { url, description };
                    });
                return {
                    ...row,
                    scholarName: row.full_name,
                    studentId: row.scholar_id,
                    year: row.year_level || '—',
                    date: row.service_date || row.submitted_at,
                    submittedAt: row.submitted_at,
                    reviewedAt: row.reviewed_at,
                    sentimentLabel: row.sentiment_label || 'Neutral',
                    status: qualityStatusMap[qualityStatus] || 'pending',
                    qualityScore,
                    reportScore: qualityScore,
                    body: row.letter_content,
                    checklistResults: [
                        { label: 'Letter body (50+ words)', passed: wordCount >= 50 },
                        { label: 'Minimum length (150+ words)', passed: wordCount >= 150 },
                        { label: 'At least 1 photo', passed: photos.length > 0 },
                        { label: 'All photos have descriptions', passed: photos.length > 0 && photos.every(photo => photo.description && photo.description.trim()) },
                    ],
                    photos,
                    staffAction: staffActionMap[reviewStatus] || null,
                    staffFeedback: row.staff_comment || '',
                    approvedAt: row.approved_at,
                    finalizedAt: row.finalized_at,
                    exportAvailableAt: row.export_available_at,
                };
            });
            res.json(results);
        });
    } catch (error) {
        console.error('Failed to resolve officer assignments for monthly letters:', error);
        return res.status(500).json({ error: 'Failed to resolve officer assignments.' });
    }
};
// Keep monthly report decisions on the same lifecycle and assignment checks
// as Manual Validation.
exports.reviewMonthlySubmission = (req, res) => {
    const action = typeof req.body?.action === 'string'
        ? req.body.action.trim().toLowerCase()
        : '';
    const status = {
        approve: 'approved',
        approved: 'approved',
        return: 'returned',
        rejected: 'returned',
        returned: 'returned',
        'needs-revision': 'returned',
        needs_revision: 'returned',
        'needs revision': 'returned',
    }[action];
    if (!status) {
        return res.status(400).json({ error: "Invalid action. Must be 'approve' or 'return'." });
    }
    req.body = { status, staff_comment: req.body?.comment ?? req.body?.feedback ?? null };
    return submissionController.reviewSubmission(req, res);
};

// ─── GET TASK COMPLETION SUMMARY ───────────────────────────────
// A task is assigned through tasks.target_year_levels and completed only
// when the matching submission or grade created after that task is approved.
exports.getTaskCompletionSummary = (req, res) => {
    const { period, scholar_group, date_from, date_to } = req.query;
    const range = buildPeriodRange(period, date_from, date_to);
    const scholarConditions = ["role = 'scholar'", "status = 'active'"];
    const scholarValues = [];

    applyOfficerYearLevelFilter(req, scholarConditions, scholarValues).then(() => {
        db.query(`SELECT u.id, u.scholar_id, u.full_name, u.year_level FROM users u WHERE ${scholarConditions.join(' AND ')}`, scholarValues, (err, scholars) => {
            if (err) {
                console.error('Task completion summary scholars query failed:', err);
                return res.status(500).json({ error: 'Failed to fetch scholars.' });
            }
            if (!scholars.length) return res.json([]);

            const taskValues = [];
            let taskSql = 'SELECT id, title, type, due_date, created_at, target_year_levels FROM tasks WHERE is_active = 1';
            if (range) {
                taskSql += ' AND DATE(COALESCE(due_date, created_at)) BETWEEN ? AND ?';
                taskValues.push(range.start, range.end);
            }

            db.query(taskSql, taskValues, (taskErr, tasks) => {
                if (taskErr) return res.status(500).json({ error: 'Failed to fetch assigned tasks.' });
                const scholarIds = scholars.map(s => s.scholar_id);
                const placeholders = scholarIds.map(() => '?').join(', ');
                const parseLevels = value => {
                    if (Array.isArray(value)) return value;
                    try { return value ? JSON.parse(value) : []; } catch { return []; }
                };
                const typeMap = {
                    'Monthly Report': 'letter',
                    'Report Card': 'report_card',
                    'COR Upload': 'cor',
                    'Other Documents': 'other',
                };

                const submissionsSql = `SELECT scholar_id, submission_type, status, submitted_at FROM submissions WHERE scholar_id IN (${placeholders})`;
                db.query(submissionsSql, scholarIds, (submissionErr, submissions) => {
                    if (submissionErr) return res.status(500).json({ error: 'Failed to fetch task completion records.' });
                    const gradesSql = `SELECT scholar_id, 'grades' AS submission_type, verification_status AS status, created_at AS submitted_at FROM grades WHERE scholar_id IN (${placeholders})`;
                    db.query(gradesSql, scholarIds, (gradeErr, grades) => {
                        if (gradeErr) return res.status(500).json({ error: 'Failed to fetch task completion records.' });
                        const scholarRecords = [...submissions, ...grades];
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const results = scholars.map(scholar => {
                            const assigned = tasks.filter(task => {
                                const levels = parseLevels(task.target_year_levels);
                                return !levels.length || levels.includes(scholar.year_level);
                            });
                            const recordsForTask = task => {
                                const submissionType = typeMap[task.type];
                                if (!submissionType) return [];
                                const taskTime = new Date(task.created_at || 0).getTime();
                                return scholarRecords.filter(record => {
                                    const matchesType = record.submission_type === submissionType || (task.type === 'Report Card' && record.submission_type === 'grades');
                                    return record.scholar_id === scholar.scholar_id && matchesType && new Date(record.submitted_at || 0).getTime() >= taskTime;
                                });
                            };
                            const completedTasks = assigned.filter(task => recordsForTask(task).some(record => ['approved', 'archived'].includes(record.status)));
                            const missingTasks = assigned.filter(task => {
                                if (!task.due_date || recordsForTask(task).length) return false;
                                const dueDate = task.due_date instanceof Date
                                    ? new Date(task.due_date.getFullYear(), task.due_date.getMonth(), task.due_date.getDate())
                                    : new Date(`${String(task.due_date).slice(0, 10)}T00:00:00`);
                                return !Number.isNaN(dueDate.getTime()) && dueDate < today;
                            }).length;
                            const completed = completedTasks.length;
                            const pendingTasks = assigned.length - completed - missingTasks;
                            const completionRate = assigned.length ? Math.round((completed / assigned.length) * 100) : 0;
                            return { id: scholar.id, name: scholar.full_name, studentId: scholar.scholar_id, year_level: scholar.year_level || 'N/A', assignedTasks: assigned.length, completedTasks: completed, missingTasks, pendingTasks, completionRate, riskStatus: completionRate >= 80 ? 'excellent' : completionRate >= 50 ? 'good' : 'at-risk' };
                        });
                        const filtered = results.filter(row => scholar_group !== 'At Risk Only' || row.riskStatus === 'at-risk');
                        res.json(filtered.sort((a, b) => a.completionRate - b.completionRate));
                    });
                });
            });
        });
    }).catch(() => res.status(500).json({ error: 'Failed to resolve officer assignments.' }));
};

// ─── GET SCHOLAR SUBMISSION SUMMARY ───────────────────────────
exports.getScholarSubmissionSummary = (req, res) => {
    const { report_type, period, date_from, date_to, scholar_group, scholar_id } = req.query;
    const supportedReportTypes = new Set([
        'Monthly Letter',
        'Report Cards',
        'Grades',
        'Report Cards & Grades',
        'COR',
        'Other Documents',
    ]);
    if (!supportedReportTypes.has(report_type)) {
        return res.status(400).json({ error: 'A supported report type is required.' });
    }
    if (req.user?.role === 'officer') {
        logPrivacyAccess(req, {
            action: report_type === 'Monthly Letter' ? 'VIEW_LETTER' : 'VIEW_SCHOLAR',
            resourceType: 'submission_report',
            resourceId: report_type,
            status: 'allowed',
        }).catch((auditError) => console.error('Failed to log scholar report summary access:', auditError));
    }
    const submissionTypeMap = {
        'Monthly Letter': 'letter',
        'Report Cards': 'report_card',
        'Grades': 'report_card',
        'Report Cards & Grades': 'report_card',
        'COR': 'cor',
        'Other Documents': 'other',
    };
    const selectedType = submissionTypeMap[report_type];
    const includesGrades = report_type === 'Grades' || report_type === 'Report Cards & Grades';
    const range = buildPeriodRange(period, date_from, date_to);
    const scholarConditions = ["role = 'scholar'", "status = 'active'"];
    const scholarValues = [];

    applyOfficerYearLevelFilter(req, scholarConditions, scholarValues).then(() => {
        if (scholar_group && scholar_group !== 'All Scholars') {
            scholarConditions.push(`${yearLevelSqlExpression('u.year_level')} = ?`);
            scholarValues.push(normalizeYearLevel(scholar_group));
        }
        if (scholar_id) {
            scholarConditions.push('u.scholar_id = ?');
            scholarValues.push(scholar_id);
        }
        db.query(`SELECT u.id, u.scholar_id, u.full_name, u.year_level FROM users u WHERE ${scholarConditions.join(' AND ')}`, scholarValues, (err, scholars) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch scholars.' });
            if (!scholars.length) return res.json([]);
            const scholarIds = scholars.map(s => s.scholar_id);
            const placeholders = scholarIds.map(() => '?').join(', ');
            const values = [...scholarIds];
            const taskType = { 'Monthly Letter': 'Monthly Report', 'Report Cards': 'Report Card', 'Grades': 'Report Card', 'COR': 'COR Upload', 'Other Documents': 'Other Documents' }[report_type];
            let sql = `SELECT id, scholar_id, submission_type, status, submitted_at, reviewed_at, quality_status, export_available_at FROM submissions WHERE scholar_id IN (${placeholders}) AND (LOWER(COALESCE(status, '')) <> 'approved' OR finalized_at IS NOT NULL)`;
            if (selectedType) { sql += ' AND submission_type = ?'; values.push(selectedType); }
            if (range) { sql += ' AND DATE(submitted_at) BETWEEN ? AND ?'; values.push(range.start, range.end); }

            const deadlineSql = taskType
                ? 'SELECT MIN(due_date) AS deadline FROM tasks WHERE is_active = 1 AND type = ? AND due_date IS NOT NULL'
                : null;
            const fetchSubmissions = deadline => db.query(sql, values, (submissionErr, submissions) => {
                if (submissionErr) {
                    console.error('Scholar submission summary submissions query failed:', submissionErr);
                    return res.status(500).json({ error: 'Failed to fetch scholar submissions.' });
                }
                const gradeValues = [...scholarIds];
                let gradeSql = `SELECT id, scholar_id, 'grades' AS submission_type, verification_status AS status, created_at AS submitted_at, export_available_at FROM grades WHERE scholar_id IN (${placeholders}) AND (LOWER(COALESCE(verification_status, '')) <> 'approved' OR finalized_at IS NOT NULL)`;
                if (includesGrades && range) { gradeSql += ' AND DATE(created_at) BETWEEN ? AND ?'; gradeValues.push(range.start, range.end); }
                if (!includesGrades) return res.json(buildRows(scholars, submissions, [], deadline));
                db.query(gradeSql, gradeValues, (gradeErr, grades) => {
                    if (gradeErr) {
                        console.error('Scholar submission summary grades query failed:', gradeErr);
                        return res.status(500).json({ error: 'Failed to fetch scholar grades.' });
                    }
                    const combined = submissions.concat(grades);
                    return res.json(buildRows(scholars, combined, [], deadline));
                });
            });
            if (deadlineSql) {
                db.query(deadlineSql, [taskType], (deadlineErr, deadlineRows) => {
                    if (deadlineErr) return fetchSubmissions(null);
                    fetchSubmissions(deadlineRows[0]?.deadline || null);
                });
            } else {
                fetchSubmissions(null);
            }
        });
    }).catch(error => {
        console.error('Scholar submission summary assignment filter failed:', error);
        res.status(500).json({ error: 'Failed to resolve officer assignments.' });
    });

    function buildRows(scholars, submissions, grades, deadline) {
        return scholars.map(scholar => {
            const records = [...submissions, ...grades].filter(row => row.scholar_id === scholar.scholar_id);
            const approved = records.filter(row => ['approved', 'archived'].includes(row.status)).length;
            const submitted = records.length;
            const pending = records.length - approved;
            const completionRate = submitted ? Math.round((approved / submitted) * 100) : 0;
            const latest = records.slice().sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))[0];
            const latestApproved = records.filter(row => ['approved', 'archived'].includes(row.status)).sort((a, b) => new Date(b.reviewed_at || 0) - new Date(a.reviewed_at || 0))[0];
            const submissionTypeLabels = {
                letter: 'Monthly Letter',
                report_card: 'Grades',
                grades: 'Grades',
                cor: 'COR',
                other: 'Other Documents',
            };
            const submissionTypes = [...new Set(records.map(row =>
                submissionTypeLabels[row.submission_type] || row.submission_type
            ).filter(Boolean))];
            const exportAvailableAt = records.reduce((latestDate, row) => {
                if (!row.export_available_at) return latestDate;
                const value = new Date(row.export_available_at);
                return !latestDate || value > latestDate ? value : latestDate;
            }, null);
            return { id: scholar.id, name: scholar.full_name, studentId: scholar.scholar_id, year_level: scholar.year_level || 'N/A', submissionTypes, submitted, approved, pending, completionRate, latestSubmittedAt: latest?.submitted_at || null, reviewedAt: latestApproved?.reviewed_at || null, exportAvailableAt: exportAvailableAt?.toISOString() || null, deadline, qualityStatus: latest?.quality_status || null, riskStatus: completionRate >= 80 ? 'excellent' : completionRate >= 50 ? 'good' : 'at-risk' };
        }).sort((a, b) => {
            const aSubmitted = a.submitted > 0 ? 1 : 0;
            const bSubmitted = b.submitted > 0 ? 1 : 0;
            if (aSubmitted !== bSubmitted) return bSubmitted - aSubmitted;
            return a.name.localeCompare(b.name);
        });
    }
};