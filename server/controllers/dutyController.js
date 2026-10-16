const db = require('../config/db');
const crypto = require('crypto');
const { sendDutyNotifyEmails } = require('../utils/notifyHelpers');
const { logComplianceIncident, clampCompliance, getComplianceSettings, calculateCurrentCompliance } = require('../utils/complianceLogger');
const { markEndedDutyAbsences } = require('../services/dutyAbsenceService');

const logAttendanceNotification = (scholar_id, type, detail, cb = () => {}) => {
    if (!scholar_id) return cb();
    db.query('SELECT email FROM users WHERE scholar_id = ? LIMIT 1', [scholar_id], (userErr, userRows) => {
        if (userErr || !userRows || userRows.length === 0) return cb();
        const recipient = userRows[0].email;
        db.query(
            'INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail) VALUES (?, ?, ?, ?, ?, ?)',
            [scholar_id, recipient, 'system', type, 'generated', detail],
            () => cb()
        );
    });
};

// ─── CREATE DUTY (now with QR token + group assignment) ──────
// NOTE: na-merge na ito galing sa staffController.js version -- mas kumpleto
// (may status default at required na created_by). Kung dating hindi
// nagpapadala ng created_by ang frontend sa POST /duties, i-update yun.
exports.createDuty = (req, res) => {
    const {
        title, description, location,
        duty_date, time_start, time_end,
        group_ids = []
    } = req.body;

    const createdBy = req.user?.id;
    if (!title || !duty_date || !createdBy)
        return res.status(400).json({ error: 'title and duty_date are required' });
    if (!Array.isArray(group_ids) || group_ids.length === 0)
        return res.status(400).json({ error: 'Select at least one group.' });

    const qrToken = crypto.randomBytes(24).toString('hex');

    const sql = `
        INSERT INTO duties
            (title, description, location, duty_date, time_start, time_end,
             status, qr_token, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, ?)
    `;
    db.query(sql, [
        title, description || null, location || null,
        duty_date, time_start || null, time_end || null,
        qrToken, createdBy
    ], (err, result) => {
        if (err) {
            console.error('Error creating duty:', err);
            return res.status(500).json({ error: 'Error creating duty' });
        }

        const dutyId = result.insertId;
        const groupValues = group_ids.map(gid => [dutyId, gid, createdBy]);
        const groupSql = `INSERT IGNORE INTO duty_group_assignments (duty_id, group_id, assigned_by) VALUES ?`;

        db.query(groupSql, [groupValues], (err2) => {
            if (err2) {
                console.error('Error assigning duty to groups:', err2);
                return res.status(500).json({ error: 'Duty created but failed to assign groups' });
            }
            res.status(201).json({
                message: 'Duty created and assigned to group(s)',
                id: dutyId,
                qr_token: qrToken
            });
        });
    });
};

// ─── ASSIGN EXISTING DUTY TO ADDITIONAL GROUP(S) ──────────────
exports.assignDutyToGroup = (req, res) => {
    const { duty_id, group_ids, assigned_by } = req.body;

    if (!duty_id || !Array.isArray(group_ids) || group_ids.length === 0 || !assigned_by)
        return res.status(400).json({ error: 'duty_id, group_ids (array), and assigned_by are required' });

    const values = group_ids.map(gid => [duty_id, gid, assigned_by]);
    const sql = `INSERT IGNORE INTO duty_group_assignments (duty_id, group_id, assigned_by) VALUES ?`;

    db.query(sql, [values], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error assigning duty to group' });
        res.status(201).json({ message: 'Duty assigned to group(s)', assigned: result.affectedRows });
    });
};

// ─── GET GROUPS ASSIGNED TO A DUTY ────────────────────────────
exports.getDutyGroups = (req, res) => {
    const { duty_id } = req.params;
    const sql = `
        SELECT g.id, g.group_name
        FROM duty_group_assignments dga
        JOIN scholar_groups g ON g.id = dga.group_id
        WHERE dga.duty_id = ?
    `;
    db.query(sql, [duty_id], (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching duty groups' });
        res.json(data);
    });
};

