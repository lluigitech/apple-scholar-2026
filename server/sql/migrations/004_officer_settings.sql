SET @migration_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'phone') = 0,
  'ALTER TABLE users ADD COLUMN phone VARCHAR(64) DEFAULT NULL',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

CREATE TABLE IF NOT EXISTS officer_notification_preferences (
  officer_id INT PRIMARY KEY,
  new_submissions BOOLEAN NOT NULL DEFAULT TRUE,
  pending_reviews BOOLEAN NOT NULL DEFAULT TRUE,
  deadlines BOOLEAN NOT NULL DEFAULT TRUE,
  returned_submissions BOOLEAN NOT NULL DEFAULT TRUE,
  announcements BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
