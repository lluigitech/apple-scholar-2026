const express = require('express');
const cors    = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'utils', '.env') });
const db = require('./config/db');

// ─── Import Routes ────────────────────────────────────────────
const authRoutes       = require('./routes/authRoutes');
const adminRoutes      = require('./routes/admin/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const scholarRoutes    = require('./routes/scholar/scholarRoutes');
const staffRoutes      = require('./routes/staff/staffRoutes');
const officerRoutes    = require('./routes/officer/officerRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const dutyRoutes       = require('./routes/dutyRoutes');
const exportRoutes     = require('./routes/exportroutes'); // ← consistent casing
const flaggedRoutes    = require('./routes/flaggedRoutes');
const tasksRoutes      = require('./routes/tasksRoutes');
const reportSummaryRoutes = require('./routes/reportSummaryRoutes');
const { sendTaskDeadlineReminders, sendComplianceAlerts } = require('./utils/notifyHelpers');
const { rateLimit } = require('./middleware/rateLimit');

const app = express();

// ─── Middleware ───────────────────────────────────────────────
// CORS at JSON — dapat UNA bago lahat ng routes
// Allow any local Vite origin for dev convenience
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (origin.startsWith('http://localhost')) return cb(null, true);
        cb(new Error('CORS not allowed'));
    },
    credentials: true,
}));
app.use(express.json());
app.use(rateLimit({ max: 120 }));
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.status(426).json({ error: 'HTTPS is required.' });
    }
    next();
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Debug: log incoming requests (temporary) -----------------------------
app.use((req, res, next) => {
    console.log('[REQ]', req.method, req.originalUrl);
    next();
});

// --- Debug: expose registered routes for troubleshooting (temporary)
app.get('/api/_routes', (req, res) => {
    try {
        const routes = [];
        const stack = app._router && app._router.stack ? app._router.stack : [];
        stack.forEach((middleware) => {
            try {
                if (middleware.route) {
                    routes.push({ path: middleware.route.path, methods: middleware.route.methods });
                    return;
                }

                const handler = middleware.handle || middleware;
                const innerStack = handler && handler.stack ? handler.stack : null;
                if (Array.isArray(innerStack)) {
                    innerStack.forEach((layer) => {
                        if (layer.route) routes.push({ path: layer.route.path, methods: layer.route.methods });
                    });
                }
            } catch (e) {
                // ignore malformed middleware entries
            }
        });
        res.json({ routes });
    } catch (err) {
        res.status(500).json({ error: 'Failed to enumerate routes', detail: String(err) });
    }
});