// ─── UNASSIGN A GROUP FROM A DUTY ─────────────────────────────
exports.unassignDutyFromGroup = (req, res) => {
    const { duty_id, group_id } = req.params;
    const sql = `DELETE FROM duty_group_assignments WHERE duty_id = ? AND group_id = ?`;
    db.query(sql, [duty_id, group_id], (err) => {
        if (err) return res.status(500).json({ error: 'Error unassigning duty' });
        res.json({ message: 'Duty unassigned from group' });
    });
};

// ─── GET DUTY QR (for printing/display sa duty location) ─────
exports.getDutyQR = (req, res) => {
    const { duty_id } = req.params;
    const sql = `SELECT id, title, duty_date, location, qr_token FROM duties WHERE id = ?`;
    db.query(sql, [duty_id], (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching duty QR' });
        if (data.length === 0) return res.status(404).json({ error: 'Duty not found' });
        res.json(data[0]);
    });
};

// ─── GET SCHOLARS ASSIGNED TO A DUTY (via group) + attendance ─
// Ginagamit sa StaffDutyAttendance.jsx -- Manual Entry tab at "who's checked in" view.
exports.getDutyScholars = (req, res) => {
    const { duty_id } = req.params;
    const sql = `
        SELECT DISTINCT u.id, u.scholar_id, u.full_name, u.year_level,
            da.status AS attendance_status, da.method, da.marked_at, da.is_makeup
        FROM duty_group_assignments dga
        JOIN scholar_group_members m ON m.group_id = dga.group_id
        JOIN users u ON u.scholar_id = m.scholar_id
        LEFT JOIN duty_attendance da ON da.duty_id = dga.duty_id AND da.scholar_id = m.scholar_id
        WHERE dga.duty_id = ?
        ORDER BY u.full_name
    `;
    db.query(sql, [duty_id], (err, data) => {
        if (err) {
            console.error('Error fetching duty scholars:', err);
            return res.status(500).json({ error: 'Error fetching scholars for this duty' });
        }
        res.json(data);
    });
};

// ─── BULK MANUAL ATTENDANCE (fallback kung sira yung QR scan) ─
// NOTE: ito na ang canonical bulk-save (delete-then-reinsert, keyed by :duty_id).
// Ang bulkSaveAttendance pa baba (keyed by :id, upsert loop) ay legacy na dating
// tinawag mula sa dutyRoutes.js -- tignan yung comment doon.
exports.bulkMarkAttendance = (req, res) => {
    const { duty_id } = req.params;
    const { records } = req.body; // [{ scholar_id, status, method }]

    if (!Array.isArray(records) || records.length === 0)
        return res.status(400).json({ error: 'records array is required' });

    const scholarIds = records.map(r => r.scholar_id);
    db.query("SELECT status FROM duties WHERE id = ? LIMIT 1", [duty_id], (dutyErr, dutyRows) => {
        if (dutyErr) return res.status(500).json({ error: 'Error checking duty status' });
        if (!dutyRows.length) return res.status(404).json({ error: 'Duty not found' });
        if (!['upcoming', 'ongoing'].includes(dutyRows[0].status)) {
            return res.status(409).json({ error: 'Attendance is closed because this duty is completed or cancelled.' });
        }

        const deleteSql = `DELETE FROM duty_attendance WHERE duty_id = ? AND scholar_id IN (?)`;

        db.query(deleteSql, [duty_id, scholarIds], (err) => {
        if (err) {
            console.error('Error clearing old attendance:', err);
            return res.status(500).json({ error: 'Error saving attendance' });
        }

        const placeholders = records.map(() => '(?, ?, ?, ?, NOW())').join(', ');
        const flatValues = [];
        records.forEach(r => {
            flatValues.push(duty_id, r.scholar_id, r.status, r.method || 'manual');
        });
        const insertSql = `INSERT INTO duty_attendance (duty_id, scholar_id, status, method, marked_at) VALUES ${placeholders}`;

        db.query(insertSql, flatValues, (err2, result) => {
            if (err2) {
                console.error('Error inserting attendance:', err2);
                return res.status(500).json({ error: 'Error saving attendance' });
            }
            res.status(201).json({ message: 'Attendance saved', count: records.length });
        });
        });
    });
};

