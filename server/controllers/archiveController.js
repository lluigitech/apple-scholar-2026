const db = require('../config/db');

const query = (sql, params = []) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

const documentSelect = `
    SELECT d.id, d.scholar_id, u.full_name AS scholar_name, d.category,
           d.file_name, d.file_path, d.file_size, d.mime_type, d.status,
           d.uploaded_at, d.retention_until, d.is_archived, d.archived_at
    FROM documents d
    LEFT JOIN users u ON u.scholar_id = d.scholar_id
`;

exports.listDocuments = async (req, res) => {
    try {
        const archived = String(req.query.archived || 'false') === 'true' ? 1 : 0;
        const search = String(req.query.search || '').trim();
        const category = String(req.query.category || '').trim();
        const year = String(req.query.year || '').trim();
        const conditions = ['d.is_archived = ?'];
        const values = [archived];

        if (search) {
            conditions.push('(u.full_name LIKE ? OR d.scholar_id LIKE ? OR d.file_name LIKE ?)');
            values.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (category) {
            conditions.push('d.category = ?');
            values.push(category);
        }
        if (year) {
            conditions.push('YEAR(d.uploaded_at) = ?');
            values.push(Number(year));
        }

        const documentRows = await query(`${documentSelect} WHERE ${conditions.join(' AND ')} ORDER BY d.uploaded_at DESC`, values);
        if (!archived) return res.json(documentRows);

        const submissionConditions = [
            "(s.archived_at IS NOT NULL OR s.archive_at IS NOT NULL)",
            "s.status = 'approved'",
        ];
        const submissionValues = [];

        if (search) {
            submissionConditions.push('(u.full_name LIKE ? OR s.scholar_id LIKE ? OR s.title LIKE ? OR s.submission_type LIKE ?)');
            submissionValues.push(...Array(4).fill(`%${search}%`));
        }
        if (category) {
            submissionConditions.push('s.submission_type LIKE ?');
            submissionValues.push(`%${category}%`);
        }
        if (year) {
            submissionConditions.push('YEAR(s.submitted_at) = ?');
            submissionValues.push(Number(year));
        }

        const submissionRows = await query(`
            SELECT
                CONCAT('submission-', s.id) AS id,
                s.id AS record_id,
                'submission' AS record_type,
                s.scholar_id,
                u.full_name AS scholar_name,
                s.submission_type AS category,
                COALESCE(NULLIF(s.title, ''), CONCAT(REPLACE(UPPER(s.submission_type), '_', ' '), ' #', s.id)) AS file_name,
                COALESCE(s.generated_pdf_path, s.report_card_path, s.cor_path, (
                    SELECT sm.file_path
                    FROM submission_media sm
                    WHERE sm.submission_id = s.id
                    ORDER BY sm.id
                    LIMIT 1
                )) AS file_path,
                NULL AS file_size,
                NULL AS mime_type,
                'Archived' AS status,
                s.submitted_at AS uploaded_at,
                DATE_ADD(COALESCE(s.archived_at, s.archive_at), INTERVAL 5 YEAR) AS retention_until,
                1 AS is_archived,
                COALESCE(s.archived_at, s.archive_at) AS archived_at
            FROM submissions s
            LEFT JOIN users u ON u.scholar_id = s.scholar_id
            WHERE ${submissionConditions.join(' AND ')}
            ORDER BY s.submitted_at DESC
        `, submissionValues);

        res.json([...documentRows, ...submissionRows].sort(
            (left, right) => new Date(right.uploaded_at) - new Date(left.uploaded_at)
        ));
    } catch (error) {
        console.error('[archive list]', error);
        res.status(500).json({ error: 'Unable to load document archive.' });
    }
};

exports.restoreSubmission = async (req, res) => {
    const submissionId = Number(req.params.id);
    if (!Number.isSafeInteger(submissionId) || submissionId <= 0) {
        return res.status(400).json({ error: 'Invalid submission ID.' });
    }

    try {
        const result = await query(
            `UPDATE submissions
             SET archived_at = NULL, archive_at = NULL
             WHERE id = ? AND (archived_at IS NOT NULL OR archive_at IS NOT NULL)`,
            [submissionId]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Archived submission not found.' });
        res.json({ message: 'Submission record restored.' });
    } catch (error) {
        console.error('[restore submission]', error);
        res.status(500).json({ error: 'Unable to restore submission record.' });
    }
};

exports.archiveDocument = async (req, res) => {
    try {
        const result = await query('UPDATE documents SET is_archived = 1, archived_at = NOW() WHERE id = ? AND is_archived = 0', [req.params.id]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Active document not found.' });
        res.json({ message: 'Document archived. The physical file was retained.' });
    } catch (error) {
        console.error('[archive document]', error);
        res.status(500).json({ error: 'Unable to archive document.' });
    }
};

exports.restoreDocument = async (req, res) => {
    try {
        const result = await query('UPDATE documents SET is_archived = 0, archived_at = NULL WHERE id = ? AND is_archived = 1', [req.params.id]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Archived document not found.' });
        res.json({ message: 'Document restored.' });
    } catch (error) {
        console.error('[restore document]', error);
        res.status(500).json({ error: 'Unable to restore document.' });
    }
};

exports.deleteDocument = async (req, res) => {
    try {
        const result = await query('DELETE FROM documents WHERE id = ?', [req.params.id]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Document not found.' });
        res.json({ message: 'Document record permanently deleted. The physical file was not removed automatically.' });
    } catch (error) {
        console.error('[delete document]', error);
        res.status(500).json({ error: 'Unable to permanently delete document.' });
    }
};

exports.expiringDocuments = async (req, res) => {
    try {
        const rows = await query(`${documentSelect} WHERE d.retention_until <= NOW() AND d.is_archived = 0 ORDER BY d.retention_until ASC`);
        res.json(rows);
    } catch (error) {
        console.error('[retention expiring]', error);
        res.status(500).json({ error: 'Unable to load expiring documents.' });
    }
};
