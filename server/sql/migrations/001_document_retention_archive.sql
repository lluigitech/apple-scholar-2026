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

ALTER TABLE submission_media
  ADD COLUMN IF NOT EXISTS photo_path VARCHAR(1000) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS retention_until DATETIME NULL,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at DATETIME DEFAULT NULL;

UPDATE submission_media
SET photo_path = file_path,
    uploaded_at = COALESCE(uploaded_at, created_at),
    retention_until = COALESCE(retention_until, DATE_ADD(COALESCE(uploaded_at, created_at), INTERVAL 5 YEAR))
WHERE photo_path IS NULL OR retention_until IS NULL;

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
  AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.source_submission_id = s.id);
