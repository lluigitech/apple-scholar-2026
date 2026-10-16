CREATE TABLE IF NOT EXISTS privacy_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  role_based_access TINYINT(1) NOT NULL DEFAULT 1,
  document_protection TINYINT(1) NOT NULL DEFAULT 1,
  access_logging TINYINT(1) NOT NULL DEFAULT 1,
  privacy_monitoring TINYINT(1) NOT NULL DEFAULT 1,
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO privacy_settings (id) VALUES (1)
ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS privacy_access_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  user_role VARCHAR(32) NOT NULL,
  action VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(255) DEFAULT NULL,
  status ENUM('allowed', 'denied') NOT NULL,
  ip_address VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_privacy_logs_created (created_at),
  INDEX idx_privacy_logs_status (status),
  INDEX idx_privacy_logs_action (action),
  INDEX idx_privacy_logs_role (user_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
