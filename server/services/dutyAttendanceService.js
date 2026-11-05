const db = require('../config/db');

const manilaNowSql = 'DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)';
const dutyEndSql = "TIMESTAMP(d.duty_date, COALESCE(d.time_end, '23:59:59'))";
const checkoutOpenSql = `CASE
    WHEN COALESCE(da.is_makeup, 0) = 1 THEN DATE_ADD(${dutyEndSql}, INTERVAL 1 HOUR)
    ELSE ${dutyEndSql}
END`;

const checkOutDutyAttendance = (dutyId, scholarId, callback) => {
    if (!Number.isSafeInteger(Number(dutyId)) || Number(dutyId) <= 0 || !String(scholarId || '').trim()) {
        return callback({ status: 400, error: 'A valid duty and scholar are required for check-out.' });
    }

    const sql = `
        SELECT da.id, da.status, da.check_out_at, da.is_makeup,
            ${checkoutOpenSql} <= ${manilaNowSql} AS checkout_open,
            DATE_ADD(${dutyEndSql}, INTERVAL 2 HOUR) <= ${manilaNowSql} AS checkout_locked
        FROM duty_attendance da
        INNER JOIN duties d ON d.id = da.duty_id
        WHERE da.duty_id = ? AND da.scholar_id = ?
        LIMIT 1
    `;

    db.query(sql, [dutyId, scholarId], (err, rows) => {
        if (err) {
            console.error('Failed to verify duty attendance for check-out:', err);
            return callback({ status: 500, error: 'Unable to verify duty attendance for check-out.' });
        }
        if (!rows.length) return callback({ status: 404, error: 'No check-in record was found for this duty.' });

        const attendance = rows[0];
        if (!['present', 'late'].includes(String(attendance.status || '').toLowerCase())) {
            return callback({ status: 409, error: 'Only scholars who checked in can check out.' });
        }
        if (attendance.check_out_at) {
            return callback({ status: 409, error: 'This attendance has already been checked out.' });
        }

        const isMakeup = Number(attendance.is_makeup) === 1;
        if (Number(attendance.checkout_locked) === 1) {
            return callback({ status: 409, error: 'The check-out window closed two hours after the scheduled duty end.' });
        }
        if (Number(attendance.checkout_open) !== 1) {
            if (isMakeup) {
            return callback({ status: 409, error: 'Make-up duty check-out is available one hour after the scheduled duty ends.' });
            }
            return callback({ status: 409, error: 'Check-out is available after the scheduled duty ends.' });
        }

        db.query(
            'UPDATE duty_attendance SET check_out_at = NOW() WHERE id = ? AND check_out_at IS NULL',
            [attendance.id],
            (updateErr, result) => {
                if (updateErr) {
                    console.error('Failed to record duty check-out:', updateErr);
                    return callback({ status: 500, error: 'Unable to record duty check-out.' });
                }
                if (!result.affectedRows) return callback({ status: 409, error: 'This attendance has already been checked out.' });
                callback(null, { id: attendance.id });
            }
        );
    });
};

const autoCheckOutDutyAttendances = async () => {
    const scheduledCheckoutSql = checkoutOpenSql;
    const [result] = await db.promise().query(`
        UPDATE duty_attendance da
        JOIN duties d ON d.id = da.duty_id
        SET da.check_out_at = ${scheduledCheckoutSql}
        WHERE da.status IN ('present', 'late')
          AND da.check_out_at IS NULL
          AND LOWER(COALESCE(d.status, '')) <> 'cancelled'
          AND DATE_ADD(${scheduledCheckoutSql}, INTERVAL 15 MINUTE) <= ${manilaNowSql}
    `);
    return { checkedOutCount: result.affectedRows };
};

module.exports = { checkOutDutyAttendance, autoCheckOutDutyAttendances };
