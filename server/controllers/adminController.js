const db     = require('../config/db');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const fs     = require('fs');
const path   = require('path');
const { sendAnnouncementNotifyEmails, sendWelcomeEmail } = require('../utils/notifyHelpers');
const { logAuditEvent } = require('../utils/auditLogger');
const { getAssignedYearLevels } = require('../utils/officerAssignments');
const { logComplianceIncident, clampCompliance, getComplianceSettings, calculateCurrentCompliance, calculateComplianceScore, resolveGradeScale } = require('../utils/complianceLogger');

exports.getPrivacyRequests = (req, res) => {
    db.query(
        `SELECT pr.id, pr.request_type, pr.status, pr.requested_at, pr.processed_at, pr.notes,
                u.id AS user_id, u.scholar_id, u.full_name, u.email
         FROM privacy_requests pr
         JOIN users u ON u.id = pr.user_id
         ORDER BY pr.requested_at DESC`,
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Failed to load privacy requests.' });
            res.json(rows);
        }
    );
};

exports.getAdminProfile = (req, res) => {
    db.query(
        `SELECT id, full_name, email FROM users WHERE id = ? AND role = 'admin' LIMIT 1`,
        [req.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Failed to load administrator profile.' });
            if (!rows.length) return res.status(404).json({ error: 'Administrator profile not found.' });
            res.json({ displayName: rows[0].full_name, email: rows[0].email });
        }
    );
};

exports.updateAdminProfile = (req, res) => {
    const displayName = String(req.body?.displayName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!displayName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Enter a valid administrator name and email address.' });
    }

    db.query(
        `UPDATE users SET full_name = ?, email = ? WHERE id = ? AND role = 'admin'`,
        [displayName, email, req.user.id],
        (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That email address is already in use.' });
                console.error('Failed to update administrator profile:', err);
                return res.status(500).json({ error: 'Failed to save administrator profile.' });
            }
            db.query(
                `SELECT id FROM users WHERE id = ? AND role = 'admin' LIMIT 1`,
                [req.user.id],
                (lookupError, rows) => {
                    if (lookupError) return res.status(500).json({ error: 'Profile was saved but could not be verified.' });
                    if (!rows.length) return res.status(404).json({ error: 'Administrator profile not found.' });

                    logAuditEvent({
                        req,
                        action: 'edit',
                        module: 'Administrator Settings',
                        details: 'Updated administrator profile',
                        result: 'success',
                    });
                    res.json({ displayName, email });
                }
            );
        }
    );
};

const DEFAULT_ADMIN_PREFERENCES = {
    language: 'English (Philippines)',
    timezone: '(GMT+8) Manila, Philippines',
    dateFormat: 'MMMM DD, YYYY',
    tableDensity: 'comfortable',
    compactTables: false,
    emailNotifications: true,
    inAppNotifications: true,
    autoRefresh: true,
    sessionTimeout: '30',
    requireReauth: true,
    securityAlerts: true,
    logAdminActivity: true,
};

const ADMIN_PREFERENCE_KEYS = Object.keys(DEFAULT_ADMIN_PREFERENCES);

exports.getAdminSettings = (req, res) => {
    db.query(
        `SELECT u.full_name AS displayName, u.email,
                p.settings_json AS preferences,
                s.scheduled_backups AS scheduledBackups,
                s.backup_interval_hours AS backupIntervalHours,
                s.backup_retention_count AS backupRetentionCount
         FROM users u
         LEFT JOIN admin_preferences p ON p.user_id = u.id
         LEFT JOIN admin_system_settings s ON s.id = 1
         WHERE u.id = ? AND u.role = 'admin' LIMIT 1`,
        [req.user.id],
        (err, rows) => {
            if (err) {
                console.error('Failed to load administrator settings:', err);
                return res.status(500).json({ error: 'Failed to load administrator settings.' });
            }
            if (!rows.length) return res.status(404).json({ error: 'Administrator profile not found.' });

            let preferences = {};
            try {
                preferences = rows[0].preferences ? JSON.parse(rows[0].preferences) : {};
            } catch (parseError) {
                console.error('Invalid stored administrator preferences:', parseError);
                return res.status(500).json({ error: 'Saved administrator preferences are invalid.' });
            }
            res.json({
                displayName: rows[0].displayName,
                email: rows[0].email,
                ...DEFAULT_ADMIN_PREFERENCES,
                ...preferences,
                scheduledBackups: rows[0].scheduledBackups == null ? process.env.ENABLE_SCHEDULED_BACKUPS !== 'false' : Boolean(rows[0].scheduledBackups),
                backupIntervalHours: String(rows[0].backupIntervalHours || process.env.BACKUP_INTERVAL_HOURS || 24),
                backupRetentionCount: String(rows[0].backupRetentionCount || process.env.BACKUP_DAILY_RETENTION || 14),
                backupTime: process.env.BACKUP_TIME || '23:59',
                backupTimezone: process.env.BACKUP_TIMEZONE || 'Asia/Manila',
                backupFullRetention: String(process.env.BACKUP_FULL_RETENTION || 4),
            });
        }
    );
};