// ─── GET DUTY WITH FULL DETAILS (groups + attendance) ─────────
// Mas kumpleto ito kaysa getDutyById pababa (may groups + parsed target_audience).
// Ginagamit sa StaffTaskAssignment.jsx.
exports.getDutyDetails = (req, res) => {
    const { id } = req.params;

    const dutySql = `SELECT * FROM duties WHERE id = ?`;
    db.query(dutySql, [id], (err, dutyRows) => {
        if (err) return res.status(500).json({ error: 'Error fetching duty' });
        if (dutyRows.length === 0) return res.status(404).json({ error: 'Duty not found' });

        const duty = {
            ...dutyRows[0],
            target_audience: typeof dutyRows[0].target_audience === 'string'
                ? JSON.parse(dutyRows[0].target_audience || '[]')
                : (dutyRows[0].target_audience || []),
        };

        const groupSql = `
            SELECT g.id, g.group_name
            FROM duty_group_assignments dga
            JOIN scholar_groups g ON g.id = dga.group_id
            WHERE dga.duty_id = ?
        `;
        db.query(groupSql, [id], (err2, groups) => {
            if (err2) return res.status(500).json({ error: 'Error fetching duty groups' });

            const attSql = `
                SELECT da.status, da.method, da.marked_at, da.is_makeup,
                    u.full_name, u.year_level, u.scholar_id
                FROM duty_attendance da
                JOIN users u ON u.scholar_id = da.scholar_id
                WHERE da.duty_id = ?
                ORDER BY da.marked_at DESC
            `;
            db.query(attSql, [id], (err3, attendance) => {
                if (err3) return res.status(500).json({ error: 'Error fetching attendance' });
                res.json({ ...duty, groups, attendance });
            });
        });
    });
};

// Backward-compat alias: ang old getDutyById sa baba ay mas simple/mas maling
// join (nag-du-duplicate ng duty fields per attendance row). Ito na yung
// tinatawag ng existing routes na dating naka-point sa getDutyById.
exports.getDutyById = exports.getDutyDetails;

// ─── GET ALL DUTIES ───────────────────────────────────────────
// NOTE: na-merge na ito galing sa staffController.js version -- nag-pa-parse na
// din ng target_audience JSON column.
exports.getAllDuties = (req, res) => {
    const isStaff = ['staff', 'Staff'].includes(req.user?.role);
    const sql = isStaff
        ? `
            SELECT DISTINCT d.*
            FROM duties d
            INNER JOIN duty_group_assignments dga ON dga.duty_id = d.id
            INNER JOIN scholar_groups g ON g.id = dga.group_id
            WHERE g.assigned_staff_id = ?
            ORDER BY d.duty_date DESC
        `
        : "SELECT * FROM duties ORDER BY duty_date DESC";
    const values = isStaff ? [req.user.id] : [];
    db.query(sql, values, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching duties' });
        const parsed = data.map(d => ({
            ...d,
            target_audience: typeof d.target_audience === 'string'
                ? JSON.parse(d.target_audience || '[]')
                : (d.target_audience || []),
        }));
        res.json(parsed);
    });
};

// ─── GET ATTENDANCE BY SCHOLAR ────────────────────────────────
exports.getAttendanceByScholar = (req, res) => {
    const { scholar_id } = req.params;
    const sql = `
        SELECT da.*, d.title, d.duty_date, d.location, d.time_start, d.time_end
        FROM duty_attendance da
        JOIN duties d ON da.duty_id = d.id
        WHERE da.scholar_id = ?
        ORDER BY d.duty_date DESC
    `;
    db.query(sql, [scholar_id], (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching attendance' });
        res.json(data);
    });
};

// ─── GET DUTIES FOR SCHOLAR (group-based na, hindi na year_level) ─────
// NOTE: superseded na ito ng GET /api/scholar/my-duties (scholarController.js).
// Iniwan lang dito kung sakaling may ibang lumang bahagi ng app na tumatawag pa dito.
exports.getDutiesForScholarLegacy = (req, res) => {
    const sql = "SELECT * FROM duties WHERE status != 'cancelled' ORDER BY duty_date ASC";
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching duties' });
        res.json(data);
    });
};

