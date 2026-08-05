const db = require('../config/db');

const ALL_LEVELS = [
    'grade_7', 'grade_8', 'grade_9', 'grade_10',
    'grade_11', 'grade_12',
    'college_1', 'college_2', 'college_3', 'college_4', 'college_5',
];

// ─── GET SCHOLAR PROFILE ─────────────────────────────────────
exports.getProfile = (req, res) => {
    const sql = `
        SELECT id, scholar_id, full_name, email, role, year_level, status, created_at,
               phone, address, course, school
        FROM users WHERE id = ?
    `;
    db.query(sql, [req.params.id], (err, data) => {
        if (err)         return res.status(500).json({ error: 'Error sa scholar profile' });
        if (!data.length) return res.status(404).json({ error: 'Scholar not found' });
        res.json(data[0]);
    });
};

// ─── UPDATE SCHOLAR PROFILE ───────────────────────────────────
exports.updateProfile = (req, res) => {
    const requestedId = req.params.id;
    const tokenUserId = req.user?.id;

    if (!tokenUserId || Number(tokenUserId) !== Number(requestedId)) {
        return res.status(403).json({ error: 'You can only update your own profile.' });
    }

    const allowedFields = ['full_name', 'email', 'phone', 'address', 'course', 'school', 'year_level'];
    const updates = {};

    allowedFields.forEach((field) => {
        if (field in req.body && typeof req.body[field] !== 'undefined') {
            updates[field] = req.body[field];
        }
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid profile fields provided.' });
    }

    if (updates.year_level && !ALL_LEVELS.includes(updates.year_level)) {
        return res.status(400).json({ error: 'Invalid year level.' });
    }

    const sql = `UPDATE users SET ${Object.keys(updates).map((field) => `${field} = ?`).join(', ')} WHERE id = ?`;
    const params = [...Object.values(updates), requestedId];

    db.query(sql, params, (err) => {
        if (err) return res.status(500).json({ error: 'Error updating profile.' });

        const fetchSql = `
            SELECT id, scholar_id, full_name, email, role, year_level, status, created_at,
                   phone, address, course, school
            FROM users WHERE id = ?
        `;

        db.query(fetchSql, [requestedId], (err2, data) => {
            if (err2) return res.status(500).json({ error: 'Error fetching updated profile.' });
            if (!data.length) return res.status(404).json({ error: 'Scholar not found after update.' });
            res.json(data[0]);
        });
    });
};

// ─── GET ANNOUNCEMENTS ────────────────────────────────────────
exports.getAnnouncements = (req, res) => {
    const { year_level } = req.query;

    const sql = `
        SELECT id, title, content, priority, target_levels, created_by, created_at
        FROM announcements
        ORDER BY created_at DESC
    `;

    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching announcements' });

        const results = data
            .map(row => ({
                ...row,
                target_levels: typeof row.target_levels === 'string'
                    ? JSON.parse(row.target_levels || '[]')
                    : (row.target_levels || []),
            }))
            .filter(row => {
                const levels = row.target_levels;
                if (!year_level) return true;
                const isAll = ALL_LEVELS.every(l => levels.includes(l));
                if (isAll) return true;
                return levels.includes(year_level);
            });

        res.json(results);
    });
};