exports.updateAdminSettings = (req, res) => {
    const displayName = String(req.body?.displayName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const incoming = req.body?.preferences;
    const settings = {};

    if (!displayName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Enter a valid administrator name and email address.' });
    }
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        return res.status(400).json({ error: 'Administrator preferences are required.' });
    }
    for (const key of ADMIN_PREFERENCE_KEYS) {
        const value = incoming[key];
        if (typeof DEFAULT_ADMIN_PREFERENCES[key] === 'boolean' && typeof value !== 'boolean') {
            return res.status(400).json({ error: `Invalid value for ${key}.` });
        }
        if (typeof DEFAULT_ADMIN_PREFERENCES[key] === 'string' && typeof value !== 'string') {
            return res.status(400).json({ error: `Invalid value for ${key}.` });
        }
        settings[key] = value;
    }

    const validOptions = {
        language: ['English (Philippines)', 'English (US)', 'Filipino'],
        timezone: ['(GMT+8) Manila, Philippines', '(GMT+0) UTC', '(GMT+9) Tokyo, Japan', '(GMT-5) New York, USA'],
        dateFormat: ['MMMM DD, YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
        tableDensity: ['comfortable', 'compact', 'condensed'],
        sessionTimeout: ['15', '30', '60', '120'],
    };
    for (const [key, options] of Object.entries(validOptions)) {
        if (!options.includes(settings[key])) return res.status(400).json({ error: `Invalid value for ${key}.` });
    }
    settings.compactTables = settings.tableDensity !== 'comfortable';
    const intervalHours = Number.parseInt(req.body.backupIntervalHours, 10);
    const retentionCount = Number.parseInt(req.body.backupRetentionCount, 10);
    if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 8760) {
        return res.status(400).json({ error: 'Backup interval must be between 1 and 8760 hours.' });
    }
    if (!Number.isInteger(retentionCount) || retentionCount < 1 || retentionCount > 1000) {
        return res.status(400).json({ error: 'Backup retention must be between 1 and 1000 backups.' });
    }
    if (typeof req.body.scheduledBackups !== 'boolean') {
        return res.status(400).json({ error: 'Invalid scheduled-backup setting.' });
    }

    const serialized = JSON.stringify(settings);
    db.query(
        `SELECT u.password, p.settings_json AS preferences
         FROM users u LEFT JOIN admin_preferences p ON p.user_id = u.id
         WHERE u.id = ? AND u.role = 'admin' LIMIT 1`,
        [req.user.id],
        async (reauthLookupError, rows) => {
            if (reauthLookupError) {
                console.error('Failed to verify administrator settings request:', reauthLookupError);
                return res.status(500).json({ error: 'Failed to verify administrator identity.' });
            }
            if (!rows.length) return res.status(404).json({ error: 'Administrator profile not found.' });
            let currentPreferences = {};
            try {
                currentPreferences = rows[0].preferences ? JSON.parse(rows[0].preferences) : {};
            } catch (parseError) {
                console.error('Invalid stored administrator preferences:', parseError);
                return res.status(500).json({ error: 'Saved administrator preferences are invalid.' });
            }
            if (currentPreferences.requireReauth !== false) {
                const password = String(req.body.currentPassword || '');
                const passwordMatches = rows[0].password?.startsWith('$2')
                    ? await bcrypt.compare(password, rows[0].password)
                    : password === String(rows[0].password || '');
                if (!passwordMatches) return res.status(401).json({ error: 'Enter your current password to save administrator settings.' });
            }

    db.getConnection((connectionError, connection) => {
        if (connectionError) {
            console.error('Failed to save administrator settings:', connectionError);
            return res.status(500).json({ error: 'Failed to save administrator settings.' });
        }
        connection.beginTransaction((transactionError) => {
            if (transactionError) {
                connection.release();
                console.error('Failed to start administrator settings transaction:', transactionError);
                return res.status(500).json({ error: 'Failed to save administrator settings.' });
            }

            const rollback = (error, message, status = 500) => connection.rollback(() => {
                connection.release();
                if (error) console.error('Failed to save administrator settings:', error);
                res.status(status).json({ error: message });
            });
            connection.query(
                `UPDATE users SET full_name = ?, email = ? WHERE id = ? AND role = 'admin'`,
                [displayName, email, req.user.id],
                (profileError, result) => {
                    if (profileError) {
                        if (profileError.code === 'ER_DUP_ENTRY') return rollback(null, 'That email address is already in use.', 409);
                        return rollback(profileError, 'Failed to save administrator profile.');
                    }
                    if (!result.affectedRows) {
                        return connection.query('SELECT id FROM users WHERE id = ? AND role = \'admin\' LIMIT 1', [req.user.id], (lookupError, rows) => {
                            if (lookupError) return rollback(lookupError, 'Failed to verify administrator profile.');
                            if (!rows.length) return rollback(null, 'Administrator profile not found.', 404);
                            savePreferences();
                        });
                    }
                    savePreferences();
                }
            );

            const savePreferences = () => connection.query(
                `INSERT INTO admin_preferences (user_id, settings_json)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json)`,
                [req.user.id, serialized],
                (preferenceError) => {
                    if (preferenceError) return rollback(preferenceError, 'Failed to save administrator preferences.');
                    connection.query(
                        `INSERT INTO admin_system_settings (id, scheduled_backups, backup_interval_hours, backup_retention_count)
                         VALUES (1, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                           scheduled_backups = VALUES(scheduled_backups),
                           backup_interval_hours = VALUES(backup_interval_hours),
                           backup_retention_count = VALUES(backup_retention_count)`,
                        [req.body.scheduledBackups, intervalHours, retentionCount],
                        (systemError) => {
                            if (systemError) return rollback(systemError, 'Failed to save system backup settings.');
                            connection.commit(async (commitError) => {
                                connection.release();
                                if (commitError) {
                                    console.error('Failed to commit administrator settings:', commitError);
                                    return res.status(500).json({ error: 'Failed to save administrator settings.' });
                                }
                                process.emit('admin-backup-settings-updated', {
                                    enabled: req.body.scheduledBackups,
                                    intervalHours,
                                    retentionCount,
                                });
                                await logAuditEvent({
                                    req,
                                    action: 'edit',
                                    module: 'Administrator Settings',
                                    details: 'Updated administrator and system preferences',
                                    result: 'success',
                                });
                                res.json({
                                    displayName,
                                    email,
                                    ...settings,
                                    scheduledBackups: req.body.scheduledBackups,
                                    backupIntervalHours: String(intervalHours),
                                    backupRetentionCount: String(retentionCount),
                                });
                            });
                        }
                    );
                }
            );
        });
    });
        }
    );
};

exports.updatePrivacyRequest = async (req, res) => {
    const status = req.body?.status;
    if (!['approved', 'rejected', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Status must be approved, rejected, or completed.' });
    }

    db.query(
        `UPDATE privacy_requests SET status = ?, processed_at = NOW(), processed_by = ?, notes = ?
         WHERE id = ? AND status = 'pending'`,
        [status, req.user.id, req.body?.notes || null, req.params.id],
        async (err, result) => {
            if (err) return res.status(500).json({ error: 'Failed to update privacy request.' });
            if (!result.affectedRows) return res.status(404).json({ error: 'Pending privacy request not found.' });
            await logAuditEvent({ req, action: `privacy_request_${status}`, module: 'Data Privacy', details: `Processed privacy request ${req.params.id}`, result: 'success' });
            res.json({ id: Number(req.params.id), status });
        }
    );
};

// ─── ID Generators ────────────────────────────────────────────
const prefixMap = {
    scholar: 'SCH',
    officer: 'OFF',
    staff:   'STF',
    admin:   'ADM',
};

const generateId = (role, cb) => {
    const year = new Date().getFullYear();
    const prefix = prefixMap[role] || 'SCH';
    const like = `${prefix}-${year}-`;

    db.query(
        `SELECT scholar_id FROM users WHERE role = ? AND scholar_id LIKE ? ORDER BY scholar_id DESC LIMIT 1`,
        [role, `${like}%`],
        (err, data) => {
            if (err) return cb(err, null);

            let nextNum = 1;
            if (data.length > 0) {
                const parts = String(data[0].scholar_id || '').split('-');
                const num = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(num)) nextNum = num + 1;
            }

            const generated = `${like}${String(nextNum).padStart(4, '0')}`;
            cb(null, generated);
        }
    );
};

const generateScholarId = (cb) => generateId('scholar', cb);
const generateOfficerId = (cb) => generateId('officer', cb);
const generateStaffId   = (cb) => generateId('staff', cb);
const generateAdminId   = (cb) => generateId('admin', cb);

const getIdGenerator = (role) => {
    switch (role) {
        case 'scholar': return generateScholarId;
        case 'officer': return generateOfficerId;
        case 'staff':   return generateStaffId;
        case 'admin':   return generateAdminId;
        default:        return generateScholarId;
    }
};

// ─── USERS ────────────────────────────────────────────────────
exports.getAllUsers = (req, res) => {
    const sql = `
        SELECT id, scholar_id, full_name, email, role, year_level, status, created_at
        FROM users
        WHERE NOT (role = 'scholar' AND COALESCE(status, '') = 'archived')
        ORDER BY created_at DESC
    `;
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching users' });
        res.json(data);
    });
};

