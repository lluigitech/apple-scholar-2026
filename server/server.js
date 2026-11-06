const express = require('express');
const cors    = require('cors');
const path = require('path');
const net = require('node:net');
const dns = require('node:dns').promises;
require('dotenv').config({ path: path.resolve(__dirname, 'utils', '.env') });
const db = require('./config/db');
const { ensureColumns, ensureIndexes, runQuery } = require('./utils/mysqlSchemaMigrations');

// ─── Import Routes ────────────────────────────────────────────
const authRoutes       = require('./routes/authRoutes');
const adminRoutes      = require('./routes/admin/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const backupRecoveryRoutes = require('./routes/backupRecoveryRoutes');
const scholarRoutes    = require('./routes/scholar/scholarRoutes');
const staffRoutes      = require('./routes/staff/staffRoutes');
const officerRoutes    = require('./routes/officer/officerRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const dutyRoutes       = require('./routes/dutyRoutes');
const exportRoutes     = require('./routes/exportroutes'); // ← consistent casing
const flaggedRoutes    = require('./routes/flaggedRoutes');
const tasksRoutes      = require('./routes/tasksRoutes');
const reportSummaryRoutes = require('./routes/reportSummaryRoutes');
const archiveRoutes    = require('./routes/archiveRoutes');
const retentionRoutes  = require('./routes/retentionRoutes');
const { sendTaskDeadlineReminders, sendComplianceAlerts } = require('./utils/notifyHelpers');
const { rateLimit } = require('./middleware/rateLimit');
const { cleanupExpired } = require('./services/resumableUploadService');
const { loadModelAtStartup } = require('./services/letterScoreService');
const { runScheduledBackups } = require('./services/backupRecoveryService');
const { markEndedDutyAbsences } = require('./services/dutyAbsenceService');
const { autoCheckOutDutyAttendances } = require('./services/dutyAttendanceService');
const { sendComplianceThresholdNotifications } = require('./services/complianceThresholdNotificationService');
const { finalizeApprovedSubmissions } = require('./services/approvedSubmissionFinalizationService');

const app = express();

// ─── Middleware ───────────────────────────────────────────────
// CORS at JSON — dapat UNA bago lahat ng routes

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://applescholar.org',
    'https://www.applescholar.org',
    ...(process.env.FRONTEND_URLS || '')
        .split(',')
        .map(url => url.trim())
        .filter(Boolean),
];

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);

        if (allowedOrigins.includes(origin)) {
            return cb(null, true);
        }

        return cb(new Error('CORS not allowed'));
    },
    credentials: true,
}));

app.use(express.json());
app.use(rateLimit({ max: 120, skipPaths: ['/api/submission/score'] }));
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.status(426).json({ error: 'HTTPS is required.' });
    }
    next();
});

// Uploaded and generated files are served through authenticated proxy routes.
// Do not expose the uploads directory as a public static tree.

// --- Debug: log incoming requests (temporary) -----------------------------
app.use((req, res, next) => {
    console.log('[REQ]', req.method, req.originalUrl);
    next();
});

