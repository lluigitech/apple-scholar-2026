const db = require('../config/db');
const crypto = require('crypto');
const { sendDutyNotifyEmails } = require('../utils/notifyHelpers');

// ─── CREATE DUTY (now with QR token + group assignment) ──────
// NOTE: na-merge na ito galing sa staffController.js version -- mas kumpleto
// (may status default at required na created_by). Kung dating hindi
// nagpapadala ng created_by ang frontend sa POST /duties, i-update yun.
exports.createDuty = (req, res) => {
    const {
        title, description, location,
        duty_date, time_start, time_end,
        group_ids = [],
        created_by
    } = req.body;

    if (!title || !duty_date || !created_by)
        return res.status(400).json({ error: 'title, duty_date, and created_by are required' });
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
        qrToken, created_by
    ], (err, result) => {
        if (err) {
            console.error('Error creating duty:', err);
            return res.status(500).json({ error: 'Error creating duty' });
        }

        const dutyId = result.insertId;
        const groupValues = group_ids.map(gid => [dutyId, gid, created_by]);
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
    const sql = "SELECT * FROM duties ORDER BY duty_date DESC";
    db.query(sql, (err, data) => {
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
                        res.json({ message: 'Attendance updated' });
                    }
                );
            } else {
                db.query(
                    "INSERT INTO duty_attendance (duty_id, scholar_id, status, method) VALUES (?, ?, ?, ?)",
                    [id, scholar_id, status, method || 'manual'],
                    (err) => {
                        if (err) return res.status(500).json({ error: 'Error marking attendance' });
                        res.json({ message: 'Attendance marked' });
                    }
                );
            }
        }
    );
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
                            if (err) errors++; else completed++;
                            processNext(index + 1);
                        }
                    );
                } else {
                    db.query(
                        "INSERT INTO duty_attendance (duty_id, scholar_id, status, method) VALUES (?, ?, ?, ?)",
                        [id, scholar_id, status, method || 'manual'],
                        (err) => {
                            if (err) errors++; else completed++;
                            processNext(index + 1);
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
        if (err) return res.status(400).json({ error: 'Failed to send duty notifications', detail: String(err) });
        if (result && result.error) return res.status(400).json(result);
        res.json(result);
    });
};