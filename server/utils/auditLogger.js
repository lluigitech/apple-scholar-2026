const db = require('../config/db');

const getClientIp = (req) => {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req?.ip || req?.connection?.remoteAddress || req?.socket?.remoteAddress || '';
};

const logAuditEvent = async ({ req, userId, action, module, details, result = 'success' }) => {
  try {
    const resolvedUserId = userId ?? req?.user?.id ?? null;
    const ipAddress = getClientIp(req);

    await new Promise((resolve) => {
      db.query(
        `INSERT INTO audit_logs (user_id, action, module, details, ip_address, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [resolvedUserId, action, module, details, ipAddress, result],
        (err) => {
          if (err) {
            console.error('[auditLogger]', err.message);
          }
          resolve();
        }
      );
    });
  } catch (err) {
    console.error('[auditLogger]', err.message);
  }
};

module.exports = {
  logAuditEvent,
};