// ─── GET SCHOLARS FOR A SPECIFIC DUTY (group-based na) ────────
// NOTE: superseded na ito ng GET /api/staff/duties/:duty_id/scholars (staffController.js),
// na naka-base na sa group membership. Iniwan lang dito para hindi masira ang lumang tawag.
exports.getScholarsForDutyLegacy = (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT DISTINCT u.scholar_id, u.full_name, u.year_level,
            da.status AS attendance_status, da.method
        FROM duty_group_assignments dga
        JOIN scholar_group_members m ON m.group_id = dga.group_id
        JOIN users u ON u.scholar_id = m.scholar_id
        LEFT JOIN duty_attendance da ON da.scholar_id = u.scholar_id AND da.duty_id = ?
        WHERE dga.duty_id = ?
        ORDER BY u.full_name ASC
    `;
    db.query(sql, [id, id], (err, scholars) => {
        if (err) return res.status(500).json({ error: 'Error fetching scholars' });
        res.json(scholars);
    });
};

// ─── UPDATE DUTY ──────────────────────────────────────────────
exports.updateDuty = (req, res) => {
    const { id } = req.params;
    const { title, description, location, duty_date, time_start, time_end, status } = req.body;

    const sql = `
        UPDATE duties SET title=?, description=?, location=?, duty_date=?, 
        time_start=?, time_end=?, status=?
        WHERE id=?
    `;
    db.query(sql, [
        title, description, location, duty_date,
        time_start, time_end,
        status, id
    ], (err) => {
        if (err) return res.status(500).json({ error: 'Error updating duty' });
        res.json({ message: 'Duty updated' });
    });
};

// ─── DELETE DUTY ──────────────────────────────────────────────
exports.deleteDuty = (req, res) => {
    db.query("DELETE FROM duties WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Error deleting duty' });
        res.json({ message: 'Duty deleted' });
    });
};

// ─── MARK SINGLE ATTENDANCE (QR) ─────────────────────────────
exports.markAttendance = (req, res) => {
    const { id } = req.params;
    const { scholar_id, status, method, marked_by } = req.body;

    db.query("SELECT status FROM duties WHERE id = ? LIMIT 1", [id], (dutyErr, dutyRows) => {
        if (dutyErr) return res.status(500).json({ error: 'Error checking duty status' });
        if (!dutyRows.length) return res.status(404).json({ error: 'Duty not found' });
        if (!['upcoming', 'ongoing'].includes(dutyRows[0].status)) {
            return res.status(409).json({ error: 'Attendance is closed because this duty is completed or cancelled.' });
        }

        db.query(
        "SELECT id FROM duty_attendance WHERE duty_id = ? AND scholar_id = ?",
        [id, scholar_id],
        (err, existing) => {
            if (err) return res.status(500).json({ error: 'Error checking attendance' });

            if (existing.length > 0) {
                db.query(
                    "UPDATE duty_attendance SET status=?, method=? WHERE duty_id=? AND scholar_id=?",
                    [status, method || 'manual', id, scholar_id],
                    (err) => {
                        if (err) return res.status(500).json({ error: 'Error updating attendance' });

                        if (status === 'absent') {
                            logAttendanceNotification(scholar_id, 'attendance_absent', `Duty attendance marked absent for duty_id=${id}.`);
                            getComplianceSettings((settingsErr, settings) => {
                                if (!settingsErr && settings) {
                                    const points = settings.absent_duty_deduction ?? 6;
                                    calculateCurrentCompliance(scholar_id, (calcErr, currentCompliance) => {
                                        if (!calcErr && typeof currentCompliance === 'number') {
                                            logComplianceIncident(
                                                scholar_id,
                                                'duty_absence_recorded',
                                                points,
                                                currentCompliance,
                                                clampCompliance(currentCompliance - points),
                                                `Duty attendance marked absent for duty ${id}.`
                                            );
                                        }
                                    });
                                }
                            });
                        }

                        if (status === 'late') {
                            logAttendanceNotification(scholar_id, 'attendance_late', `Late attendance marked for duty_id=${id}.`);
                            res.json({ message: 'Attendance updated' });
                            return;
                        }

                        res.json({ message: 'Attendance updated' });
                    }
                );
            } else {
                db.query(
                    "INSERT INTO duty_attendance (duty_id, scholar_id, status, method) VALUES (?, ?, ?, ?)",
                    [id, scholar_id, status, method || 'manual'],
                    (err) => {
                        if (err) return res.status(500).json({ error: 'Error marking attendance' });

                        if (status === 'absent') {
                            logAttendanceNotification(scholar_id, 'attendance_absent', `Duty attendance marked absent for duty_id=${id}.`);
                            getComplianceSettings((settingsErr, settings) => {
                                if (!settingsErr && settings) {
                                    const points = settings.absent_duty_deduction ?? 6;
                                    calculateCurrentCompliance(scholar_id, (calcErr, currentCompliance) => {
                                        if (!calcErr && typeof currentCompliance === 'number') {
                                            logComplianceIncident(
                                                scholar_id,
                                                'duty_absence_recorded',
                                                points,
                                                currentCompliance,
                                                clampCompliance(currentCompliance - points),
                                                `Duty attendance marked absent for duty ${id}.`
                                            );
                                        }
                                    });
                                }
                            });
                        }

                        if (status === 'late') {
                            logAttendanceNotification(scholar_id, 'attendance_late', `Late attendance marked for duty_id=${id}.`);
                            res.json({ message: 'Attendance marked' });
                            return;
                        }

                        res.json({ message: 'Attendance marked' });
                    }
                );
            }
        }
        );
    });
};

// ─── BULK SAVE ATTENDANCE (Manual Entry) ─────────────────────
// NOTE: superseded ng POST /api/staff/duties/:duty_id/attendance/bulk (staffController.js).
exports.bulkSaveAttendance = (req, res) => {
    const { id } = req.params;
    const { records } = req.body;

    if (!records || records.length === 0) {
        return res.status(400).json({ error: 'No records provided' });
    }

    let completed = 0;
    let errors = 0;

    const processNext = (index) => {
        if (index >= records.length) {
            return res.json({ message: `Saved ${completed} records`, completed, errors });
        }

        const { scholar_id, status, method } = records[index];

        db.query(
            "SELECT id FROM duty_attendance WHERE duty_id = ? AND scholar_id = ?",
            [id, scholar_id],
            (err, existing) => {
                if (err) { errors++; return processNext(index + 1); }

                if (existing.length > 0) {
                    db.query(
                        "UPDATE duty_attendance SET status=?, method=? WHERE duty_id=? AND scholar_id=?",
                        [status, method || 'manual', id, scholar_id],
                        (err) => {
                            if (err) errors++; else {
                                if (status === 'late') {
                                    logAttendanceNotification(scholar_id, 'attendance_late', `Late attendance record updated for duty_id=${id}.`);
                                }
                                if (status === 'absent') {
                                    logAttendanceNotification(scholar_id, 'attendance_absent', `Duty attendance marked absent for duty_id=${id}.`);
                                }
                                completed++;
                            }
                            processNext(index + 1);
                        }
                    );
                } else {
                    db.query(
                        "INSERT INTO duty_attendance (duty_id, scholar_id, status, method) VALUES (?, ?, ?, ?)",
                        [id, scholar_id, status, method || 'manual'],
                        (err) => {
                            if (err) errors++; else {
                                if (status === 'late') {
                                    logAttendanceNotification(scholar_id, 'attendance_late', `Late attendance recorded for duty_id=${id}.`);
                                }
                                if (status === 'absent') {
                                    logAttendanceNotification(scholar_id, 'attendance_absent', `Duty attendance marked absent for duty_id=${id}.`);
                                }
                                completed++;
                                processNext(index + 1);
                            }
                        }
                    );
                }
            }
        );
    };

    processNext(0);
};

// ─── GET ATTENDANCE SUMMARY FOR A DUTY ───────────────────────
exports.getAttendanceSummary = (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT 
            da.status,
            COUNT(*) as count
        FROM duty_attendance da
        WHERE da.duty_id = ?
        GROUP BY da.status
    `;
    db.query(sql, [id], (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching summary' });
        const summary = { present: 0, absent: 0, excused: 0 };
        data.forEach(row => { summary[row.status] = row.count; });
        res.json(summary);
    });
};