// ─── Routes ───────────────────────────────────────────────────
app.use('/api',            authRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/admin/notifications', notificationRoutes);
app.use('/api/admin/backups', backupRecoveryRoutes);
app.use('/api/scholar',    scholarRoutes);
app.use('/api/staff',      staffRoutes);
app.use('/api/officer',    officerRoutes);
app.use('/api/submission', submissionRoutes);
app.use('/api/duties',     dutyRoutes);
app.use('/api/export',     exportRoutes);
app.use('/api/flagged',    flaggedRoutes);
app.use('/api/tasks',      tasksRoutes);
app.use('/api/reports',    reportSummaryRoutes);
app.use('/api/archive',    archiveRoutes);
app.use('/api',            retentionRoutes);

// ─── Test Route ───────────────────────────────────────────────
app.get('/', (req, res) => {
    res.send('Kalinga Scholar System Backend is Running! 🚀');
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong on the server!' });
});

loadModelAtStartup();

let databaseReady = false;

const runDutyAbsenceSweep = async () => {
    if (!databaseReady) return;
    try {
        const result = await markEndedDutyAbsences();
        if (!result.skipped && result.markedCount > 0) {
            console.log(`[duty-absence] marked ${result.markedCount} scholars absent after the check-in window closed.`);
        }
        const checkoutResult = await autoCheckOutDutyAttendances();
        if (checkoutResult.checkedOutCount > 0) {
            console.log(`[duty-checkout] automatically checked out ${checkoutResult.checkedOutCount} scholars.`);
        }
    } catch (error) {
        console.error('[duty-attendance] scheduled attendance sweep failed:', error.message || error);
    }
};

setTimeout(runDutyAbsenceSweep, 15 * 1000);
setInterval(runDutyAbsenceSweep, 60 * 1000);

const complianceThresholdIntervalMs = 24 * 60 * 60 * 1000;
let complianceThresholdRunInProgress = false;
const runComplianceThresholdNotifications = async () => {
    if (!databaseReady || complianceThresholdRunInProgress) return;
    complianceThresholdRunInProgress = true;
    try {
        const result = await sendComplianceThresholdNotifications();
        if (!result.skipped) console.log('[compliance-threshold] run complete:', result);
    } catch (error) {
        console.error('[compliance-threshold] run failed:', error.message || error);
    } finally {
        complianceThresholdRunInProgress = false;
    }
};

setTimeout(runComplianceThresholdNotifications, 30 * 1000);
setInterval(runComplianceThresholdNotifications, complianceThresholdIntervalMs);

let approvedSubmissionFinalizationInProgress = false;
const runApprovedSubmissionFinalization = async () => {
    if (!databaseReady || approvedSubmissionFinalizationInProgress) return;
    approvedSubmissionFinalizationInProgress = true;
    try {
        const result = await finalizeApprovedSubmissions();
        if (result.submissions_finalized || result.grades_finalized) {
            console.log('[approved-submissions] moved to Reports:', result);
        }
    } catch (error) {
        console.error('[approved-submissions] finalization failed:', error.message || error);
    } finally {
        approvedSubmissionFinalizationInProgress = false;
    }
};

setTimeout(runApprovedSubmissionFinalization, 30 * 1000);
setInterval(runApprovedSubmissionFinalization, 60 * 60 * 1000);

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

const reminderIntervalMs = 24 * 60 * 60 * 1000;
let reminderRunInProgress = false;

const runTaskDeadlineReminders = async () => {
    if (!databaseReady || process.env.ENABLE_DEADLINE_REMINDERS === 'false' || reminderRunInProgress) return;
    reminderRunInProgress = true;
    try {
        const result = await sendTaskDeadlineReminders();
        if (!result.skipped) console.log('[deadline-reminder] run complete:', result);
        const alerts = await sendComplianceAlerts();
        if (!alerts.skipped) console.log('[compliance-alert] run complete:', alerts);
    } catch (err) {
        console.error('[deadline-reminder] run failed:', err.message || err);
    } finally {
        reminderRunInProgress = false;
    }
};

if (process.env.ENABLE_DEADLINE_REMINDERS !== 'false') {
    setTimeout(runTaskDeadlineReminders, 15 * 1000);
    setInterval(runTaskDeadlineReminders, reminderIntervalMs);
}

const runResumableUploadCleanup = () => {
    if (!databaseReady) return;
    cleanupExpired().catch((error) => console.error('[resumable-upload] cleanup failed:', error.message));
};

runResumableUploadCleanup();
setInterval(runResumableUploadCleanup, 60 * 60 * 1000);

let backupScheduleTimer = null;
let backupSchedule = {
    enabled: process.env.ENABLE_SCHEDULED_BACKUPS !== 'false',
    retentionCount: Math.max(1, Number.parseInt(process.env.BACKUP_DAILY_RETENTION || '14', 10)),
};
let backupScheduleLoaded = false;
const runScheduledBackupIfEnabled = async () => {
    if (!databaseReady || !backupSchedule.enabled) return;
    try {
        const result = await runScheduledBackups({
            enabled: backupSchedule.enabled,
            dailyRetentionCount: backupSchedule.retentionCount,
        });
        if (!result.skipped) console.log('[scheduled-backup] completed:', result.backups.map((backup) => backup.id));
    } catch (error) {
        console.error('[scheduled-backup] failed:', error.message || error);
    }
};

const configureBackupSchedule = ({ enabled, retentionCount }) => {
    if (backupScheduleTimer) clearInterval(backupScheduleTimer);
    backupSchedule = {
        enabled: Boolean(enabled),
        retentionCount: Math.max(1, Number.parseInt(retentionCount, 10) || 14),
    };
    backupScheduleTimer = setInterval(runScheduledBackupIfEnabled, 30 * 1000);
};

configureBackupSchedule(backupSchedule);
process.on('admin-backup-settings-updated', (settings) => {
    backupScheduleLoaded = true;
    configureBackupSchedule(settings);
});
setInterval(() => {
    if (!databaseReady) return;
    db.query(
        'SELECT scheduled_backups, backup_retention_count FROM admin_system_settings WHERE id = 1',
        (error, rows) => {
            if (error) {
                console.error('Failed to refresh scheduled backup settings:', error.message);
                return;
            }
            if (!rows.length) return;
            const next = {
                enabled: Boolean(rows[0].scheduled_backups),
                retentionCount: rows[0].backup_retention_count,
            };
            if (!backupScheduleLoaded) {
                backupScheduleLoaded = true;
                configureBackupSchedule(next);
                return;
            }
            if (next.enabled !== backupSchedule.enabled ||
                Number(next.retentionCount) !== backupSchedule.retentionCount) {
                configureBackupSchedule(next);
            }
        }
    );
}, 60 * 1000);

const initializeDatabase = () => {
    if (!process.env.DB_NAME) {
        return;
    }

    let submissionsSchemaReady = Promise.resolve();
    let officerAssignmentsReady = Promise.resolve(false);

    db.query('SELECT 1', (err) => {
        if (err) console.error('❌ MySQL connection failed:', err.message);
        else console.log('✅ Connected to MySQL Database!');
    });

    db.query(`
        CREATE TABLE IF NOT EXISTS admin_preferences (
            user_id INT PRIMARY KEY,
            settings_json LONGTEXT NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (preferencesError) => {
        if (preferencesError) console.error('Failed to ensure admin preferences table:', preferencesError.message);
    });
    db.query(`
        CREATE TABLE IF NOT EXISTS officer_notification_preferences (
            officer_id INT PRIMARY KEY,
            new_submissions BOOLEAN NOT NULL DEFAULT TRUE,
            pending_reviews BOOLEAN NOT NULL DEFAULT TRUE,
            deadlines BOOLEAN NOT NULL DEFAULT TRUE,
            returned_submissions BOOLEAN NOT NULL DEFAULT TRUE,
            announcements BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (notificationPreferencesError) => {
        if (notificationPreferencesError) {
            console.error('Failed to ensure officer notification preferences table:', notificationPreferencesError.message);
        }
    });
    db.query(`
        CREATE TABLE IF NOT EXISTS staff_notification_preferences_v2 (
            staff_id INT PRIMARY KEY,
            announcements BOOLEAN NOT NULL DEFAULT TRUE,
            task_assignments BOOLEAN NOT NULL DEFAULT TRUE,
            duty_attendance BOOLEAN NOT NULL DEFAULT TRUE,
            submission_updates BOOLEAN NOT NULL DEFAULT TRUE,
            makeup_requests BOOLEAN NOT NULL DEFAULT TRUE,
            system_updates BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (staffPreferencesError) => {
        if (staffPreferencesError) {
            console.error('Failed to ensure staff notification preferences table:', staffPreferencesError.message);
        }
    });
    db.query(`
        CREATE TABLE IF NOT EXISTS admin_system_settings (
            id TINYINT PRIMARY KEY,
            scheduled_backups BOOLEAN NOT NULL DEFAULT TRUE,
            backup_interval_hours INT NOT NULL DEFAULT 24,
            backup_retention_count INT NOT NULL DEFAULT 14,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (systemSettingsError) => {
        if (systemSettingsError) {
            console.error('Failed to ensure admin system settings table:', systemSettingsError.message);
            return;
        }
        db.query(
            `INSERT IGNORE INTO admin_system_settings (id, scheduled_backups, backup_interval_hours, backup_retention_count)
             VALUES (1, ?, ?, ?)`,
            [
                process.env.ENABLE_SCHEDULED_BACKUPS !== 'false',
                Math.max(1, Number.parseInt(process.env.BACKUP_INTERVAL_HOURS || '24', 10)),
                Math.max(1, Number.parseInt(process.env.BACKUP_DAILY_RETENTION || '14', 10)),
            ],
            (seedError) => {
                if (seedError) console.error('Failed to initialize admin system settings:', seedError.message);
            }
        );
    });

    // Create core tables and seed an admin account if the database is empty.
    db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            scholar_id VARCHAR(64) UNIQUE,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role ENUM('admin','scholar','staff','officer') NOT NULL DEFAULT 'scholar',
            year_level VARCHAR(64) DEFAULT NULL,
            birth_date DATE DEFAULT NULL,
            age INT DEFAULT NULL,
            phone VARCHAR(64) DEFAULT NULL,
            address VARCHAR(255) DEFAULT NULL,
            course VARCHAR(255) DEFAULT NULL,
            school VARCHAR(255) DEFAULT NULL,
            qr_code VARCHAR(255) DEFAULT NULL,
            status VARCHAR(32) DEFAULT 'active',
            must_change_password TINYINT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (userErr) => {
        if (userErr) {
            console.error('Failed to ensure users table:', userErr.message);
            return;
        }

        const allowUserProfileColumnMigration =
            process.env.ALLOW_AUTO_USER_PROFILE_MIGRATION === 'true' ||
            process.env.NODE_ENV !== 'production';

        runQuery(
            db,
            "ALTER TABLE users MODIFY COLUMN role ENUM('admin','scholar','staff','officer') NOT NULL DEFAULT 'scholar'"
        ).catch((roleError) => {
            console.error('Failed to update user role enum:', roleError.message);
        }).then(async () => {
            if (!allowUserProfileColumnMigration) {
                console.log('Skipping users profile column auto-migration in production.');
                return;
            }

            try {
                await ensureColumns(db, 'users', {
                    age: 'INT DEFAULT NULL',
                    birth_date: 'DATE DEFAULT NULL',
                    phone: 'VARCHAR(64) DEFAULT NULL',
                    address: 'VARCHAR(255) DEFAULT NULL',
                    course: 'VARCHAR(255) DEFAULT NULL',
                    school: 'VARCHAR(255) DEFAULT NULL',
                });
                console.log('✅ Users profile columns ensured.');
            } catch (migrationError) {
                console.error('Failed to ensure users profile columns:', migrationError.message);
            }
        });

        db.query(`
            INSERT INTO users (scholar_id, full_name, email, password, role, year_level, qr_code, status, must_change_password)
            VALUES (?, ?, ?, ?, 'admin', 'N/A', ?, 'active', 1)
            ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role);
        `, [
            'ADMIN-001',
            process.env.DEFAULT_ADMIN_NAME || 'System Administrator',
            process.env.DEFAULT_ADMIN_EMAIL || 'admin@kalinga.local',
            require('bcryptjs').hashSync(process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!', 10),
            `ADMIN-${Date.now()}`
        ], (seedErr) => {
            if (seedErr) {
                console.error('Failed to seed admin user:', seedErr.message);
                return;
            }
            console.log('✅ Admin bootstrap ensured');
        });
    });

    // Ensure notifications table exists for logging delivery attempts
    db.query(`
        CREATE TABLE IF NOT EXISTS notification_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            scholar_id VARCHAR(64) NULL,
            recipient VARCHAR(255) NOT NULL,
            channel VARCHAR(32) NOT NULL,
            type VARCHAR(64) DEFAULT NULL,
            status VARCHAR(32) DEFAULT NULL,
            detail TEXT,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            read_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (nErr) => {
        if (nErr) console.error('Failed to create notification_logs table:', nErr);
        else {
            ensureColumns(db, 'notification_logs', {
                is_read: 'TINYINT(1) NOT NULL DEFAULT 0',
                read_at: 'TIMESTAMP NULL DEFAULT NULL',
            })
                .then(() => console.log('✅ notification_logs table and read columns ensured'))
                .catch((migrationError) => {
                    console.error('Failed to ensure notification read columns:', migrationError.message);
                });
        }
    });

    db.query(`
        CREATE TABLE IF NOT EXISTS compliance_threshold_alert_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            scholar_id VARCHAR(64) NOT NULL,
            stage VARCHAR(16) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_compliance_threshold_scholar_event (scholar_id, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (thresholdErr) => {
        if (thresholdErr) console.error('Failed to create compliance threshold alert state table:', thresholdErr);
        else console.log('✅ compliance threshold alert state table ensured');
    });

    db.query(`
        CREATE TABLE IF NOT EXISTS duty_makeup_permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            scholar_id VARCHAR(64) NOT NULL,
            source_duty_id INT NOT NULL,
            makeup_duty_id INT NOT NULL,
            reason TEXT DEFAULT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'approved',
            approved_by INT DEFAULT NULL,
            approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            used_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_makeup_permission (scholar_id, makeup_duty_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (makeupErr) => {
        if (makeupErr) console.error('Failed to create duty_makeup_permissions table:', makeupErr);
        else console.log('✅ duty_makeup_permissions table ensured');
    });

    db.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            action VARCHAR(128) NOT NULL,
            module VARCHAR(128) DEFAULT NULL,
            details TEXT DEFAULT NULL,
            ip_address VARCHAR(64) DEFAULT NULL,
            result VARCHAR(32) DEFAULT 'success',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (auditErr) => {
        if (auditErr) {
            console.error('Failed to create audit_logs table:', auditErr);
            return;
        }

        console.log('✅ audit_logs table ensured');
    });

    officerAssignmentsReady = new Promise((resolve) => db.query(`
        CREATE TABLE IF NOT EXISTS officer_year_level_assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            officer_id INT NOT NULL,
            year_level VARCHAR(64) NOT NULL,
            assigned_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_officer_year_level (officer_id, year_level)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (assignmentErr) => {
        if (assignmentErr) console.error('Failed to create officer assignment table:', assignmentErr);
        else console.log('✅ officer_year_level_assignments table ensured');
        resolve(!assignmentErr);
    }));

    // Keep compliance threshold settings compatible with older databases.
    ensureColumns(db, 'compliance_settings', {
        min_compliance: 'DECIMAL(5,2) NOT NULL DEFAULT 70.00',
        allowed_missed: 'INT NOT NULL DEFAULT 2',
        required_hours: 'INT NOT NULL DEFAULT 30',
        missed_submission_deduction: 'INT NOT NULL DEFAULT 2',
        service_hour_shortfall_deduction: 'INT NOT NULL DEFAULT 1',
        absent_duty_deduction: 'INT NOT NULL DEFAULT 2',
        late_submission_deduction: 'INT NOT NULL DEFAULT 1',
        negative_letter_deduction: 'INT NOT NULL DEFAULT 1',
        quality_drop_deduction: 'DECIMAL(4,2) NOT NULL DEFAULT 0.50',
        extra_service_bonus: 'INT NOT NULL DEFAULT 2',
        good_maintenance_bonus: 'INT NOT NULL DEFAULT 5',
        missed_submission_grace_count: 'INT NOT NULL DEFAULT 2',
        late_submission_grace_count: 'INT NOT NULL DEFAULT 2',
        recovery_enabled: 'TINYINT(1) NOT NULL DEFAULT 1',
        early_submission_bonus: 'DECIMAL(4,2) NOT NULL DEFAULT 0.50',
        service_hours_completion_bonus: 'DECIMAL(4,2) NOT NULL DEFAULT 2.00',
        consecutive_early_bonus: 'DECIMAL(4,2) NOT NULL DEFAULT 1.00',
        perfect_attendance_bonus: 'DECIMAL(4,2) NOT NULL DEFAULT 0.50',
        monthly_recovery_cap: 'DECIMAL(4,2) NOT NULL DEFAULT 2.00',
    }).then(() => {
            console.log('✅ compliance_settings fields ensured');
            db.query(
                'INSERT INTO compliance_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id',
                (seedErr) => {
                    if (seedErr) console.error('Failed to seed compliance settings:', seedErr.message);
                    else console.log('✅ compliance settings defaults ensured');
                }
            );
    }).catch((migrationError) => {
        console.error('Failed to add compliance_settings fields:', migrationError.message);
    });

    // Ensure submissions schema is compatible with current application logic.
    submissionsSchemaReady = ensureColumns(db, 'submissions', {
        letter_content: 'TEXT DEFAULT NULL',
        sentiment_score: 'DECIMAL(7,2) DEFAULT NULL',
        sentiment_label: 'VARCHAR(64) DEFAULT NULL',
        content_score: 'INT DEFAULT NULL',
        content_breakdown: 'TEXT DEFAULT NULL',
        quality_label: 'VARCHAR(64) DEFAULT NULL',
        needs_followup: 'TINYINT(1) NOT NULL DEFAULT 0',
        report_card_path: 'VARCHAR(500) DEFAULT NULL',
        cor_path: 'VARCHAR(500) DEFAULT NULL',
        service_activity: 'VARCHAR(255) DEFAULT NULL',
        service_hours: 'DECIMAL(8,2) DEFAULT NULL',
        service_date: 'DATE DEFAULT NULL',
        quality_score: 'DECIMAL(5,2) DEFAULT NULL',
        quality_status: 'VARCHAR(64) DEFAULT NULL',
        officer_comment: 'TEXT DEFAULT NULL',
        reviewed_at: 'TIMESTAMP NULL DEFAULT NULL',
        approved_at: 'TIMESTAMP NULL DEFAULT NULL',
        archive_at: 'TIMESTAMP NULL DEFAULT NULL',
        archived_at: 'TIMESTAMP NULL DEFAULT NULL',
        returned_at: 'TIMESTAMP NULL DEFAULT NULL',
        finalized_at: 'DATETIME NULL DEFAULT NULL',
        export_available_at: 'DATETIME NULL DEFAULT NULL',
        finalization_batch_id: 'VARCHAR(64) DEFAULT NULL',
        generated_pdf_path: 'VARCHAR(1000) DEFAULT NULL',
    }).then(async () => {
        console.log('✅ submissions table schema ensured');
        await runQuery(db, "UPDATE submissions SET status = 'approved' WHERE status = 'Approved'");
        await runQuery(db, "UPDATE submissions SET status = 'rejected' WHERE status = 'Rejected'");
        await runQuery(db, "UPDATE submissions SET status = 'pending' WHERE status = 'Pending'");
        await runQuery(db, `
            UPDATE submissions
            SET status = 'approved',
                finalized_at = COALESCE(archived_at, archive_at, NOW()),
                export_available_at = COALESCE(archive_at, archived_at, NOW()),
                finalization_batch_id = COALESCE(
                    finalization_batch_id,
                    CONCAT('legacy-', scholar_id, '-', DATE_FORMAT(COALESCE(archived_at, archive_at, NOW()), '%Y%m%d%H%i%s'))
                )
            WHERE status = 'archived' AND finalized_at IS NULL
        `);
        console.log('✅ legacy archived submissions moved to finalized history');
        await runQuery(db, `
            UPDATE submissions
            SET finalized_at = COALESCE(approved_at, reviewed_at, submitted_at, NOW()),
                export_available_at = COALESCE(approved_at, reviewed_at, submitted_at, NOW()),
                finalization_batch_id = CONCAT('legacy-approved-', scholar_id, '-', id)
            WHERE LOWER(status) = 'approved'
              AND finalized_at IS NULL
              AND COALESCE(approved_at, reviewed_at, submitted_at, NOW()) <= DATE_SUB(NOW(), INTERVAL 3 DAY)
        `);
        console.log('✅ previously approved submissions moved into Reports');
        await ensureIndexes(db, 'submissions', {
            idx_submissions_scholar_id: ['scholar_id'],
        });
        console.log('✅ submissions.scholar_id index ensured');
        return true;
    }).catch((migrationError) => {
        console.error('Failed to migrate submissions schema or legacy records:', migrationError.message);
        return false;
    });

    ensureColumns(db, 'duty_attendance', {
        check_out_at: 'DATETIME DEFAULT NULL',
    }).then(() => ensureIndexes(db, 'duty_attendance', {
        idx_duty_attendance_scholar_id: ['scholar_id'],
    })).then(() => {
        console.log('✅ duty_attendance check-out field and scholar_id index ensured');
    }).catch((migrationError) => {
        console.error('Failed to ensure duty_attendance schema:', migrationError.message);
    });

    ensureColumns(db, 'submission_media', {
        photo_path: 'VARCHAR(1000) DEFAULT NULL',
        consent: 'BOOLEAN NOT NULL DEFAULT FALSE',
        uploaded_at: 'TIMESTAMP NULL DEFAULT NULL',
        retention_until: 'DATETIME NULL',
        is_archived: 'BOOLEAN NOT NULL DEFAULT FALSE',
        archived_at: 'DATETIME DEFAULT NULL',
        approved_for_donor: 'TINYINT(1) NOT NULL DEFAULT 0',
        approved_at: 'TIMESTAMP NULL DEFAULT NULL',
        approved_by: 'INT DEFAULT NULL',
    }).then(() => ensureIndexes(db, 'submission_media', {
        idx_submission_media_submission_id: ['submission_id'],
    })).then(() => runQuery(db, `
        UPDATE submission_media
        SET photo_path = COALESCE(photo_path, file_path),
            uploaded_at = COALESCE(uploaded_at, created_at),
            retention_until = COALESCE(retention_until, DATE_ADD(COALESCE(uploaded_at, created_at), INTERVAL 5 YEAR))
        WHERE photo_path IS NULL OR uploaded_at IS NULL OR retention_until IS NULL
    `)).then(() => {
        console.log('✅ submission_media retention and donor approval fields ensured');
    }).catch((migrationError) => {
        console.error('Failed to ensure submission_media schema:', migrationError.message);
    });

    db.query(`
        CREATE TABLE IF NOT EXISTS documents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            scholar_id VARCHAR(64) NOT NULL,
            category VARCHAR(64) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(1000) DEFAULT NULL,
            file_size BIGINT UNSIGNED DEFAULT NULL,
            mime_type VARCHAR(128) DEFAULT NULL,
            status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
            uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            retention_until DATETIME NOT NULL,
            is_archived BOOLEAN NOT NULL DEFAULT FALSE,
            archived_at DATETIME DEFAULT NULL,
            source_submission_id INT DEFAULT NULL,
            INDEX idx_documents_scholar (scholar_id),
            INDEX idx_documents_archive (is_archived, retention_until),
            INDEX idx_documents_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (documentErr) => {
        if (documentErr) console.error('Failed to ensure documents table:', documentErr.message);
        else {
            submissionsSchemaReady.then((schemaReady) => {
                if (!schemaReady) {
                    console.error('Skipping retention document backfill because submissions migration did not complete.');
                    return;
                }
                return runQuery(db, `
                              INSERT INTO documents (scholar_id, category, file_name, file_path, mime_type, status, uploaded_at, retention_until, source_submission_id)
                              SELECT s.scholar_id,
                                  CASE WHEN s.generated_pdf_path IS NOT NULL THEN 'monthly_letter'
                                    WHEN s.cor_path IS NOT NULL THEN 'COR'
                                    WHEN s.report_card_path IS NOT NULL THEN 'grades'
                                    ELSE s.submission_type END,
                                  CASE WHEN s.generated_pdf_path IS NOT NULL THEN CONCAT('monthly-letter-', s.id, '.pdf')
                                    WHEN s.cor_path IS NOT NULL THEN CONCAT('cor-', s.id)
                                    WHEN s.report_card_path IS NOT NULL THEN CONCAT('report-card-', s.id)
                                    ELSE CONCAT(s.submission_type, '-', s.id) END,
                                  COALESCE(s.generated_pdf_path, s.cor_path, s.report_card_path),
                                  CASE WHEN s.generated_pdf_path IS NOT NULL THEN 'application/pdf' ELSE NULL END,
                                  CASE s.status WHEN 'approved' THEN 'Approved' WHEN 'rejected' THEN 'Rejected' ELSE 'Pending' END,
                                  s.submitted_at, DATE_ADD(s.submitted_at, INTERVAL 5 YEAR), s.id
                              FROM submissions s
                              WHERE COALESCE(s.generated_pdf_path, s.cor_path, s.report_card_path) IS NOT NULL
                                AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.source_submission_id = s.id)
                `);
            }).catch((backfillError) => {
                console.error('Failed to backfill retention documents:', backfillError.message);
            });
        }
    });

    // Ensure tasks table exists
    db.query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            type VARCHAR(64) NOT NULL,
            due_date DATE DEFAULT NULL,
            recurring VARCHAR(32) DEFAULT NULL,
            instructions TEXT DEFAULT NULL,
            source VARCHAR(32) DEFAULT 'manual',
            created_by INT DEFAULT NULL,
            created_by_role VARCHAR(32) DEFAULT NULL,
            target_year_levels JSON DEFAULT NULL,
            is_active TINYINT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (tErr) => {
        if (tErr) {
            console.error('Failed to ensure tasks table:', tErr.message);
            return;
        }
        ensureColumns(db, 'tasks', {
            target_year_levels: 'JSON DEFAULT NULL',
        }).then(async () => {
            if (!await officerAssignmentsReady) {
                console.error('Skipping legacy task target migration because officer assignments table is unavailable.');
                return;
            }
            const legacyTasks = await runQuery(db, `
                SELECT id, created_by FROM tasks
                WHERE created_by_role = 'officer' AND target_year_levels IS NULL
            `);
            for (const task of legacyTasks) {
                const levels = await runQuery(
                    db,
                    'SELECT year_level FROM officer_year_level_assignments WHERE officer_id = ?',
                    [task.created_by]
                );
                if (levels.length) {
                    await runQuery(
                        db,
                        'UPDATE tasks SET target_year_levels = ? WHERE id = ?',
                        [JSON.stringify(levels.map((row) => row.year_level)), task.id]
                    );
                }
            }
            console.log('✅ tasks table and target levels ensured');
        }).catch((migrationError) => {
            console.error('Failed to ensure task target levels:', migrationError.message);
        });
    });

    ensureColumns(db, 'scholar_groups', {
        assigned_staff_id: 'INT DEFAULT NULL',
    }).then(() => runQuery(db, `
        UPDATE scholar_groups
        SET assigned_staff_id = created_by
        WHERE assigned_staff_id IS NULL AND created_by IS NOT NULL
    `)).then(() => {
        console.log('✅ scholar group staff assignments ensured');
    }).catch((migrationError) => {
        console.error('Failed to migrate scholar group staff assignments:', migrationError.message);
    });

    db.query(`
        CREATE TABLE IF NOT EXISTS data_consents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            purpose VARCHAR(128) NOT NULL,
            consented TINYINT(1) NOT NULL DEFAULT 0,
            consented_at TIMESTAMP NULL DEFAULT NULL,
            revoked_at TIMESTAMP NULL DEFAULT NULL,
            UNIQUE KEY uq_data_consent_user_purpose (user_id, purpose)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (consentErr) => {
        if (consentErr) console.error('Failed to create data_consents table:', consentErr);
        else console.log('✅ data_consents table ensured');
    });

    db.query(`
        CREATE TABLE IF NOT EXISTS file_assets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            scholar_id VARCHAR(64) NOT NULL,
            file_url VARCHAR(1000) NOT NULL,
            public_id VARCHAR(500) NOT NULL,
            resource_type VARCHAR(32) NOT NULL DEFAULT 'image',
            file_format VARCHAR(16) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_file_asset_url (file_url(255)),
            INDEX idx_file_assets_scholar (scholar_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (assetErr) => {
        if (assetErr) console.error('Failed to create file_assets table:', assetErr);
        else console.log('✅ file_assets table ensured');
    });

    db.query(`
        CREATE TABLE IF NOT EXISTS privacy_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            request_type ENUM('export', 'deletion') NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP NULL DEFAULT NULL,
            processed_by INT DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            INDEX idx_privacy_requests_user (user_id),
            INDEX idx_privacy_requests_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (privacyErr) => {
        if (privacyErr) console.error('Failed to create privacy_requests table:', privacyErr);
        else console.log('✅ privacy_requests table ensured');
    });

    ensureColumns(db, 'grades', {
        approved_at: 'DATETIME NULL DEFAULT NULL',
        finalized_at: 'DATETIME NULL DEFAULT NULL',
        export_available_at: 'DATETIME NULL DEFAULT NULL',
        finalization_batch_id: 'VARCHAR(64) DEFAULT NULL',
    }).then(() => runQuery(db, `
        UPDATE grades
        SET approved_at = COALESCE(approved_at, created_at),
            finalized_at = NOW(),
            export_available_at = NOW(),
            finalization_batch_id = CONCAT('legacy-grade-', scholar_id, '-', semester, '-', academic_year)
        WHERE verification_status = 'approved'
          AND finalized_at IS NULL
          AND COALESCE(approved_at, created_at) <= DATE_SUB(NOW(), INTERVAL 3 DAY)
    `)).then(() => {
        console.log('✅ grades finalization fields ensured; approved grades moved into Reports');
    }).catch((migrationError) => {
        console.error('Failed to ensure grade finalization schema:', migrationError.message);
    });
};

// Temporary production database network diagnostic
const diagnoseDatabaseNetwork = async () => {
    const host = process.env.DB_HOST;
    const port = Number(process.env.DB_PORT);

    if (!host || !port) {
        console.error('[db-network] Missing DB_HOST or DB_PORT');
        return;
    }

    try {
        const addresses = await dns.lookup(host, { all: true });

        console.log('[db-network] DNS resolved:', addresses);

        const socket = net.createConnection({ host, port });

        socket.setTimeout(10000);

        socket.once('connect', () => {
            console.log('[db-network] TCP CONNECT SUCCESS');
        });

        socket.once('data', (data) => {
            const packetLength = data.length >= 3
                ? data[0] | (data[1] << 8) | (data[2] << 16)
                : null;
            console.log('[db-network] first response header:', {
                bytesReceived: data.length,
                packetLength,
                sequenceId: data.length >= 4 ? data[3] : null,
                protocolVersion: data.length >= 5 ? data[4] : null,
                looksLikeMySqlGreeting: data.length >= 5 && data[4] === 10,
            });
            socket.destroy();
        });

        socket.once('timeout', () => {
            console.error('[db-network] TCP TIMEOUT');
            socket.destroy();
        });

        socket.once('error', (error) => {
            console.error('[db-network] TCP ERROR:', error.code);
        });
    } catch (error) {
        console.error('[db-network] DNS ERROR:', error.code);
    }
};

diagnoseDatabaseNetwork();

const enableDbAutoMigration = process.env.DB_AUTO_MIGRATION !== 'false';

db.ready
    .then(() => {
        databaseReady = true;
        if (enableDbAutoMigration) {
            initializeDatabase();
        } else {
            console.log('Skipping automatic DB schema migration because DB_AUTO_MIGRATION=false');
        }
    })
    .catch((err) => {
        console.error('Database initialization skipped because the connection is not ready:', err.message || err);
    });