const db = require('../config/db');
const dutyController = require('./dutyController');
const { sendAnnouncementNotifyEmails } = require('../utils/notifyHelpers');

// ─── SCHOLARS ─────────────────────────────────────────────────
exports.getPendingScholars = (req, res) => {
    const sql = `
        SELECT id, scholar_id, full_name, email, role, year_level, status, created_at
        FROM users WHERE role = 'scholar' ORDER BY created_at DESC
    `;
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Database error sa staff route' });
        res.json(data);
    });
};

// ─── ANNOUNCEMENTS ────────────────────────────────────────────
exports.getAnnouncements = (req, res) => {
    const sql = `
        SELECT a.id, a.title, a.content, a.priority, a.target_roles, a.target_levels,
               a.created_by, a.created_by_role, a.is_active, a.created_at,
               u.full_name AS created_by_name
        FROM announcements a
        LEFT JOIN users u ON u.id = a.created_by
        WHERE a.is_active = 1 AND (JSON_CONTAINS(a.target_roles, '"staff"') OR a.created_by_role = 'staff')
        ORDER BY a.created_at DESC
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching staff announcements:', err);
            return res.status(500).json({ error: 'Error fetching announcements' });
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

exports.createAnnouncement = (req, res) => {
    const { title, content, priority = 'info', created_by, target_levels = [] } = req.body;

    if (!title || !content || !created_by) {
        return res.status(400).json({ error: 'title, content, and created_by are required.' });
    }

    const creatorId = created_by === undefined || created_by === null || created_by === '' ? null : Number(created_by);
    const sql = `
        INSERT INTO announcements (title, content, priority, target_roles, target_levels, created_by, created_by_role, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'staff', 1, NOW())
    `;
    db.query(sql, [title, content, priority, JSON.stringify(['scholar']), JSON.stringify(target_levels), creatorId], (err, result) => {
        if (err) {
            console.error('Error creating staff announcement:', err);
            return res.status(500).json({ error: 'Failed to create announcement.' });
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

exports.getDeadlines = (req, res) => {
    const sql = `
        SELECT id, title, location, duty_date AS due_date, status
        FROM duties
        WHERE DATE(duty_date) >= CURDATE()
        ORDER BY duty_date ASC
        LIMIT 20
    `;
    db.query(sql, (err, data) => {
        if (err) {
            console.error('Error fetching deadlines:', err);
            return res.status(500).json({ error: 'Error fetching deadlines' });
        }
        res.json(data);
    });
};

// ─── STAFF ATTENDANCE ─────────────────────────────────────────
exports.getAllAttendance = (req, res) => {
    const { date, date_from, date_to, role, status } = req.query;
    const conditions = [];
    const values     = [];

    if (date)      { conditions.push('DATE(sa.date) = ?');    values.push(date); }
    if (date_from) { conditions.push('DATE(sa.date) >= ?');   values.push(date_from); }
    if (date_to)   { conditions.push('DATE(sa.date) <= ?');   values.push(date_to); }
    if (role)      { conditions.push('sa.role = ?');          values.push(role); }
    if (status)    { conditions.push('sa.status = ?');        values.push(status); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const sql = `
        SELECT sa.*, u.email
        FROM staff_attendance sa
        LEFT JOIN users u ON u.id = sa.staff_id
        ${where}
        ORDER BY sa.date DESC, sa.created_at DESC
    `;
    db.query(sql, values, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching staff attendance' });
        res.json(data);
    });
};

exports.getAttendanceById = (req, res) => {
    db.query(
        'SELECT * FROM staff_attendance WHERE id = ?',
        [req.params.id],
        (err, data) => {
            if (err)          return res.status(500).json({ error: 'Error fetching record' });
            if (!data.length) return res.status(404).json({ error: 'Record not found' });
            res.json(data[0]);
        }
    );
};

exports.addAttendance = (req, res) => {
    const { staff_id, staff_name, role, duty, date, status, method, marked_by } = req.body;

    if (!staff_name || !duty || !date)
        return res.status(400).json({ error: 'staff_name, duty, and date are required' });

    const sql = `
        INSERT INTO staff_attendance (staff_id, staff_name, role, duty, date, status, method, marked_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [
        staff_id || null, staff_name,
        role     || 'Staff', duty, date,
        status   || 'present',
        method   || 'manual',
        marked_by || 'Staff'
    ], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error adding attendance entry' });
        res.status(201).json({ message: 'Entry added', id: result.insertId });
    });
};