exports.archiveScholar = (req, res) => {
    const userId = String(req.params.id || '');
    if (!/^[1-9]\d*$/.test(userId) || !Number.isSafeInteger(Number(userId))) {
        return res.status(400).json({ error: 'A valid scholar user ID is required.' });
    }

    db.query(
        'SELECT id, scholar_id, full_name, role, status FROM users WHERE id = ? LIMIT 1',
        [userId],
        (lookupError, rows) => {
            if (lookupError) {
                console.error('Failed to look up scholar for archival:', lookupError);
                return res.status(500).json({ error: 'Unable to archive scholar.' });
            }
            if (!rows.length) return res.status(404).json({ error: 'User not found.' });

            const scholar = rows[0];
            if (scholar.role !== 'scholar') {
                return res.status(400).json({ error: 'Only scholar accounts can be archived.' });
            }

            const respondArchived = () => {
                res.json({
                    message: 'Scholar archived successfully',
                    userId: Number(userId),
                });
            };

            if (String(scholar.status || '').toLowerCase() === 'archived') {
                return respondArchived();
            }

            db.query(
                "UPDATE users SET status = 'archived' WHERE id = ? AND role = 'scholar'",
                [userId],
                async (updateError, result) => {
                    if (updateError) {
                        console.error('Failed to archive scholar:', updateError);
                        return res.status(500).json({ error: 'Unable to archive scholar.' });
                    }

                    if (!result.affectedRows) {
                        return db.query(
                            'SELECT role, status FROM users WHERE id = ? LIMIT 1',
                            [userId],
                            (verifyError, currentRows) => {
                                if (verifyError) {
                                    console.error('Failed to verify scholar archive state:', verifyError);
                                    return res.status(500).json({ error: 'Unable to verify scholar archive state.' });
                                }
                                if (!currentRows.length) return res.status(404).json({ error: 'User not found.' });
                                if (currentRows[0].role !== 'scholar') {
                                    return res.status(400).json({ error: 'Only scholar accounts can be archived.' });
                                }
                                if (String(currentRows[0].status || '').toLowerCase() !== 'archived') {
                                    return res.status(409).json({ error: 'Scholar archive state changed. Refresh and try again.' });
                                }
                                respondArchived();
                            }
                        );
                    }

                    await logAuditEvent({
                        req,
                        action: 'archive',
                        module: 'User Management',
                        details: `Archived scholar ${scholar.full_name} (${scholar.scholar_id || userId})`,
                        result: 'success',
                    });
                    respondArchived();
                }
            );
        }
    );
};

