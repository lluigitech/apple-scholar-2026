const db = require('../config/db');

const sql = `
    INSERT INTO documents (
        scholar_id, category, file_name, file_path, mime_type, status,
        uploaded_at, retention_until, source_submission_id
    )
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
           s.submitted_at,
           DATE_ADD(s.submitted_at, INTERVAL 5 YEAR),
           s.id
    FROM submissions s
    WHERE COALESCE(s.generated_pdf_path, s.cor_path, s.report_card_path) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.source_submission_id = s.id)
`;

db.query(sql, (error, result) => {
    if (error) {
        console.error(error.message);
        process.exitCode = 1;
    } else {
        console.log(`Backfilled documents: ${result.affectedRows}`);
        db.query('SELECT COUNT(*) AS count FROM documents', (countError, rows) => {
            if (countError) console.error(countError.message);
            else console.log('Total documents:', rows[0].count);
            db.end();
        });
    }
});