exports.qrAttendance = (req, res) => {
    const { qr_value, duty, date, marked_by } = req.body;

    if (!qr_value)
        return res.status(400).json({ error: 'qr_value is required' });

    db.query(
        "SELECT id, full_name, role FROM users WHERE qr_code LIKE ? AND role IN ('staff', 'admin')",
        [`%${qr_value}%`],
        (err, users) => {
            if (err)           return res.status(500).json({ error: 'Database error' });
            if (!users.length) return res.status(404).json({ error: `No staff found for QR: ${qr_value}` });

            const user      = users[0];
            const scanDate  = date  || new Date().toISOString().split('T')[0];
            const scanDuty  = duty  || 'Unspecified Duty';

            db.query(
                'SELECT id, status FROM staff_attendance WHERE staff_id = ? AND duty = ? AND date = ?',
                [user.id, scanDuty, scanDate],
                (err, existing) => {
                    if (err) return res.status(500).json({ error: 'Error checking existing record' });

                    if (existing.length > 0) {
                        db.query(
                            "UPDATE staff_attendance SET status = 'present', method = 'qr', marked_by = ? WHERE id = ?",
                            [marked_by || 'QR Scan', existing[0].id],
                            (err) => {
                                if (err) return res.status(500).json({ error: 'Error updating record' });
                                res.json({
                                    message:    `${user.full_name} marked Present (updated)`,
                                    staff_name: user.full_name,
                                    action:     'updated'
                                });
                            }
                        );
                    } else {
                        db.query(
                            `INSERT INTO staff_attendance (staff_id, staff_name, role, duty, date, status, method, marked_by)
                             VALUES (?, ?, ?, ?, ?, 'present', 'qr', ?)`,
                            [user.id, user.full_name, user.role, scanDuty, scanDate, marked_by || 'QR Scan'],
                            (err, result) => {
                                if (err) return res.status(500).json({ error: 'Error inserting record' });
                                res.status(201).json({
                                    message:    `${user.full_name} added & marked Present`,
                                    staff_name: user.full_name,
                                    id:         result.insertId,
                                    action:     'created'
                                });
                            }
                        );
                    }
                }
            );
        }
    );
};

exports.toggleAttendance = (req, res) => {
    db.query(
        'SELECT status FROM staff_attendance WHERE id = ?',
        [req.params.id],
        (err, data) => {
            if (err)          return res.status(500).json({ error: 'Error fetching record' });
            if (!data.length) return res.status(404).json({ error: 'Record not found' });

            const newStatus = data[0].status === 'present' ? 'missed' : 'present';
            db.query(
                'UPDATE staff_attendance SET status = ? WHERE id = ?',
                [newStatus, req.params.id],
                (err) => {
                    if (err) return res.status(500).json({ error: 'Error updating status' });
                    res.json({ message: 'Status toggled', status: newStatus });
                }
            );
        }
    );
};

exports.updateAttendance = (req, res) => {
    const { staff_name, role, duty, date, status } = req.body;
    db.query(
        'UPDATE staff_attendance SET staff_name=?, role=?, duty=?, date=?, status=? WHERE id=?',
        [staff_name, role, duty, date, status, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'Error updating record' });
            res.json({ message: 'Record updated' });
        }
    );
};

exports.deleteAttendance = (req, res) => {
    db.query(
        'DELETE FROM staff_attendance WHERE id = ?',
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'Error deleting record' });
            res.json({ message: 'Record deleted' });
        }
    );
};

exports.getAttendanceSummary = (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const sql = `
        SELECT
            COUNT(*) AS total,
            SUM(status = 'present') AS present,
            SUM(status = 'missed')  AS missed,
            ROUND(SUM(status = 'present') / COUNT(*) * 100, 0) AS rate
        FROM staff_attendance WHERE DATE(date) = ?
    `;
    db.query(sql, [today], (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching summary' });
        res.json(data[0]);
    });
};