// ─── GET MY DUTIES ──────────────────────────────────────────────
// Group-based lang: makikita LANG ng scholar yung duty kung member siya
// ng isang group na naka-assign dito. scholar_id GALING SA JWT.
exports.getMyDuties = (req, res) => {
    const scholar_id = req.user.scholar_id;

    const sql = `
        SELECT DISTINCT d.id, d.title, d.description,
            d.duty_date, d.time_start, d.time_end, d.location, d.status,
            g.group_name,
            da.status AS attendance_status, da.method, da.marked_at, da.is_makeup,
            CASE
                WHEN da.status = 'present' THEN 'completed'
                WHEN CURDATE() <= DATE_ADD(d.duty_date, INTERVAL 7 DAY) THEN 'pending'
                ELSE 'missed'
            END AS computed_status
        FROM duties d
        JOIN duty_group_assignments dga ON dga.duty_id = d.id
        JOIN scholar_group_members m ON m.group_id = dga.group_id
        JOIN scholar_groups g ON g.id = dga.group_id
        LEFT JOIN duty_attendance da ON da.duty_id = d.id AND da.scholar_id = m.scholar_id
        WHERE m.scholar_id = ?
        ORDER BY d.duty_date DESC
    `;
    db.query(sql, [scholar_id], (err, data) => {
        if (err) {
            console.error('Error fetching duties (getMyDuties):', err);
            return res.status(500).json({ error: 'Error fetching your duties' });
        }
        res.json(data);
    });
};

// ─── CHECK-IN VIA QR SCAN ────────────────────────────────────────
// Tinatawag ito ng app pagkatapos i-scan ng scholar yung QR code na naka-post
// sa duty location. Ang QR ay naka-encode lang ng `qr_token` (hindi duty_id
// mismo), kaya kailangan i-lookup muna yung duty base dito.
// scholar_id GALING SA JWT (req.user.scholar_id) -- HINDI sa req.body,
// para hindi pwede mag-check-in bilang ibang scholar.
exports.checkInToDuty = (req, res) => {
    const scholar_id = req.user.scholar_id;
    const { qr_token } = req.body;

    if (!qr_token)
        return res.status(400).json({ error: 'qr_token is required' });

    // Step 1: Hanapin yung duty base sa QR token
    const dutySql = `SELECT id, duty_date FROM duties WHERE qr_token = ?`;
    db.query(dutySql, [qr_token], (err, dutyRows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (dutyRows.length === 0)
            return res.status(404).json({ error: 'Invalid QR code.' });

        const duty = dutyRows[0];

        // Step 2: Verify na member siya ng group na naka-assign sa duty na ito
        const verifySql = `
            SELECT 1
            FROM duty_group_assignments dga
            JOIN scholar_group_members m ON m.group_id = dga.group_id
            WHERE dga.duty_id = ? AND m.scholar_id = ?
            LIMIT 1
        `;
        db.query(verifySql, [duty.id, scholar_id], (err, check) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            if (check.length === 0) {
                // Hindi siya member ng naka-assign na group -- reject kahit valid ang QR
                return res.status(403).json({ error: 'This duty is not assigned to your group.' });
            }

            // Step 3: Prevent duplicate check-in
            const dupSql = `SELECT id FROM duty_attendance WHERE duty_id = ? AND scholar_id = ?`;
            db.query(dupSql, [duty.id, scholar_id], (err, existing) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                if (existing.length > 0)
                    return res.status(409).json({ error: 'Already checked in for this duty.' });

                // Step 4: Check kung nasa loob pa ng 7-day makeup window
                const today = new Date().toISOString().split('T')[0];
                const dutyDateStr = new Date(duty.duty_date).toISOString().split('T')[0];

                const deadline = new Date(duty.duty_date);
                deadline.setDate(deadline.getDate() + 7);
                const deadlineStr = deadline.toISOString().split('T')[0];

                if (today > deadlineStr) {
                    return res.status(410).json({ error: 'Makeup window for this duty has already closed.' });
                }

                const isMakeup = today !== dutyDateStr ? 1 : 0;

                // Step 5: Insert attendance
                const insertSql = `
                    INSERT INTO duty_attendance (duty_id, scholar_id, status, method, marked_at, is_makeup)
                    VALUES (?, ?, 'present', 'qr', NOW(), ?)
                `;
                db.query(insertSql, [duty.id, scholar_id, isMakeup], (err, result) => {
                    if (err) return res.status(500).json({ error: 'Error recording attendance' });
                    res.status(201).json({
                        message: isMakeup ? 'Checked in (makeup)' : 'Checked in successfully',
                        id: result.insertId,
                        is_makeup: !!isMakeup
                    });
                });
            });
        });
    });
};