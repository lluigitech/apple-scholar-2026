const db = require('../config/db');

const LOCK_NAME = 'apple-scholar-duty-absence-sweep';

exports.markEndedDutyAbsences = async () => {
    const connection = await db.promise().getConnection();
    let lockAcquired = false;

    try {
        const [lockRows] = await connection.query(
            'SELECT GET_LOCK(?, 0) AS acquired',
            [LOCK_NAME]
        );
        lockAcquired = Number(lockRows[0]?.acquired) === 1;
        if (!lockAcquired) return { skipped: true, markedCount: 0 };

        const [result] = await connection.query(`
            INSERT INTO duty_attendance (duty_id, scholar_id, status, method, marked_at)
            SELECT DISTINCT d.id, gm.scholar_id, 'absent', 'system', NOW()
            FROM duties d
            JOIN duty_group_assignments dga ON dga.duty_id = d.id
            JOIN scholar_group_members gm ON gm.group_id = dga.group_id
            JOIN users u ON u.scholar_id = gm.scholar_id
                AND u.role = 'scholar' AND u.status = 'active'
            WHERE LOWER(COALESCE(d.status, '')) <> 'cancelled'
              AND TIMESTAMP(d.duty_date, COALESCE(d.time_end, '23:59:59')) <= NOW()
              AND NOT EXISTS (
                  SELECT 1
                  FROM duty_attendance existing
                  WHERE existing.duty_id = d.id
                    AND existing.scholar_id = gm.scholar_id
              )
        `);

        return { skipped: false, markedCount: result.affectedRows };
    } finally {
        if (lockAcquired) {
            try {
                await connection.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
            } catch (error) {
                console.error('[duty-absence] failed to release scheduler lock:', error.message || error);
            }
        }
        connection.release();
    }
};