// ─── Routes ───────────────────────────────────────────────────
app.use('/api',            authRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/admin/notifications', notificationRoutes);
app.use('/api/scholar',    scholarRoutes);
app.use('/api/staff',      staffRoutes);
app.use('/api/officer',    officerRoutes);
app.use('/api/submission', submissionRoutes);
app.use('/api/duties',     dutyRoutes);
app.use('/api/export',     exportRoutes);
app.use('/api/flagged',    flaggedRoutes);
app.use('/api/tasks',      tasksRoutes);
app.use('/api/reports',    reportSummaryRoutes);

// ─── Test Route ───────────────────────────────────────────────
app.get('/', (req, res) => {
    res.send('Kalinga Scholar System Backend is Running! 🚀');
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong on the server!' });
});

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

const reminderIntervalMs = 24 * 60 * 60 * 1000;
let reminderRunInProgress = false;

const runTaskDeadlineReminders = async () => {
    if (process.env.ENABLE_DEADLINE_REMINDERS === 'false' || reminderRunInProgress) return;
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

const initializeDatabase = () => {
    if (!process.env.DB_NAME) {
        return;
    }

    db.query('SELECT 1', (err) => {
        if (err) console.error('❌ MySQL connection failed:', err.message);
        else console.log('✅ Connected to MySQL Database!');
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

        if (!allowUserProfileColumnMigration) {
            console.log('Skipping users profile column auto-migration in production.');
        } else {
            const requiredProfileColumns = {
                age: 'INT DEFAULT NULL',
                phone: 'VARCHAR(64) DEFAULT NULL',
                address: 'VARCHAR(255) DEFAULT NULL',
                course: 'VARCHAR(255) DEFAULT NULL',
                school: 'VARCHAR(255) DEFAULT NULL',
            };

            db.query('SHOW COLUMNS FROM users', (colErr, colRows) => {
                if (colErr) {
                    console.error('Failed to inspect users columns:', colErr.message);
                    return;
                }

                const existingColumns = new Set(colRows.map((row) => row.Field));
                const missing = Object.entries(requiredProfileColumns)
                    .filter(([column]) => !existingColumns.has(column));

                if (missing.length === 0) {
                    console.log('✅ Users profile columns already present.');
                } else {
                    const alterSql = 'ALTER TABLE users ' + missing
                        .map(([column, definition]) => `ADD COLUMN IF NOT EXISTS ${column} ${definition}`)
                        .join(', ');
                    console.log('Adding missing users profile columns:', missing.map(([column]) => column).join(', '));
                    db.query(alterSql, (alterErr) => {
                        if (alterErr) {
                            console.error('Failed to add missing users profile columns using IF NOT EXISTS:', alterErr.message);
                            console.error('Users profile column migration failed. The following columns may still be missing: %s', missing.map(([column]) => column).join(', '));
                            console.error('Please add them manually or retry after resolving any table lock issues. Example SQL:');
                            missing.forEach(([column, definition]) => {
                                console.error(`  ALTER TABLE users ADD COLUMN ${column} ${definition};`);
                            });

                            const fallbackQueries = missing.map(
                                ([column, definition]) => `ALTER TABLE users ADD COLUMN ${column} ${definition}`
                            );

                            const runFallback = (index = 0) => {
                                if (index >= fallbackQueries.length) {
                                    console.log('Completed fallback users profile column migration.');
                                    return;
                                }

                                db.query(fallbackQueries[index], (fallbackErr) => {
                                    const fieldName = missing[index][0];
                                    if (fallbackErr) {
                                        if (fallbackErr.message.includes('Duplicate column name')) {
                                            console.warn(`Column already exists: ${fieldName}`);
                                        } else {
                                            console.error(`Failed to add ${fieldName}:`, fallbackErr.message);
                                        }
                                    } else {
                                        console.log(`✅ Added missing users profile column: ${fieldName}`);
                                    }
                                    runFallback(index + 1);
                                });
                            };

                            runFallback();
                        } else {
                            console.log('✅ Added missing users profile columns:', missing.map(([column]) => column).join(', '));
                        }
                    });
                }
            });
        }

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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (nErr) => {
        if (nErr) console.error('Failed to create notification_logs table:', nErr);
        else console.log('✅ notification_logs table ensured');
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

    db.query(`
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
    });

    // Keep compliance threshold settings compatible with older databases.
    db.query(`
        ALTER TABLE compliance_settings
        ADD COLUMN IF NOT EXISTS min_compliance DECIMAL(5,2) NOT NULL DEFAULT 70.00,
        ADD COLUMN IF NOT EXISTS allowed_missed INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS required_hours INT NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS missed_submission_deduction INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS service_hour_shortfall_deduction INT NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS absent_duty_deduction INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS late_submission_deduction INT NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS negative_letter_deduction INT NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS quality_drop_deduction DECIMAL(4,2) NOT NULL DEFAULT 0.50,
        ADD COLUMN IF NOT EXISTS extra_service_bonus INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS good_maintenance_bonus INT NOT NULL DEFAULT 5,
        ADD COLUMN IF NOT EXISTS missed_submission_grace_count INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS late_submission_grace_count INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS recovery_enabled TINYINT(1) NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS early_submission_bonus DECIMAL(4,2) NOT NULL DEFAULT 0.50,
        ADD COLUMN IF NOT EXISTS service_hours_completion_bonus DECIMAL(4,2) NOT NULL DEFAULT 2.00,
        ADD COLUMN IF NOT EXISTS consecutive_early_bonus DECIMAL(4,2) NOT NULL DEFAULT 1.00,
        ADD COLUMN IF NOT EXISTS perfect_attendance_bonus DECIMAL(4,2) NOT NULL DEFAULT 0.50,
        ADD COLUMN IF NOT EXISTS monthly_recovery_cap DECIMAL(4,2) NOT NULL DEFAULT 2.00;
    `, (alterErr) => {
        if (alterErr) console.error('Failed to add compliance_settings fields:', alterErr);
        else {
            console.log('✅ compliance_settings fields ensured');
            db.query(
                'INSERT INTO compliance_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id',
                (seedErr) => {
                    if (seedErr) console.error('Failed to seed compliance settings:', seedErr.message);
                    else console.log('✅ compliance settings defaults ensured');
                }
            );
        }
    });

    // Ensure submissions schema is compatible with current application logic.
    db.query(`
        ALTER TABLE submissions
        ADD COLUMN IF NOT EXISTS letter_content TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(7,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS sentiment_label VARCHAR(64) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS report_card_path VARCHAR(500) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS cor_path VARCHAR(500) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS service_activity VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS service_hours DECIMAL(8,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS service_date DATE DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS quality_score DECIMAL(5,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS quality_status VARCHAR(64) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS officer_comment TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP NULL DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS generated_pdf_path VARCHAR(1000) DEFAULT NULL
    `, (alterErr) => {
        if (alterErr) console.error('Failed to ensure submissions schema:', alterErr);
        else console.log('✅ submissions table schema ensured');
    });

    // Speed up Scholar queries by indexing common filter columns.
    db.query(`
        ALTER TABLE submissions
        ADD INDEX IF NOT EXISTS idx_submissions_scholar_id (scholar_id);
    `, (idxErr) => {
        if (idxErr) console.error('Failed to add submissions scholar_id index:', idxErr.message);
        else console.log('✅ submissions.scholar_id index ensured');
    });

    db.query(`
        ALTER TABLE duty_attendance
        ADD INDEX IF NOT EXISTS idx_duty_attendance_scholar_id (scholar_id);
    `, (idxErr) => {
        if (idxErr) console.error('Failed to add duty_attendance scholar_id index:', idxErr.message);
        else console.log('✅ duty_attendance.scholar_id index ensured');
    });

    db.query(`
        ALTER TABLE submission_media
        ADD INDEX IF NOT EXISTS idx_submission_media_submission_id (submission_id);
    `, (idxErr) => {
        if (idxErr) console.error('Failed to add submission_media submission_id index:', idxErr.message);
        else console.log('✅ submission_media.submission_id index ensured');
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
        if (tErr) console.error('Failed to ensure tasks table:', tErr);
        else db.query(
            'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_year_levels JSON DEFAULT NULL',
            (alterTaskErr) => {
                if (alterTaskErr) console.error('Failed to ensure task target levels:', alterTaskErr.message);
                else {
                    db.query(
                        `SELECT id, created_by FROM tasks
                         WHERE created_by_role = 'officer' AND target_year_levels IS NULL`,
                        (legacyErr, legacyTasks) => {
                            if (legacyErr) {
                                console.error('Failed to find legacy officer tasks:', legacyErr.message);
                                return;
                            }

                            let remaining = legacyTasks.length;
                            if (!remaining) {
                                console.log('✅ tasks table and target levels ensured');
                                return;
                            }

                            legacyTasks.forEach(task => {
                                db.query(
                                    `SELECT year_level FROM officer_year_level_assignments WHERE officer_id = ?`,
                                    [task.created_by],
                                    (levelsErr, levels) => {
                                        if (!levelsErr && levels.length) {
                                            db.query(
                                                'UPDATE tasks SET target_year_levels = ? WHERE id = ?',
                                                [JSON.stringify(levels.map(row => row.year_level)), task.id],
                                                () => {}
                                            );
                                        }
                                        remaining -= 1;
                                        if (!remaining) console.log('✅ tasks table and target levels ensured');
                                    }
                                );
                            });
                        }
                    );
                }
            }
        );
    });
};

const enableDbAutoMigration = process.env.DB_AUTO_MIGRATION !== 'false';

db.ready
    .then(() => {
        if (enableDbAutoMigration) {
            initializeDatabase();
        } else {
            console.log('Skipping automatic DB schema migration because DB_AUTO_MIGRATION=false');
        }
    })
    .catch((err) => {
        console.error('Database initialization skipped because the connection is not ready:', err.message || err);
    });

    db.query("ALTER TABLE scholar_groups ADD COLUMN IF NOT EXISTS assigned_staff_id INT DEFAULT NULL", (groupErr) => {
        if (groupErr) console.error('Failed to add staff assignment column:', groupErr.message);
        else db.query('UPDATE scholar_groups SET assigned_staff_id = created_by WHERE assigned_staff_id IS NULL AND created_by IS NOT NULL', () => {});
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