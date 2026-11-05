const db = require('../config/db');
const nodemailer = require('nodemailer');
const { calculateCurrentCompliance } = require('../utils/complianceLogger');
const { buildComplianceThresholdEmail } = require('../utils/emailTemplates');

const LOCK_NAME = 'apple-scholar-compliance-threshold-alerts';

const getTransporter = () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
};

const calculateScore = (scholarId) => new Promise((resolve, reject) => {
    calculateCurrentCompliance(scholarId, (error, score, minimumScore) => {
        if (error) return reject(error);
        resolve({ score: Number(score), minimumScore: Number(minimumScore) });
    });
});

const insertNotification = async (connection, {
    scholarId,
    recipient = '',
    channel,
    type,
    status,
    detail,
}) => connection.query(
    `INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [scholarId || null, recipient, channel, type, status, detail]
);

exports.sendComplianceThresholdNotifications = async () => {
    const connection = await db.promise().getConnection();
    let lockAcquired = false;
    try {
        const [lockRows] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [LOCK_NAME]);
        lockAcquired = Number(lockRows[0]?.acquired) === 1;
        if (!lockAcquired) return { skipped: true, notified_count: 0, email_count: 0 };

        const [scholars] = await connection.query(`
            SELECT scholar_id, full_name, email
            FROM users
            WHERE role = 'scholar' AND status = 'active'
            ORDER BY scholar_id
        `);
        const transporter = getTransporter();
        let notifiedCount = 0;
        let emailCount = 0;
        let failedEmailCount = 0;

        for (const scholar of scholars) {
            let compliance;
            try {
                compliance = await calculateScore(scholar.scholar_id);
            } catch (error) {
                console.error(`[compliance-threshold] Could not calculate score for ${scholar.scholar_id}:`, error.message || error);
                continue;
            }

            if (!Number.isFinite(compliance.score) || !Number.isFinite(compliance.minimumScore)) {
                console.error(`[compliance-threshold] Invalid compliance score for ${scholar.scholar_id}.`);
                continue;
            }

            const warningScore = compliance.minimumScore + 5;
            const stage = compliance.score < compliance.minimumScore
                ? 'critical'
                : compliance.score <= warningScore
                    ? 'warning'
                    : 'recovered';
            const [stateRows] = await connection.query(
                `SELECT id, stage FROM compliance_threshold_alert_events
                 WHERE scholar_id = ?
                 ORDER BY id DESC LIMIT 1`,
                [scholar.scholar_id]
            );
            const lastStage = stateRows[0]?.stage || '';

            if (stage === 'recovered') {
                if (lastStage === 'warning' || lastStage === 'critical') {
                    await connection.query(
                        `INSERT INTO compliance_threshold_alert_events (scholar_id, stage) VALUES (?, 'recovered')`,
                        [scholar.scholar_id]
                    );
                }
                continue;
            }

            if (lastStage === 'critical' && stage === 'warning') continue;
            const isNewStage = lastStage !== stage;
            let eventId = stateRows[0]?.id;
            if (isNewStage) {
                const [stateResult] = await connection.query(
                    `INSERT INTO compliance_threshold_alert_events (scholar_id, stage) VALUES (?, ?)`,
                    [scholar.scholar_id, stage]
                );
                eventId = stateResult.insertId;
            }
            const alertType = stage === 'critical'
                ? 'compliance_below_minimum'
                : 'compliance_near_minimum';
            const message = stage === 'critical'
                ? `Your compliance points are ${compliance.score.toFixed(2)}%, below the minimum required points of ${compliance.minimumScore.toFixed(2)}%. Please review your compliance status.`
                : `Your compliance points are ${compliance.score.toFixed(2)}%, approaching the minimum required points of ${compliance.minimumScore.toFixed(2)}%. Please review your compliance status.`;

            if (isNewStage) {
                await insertNotification(connection, {
                    scholarId: scholar.scholar_id,
                    recipient: scholar.email || '',
                    channel: 'system',
                    type: alertType,
                    status: 'generated',
                    detail: message,
                });
                notifiedCount += 1;
            }

            if (!scholar.email || !eventId) continue;
            const emailDetail = `event:${eventId}`;
            const [sentEmails] = await connection.query(
                `SELECT id FROM notification_logs
                 WHERE recipient = ? AND type = ? AND detail = ? AND status = 'sent'
                 LIMIT 1`,
                [scholar.email, alertType, emailDetail]
            );
            if (sentEmails.length) continue;

            if (!transporter) {
                failedEmailCount += 1;
                console.error(`[compliance-threshold] SMTP is not configured; could not email ${scholar.scholar_id}.`);
                await insertNotification(connection, {
                    recipient: scholar.email,
                    channel: 'email',
                    type: alertType,
                    status: 'failed',
                    detail: emailDetail,
                });
                continue;
            }

            try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: scholar.email,
                    subject: stage === 'critical'
                        ? 'Action needed: compliance points below minimum'
                        : 'Compliance points approaching minimum',
                    text: message,
                    html: buildComplianceThresholdEmail({
                        recipientName: scholar.full_name,
                        score: compliance.score,
                        minimumScore: compliance.minimumScore,
                        warningScore,
                        belowMinimum: stage === 'critical',
                    }),
                });
                await insertNotification(connection, {
                    recipient: scholar.email,
                    channel: 'email',
                    type: alertType,
                    status: 'sent',
                    detail: emailDetail,
                });
                emailCount += 1;
            } catch (error) {
                failedEmailCount += 1;
                console.error(`[compliance-threshold] Failed emailing ${scholar.scholar_id}:`, error.message || error);
                await insertNotification(connection, {
                    recipient: scholar.email,
                    channel: 'email',
                    type: alertType,
                    status: 'failed',
                    detail: emailDetail,
                });
            }
        }

        return {
            skipped: false,
            notified_count: notifiedCount,
            email_count: emailCount,
            failed_email_count: failedEmailCount,
        };
    } finally {
        if (lockAcquired) {
            try {
                await connection.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
            } catch (error) {
                console.error('[compliance-threshold] Failed to release scheduler lock:', error.message || error);
            }
        }
        connection.release();
    }
};
