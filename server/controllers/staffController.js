const db = require('../config/db');
const dutyController = require('./dutyController');
const { markEndedDutyAbsences } = require('../services/dutyAbsenceService');
const { sendAnnouncementNotifyEmails } = require('../utils/notifyHelpers');
const { applyOfficerYearLevelFilter } = require('../utils/officerAssignments');

const applyStaffGroupFilter = (req, conditions, values, scholarColumn) => {
    if (req.user?.role !== 'staff') return;

    conditions.push(`EXISTS (
        SELECT 1
        FROM scholar_group_members scoped_members
        JOIN scholar_groups scoped_groups ON scoped_groups.id = scoped_members.group_id
        WHERE scoped_members.scholar_id = ${scholarColumn}
          AND scoped_groups.assigned_staff_id = ?
    )`);
    values.push(req.user.id);
};

exports.getMakeupRequestData = async (req, res) => {
    const staffId = req.user.id;
    try {
        await markEndedDutyAbsences();
    } catch (error) {
        console.error('[duty-absence] failed to prepare makeup request data:', error.message || error);
        return res.status(500).json({ error: 'Unable to update ended duty attendance.' });
    }

    db.query(`
        SELECT DISTINCT u.scholar_id, u.full_name AS scholar_name,
               d.id AS source_duty_id, d.title AS source_duty_title, d.duty_date AS source_duty_date,
               da.status AS source_status
        FROM duties d
        JOIN duty_group_assignments dga ON dga.duty_id = d.id
        JOIN scholar_groups g ON g.id = dga.group_id AND g.assigned_staff_id = ?
        JOIN scholar_group_members gm ON gm.group_id = g.id
        JOIN users u ON u.scholar_id = gm.scholar_id AND u.role = 'scholar' AND u.status = 'active'
        LEFT JOIN duty_attendance da ON da.duty_id = d.id AND da.scholar_id = u.scholar_id
        LEFT JOIN duty_makeup_permissions p
            ON p.source_duty_id = d.id AND p.scholar_id = u.scholar_id
            AND p.status IN ('pending', 'approved', 'used')
        WHERE da.status IN ('absent', 'excused')
          AND d.duty_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
          AND p.id IS NULL
        ORDER BY d.duty_date DESC, u.full_name ASC
    `, [staffId], (sourceErr, sources) => {
        if (sourceErr) return res.status(500).json({ error: 'Error fetching makeup request candidates' });
        res.json({ sources });
    });
};

// ─── SCHOLARS ─────────────────────────────────────────────────
exports.getPendingScholars = (req, res) => {
    const conditions = ["u.role = 'scholar'"];
    const values = [];
    applyStaffGroupFilter(req, conditions, values, 'u.scholar_id');
    applyOfficerYearLevelFilter(req, conditions, values).then(() => {
    const sql = `
        SELECT id, scholar_id, full_name, email, role, year_level, status, created_at
        FROM users u WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC
    `;
    db.query(sql, values, (err, data) => {
        if (err) return res.status(500).json({ error: 'Database error sa staff route' });
        res.json(data);
    });
    }).catch(() => res.status(500).json({ error: 'Failed to resolve officer assignments.' }));
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
    const { title, content, priority = 'info', target_levels = [] } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'title and content are required.' });
    }

    const creatorId = req.user?.id || null;
    const creatorRole = req.user?.role || 'staff';
    const sql = `
        INSERT INTO announcements (title, content, priority, target_roles, target_levels, created_by, created_by_role, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())
    `;
    db.query(sql, [title, content, priority, JSON.stringify(['scholar']), JSON.stringify(target_levels), creatorId, creatorRole], (err, result) => {
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
    const { scholar_id, date_from, date_to, month, status } = req.query;
    const conditions = [];
    const values     = [];

    if (scholar_id) { conditions.push('da.scholar_id = ?');          values.push(scholar_id); }
    if (date_from)  { conditions.push('DATE(COALESCE(d.duty_date, da.marked_at)) >= ?');    values.push(date_from); }
    if (date_to)    { conditions.push('DATE(COALESCE(d.duty_date, da.marked_at)) <= ?');    values.push(date_to); }
    if (month)      { conditions.push("DATE_FORMAT(COALESCE(d.duty_date, da.marked_at), '%Y-%m') = ?"); values.push(month); }
    if (status)     { conditions.push('da.status = ?');               values.push(status); }
    applyStaffGroupFilter(req, conditions, values, 'da.scholar_id');

    applyOfficerYearLevelFilter(req, conditions, values).then(() => {
    const sql = `
        SELECT u.full_name AS scholar, u.scholar_id, u.year_level,
            d.title AS duty, d.duty_date AS date, d.location,
            da.status, da.method, da.marked_at,
            COALESCE(g.group_name, 'Unassigned') AS group_name,
            COALESCE(assigned_staff.full_name, 'Unassigned') AS assigned_staff
        FROM duty_attendance da
        JOIN users u ON u.scholar_id = da.scholar_id
        JOIN duties d ON d.id = da.duty_id
        LEFT JOIN scholar_group_members gm ON gm.scholar_id = da.scholar_id
            AND gm.group_id IN (SELECT group_id FROM duty_group_assignments WHERE duty_id = d.id)
        LEFT JOIN scholar_groups g ON g.id = gm.group_id
        LEFT JOIN users assigned_staff ON assigned_staff.id = g.assigned_staff_id AND LOWER(assigned_staff.role) = 'staff'
        ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
        GROUP BY da.id, u.full_name, u.scholar_id, u.year_level, d.title, d.duty_date, d.location, da.status, da.method, da.marked_at, g.group_name, assigned_staff.full_name
        ORDER BY da.marked_at DESC, u.full_name
    `;
    console.log('[DEBUG] reportDutyAttendance req.query=', req.query, 'sql=', sql, 'values=', values);
    db.query(sql, values, (err, data) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(data);
    });
    }).catch(() => res.status(500).json({ error: 'Failed to resolve officer assignments.' }));
};