// ─── REPORTS ──────────────────────────────────────────────────
exports.reportDutyAttendance = (req, res) => {
    const { scholar_id, date_from, date_to, status } = req.query;
    const conditions = [];
    const values     = [];

    if (scholar_id) { conditions.push('da.scholar_id = ?');          values.push(scholar_id); }
    if (date_from)  { conditions.push('DATE(da.marked_at) >= ?');    values.push(date_from); }
    if (date_to)    { conditions.push('DATE(da.marked_at) <= ?');    values.push(date_to); }
    if (status)     { conditions.push('da.status = ?');               values.push(status); }

    const sql = `
        SELECT u.full_name AS scholar, u.scholar_id, u.year_level,
            d.title AS duty, d.duty_date AS date, d.location,
            da.status, da.method, da.marked_at
        FROM duty_attendance da
        JOIN users u ON u.scholar_id = da.scholar_id
        JOIN duties d ON d.id = da.duty_id
        ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
        ORDER BY da.marked_at DESC, u.full_name
    `;
    console.log('[DEBUG] reportDutyAttendance req.query=', req.query, 'sql=', sql, 'values=', values);
    db.query(sql, values, (err, data) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(data);
    });
};

exports.reportSubmissions = (req, res) => {
    const { scholar_id, date_from, date_to } = req.query;
    const conditions = [];
    const values     = [];

    if (scholar_id) { conditions.push('s.scholar_id = ?');           values.push(scholar_id); }
    if (date_from)  { conditions.push('DATE(s.submitted_at) >= ?');  values.push(date_from); }
    if (date_to)    { conditions.push('DATE(s.submitted_at) <= ?');  values.push(date_to); }

    const sql = `
        SELECT u.full_name AS scholar, u.scholar_id,
            s.service_activity AS type, s.service_date, s.service_hours,
            s.status, s.quality_status, s.submitted_at
        FROM submissions s
        JOIN users u ON u.scholar_id = s.scholar_id
        ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
        ORDER BY s.submitted_at DESC, u.full_name
    `;
    db.query(sql, values, (err, data) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(data);
    });
};

exports.reportRequirements = (req, res) => {
    const { scholar_id, date_from, date_to } = req.query;
    const conditions = [];
    const values     = [];

    if (scholar_id) { conditions.push('s.scholar_id = ?');           values.push(scholar_id); }
    if (date_from)  { conditions.push('DATE(s.submitted_at) >= ?');  values.push(date_from); }
    if (date_to)    { conditions.push('DATE(s.submitted_at) <= ?');  values.push(date_to); }

    const sql = `
        SELECT u.full_name AS scholar, u.scholar_id,
            CASE
                WHEN s.cor_path IS NOT NULL         THEN 'COR'
                WHEN s.report_card_path IS NOT NULL THEN 'Report Card'
                ELSE 'Submission'
            END AS type,
            s.status, s.staff_comment, s.submitted_at
        FROM submissions s
        JOIN users u ON u.scholar_id = s.scholar_id
        ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
        ORDER BY s.submitted_at DESC, u.full_name
    `;
    db.query(sql, values, (err, data) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(data);
    });
};

exports.reportActivities = (req, res) => {
    const { scholar_id, date_from, date_to } = req.query;
    const conditions = [];
    const values     = [];

    if (scholar_id) { conditions.push('da.scholar_id = ?');          values.push(scholar_id); }
    if (date_from)  { conditions.push('DATE(d.duty_date) >= ?');     values.push(date_from); }
    if (date_to)    { conditions.push('DATE(d.duty_date) <= ?');     values.push(date_to); }

    const sql = `
        SELECT u.full_name AS scholar, u.scholar_id,
            d.title AS activity, d.duty_date AS date, d.location,
            da.status AS attended, da.method
        FROM duty_attendance da
        JOIN users u ON u.scholar_id = da.scholar_id
        JOIN duties d ON d.id = da.duty_id
        ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
        ORDER BY d.duty_date DESC, u.full_name
    `;
    db.query(sql, values, (err, data) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(data);
    });
};