// ─── NOTIFY SCHOLARS ASSIGNED TO A DUTY ────────────────────────
exports.notifyDutyScholars = (req, res) => {
    const { id } = req.params;
    sendDutyNotifyEmails(id, (err, result) => {
        if (err) {
            const status = err.message === 'Duty not found' ? 404 : 500;
            return res.status(status).json({ error: 'Failed to send duty notifications', detail: String(err) });
        }
        if (result?.error === 'SMTP not configured') {
            return res.status(503).json({ error: 'Email service is not configured.' });
        }
        if (result && result.error) return res.status(502).json(result);
        res.json(result);
    });
};

// ─── APPROVE A ONE-DUTY MAKEUP PERMISSION ────────────────────
// This does not change the scholar's permanent group membership.
exports.getMakeupPermissions = (req, res) => {
    const status = req.query.status || 'approved';
    db.query(`
        SELECT p.*, s.full_name AS scholar_name,
               source.title AS source_duty_title, source.duty_date AS source_duty_date,
               target.title AS makeup_duty_title, target.duty_date AS makeup_duty_date
        FROM duty_makeup_permissions p
        JOIN users s ON s.scholar_id = p.scholar_id
        JOIN duties source ON source.id = p.source_duty_id
        JOIN duties target ON target.id = p.makeup_duty_id
        WHERE p.status = ?
        ORDER BY target.duty_date ASC, s.full_name ASC
    `, [status], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error fetching makeup permissions' });
        res.json(rows);
    });
};