exports.reportSubmissions = (req, res) => {
    const { scholar_id, date_from, date_to } = req.query;
    const conditions = [];
    const values     = [];

    if (req.user?.role === 'officer') conditions.push("s.submission_type = 'letter'");
    if (scholar_id) { conditions.push('s.scholar_id = ?');           values.push(scholar_id); }
    if (date_from)  { conditions.push('DATE(s.submitted_at) >= ?');  values.push(date_from); }
    if (date_to)    { conditions.push('DATE(s.submitted_at) <= ?');  values.push(date_to); }
    applyStaffGroupFilter(req, conditions, values, 's.scholar_id');

    applyOfficerYearLevelFilter(req, conditions, values).then(() => {
    const sql = `
        SELECT u.full_name AS scholar, u.scholar_id,
            s.submission_type AS type,
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
    }).catch(() => res.status(500).json({ error: 'Failed to resolve officer assignments.' }));
};

exports.reportRequirements = (req, res) => {
    const { scholar_id, date_from, date_to } = req.query;
    const conditions = [];
    const values     = [];

    if (scholar_id) { conditions.push('s.scholar_id = ?');           values.push(scholar_id); }
    if (date_from)  { conditions.push('DATE(s.submitted_at) >= ?');  values.push(date_from); }
    if (date_to)    { conditions.push('DATE(s.submitted_at) <= ?');  values.push(date_to); }
    applyStaffGroupFilter(req, conditions, values, 's.scholar_id');

    applyOfficerYearLevelFilter(req, conditions, values).then(() => {
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
    }).catch(() => res.status(500).json({ error: 'Failed to resolve officer assignments.' }));
};

exports.reportActivities = (req, res) => {
    const { scholar_id, date_from, date_to } = req.query;
    const conditions = [];
    const values     = [];

    if (scholar_id) { conditions.push('da.scholar_id = ?');          values.push(scholar_id); }
    if (date_from)  { conditions.push('DATE(d.duty_date) >= ?');     values.push(date_from); }
    if (date_to)    { conditions.push('DATE(d.duty_date) <= ?');     values.push(date_to); }
    applyStaffGroupFilter(req, conditions, values, 'da.scholar_id');

    applyOfficerYearLevelFilter(req, conditions, values).then(() => {
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
    }).catch(() => res.status(500).json({ error: 'Failed to resolve officer assignments.' }));
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

exports.updateGroup = (req, res) => {
    const { group_id } = req.params;
    const { group_name, description } = req.body;
    const trimmedName = String(group_name || '').trim();

    if (!trimmedName) {
        return res.status(400).json({ error: 'Group name is required' });
    }

    db.query(
        'UPDATE scholar_groups SET group_name = ?, description = ? WHERE id = ?',
        [trimmedName, description ? String(description).trim() : null, group_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Error updating group' });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Group not found' });
            res.json({ message: 'Group updated', id: Number(group_id) });
        }
    );
};

exports.deleteGroup = (req, res) => {
    const { group_id } = req.params;

    db.query('DELETE FROM scholar_group_members WHERE group_id = ?', [group_id], (memberErr) => {
        if (memberErr) return res.status(500).json({ error: 'Error removing group members' });

        db.query('DELETE FROM duty_group_assignments WHERE group_id = ?', [group_id], (dutyErr) => {
            if (dutyErr) return res.status(500).json({ error: 'Error removing duty assignments for this group' });

            db.query('DELETE FROM scholar_groups WHERE id = ?', [group_id], (err, result) => {
                if (err) return res.status(500).json({ error: 'Error deleting group' });
                if (result.affectedRows === 0) return res.status(404).json({ error: 'Group not found' });
                res.json({ message: 'Group deleted', id: Number(group_id) });
            });
        });
    });
};

exports.getGroups = (req, res) => {
    const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
    const sql = `
        SELECT g.id, g.group_name, g.description, g.created_at,
            COUNT(m.id) AS member_count
        FROM scholar_groups g
        LEFT JOIN scholar_group_members m ON m.group_id = g.id
        ${isAdmin ? '' : 'WHERE g.assigned_staff_id = ? OR g.created_by = ?'}
        GROUP BY g.id
        ORDER BY g.created_at DESC
    `;
    db.query(sql, isAdmin ? [] : [req.user.id, req.user.id], (err, data) => {
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