exports.createUser = async (req, res) => {
    const { full_name, email, password, role, year_level } = req.body;

    if (!full_name || !email || !password || !role)
        return res.status(400).json({ error: 'Missing required fields' });

    const validRoles = ['scholar', 'officer', 'staff', 'admin'];
    if (!validRoles.includes(role))
        return res.status(400).json({ error: 'Invalid role' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const generator = getIdGenerator(role);

        generator(async (err, generatedId) => {
            if (err) return res.status(500).json({ error: 'Error generating ID' });

            try {
                const finalYearLevel = (role === 'scholar' || role === 'officer')
                    ? (year_level || null) : null;

                const sql = `
                    INSERT INTO users (scholar_id, full_name, email, password, role, year_level, must_change_password)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                `;
                db.query(sql, [generatedId, full_name, email, hashedPassword, role, finalYearLevel], (insertErr, result) => {
                    if (insertErr) {
                        if (insertErr.code === 'ER_DUP_ENTRY')
                            return res.status(409).json({ error: 'Email or ID already exists' });
                        return res.status(500).json({ error: 'Error creating user' });
                    }

                    const responseKey =
                        role === 'scholar' ? 'scholarId' :
                        role === 'officer' ? 'officerId' :
                        role === 'staff'   ? 'staffId'   : 'adminId';

                    sendWelcomeEmail(
                        { full_name, email, generatedId },
                        password,
                        () => {}
                    );

                    logAuditEvent({
                        req,
                        action: 'create',
                        module: 'User Management',
                        details: `Created ${role} user ${email} (${generatedId})`,
                        result: 'success',
                    });

                    res.status(201).json({
                        message: 'User created successfully',
                        userId: result.insertId,
                        generatedId,
                        [responseKey]: generatedId,
                    });
                });
            } catch (err) {
                res.status(500).json({ error: 'Error creating user' });
            }
        });
    } catch (hashErr) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { full_name, email, role, year_level, status, password } = req.body;

    try {
        const finalYearLevel = (role === 'scholar' || role === 'officer') ? (year_level || null) : null;
        let sql, params;
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            sql    = `UPDATE users SET full_name=?, email=?, role=?, year_level=?, status=?, password=?, must_change_password=1 WHERE id=?`;
            params = [full_name, email, role, finalYearLevel, status, hashedPassword, id];
        } else {
            sql    = `UPDATE users SET full_name=?, email=?, role=?, year_level=?, status=? WHERE id=?`;
            params = [full_name, email, role, finalYearLevel, status, id];
        }
        db.query(sql, params, (err) => {
            if (err) return res.status(500).json({ error: 'Error updating user' });
            logAuditEvent({
                req,
                action: 'edit',
                module: 'User Management',
                details: `Updated user ${id} (${email})`,
                result: 'success',
            });
            res.json({ message: 'User updated successfully' });
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.assignUserRole = (req, res) => {
    const { id }    = req.params;
    const { newRole } = req.body;
    const validRoles  = ['scholar', 'officer', 'staff', 'admin'];

    if (!newRole || !validRoles.includes(newRole))
        return res.status(400).json({ error: 'Invalid or missing role' });

    db.query('UPDATE users SET role = ? WHERE id = ?', [newRole, id], (err, result) => {
        if (err)                     return res.status(500).json({ error: 'Database error', details: err });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
        logAuditEvent({
            req,
            action: 'edit',
            module: 'User Management',
            details: `Changed role for user ${id} to ${newRole}`,
            result: 'success',
        });
        res.json({ message: 'User role updated successfully', newRole });
    });
};

// Soft-delete users by marking status as 'inactive' to avoid FK constraint issues
exports.deleteUser = (req, res) => {
    const userId = req.params.id;
    db.query('UPDATE users SET status = ? WHERE id = ?', ['inactive', userId], (err, result) => {
        if (err) {
            console.error('Error soft-deleting user:', err);
            try {
                const logPath = path.join(__dirname, '..', 'logs', 'delete_errors.log');
                const entry = `[${new Date().toISOString()}] SOFT-DELETE /api/admin/users/${userId} ERROR: ${err.stack || err}\n`;
                fs.appendFile(logPath, entry, (fsErr) => {
                    if (fsErr) console.error('Failed writing delete error log:', fsErr);
                });
            } catch (e) {
                console.error('Failed to write delete error log:', e);
            }
            return res.status(500).json({ error: 'Error deleting user', details: err.message });
        }
        if (result && result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
        logAuditEvent({
            req,
            action: 'delete',
            module: 'User Management',
            details: `Deactivated user ${userId}`,
            result: 'success',
        });
        res.json({ message: 'User marked inactive (soft-deleted)' });
    });
};

// ─── SCHOLAR PROFILE ──────────────────────────────────────────
exports.getScholarProfile = (req, res) => {
    const { id } = req.params;
    db.query(
        `SELECT id, scholar_id, full_name, email, role, year_level, status, created_at FROM users WHERE id = ? AND role = 'scholar'`,
        [id],
        (err, userData) => {
            if (err)                 return res.status(500).json({ error: 'Error fetching scholar' });
            if (!userData.length)   return res.status(404).json({ error: 'Scholar not found' });

            const scholar = userData[0];
            const statsSql = `
                SELECT COUNT(*) as total_submissions,
                    ROUND(AVG(quality_score), 1) as avg_quality_score,
                    SUM(CASE WHEN service_hours IS NOT NULL THEN service_hours ELSE 0 END) as total_service_hours
                FROM submissions WHERE scholar_id = ?
            `;
            db.query(statsSql, [scholar.scholar_id], (statsErr, statsData) => {
                if (statsErr) return res.status(500).json({ error: 'Error fetching scholar stats' });
                const stats = statsData[0] || {};
                res.json({
                    ...scholar,
                    total_submissions:   stats.total_submissions   || 0,
                    avg_quality_score:   stats.avg_quality_score   || 0,
                    total_service_hours: stats.total_service_hours || 0,
                });
            });
        }
    );
};

exports.getScholarSubmissions = (req, res) => {
    db.query('SELECT scholar_id FROM users WHERE id = ?', [req.params.id], (lookupErr, lookupData) => {
        if (lookupErr)          return res.status(500).json({ error: 'Error resolving scholar' });
        if (!lookupData.length) return res.status(404).json({ error: 'Scholar not found' });

        const scholarId = lookupData[0].scholar_id;
        if (!scholarId) return res.json([]);

        const sql = `
            SELECT s.*, GROUP_CONCAT(sm.file_path) as media_paths, GROUP_CONCAT(sm.description) as media_descriptions
            FROM submissions s
            LEFT JOIN submission_media sm ON s.id = sm.submission_id
            WHERE s.scholar_id = ? GROUP BY s.id ORDER BY s.submitted_at DESC
        `;
        db.query(sql, [scholarId], (err, data) => {
            if (err) return res.status(500).json({ error: 'Error fetching submissions' });
            res.json(data);
        });
    });
};

exports.getScholarAttendance = (req, res) => {
    db.query('SELECT scholar_id FROM users WHERE id = ?', [req.params.id], (lookupErr, lookupData) => {
        if (lookupErr)          return res.status(500).json({ error: 'Error resolving scholar' });
        if (!lookupData.length) return res.status(404).json({ error: 'Scholar not found' });

        const scholarId = lookupData[0].scholar_id;
        if (!scholarId) return res.json([]);

        const sql = `
            SELECT da.id, da.status, da.method, da.marked_at,
                d.id as duty_id, d.title, d.location, d.duty_date, d.time_start, d.time_end
            FROM duty_attendance da
            INNER JOIN duties d ON da.duty_id = d.id
            WHERE da.scholar_id = ? ORDER BY d.duty_date DESC
        `;
        db.query(sql, [scholarId], (err, data) => {
            if (err) {
                console.error('Scholar attendance query error:', err);
                return res.status(500).json({ error: 'Error fetching attendance', detail: err.message });
            }
            res.json(data);
        });
    });
};

// ─── SCHOLAR GRADES (admin view — reads same `grades` table scholars submit to) ──
exports.getScholarGrades = (req, res) => {
    db.query('SELECT scholar_id FROM users WHERE id = ?', [req.params.id], (lookupErr, lookupData) => {
        if (lookupErr)          return res.status(500).json({ error: 'Error resolving scholar' });
        if (!lookupData.length) return res.status(404).json({ error: 'Scholar not found' });

        const scholarId = lookupData[0].scholar_id;
        if (!scholarId) return res.json([]);

        const sql = `
            SELECT id, semester, academic_year, subject_name, units, grade,
                proof_path, verification_status, officer_comment, created_at
            FROM grades
            WHERE scholar_id = ?
            ORDER BY academic_year DESC, semester ASC, subject_name ASC
        `;
        db.query(sql, [scholarId], (err, data) => {
            if (err) return res.status(500).json({ error: 'Error fetching grades' });

            const semMap = {};
            data.forEach(row => {
                const key = `${row.semester}|${row.academic_year}`;
                if (!semMap[key]) {
                    semMap[key] = {
                        semester: row.semester,
                        academic_year: row.academic_year,
                        subjects: [],
                        total_units: 0,
                        weighted_sum: 0,
                        proof_path: row.proof_path,
                        verification_status: row.verification_status,
                        officer_comment: row.officer_comment,
                        submitted_at: row.created_at,
                    };
                }
                semMap[key].subjects.push({
                    id: row.id,
                    subject_name: row.subject_name,
                    units: row.units,
                    grade: parseFloat(row.grade),
                });
                const units = Number(row.units) || 0;
                const grade = Number(row.grade);
                semMap[key].total_units += units;
                semMap[key].weighted_sum += units * grade;
            });

            const semesters = Object.values(semMap).map(sem => ({
                ...sem,
                gwa: sem.total_units > 0 ? parseFloat((sem.weighted_sum / sem.total_units).toFixed(2)) : null,
                status: sem.total_units > 0
                    ? (sem.weighted_sum / sem.total_units) <= 3.00 ? 'passed' : 'failed'
                    : 'pending',
            }));

            res.json(semesters);
        });
    });
};

// Admin manually adds a single subject grade — auto-verified since admin entered it directly
exports.addScholarGrade = (req, res) => {
    const { semester, academic_year, subject_name, units, grade } = req.body;

    if (!semester || !academic_year || !subject_name || !units || grade === undefined)
        return res.status(400).json({ error: 'Missing required fields' });

    db.query('SELECT scholar_id, year_level FROM users WHERE id = ?', [req.params.id], (lookupErr, lookupData) => {
        if (lookupErr)          return res.status(500).json({ error: 'Error resolving scholar' });
        if (!lookupData.length) return res.status(404).json({ error: 'Scholar not found' });

        const scholarId = lookupData[0].scholar_id;
        const gradeScale = resolveGradeScale(lookupData[0].year_level || '');
        const parsedGrade = parseFloat(grade);
        const validForScale = gradeScale === 'college'
            ? (!isNaN(parsedGrade) && parsedGrade >= 1.00 && parsedGrade <= 5.00)
            : (!isNaN(parsedGrade) && parsedGrade >= 75 && parsedGrade <= 100);

        if (!validForScale) {
            return res.status(400).json({
                error: gradeScale === 'college'
                    ? 'Invalid grade. Must be 1.00-5.00 for college.'
                    : 'Invalid grade. Must be 75-100 for K-12.',
            });
        }

        const sql = `
            INSERT INTO grades (scholar_id, semester, academic_year, subject_name, units, grade, grade_scale, verification_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')
        `;
        db.query(sql, [scholarId, semester, academic_year, subject_name, parseInt(units), parsedGrade, gradeScale], (err, result) => {
            if (err) return res.status(500).json({ error: 'Error saving grade' });

            getComplianceSettings((settingsErr, settings) => {
                if (!settingsErr && settings) {
                    const points = settings.quality_drop_deduction ?? 4;
                    calculateCurrentCompliance(scholarId, (calcErr, currentCompliance) => {
                        if (!calcErr && typeof currentCompliance === 'number' && parsedGrade > (gradeScale === 'college' ? 3.00 : 75)) {
                            logComplianceIncident(
                                scholarId,
                                'failing_grade_submitted',
                                points,
                                currentCompliance,
                                clampCompliance(currentCompliance - points),
                                `Admin-added failing grade recorded for ${semester} ${academic_year}.`
                            );
                        }
                    });
                }
            });

            res.status(201).json({ message: 'Grade added successfully', id: result.insertId });
        });
    });
};

exports.deleteScholarGrade = (req, res) => {
    const { gradeId } = req.params;
    db.query('DELETE FROM grades WHERE id = ?', [gradeId], (err) => {
        if (err) return res.status(500).json({ error: 'Error deleting grade' });
        res.json({ message: 'Grade deleted successfully' });
    });
};

// ─── COMPLIANCE MANAGER SETTINGS ─────────────────────────────────
exports.getComplianceSettings = (req, res) => {
    const sql = `SELECT id, min_compliance, allowed_missed, required_hours,
        missed_submission_deduction, service_hour_shortfall_deduction,
        absent_duty_deduction, late_submission_deduction,
        negative_letter_deduction, quality_drop_deduction,
        extra_service_bonus, good_maintenance_bonus,
        missed_submission_grace_count, late_submission_grace_count,
        recovery_enabled, early_submission_bonus,
        service_hours_completion_bonus, consecutive_early_bonus,
        perfect_attendance_bonus, monthly_recovery_cap,
        updated_by, updated_at
        FROM compliance_settings WHERE id = 1 LIMIT 1`;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching compliance settings:', err);
            return res.status(500).json({ message: 'Failed to fetch compliance settings.' });
        }
        if (!results || !results.length) {
            return res.json({
                min_compliance: '70.00',
                allowed_missed: 2,
                required_hours: 30,
                missed_submission_deduction: 2,
                service_hour_shortfall_deduction: 1,
                absent_duty_deduction: 2,
                late_submission_deduction: 1,
                negative_letter_deduction: 1,
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
            });
        }
        res.json(results[0]);
    });
};

exports.upsertComplianceSettings = (req, res) => {
    const {
        min_compliance,
        allowed_missed,
        required_hours,
        missed_submission_deduction,
        service_hour_shortfall_deduction,
        absent_duty_deduction,
        late_submission_deduction,
        quality_drop_deduction,
        extra_service_bonus,
        good_maintenance_bonus,
        missed_submission_grace_count,
        late_submission_grace_count,
        recovery_enabled,
        early_submission_bonus,
        service_hours_completion_bonus,
        consecutive_early_bonus,
        perfect_attendance_bonus,
        monthly_recovery_cap,
    } = req.body;

    const requiredFields = [
        min_compliance,
        allowed_missed,
        required_hours,
        missed_submission_deduction,
        service_hour_shortfall_deduction,
        absent_duty_deduction,
        late_submission_deduction,
        quality_drop_deduction,
        missed_submission_grace_count,
        late_submission_grace_count,
        recovery_enabled,
        early_submission_bonus,
        service_hours_completion_bonus,
        consecutive_early_bonus,
        perfect_attendance_bonus,
        monthly_recovery_cap,
    ];

    if (requiredFields.some((value) => value === undefined)) {
        return res.status(400).json({
            message: 'min_compliance, allowed_missed, required_hours, and all penalty, grace, and recovery fields are required.',
        });
    }

    const parsedCompliance = parseFloat(min_compliance);
    if (Number.isNaN(parsedCompliance) || parsedCompliance < 0 || parsedCompliance > 100) {
        return res.status(400).json({ message: 'min_compliance must be a number between 0 and 100.' });
    }

    const parsedMissed = parseInt(allowed_missed, 10);
    if (Number.isNaN(parsedMissed) || parsedMissed < 0 || parsedMissed > 100) {
        return res.status(400).json({ message: 'allowed_missed must be an integer between 0 and 100.' });
    }

    const parsedHours = parseInt(required_hours, 10);
    if (Number.isNaN(parsedHours) || parsedHours < 0 || parsedHours > 10000) {
        return res.status(400).json({ message: 'required_hours must be an integer between 0 and 10000.' });
    }

    const parsedPenalties = {
        missed_submission_deduction:      parseInt(missed_submission_deduction ?? 2, 10),
        service_hour_shortfall_deduction:  parseInt(service_hour_shortfall_deduction ?? 1, 10),
        absent_duty_deduction:            parseInt(absent_duty_deduction ?? 2, 10),
        late_submission_deduction:        parseInt(late_submission_deduction ?? 1, 10),
        quality_drop_deduction:           parseFloat(quality_drop_deduction ?? 0.5),
        extra_service_bonus:              parseInt(extra_service_bonus ?? 2, 10),
        good_maintenance_bonus:           parseInt(good_maintenance_bonus ?? 5, 10),
        missed_submission_grace_count:     parseInt(missed_submission_grace_count ?? 2, 10),
        late_submission_grace_count:       parseInt(late_submission_grace_count ?? 2, 10),
    };

    const parsedRecovery = {
        recovery_enabled:                  recovery_enabled === true || recovery_enabled === 1 || recovery_enabled === '1' || recovery_enabled === 'true',
        early_submission_bonus:            parseFloat(early_submission_bonus),
        service_hours_completion_bonus:    parseFloat(service_hours_completion_bonus),
        consecutive_early_bonus:           parseFloat(consecutive_early_bonus),
        perfect_attendance_bonus:          parseFloat(perfect_attendance_bonus),
        monthly_recovery_cap:              parseFloat(monthly_recovery_cap),
    };

    const invalidPenalty = Object.entries(parsedPenalties).find(([, value]) => Number.isNaN(value) || value < 0 || value > 1000);
    if (invalidPenalty) {
        return res.status(400).json({ message: `${invalidPenalty[0]} must be a non-negative integer.` });
    }

    if (parsedPenalties.missed_submission_grace_count > 100 || parsedPenalties.late_submission_grace_count > 100) {
        return res.status(400).json({ message: 'Grace period counts must be between 0 and 100.' });
    }

    const invalidRecovery = Object.entries(parsedRecovery).find(([, value]) => {
        if (typeof value === 'boolean') return false;
        return Number.isNaN(value) || value < 0 || value > 100;
    });
    if (invalidRecovery) {
        return res.status(400).json({ message: `${invalidRecovery[0]} must be a non-negative number.` });
    }

    const sql = `
        INSERT INTO compliance_settings (
            id, min_compliance, allowed_missed, required_hours,
            missed_submission_deduction, service_hour_shortfall_deduction,
            absent_duty_deduction, late_submission_deduction,
            negative_letter_deduction, quality_drop_deduction,
            extra_service_bonus, good_maintenance_bonus,
            missed_submission_grace_count, late_submission_grace_count,
            recovery_enabled, early_submission_bonus,
            service_hours_completion_bonus, consecutive_early_bonus,
            perfect_attendance_bonus, monthly_recovery_cap,
            updated_by
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            min_compliance = VALUES(min_compliance),
            allowed_missed = VALUES(allowed_missed),
            required_hours = VALUES(required_hours),
            missed_submission_deduction = VALUES(missed_submission_deduction),
            service_hour_shortfall_deduction = VALUES(service_hour_shortfall_deduction),
            absent_duty_deduction = VALUES(absent_duty_deduction),
            late_submission_deduction = VALUES(late_submission_deduction),
            negative_letter_deduction = 0,
            quality_drop_deduction = VALUES(quality_drop_deduction),
            extra_service_bonus = VALUES(extra_service_bonus),
            good_maintenance_bonus = VALUES(good_maintenance_bonus),
            missed_submission_grace_count = VALUES(missed_submission_grace_count),
            late_submission_grace_count = VALUES(late_submission_grace_count),
            recovery_enabled = VALUES(recovery_enabled),
            early_submission_bonus = VALUES(early_submission_bonus),
            service_hours_completion_bonus = VALUES(service_hours_completion_bonus),
            consecutive_early_bonus = VALUES(consecutive_early_bonus),
            perfect_attendance_bonus = VALUES(perfect_attendance_bonus),
            monthly_recovery_cap = VALUES(monthly_recovery_cap),
            updated_by = VALUES(updated_by),
            updated_at = NOW()
    `;
    const updatedBy = req.user && Number.isFinite(parseInt(req.user.id, 10)) ? parseInt(req.user.id, 10) : null;
    db.query(sql, [
        String(parsedCompliance.toFixed(2)),
        parsedMissed,
        parsedHours,
        parsedPenalties.missed_submission_deduction,
        parsedPenalties.service_hour_shortfall_deduction,
        parsedPenalties.absent_duty_deduction,
        parsedPenalties.late_submission_deduction,
        0,
        parsedPenalties.quality_drop_deduction,
        parsedPenalties.extra_service_bonus,
        parsedPenalties.good_maintenance_bonus,
        parsedPenalties.missed_submission_grace_count,
        parsedPenalties.late_submission_grace_count,
        parsedRecovery.recovery_enabled ? 1 : 0,
        parsedRecovery.early_submission_bonus,
        parsedRecovery.service_hours_completion_bonus,
        parsedRecovery.consecutive_early_bonus,
        parsedRecovery.perfect_attendance_bonus,
        parsedRecovery.monthly_recovery_cap,
        updatedBy,
    ], (err) => {
        if (err) {
            console.error('Error saving compliance settings:', err);
            return res.status(500).json({ message: 'Failed to save compliance settings.' });
        }
        res.json({ message: 'Compliance settings saved.' });
    });
};

// ─── COMPLIANCE SUMMARY (aggregated stats for one scholar profile) ─────────
exports.getScholarComplianceSummary = (req, res) => {
    db.query('SELECT scholar_id FROM users WHERE id = ?', [req.params.id], (lookupErr, lookupData) => {
        if (lookupErr)          return res.status(500).json({ error: 'Error resolving scholar' });
        if (!lookupData.length) return res.status(404).json({ error: 'Scholar not found' });

        const scholarId = lookupData[0].scholar_id;
        if (!scholarId) return res.json(null);

        // Report submissions
        db.query(
            'SELECT id, status, submitted_at FROM submissions WHERE scholar_id = ? ORDER BY submitted_at DESC',
            [scholarId],
            (subErr, subData) => {
                if (subErr) return res.status(500).json({ error: 'Error fetching submissions' });

                const approvedSubs = subData.filter(s => ['approved', 'archived'].includes(s.status)).length;
                const pendingSubs  = subData.filter(s => s.status === 'pending').length;
                const rejectedSubs = subData.filter(s => s.status === 'rejected').length;

                // Community service (from submissions with service_activity)
                db.query(
                    `SELECT service_activity as name, service_hours as hours
                     FROM submissions
                     WHERE scholar_id = ? AND service_activity IS NOT NULL AND service_activity != ''`,
                    [scholarId],
                    (svcErr, svcData) => {
                        if (svcErr) return res.status(500).json({ error: 'Error fetching service data' });

                        const totalHours   = svcData.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
                        const requiredHours = 32;
                        const svcProgress  = Math.min(100, Math.round((totalHours / requiredHours) * 100));

                        // Attendance
                        db.query(
                            'SELECT status FROM duty_attendance WHERE scholar_id = ?',
                            [scholarId],
                            (attErr, attData) => {
                                if (attErr) return res.status(500).json({ error: 'Error fetching attendance' });

                                const present = attData.filter(a => a.status === 'present').length;
                                const absent  = attData.filter(a => a.status === 'absent').length;
                                const excused = attData.filter(a => a.status === 'excused').length;
                                const total   = attData.length;
                                const attRate = total > 0 ? Math.round((present / total) * 100) : 0;

                                // Academic (grades)
                                db.query(
                                    'SELECT semester, academic_year, units, grade FROM grades WHERE scholar_id = ?',
                                    [scholarId],
                                    (gErr, gData) => {
                                        if (gErr) return res.status(500).json({ error: 'Error fetching grades' });

                                        const semMap = {};
                                        gData.forEach(row => {
                                            const key = `${row.semester}|${row.academic_year}`;
                                            if (!semMap[key]) semMap[key] = { totalUnits: 0, weightedSum: 0 };
                                            semMap[key].totalUnits  += row.units;
                                            semMap[key].weightedSum += row.units * parseFloat(row.grade);
                                        });
                                        const semStats = Object.values(semMap).map(s => s.weightedSum / s.totalUnits);
                                        const passedSems = semStats.filter(g => g <= 3.00).length;
                                        const totalSems  = semStats.length;

                                        res.json({
                                            report_submissions: {
                                                approved: approvedSubs, pending: pendingSubs, rejected: rejectedSubs,
                                                total: subData.length, items: subData,
                                            },
                                            community_service: {
                                                total_hours: totalHours, required_hours: requiredHours,
                                                progress: svcProgress, items: svcData,
                                            },
                                            attendance: { present, absent, excused, total, rate: attRate },
                                            academic: { passed_sems: passedSems, total_sems: totalSems },
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    });
};

// ─── ANNOUNCEMENTS ────────────────────────────────────────────
exports.getAnnouncements = (req, res) => {
    const sql = `
        SELECT a.*, u.full_name AS created_by_name
        FROM announcements a
        LEFT JOIN users u ON u.id = a.created_by
        ORDER BY a.created_at DESC
    `;

    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching announcements' });
        const parsed = data.map(row => ({
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
    const { title, content, target_roles, target_levels, priority, created_by } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

    const roles = Array.isArray(target_roles) && target_roles.length
        ? target_roles.filter(r => ['scholar', 'staff', 'officer'].includes(r))
        : ['scholar', 'staff', 'officer'];

    const levels = Array.isArray(target_levels) ? target_levels : [];
    const creatorId = created_by === undefined || created_by === null || created_by === '' ? null : Number(created_by);

    db.query(
        `INSERT INTO announcements (title, content, target_roles, target_levels, priority, created_by, created_by_role, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 'admin', 1)`,
        [title, content, JSON.stringify(roles), JSON.stringify(levels), priority || 'info', creatorId],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Error creating announcement' });
            res.status(201).json({ message: 'Announcement created', id: result.insertId });
        }
    );
};

exports.notifyAnnouncement = (req, res) => {
    const { id } = req.params;
    sendAnnouncementNotifyEmails(id, (err, result) => {
        if (err) return res.status(400).json({ error: 'Failed to send announcement notifications', detail: String(err) });
        if (result && result.error) return res.status(400).json(result);
        res.json(result);
    });
};

exports.deleteAnnouncement = (req, res) => {
    db.query('DELETE FROM announcements WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Error deleting announcement' });
        res.json({ message: 'Announcement deleted' });
    });
};

exports.toggleAnnouncement = (req, res) => {
    db.query('UPDATE announcements SET is_active = !is_active WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Error toggling announcement' });
        res.json({ message: 'Announcement status updated' });
    });
};

// ─── COMPLIANCE (org-wide, admin compliance manager) ──────────
exports.getCompliance = (req, res) => {
    const sql = `
        SELECT s.*, u.full_name, u.scholar_id as sid, u.year_level,
            GROUP_CONCAT(sm.file_path) as media_paths
        FROM submissions s
        LEFT JOIN users u ON s.scholar_id = u.scholar_id
        LEFT JOIN submission_media sm ON s.id = sm.submission_id
        GROUP BY s.id ORDER BY s.submitted_at DESC
    `;
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching compliance data' });
        res.json(data);
    });
};

exports.getComplianceById = (req, res) => {
    const sql = `
        SELECT s.*, u.full_name, u.scholar_id as sid, u.year_level,
            GROUP_CONCAT(sm.file_path)   as media_paths,
            GROUP_CONCAT(sm.description) as media_descriptions
        FROM submissions s
        LEFT JOIN users u ON s.scholar_id = u.scholar_id
        LEFT JOIN submission_media sm ON s.id = sm.submission_id
        WHERE s.id = ? GROUP BY s.id
    `;
    db.query(sql, [req.params.id], (err, data) => {
        if (err)        return res.status(500).json({ error: 'Error fetching submission' });
        if (!data.length) return res.status(404).json({ error: 'Submission not found' });
        res.json(data[0]);
    });
};

exports.reviewCompliance = (req, res) => {
    const { status, staff_comment } = req.body;
    const allowedStatuses = ['pending', 'approved', 'rejected'];
    if (!allowedStatuses.includes(status))
        return res.status(400).json({ error: 'Invalid status value' });
    db.query(
        'UPDATE submissions SET status = ?, staff_comment = ? WHERE id = ?',
        [status, staff_comment, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'Error updating submission' });
            res.json({ message: 'Submission reviewed successfully' });
        }
    );
};

// ─── ADMIN REPORTS: COMPLIANCE SUMMARY ─────────────────────
// Uses the same compliance-credit formula as the flagged scholar and scholar profile views.
exports.getComplianceSummary = (req, res) => {
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

        const submissionSql = `
            SELECT
                scholar_id,
                COUNT(*) AS total_submissions,
                SUM(CASE WHEN status IN ('approved', 'archived') THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                AVG(quality_score) AS avg_quality,
                MAX(submitted_at) AS last_submission,
                SUM(CASE WHEN service_hours IS NOT NULL THEN service_hours ELSE 0 END) AS total_service_hours,
                SUM(CASE WHEN sentiment_label LIKE '%Negative%' THEN 1 ELSE 0 END) AS negative_letters,
                SUM(CASE WHEN submission_type = 'letter' AND submitted_at <= DATE_SUB(LAST_DAY(submitted_at), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS early_submissions,
                GROUP_CONCAT(DISTINCT DATE_FORMAT(submitted_at, '%Y-%m') ORDER BY DATE_FORMAT(submitted_at, '%Y-%m') SEPARATOR ',') AS early_submission_months
            FROM submissions
            WHERE scholar_id IN (${placeholders})
            GROUP BY scholar_id
        `;

        const attendanceSql = `
            SELECT
                scholar_id,
                COUNT(*) AS total_duties,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent
            FROM duty_attendance
            WHERE scholar_id IN (${placeholders})
            GROUP BY scholar_id
        `;

        getComplianceSettings((settingsErr, settings) => {
            if (settingsErr) return res.status(500).json({ error: 'Failed to load compliance settings.' });

            db.query(submissionSql, scholarIds, (err, subStats) => {
                if (err) return res.status(500).json({ error: 'Failed to fetch submission stats.' });

                db.query(attendanceSql, scholarIds, (err, attStats) => {
                    if (err) return res.status(500).json({ error: 'Failed to fetch attendance stats.' });

                    const subMap = {};
                    subStats.forEach(s => { subMap[s.scholar_id] = s; });
                    const attMap = {};
                    attStats.forEach(a => { attMap[a.scholar_id] = a; });

                    const results = scholars.map(scholar => {
                        const sub = subMap[scholar.scholar_id] || {};
                        const att = attMap[scholar.scholar_id] || {};
                        const score = calculateComplianceScore({ sub, att, settings, today: new Date() });
                        const overallCompliance = Number(score?.overallCompliance ?? 0);
                        const riskStatus = overallCompliance >= 70 ? 'low' : overallCompliance >= 50 ? 'medium' : 'high';

                        return {
                            id: scholar.id,
                            name: scholar.full_name,
                            studentId: scholar.scholar_id,
                            completionRate: overallCompliance,
                            credits: overallCompliance,
                            riskStatus,
                            year_level: scholar.year_level || 'N/A',
                        };
                    });

                    results.sort((a, b) => b.completionRate - a.completionRate);
                    res.json(results);
                });
            });
        });
    });
};

// ─── ADMIN REPORTS: MONTHLY SUBMISSIONS ────────────────────
// Returns monthly scholar submissions for review
exports.getMonthlySubmissions = (req, res) => {
    const { year_level, month } = req.query;

    const normalizeYearLevel = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ');

    const yearLevelAliases = new Set();
    if (year_level) {
        const raw = String(year_level).trim();
        const aliases = [
            raw,
            raw.replace(/\s*college\s*$/i, ''),
            raw.replace(/\s*year\s*$/i, ''),
            raw.replace(/\s*college\s*$/i, ' College'),
            raw.replace(/\s*college\s*$/i, ''),
        ];
        aliases.forEach(value => {
            const normalized = normalizeYearLevel(value);
            if (normalized) yearLevelAliases.add(normalized);
        });
    }

    let sql = `
        SELECT
            s.id,
            s.submission_type AS submissionType,
            s.scholar_id,
            u.id AS userId,
            u.full_name AS scholarName,
            u.year_level,
            COALESCE(
                GROUP_CONCAT(DISTINCT ou.full_name ORDER BY ou.full_name SEPARATOR ', '),
                'Unassigned'
            ) AS assigned_officers,
            s.submitted_at AS submittedAt,
            s.status,
            s.quality_score AS qualityScore,
            s.generated_pdf_path AS generatedPdfPath,
            u.email,
            s.letter_content AS body,
            s.service_activity,
            s.service_hours,
            s.sentiment_label
        FROM submissions s
        INNER JOIN users u ON u.scholar_id = s.scholar_id
        LEFT JOIN officer_year_level_assignments oya
            ON LOWER(REPLACE(REPLACE(TRIM(oya.year_level), '_', ' '), '-', ' '))
               = LOWER(REPLACE(REPLACE(TRIM(u.year_level), '_', ' '), '-', ' '))
        LEFT JOIN users ou ON ou.id = oya.officer_id
        WHERE s.status = 'approved'
          AND COALESCE(s.archived_at, s.archive_at) IS NULL
    `;
    const values = [];

    if (month) {
        const [year, monthStr] = month.split('-');
        sql += ` AND YEAR(s.submitted_at) = ? AND MONTH(s.submitted_at) = ?`;
        values.push(parseInt(year), parseInt(monthStr));
    }

    if (yearLevelAliases.size) {
        const normalizedList = [...yearLevelAliases];
        sql += ` AND LOWER(REPLACE(REPLACE(TRIM(u.year_level), '_', ' '), '-', ' ')) IN (${normalizedList.map(() => '?').join(', ')})`;
        values.push(...normalizedList);
    }

    sql += ` GROUP BY s.id, s.submission_type, s.scholar_id, u.full_name, u.year_level, s.submitted_at, s.status, s.quality_score, s.generated_pdf_path, u.email, s.letter_content, s.service_activity, s.service_hours, s.sentiment_label ORDER BY s.submitted_at DESC LIMIT 500`;

    db.query(sql, values, (err, submissions) => {
        if (err) {
            console.error('Error fetching monthly submissions:', err);
            return res.status(500).json({ error: 'Failed to fetch monthly submissions.' });
        }

        if (!submissions || submissions.length === 0) {
            return res.json([]);
        }

        const submissionIds = submissions.map(s => s.id);
        const photoPlaceholders = submissionIds.map(() => '?').join(', ');

        const photoSql = `
            SELECT submission_id, file_path AS url, description
            FROM submission_media
            WHERE submission_id IN (${photoPlaceholders})
        `;

        db.query(photoSql, submissionIds, (err, photos) => {
            const photoMap = {};
            if (!err && photos) {
                photos.forEach(p => {
                    if (!photoMap[p.submission_id]) photoMap[p.submission_id] = [];
                    photoMap[p.submission_id].push({ url: p.url, description: p.description });
                });
            }

            const enrichedSubmissions = submissions.map(s => ({
                ...s,
                userId: s.userId || s.user_id || null,
                year: s.year_level || '—',
                assignedOfficer: s.assigned_officers === 'Unassigned' ? 'Unassigned' : s.assigned_officers,
                assignedOfficerNames: s.assigned_officers && s.assigned_officers !== 'Unassigned'
                    ? s.assigned_officers.split(', ').filter(Boolean)
                    : [],
                photos: photoMap[s.id] || [],
                staffAction: null,
                staffFeedback: '',
                reportScore: Math.round(s.qualityScore * 0.6) || 0,
                mediaScore: (photoMap[s.id]?.length || 0) > 0 ? 85 : 60,
                checklistResults: [
                    { label: 'Contains narrative', passed: !!s.body },
                    { label: 'Has documentation photos', passed: (photoMap[s.id]?.length || 0) > 0 },
                    { label: 'Quality score ≥ 60', passed: s.qualityScore >= 60 },
                ],
            }));

            res.json(enrichedSubmissions);
        });
    });
};

exports.getOfficerAssignments = async (req, res) => {
    try {
        const [officers, assignments] = await Promise.all([
            new Promise((resolve, reject) => db.query("SELECT id, scholar_id, full_name, email, year_level, status FROM users WHERE role = 'officer' ORDER BY full_name", (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.query('SELECT officer_id, year_level FROM officer_year_level_assignments ORDER BY year_level', (err, rows) => err ? reject(err) : resolve(rows))),
        ]);
        const byOfficer = assignments.reduce((map, row) => {
            if (!map[row.officer_id]) map[row.officer_id] = [];
            map[row.officer_id].push(row.year_level);
            return map;
        }, {});
        res.json(officers.map(officer => ({ ...officer, assigned_year_levels: byOfficer[officer.id] || [] })));
    } catch (err) {
        res.status(500).json({ error: 'Failed to load officer assignments' });
    }
};

exports.updateOfficerAssignments = async (req, res) => {
    const officerId = Number(req.params.id);
    const levels = Array.isArray(req.body?.year_levels) ? [...new Set(req.body.year_levels.map(String).map(v => v.trim()).filter(Boolean))] : [];
    if (!officerId) return res.status(400).json({ error: 'Invalid officer id' });
    try {
        await new Promise((resolve, reject) => db.query("SELECT id FROM users WHERE id = ? AND role = 'officer'", [officerId], (err, rows) => err ? reject(err) : rows.length ? resolve() : reject(Object.assign(new Error('Officer not found'), { statusCode: 404 }))));
        await new Promise((resolve, reject) => db.query('DELETE FROM officer_year_level_assignments WHERE officer_id = ?', [officerId], err => err ? reject(err) : resolve()));
        if (levels.length) {
            await new Promise((resolve, reject) => db.query('INSERT INTO officer_year_level_assignments (officer_id, year_level, assigned_by) VALUES ?', [levels.map(level => [officerId, level, req.user.id])], err => err ? reject(err) : resolve()));
        }
        await logAuditEvent({ req, action: 'edit', module: 'Officer Assignments', details: `Assigned year levels to officer ${officerId}: ${levels.join(', ') || 'none'}`, result: 'success' });
        res.json({ message: 'Officer assignments updated', year_levels: levels });
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.statusCode === 404 ? 'Officer not found' : 'Failed to update officer assignments' });
    }
};

exports.getStaffAssignments = (req, res) => {
    const staffSql = `
        SELECT
            u.id,
            u.full_name,
            u.email,
            g.id AS group_id,
            g.group_name,
            g.description,
            (SELECT COUNT(*) FROM scholar_group_members m WHERE m.group_id = g.id) AS member_count
        FROM users u
        LEFT JOIN scholar_groups g ON g.assigned_staff_id = u.id
        WHERE u.role = 'staff'
        ORDER BY u.full_name, g.group_name
    `;

    db.query(staffSql, (err, rows) => {
        if (err) {
            console.error('getStaffAssignments failed:', err);
            return res.status(500).json({ error: 'Failed to load staff assignments' });
        }

        const staffMap = new Map();
        rows.forEach((row) => {
            if (!staffMap.has(row.id)) {
                staffMap.set(row.id, {
                    id: row.id,
                    full_name: row.full_name,
                    email: row.email,
                    assigned_groups: [],
                });
            }

            if (row.group_id) {
                staffMap.get(row.id).assigned_groups.push({
                    id: row.group_id,
                    group_name: row.group_name,
                    description: row.description,
                    member_count: Number(row.member_count || 0),
                });
            }
        });

        db.query(`
            SELECT
                id,
                group_name,
                description,
                assigned_staff_id,
                (SELECT COUNT(*) FROM scholar_group_members m WHERE m.group_id = scholar_groups.id) AS member_count
            FROM scholar_groups
            ORDER BY group_name
        `, (groupErr, groups) => {
            if (groupErr) {
                console.error('getStaffAssignments groups failed:', groupErr);
                return res.status(500).json({ error: 'Failed to load scholar groups' });
            }

            res.json({
                staff: Array.from(staffMap.values()),
                groups: groups.map((group) => ({
                    ...group,
                    member_count: Number(group.member_count || 0),
                })),
            });
        });
    });
};

exports.updateStaffAssignments = (req, res) => {
    const staffId = Number(req.params.id);
    const groupIds = Array.isArray(req.body?.group_ids) ? [...new Set(req.body.group_ids.map(Number).filter(Boolean))] : [];
    if (!staffId) return res.status(400).json({ error: 'Invalid staff id' });
    db.query("SELECT id FROM users WHERE id = ? AND role = 'staff'", [staffId], (staffErr, staffRows) => {
        if (staffErr) return res.status(500).json({ error: 'Failed to resolve staff account' });
        if (!staffRows.length) return res.status(404).json({ error: 'Staff account not found' });
        db.query('UPDATE scholar_groups SET assigned_staff_id = NULL WHERE assigned_staff_id = ?', [staffId], (clearErr) => {
            if (clearErr) return res.status(500).json({ error: 'Failed to clear staff assignments' });
            if (!groupIds.length) return res.json({ message: 'Staff assignments updated', group_ids: [] });
            db.query('UPDATE scholar_groups SET assigned_staff_id = ? WHERE id IN (?)', [staffId, groupIds], async (assignErr) => {
                if (assignErr) return res.status(500).json({ error: 'Failed to assign staff groups' });
                await logAuditEvent({ req, action: 'edit', module: 'Staff Assignments', details: `Assigned groups to staff ${staffId}: ${groupIds.join(', ')}`, result: 'success' });
                res.json({ message: 'Staff assignments updated', group_ids: groupIds });
            });
        });
    });
};

exports.deleteStaffAssignments = (req, res) => {
    const staffId = Number(req.params.id);
    if (!staffId) return res.status(400).json({ error: 'Invalid staff id' });
    db.query("SELECT id FROM users WHERE id = ? AND role = 'staff'", [staffId], (staffErr, staffRows) => {
        if (staffErr) return res.status(500).json({ error: 'Failed to resolve staff account' });
        if (!staffRows.length) return res.status(404).json({ error: 'Staff account not found' });
        db.query('UPDATE scholar_groups SET assigned_staff_id = NULL WHERE assigned_staff_id = ?', [staffId], async (clearErr) => {
            if (clearErr) return res.status(500).json({ error: 'Failed to delete staff assignments' });
            await logAuditEvent({ req, action: 'delete', module: 'Staff Assignments', details: `Deleted group assignments for staff ${staffId}`, result: 'success' });
            res.json({ message: 'Staff assignments deleted', group_ids: [] });
        });
    });
};