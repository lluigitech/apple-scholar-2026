const db = require('../config/db');
const exportController = require('./exportcontroller');
const { sendAnnouncementNotifyEmails } = require('../utils/notifyHelpers');

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

// ─── GET ANNOUNCEMENTS ────────────────────────────────────────
exports.getAnnouncements = (req, res) => {
    const sql = `
        SELECT id, title, content, priority, target_roles, target_levels, created_by, created_by_role, is_active, created_at
        FROM announcements
        WHERE is_active = 1 AND (JSON_CONTAINS(target_roles, '"officer"') OR created_by_role = 'officer')
        ORDER BY created_at DESC
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

    const sql = `
        INSERT INTO announcements (title, content, priority, target_roles, target_levels, created_by, created_by_role, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'officer', 1, NOW())
    `;

    db.query(sql, [title, content, priority, JSON.stringify(roles), JSON.stringify(levels), created_by], (err, result) => {
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

    const scholarSql = `
        SELECT id, scholar_id, full_name, email, year_level, status
        FROM users
        WHERE role = 'scholar' AND status = 'active'
    `;

    db.query(scholarSql, (err, scholars) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch scholars.' });
        if (scholars.length === 0) return res.json([]);

        const scholarIds = scholars.map(s => s.scholar_id);
        const placeholders = scholarIds.map(() => '?').join(', ');

        let submissionSql = `
            SELECT
                scholar_id,
                COUNT(*) AS total_submissions,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
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
};

// ─── GET MONTHLY REPORT SUBMISSIONS (for Officer review table) ────────
// NOTE: `course`, `school`, `age` ay INAASSUME kong columns sa `users` table.
// Kung wala 'to sa schema mo, alisin mo muna 'yung mga linyang 'yun sa SELECT
// at sa mapping sa baba, o baguhin sa tamang column name.
exports.getMonthlySubmissions = (req, res) => {
    const { year_level, month } = req.query;
    const conditions = ['s.submission_type = \'letter\''];
    const values = [];

    if (year_level) {
        conditions.push('u.year_level = ?');
        values.push(year_level);
    }
    if (month) {
        conditions.push("DATE_FORMAT(COALESCE(s.service_date, s.submitted_at), '%Y-%m') = ?");
        values.push(month);
    }

    const sql = `
        SELECT s.id, s.scholar_id, s.letter_content, s.sentiment_label, s.quality_score, s.quality_status,
               s.status, s.officer_comment AS staff_comment, s.submitted_at, s.service_date,
               u.full_name, u.year_level,
               GROUP_CONCAT(
                   CONCAT_WS('||', IFNULL(sm.file_path, ''), IFNULL(sm.description, ''))
                   SEPARATOR ';;'
               ) AS media_raw
        FROM submissions s
        LEFT JOIN users u ON s.scholar_id = u.scholar_id
        LEFT JOIN submission_media sm ON s.id = sm.submission_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY s.id, s.scholar_id, s.letter_content, s.sentiment_label, s.quality_score, s.quality_status,
                 s.status, s.officer_comment, s.submitted_at, s.service_date,
                 u.full_name, u.year_level
        ORDER BY s.submitted_at DESC
    `;

    console.log('DEBUG monthly submissions query', { sql: sql.trim().replace(/\s+/g, ' '), values });
    db.query(sql, values, (err, rows) => {
        if (err) {
            console.error('Error fetching monthly submissions:', err, { sql, values });
            return res.status(500).json({ error: 'Error fetching monthly submissions' });
        }
        console.log('DEBUG monthly submissions rows', rows.length);

        const qualityStatusMap = { accepted: 'accepted', medium_risk: 'medium-risk', high_risk: 'high-risk' };
        const staffActionMap   = { approved: 'approved', rejected: 'rejected', needs_revision: 'needs-revision' };

        const results = rows.map(row => {
            const photos = (row.media_raw || '')
                .split(';;')
                .filter(Boolean)
                .map(chunk => {
                    const [url, description] = chunk.split('||');
                    return { url, description };
                });

            const wordCount = (row.letter_content || '').trim().split(/\s+/).filter(Boolean).length;

            const checklistResults = [
                { label: 'Letter body (50+ words)',        passed: wordCount >= 50 },
                { label: 'Minimum length (150+ words)',    passed: wordCount >= 150 },
                { label: 'At least 1 photo',               passed: photos.length > 0 },
                { label: 'All photos have descriptions',   passed: photos.length > 0 && photos.every(p => p.description && p.description.trim()) },
            ];

            return {
                id: row.id,
                scholarName: row.full_name,
                studentId: row.scholar_id,
                course: '—',
                school: '—',
                year: row.year_level || '—',
                age: '—',
                date: row.service_date || row.submitted_at,
                submittedAt: row.submitted_at,
                sentimentLabel: row.sentiment_label || 'Neutral',
                status: qualityStatusMap[row.quality_status] || 'high-risk',
                qualityScore: row.quality_score || 0,
                reportScore: row.quality_score || 0,
                mediaScore: row.quality_score || 0,
                body: row.letter_content,
                checklistResults,
                photos,
                staffAction: staffActionMap[row.status] || null,
                staffFeedback: row.staff_comment || '',
            };
        });

        res.json(results);
    });
};
// ─── REVIEW A MONTHLY SUBMISSION (Approve / Reject / Needs Revision) ───
// IMPORTANT: kung ENUM ang `submissions.status` column mo sa MySQL at
// 'needs_revision' ay wala pang kasama, kailangan mo munang i-ALTER TABLE:
//   ALTER TABLE submissions MODIFY status
//     ENUM('pending','approved','rejected','needs_revision') DEFAULT 'pending';
// Kung TEXT/VARCHAR naman siya, ok lang agad, walang kailangan gawin.
exports.reviewMonthlySubmission = (req, res) => {
    const { id } = req.params;
    const { action, feedback } = req.body; // action: 'approved' | 'rejected' | 'needs-revision'

    const statusMap = { approved: 'approved', rejected: 'rejected', 'needs-revision': 'needs_revision' };
    const dbStatus = statusMap[action];

    if (!dbStatus) {
        return res.status(400).json({ error: "Invalid action. Must be 'approved', 'rejected', or 'needs-revision'." });
    }

    const sql = `UPDATE submissions SET status = ?, officer_comment = ? WHERE id = ?`;
    db.query(sql, [dbStatus, feedback || null, id], (err, result) => {
        if (err) {
            console.error('Error reviewing monthly submission:', err);
            return res.status(500).json({ error: 'Error updating submission' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        res.json({ message: 'Submission reviewed successfully' });
    });
};