exports.createMakeupPermission = (req, res) => {
    const { scholar_id, source_duty_id, makeup_duty_id, reason } = req.body;
    if (!scholar_id || !source_duty_id || !makeup_duty_id) {
        return res.status(400).json({ error: 'scholar_id, source_duty_id, and makeup_duty_id are required' });
    }
    if (Number(source_duty_id) === Number(makeup_duty_id)) {
        return res.status(400).json({ error: 'Source and makeup duty must be different' });
    }

    const sourceSql = `
        SELECT da.status, source.duty_date
        FROM duty_attendance da
        JOIN duties source ON source.id = da.duty_id
        WHERE da.duty_id = ? AND da.scholar_id = ?
        ORDER BY da.marked_at DESC LIMIT 1
    `;
    db.query(sourceSql, [source_duty_id, scholar_id], (sourceErr, sourceRows) => {
        if (sourceErr) return res.status(500).json({ error: 'Error checking source duty attendance' });
        if (!sourceRows.length || !['absent', 'excused'].includes(String(sourceRows[0].status).toLowerCase())) {
            return res.status(400).json({ error: 'Scholar must have an absent or excused record on the source duty' });
        }

        const sourceDate = sourceRows[0].duty_date;
        db.query(
            `SELECT id FROM duties
             WHERE id = ? AND duty_date > CURDATE() AND duty_date > ?
               AND duty_date <= DATE_ADD(?, INTERVAL 14 DAY)
               AND status <> 'cancelled'
             LIMIT 1`,
            [makeup_duty_id, sourceDate, sourceDate],
            (targetErr, targetRows) => {
                if (targetErr) return res.status(500).json({ error: 'Error checking makeup duty' });
                if (!targetRows.length) return res.status(400).json({ error: 'Select a non-cancelled duty within 14 days after the missed duty.' });

                db.query(
                    `SELECT id FROM users WHERE scholar_id = ? AND role = 'scholar' AND status = 'active' LIMIT 1`,
                    [scholar_id],
                    (userErr, userRows) => {
                        if (userErr) return res.status(500).json({ error: 'Error checking scholar' });
                        if (!userRows.length) return res.status(404).json({ error: 'Active scholar not found' });

                        const createPermission = () => db.query(`
                            INSERT INTO duty_makeup_permissions
                                (scholar_id, source_duty_id, makeup_duty_id, reason, status, approved_by, approved_at)
                            VALUES (?, ?, ?, ?, 'approved', ?, NOW())
                            ON DUPLICATE KEY UPDATE
                                source_duty_id = VALUES(source_duty_id), reason = VALUES(reason),
                                status = 'approved', approved_by = VALUES(approved_by), approved_at = NOW(), used_at = NULL
                        `, [scholar_id, source_duty_id, makeup_duty_id, reason || null, req.user.id], (insertErr) => {
                            if (insertErr) return res.status(500).json({ error: 'Failed to assign makeup duty' });
                            res.status(201).json({ message: 'Makeup duty assigned', scholar_id, makeup_duty_id });
                        });

                        db.query(
                            `UPDATE duty_makeup_permissions
                             SET makeup_duty_id = ?, reason = ?, status = 'approved',
                                 approved_by = ?, approved_at = NOW(), used_at = NULL
                             WHERE scholar_id = ? AND source_duty_id = ? AND status = 'pending'`,
                            [makeup_duty_id, reason || null, req.user.id, scholar_id, source_duty_id],
                            (pendingErr, pendingResult) => {
                                if (pendingErr) return res.status(500).json({ error: 'Failed to assign makeup duty' });
                                if (pendingResult.affectedRows) {
                                    return res.status(201).json({ message: 'Makeup duty assigned', scholar_id, makeup_duty_id });
                                }
                                createPermission();
                            }
                        );
                    }
                );
            }
        );
    });
};