// ─── SCHOLAR GROUPS ──────────────────────────────────────────
exports.createGroup = (req, res) => {
    const { group_name, description, created_by } = req.body;

    if (!group_name || !created_by)
        return res.status(400).json({ error: 'group_name and created_by are required' });

    const sql = `INSERT INTO scholar_groups (group_name, description, created_by) VALUES (?, ?, ?)`;
    db.query(sql, [group_name, description || null, created_by], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error creating group' });
        res.status(201).json({ message: 'Group created', id: result.insertId });
    });
};

exports.getGroups = (req, res) => {
    const sql = `
        SELECT g.id, g.group_name, g.description, g.created_at,
            COUNT(m.id) AS member_count
        FROM scholar_groups g
        LEFT JOIN scholar_group_members m ON m.group_id = g.id
        GROUP BY g.id
        ORDER BY g.created_at DESC
    `;
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching groups' });
        res.json(data);
    });
};

exports.getGroupMembers = (req, res) => {
    const { group_id } = req.params;
    const sql = `
        SELECT u.id, u.scholar_id, u.full_name, u.email, u.year_level, m.date_added
        FROM scholar_group_members m
        JOIN users u ON u.scholar_id = m.scholar_id
        WHERE m.group_id = ?
        ORDER BY u.full_name
    `;
    db.query(sql, [group_id], (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching group members' });
        res.json(data);
    });
};

// Scholars na wala pa sa kahit anong group (para sa "add member" picker)
exports.getUngroupedScholars = (req, res) => {
    const sql = `
        SELECT u.id, u.scholar_id, u.full_name, u.email, u.year_level
        FROM users u
        LEFT JOIN scholar_group_members m ON m.scholar_id = u.scholar_id
        WHERE u.role = 'scholar' AND u.status = 'active' AND m.id IS NULL
        ORDER BY u.full_name
    `;
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching ungrouped scholars' });
        res.json(data);
    });
};

// FULL LIST ng lahat ng scholars, kasama yung current group nila (null kung wala pa)
// Ito yung gagamitin sa "Manage Groups" screen para makita LAHAT, hindi lang ungrouped
exports.getAllScholarsWithGroups = (req, res) => {
    const sql = `
        SELECT u.id, u.scholar_id, u.full_name, u.email, u.year_level,
            g.id AS group_id, g.group_name
        FROM users u
        LEFT JOIN scholar_group_members m ON m.scholar_id = u.scholar_id
        LEFT JOIN scholar_groups g ON g.id = m.group_id
        WHERE u.role = 'scholar' AND u.status = 'active'
        ORDER BY u.full_name
    `;
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching scholars' });
        res.json(data);
    });
};

// NOTE: exclusive membership -- kung kabilang na sa ibang group, mag-fail dahil
// sa UNIQUE constraint sa scholar_id. Kailangang alisin muna sa dating group.
exports.addGroupMembers = (req, res) => {
    const { group_id } = req.params;
    const { scholar_ids } = req.body;

    if (!Array.isArray(scholar_ids) || scholar_ids.length === 0)
        return res.status(400).json({ error: 'scholar_ids array is required' });

    const values = scholar_ids.map(sid => [group_id, sid]);
    const sql = `INSERT IGNORE INTO scholar_group_members (group_id, scholar_id) VALUES ?`;

    db.query(sql, [values], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error adding members' });
        res.status(201).json({
            message: 'Members added',
            added: result.affectedRows,
            skipped: scholar_ids.length - result.affectedRows
        });
    });
};

exports.removeGroupMember = (req, res) => {
    const { group_id, scholar_id } = req.params;
    const sql = `DELETE FROM scholar_group_members WHERE group_id = ? AND scholar_id = ?`;
    db.query(sql, [group_id, scholar_id], (err) => {
        if (err) return res.status(500).json({ error: 'Error removing member' });
        res.json({ message: 'Member removed' });
    });
};

// ─── DUTIES ────────────────────────────────────────────────────
// Na-update na ang staffRoutes.js para diretso na tumawag sa dutyController.js
// para dito. Iniwan na lang ang tatlong ito na aliases kung sakaling may ibang
// route file pa na tumatawag sa staff.createDuty / staff.getDuties /
// staff.getDutyDetails -- i-check lang kung wala na, tapos pwede na burahin.
exports.createDuty     = dutyController.createDuty;
exports.getDuties       = dutyController.getAllDuties;
exports.getDutyDetails  = dutyController.getDutyDetails;