const db = require('../config/db');

const finalizeApprovedSubmissions = async () => {
    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();
        const [submissionResult] = await connection.query(`
            UPDATE submissions
            SET approved_at = COALESCE(approved_at, reviewed_at, submitted_at),
                finalized_at = NOW(),
                export_available_at = NOW(),
                finalization_batch_id = CONCAT('auto-approved-', scholar_id, '-', id)
            WHERE status = 'approved'
              AND finalized_at IS NULL
              AND COALESCE(approved_at, reviewed_at, submitted_at) <= DATE_SUB(NOW(), INTERVAL 3 DAY)
        `);
        const [gradeResult] = await connection.query(`
            UPDATE grades
            SET approved_at = COALESCE(approved_at, created_at),
                finalized_at = NOW(),
                export_available_at = NOW(),
                finalization_batch_id = CONCAT('auto-approved-grade-', scholar_id, '-', id)
            WHERE verification_status = 'approved'
              AND finalized_at IS NULL
              AND COALESCE(approved_at, created_at) <= DATE_SUB(NOW(), INTERVAL 3 DAY)
        `);
        await connection.commit();
        return {
            submissions_finalized: submissionResult.affectedRows,
            grades_finalized: gradeResult.affectedRows,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = { finalizeApprovedSubmissions };
