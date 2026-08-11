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

// Static files
app.use('/uploads', express.static('uploads'));

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
            ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password = VALUES(password), role = VALUES(role);
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

    // Keep compliance threshold settings compatible with older databases.
    db.query(`
        ALTER TABLE compliance_settings
        ADD COLUMN IF NOT EXISTS min_compliance DECIMAL(5,2) NOT NULL DEFAULT 70.00,
        ADD COLUMN IF NOT EXISTS allowed_missed INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS required_hours INT NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS missed_submission_deduction INT NOT NULL DEFAULT 12,
        ADD COLUMN IF NOT EXISTS service_hour_shortfall_deduction INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS absent_duty_deduction INT NOT NULL DEFAULT 6,
        ADD COLUMN IF NOT EXISTS late_submission_deduction INT NOT NULL DEFAULT 5,
        ADD COLUMN IF NOT EXISTS negative_letter_deduction INT NOT NULL DEFAULT 8,
        ADD COLUMN IF NOT EXISTS quality_drop_deduction INT NOT NULL DEFAULT 4,
        ADD COLUMN IF NOT EXISTS extra_service_bonus INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS good_maintenance_bonus INT NOT NULL DEFAULT 5,
        ADD COLUMN IF NOT EXISTS missed_submission_grace_count INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS late_submission_grace_count INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS recovery_enabled TINYINT(1) NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS early_submission_bonus DECIMAL(4,2) NOT NULL DEFAULT 0.50,
        ADD COLUMN IF NOT EXISTS service_hours_completion_bonus DECIMAL(4,2) NOT NULL DEFAULT 2.00,
        ADD COLUMN IF NOT EXISTS consecutive_early_bonus DECIMAL(4,2) NOT NULL DEFAULT 1.00,
        ADD COLUMN IF NOT EXISTS perfect_attendance_bonus DECIMAL(4,2) NOT NULL DEFAULT 0.50,
        ADD COLUMN IF NOT EXISTS monthly_recovery_cap DECIMAL(4,2) NOT NULL DEFAULT 3.00;
    `, (alterErr) => {
        if (alterErr) console.error('Failed to add compliance_settings fields:', alterErr);
        else console.log('✅ compliance_settings fields ensured');
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
        ADD COLUMN IF NOT EXISTS quality_status VARCHAR(64) DEFAULT NULL
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
            is_active TINYINT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (tErr) => {
        if (tErr) console.error('Failed to ensure tasks table:', tErr);
        else console.log('✅ tasks table ensured');
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