exports.getMakeupCandidates = async (req, res) => {
    try {
        await markEndedDutyAbsences();
    } catch (error) {
        console.error('[duty-absence] failed to prepare admin makeup candidates:', error.message || error);
        return res.status(500).json({ error: 'Unable to update ended duty attendance.' });
    }
    db.query(`
        SELECT DISTINCT
            da.scholar_id, u.full_name AS scholar_name,
            source.id AS source_duty_id, source.title AS source_duty_title,
            source.duty_date AS source_duty_date, da.status AS source_status,
            pending.makeup_duty_id AS requested_makeup_duty_id, pending.reason
        FROM duty_attendance da
        JOIN users u ON u.scholar_id = da.scholar_id AND u.role = 'scholar' AND u.status = 'active'
        JOIN duties source ON source.id = da.duty_id
        LEFT JOIN (
            SELECT p1.id, p1.scholar_id, p1.source_duty_id, p1.makeup_duty_id, p1.reason
            FROM duty_makeup_permissions p1
            JOIN (
                SELECT scholar_id, source_duty_id, MAX(id) AS id
                FROM duty_makeup_permissions
                WHERE status = 'pending'
                GROUP BY scholar_id, source_duty_id
            ) latest_pending ON latest_pending.id = p1.id
        ) pending ON pending.scholar_id = da.scholar_id AND pending.source_duty_id = da.duty_id
        WHERE da.status IN ('absent', 'excused')
          AND source.duty_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
          AND (
              pending.id IS NOT NULL
              OR NOT EXISTS (
                  SELECT 1 FROM duty_makeup_permissions active_permission
                  WHERE active_permission.scholar_id = da.scholar_id
                    AND active_permission.source_duty_id = da.duty_id
                    AND active_permission.status IN ('approved', 'used')
              )
          )
        ORDER BY source.duty_date DESC, u.full_name ASC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error fetching makeup candidates' });
        res.json(rows);
    });
};

// Complete a duty after attendance has been finalized.
exports.completeDuty = (req, res) => {
    const { duty_id } = req.params;
    db.query(
        "UPDATE duties SET status = 'completed' WHERE id = ? AND status IN ('upcoming', 'ongoing')",
        [duty_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Error completing duty' });
            if (!result.affectedRows) return res.status(409).json({ error: 'Duty is already completed, cancelled, or unavailable.' });
            res.json({ message: 'Duty completed', duty_id: Number(duty_id), status: 'completed' });
        }
    );
};