const db = require('../config/db'); // your mysql2 pool/connection
const promiseDb = db.promise();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const buildWhere = (filters) => {
  const conditions = [];
  const values = [];

  if (filters.scholar_id) {
    conditions.push('s.id = ?');
    values.push(filters.scholar_id);
  }
  if (filters.date_from) {
    conditions.push('DATE(created_at) >= ?');
    values.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push('DATE(created_at) <= ?');
    values.push(filters.date_to);
  }

  return {
    clause: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '',
    values,
  };
};

// ─── COMPLIANCE REPORT ────────────────────────────────────────────────────────
// Used for: internal monitoring, staff dashboard
const getComplianceReport = async (filters) => {
  const { clause, values } = buildWhere(filters);

  // Duty attendance
  const [dutyRows] = await promiseDb.query(
    `SELECT
       s.id            AS scholar_id,
       s.name          AS scholar,
       s.course,
       s.year_level,
       da.duty_date    AS date,
       dt.title        AS duty,
       da.status,
       da.hours_rendered AS hours
     FROM duty_attendance da
     JOIN scholars s  ON s.id = da.scholar_id
     JOIN duty_tasks dt ON dt.id = da.duty_task_id
     ${clause.replace('created_at', 'da.duty_date')}
     ORDER BY da.duty_date DESC, s.name`,
    values
  );

  // Monthly report submissions
  const [submissionRows] = await promiseDb.query(
    `SELECT
       s.id            AS scholar_id,
       s.name          AS scholar,
       sub.report_type AS type,
       sub.period,
       sub.submitted_at,
       sub.status
     FROM submissions sub
     JOIN scholars s ON s.id = sub.scholar_id
     ${clause.replace('created_at', 'sub.submitted_at')}
     ORDER BY sub.submitted_at DESC, s.name`,
    values
  );

  // Requirements (COR, grades, ID card)
  const [reqRows] = await promiseDb.query(
    `SELECT
       s.id            AS scholar_id,
       s.name          AS scholar,
       r.requirement_type AS type,
       r.semester,
       r.submitted_at,
       r.status
     FROM requirements r
     JOIN scholars s ON s.id = r.scholar_id
     ${clause.replace('created_at', 'r.submitted_at')}
     ORDER BY r.submitted_at DESC, s.name`,
    values
  );

  // Activity participation
  const [activityRows] = await promiseDb.query(
    `SELECT
       s.id            AS scholar_id,
       s.name          AS scholar,
       a.title         AS activity,
       ap.activity_date AS date,
       ap.attended,
       ap.with_photos,
       ap.photos_count
     FROM activity_participation ap
     JOIN scholars s    ON s.id = ap.scholar_id
     JOIN activities a  ON a.id = ap.activity_id
     ${clause.replace('created_at', 'ap.activity_date')}
     ORDER BY ap.activity_date DESC, s.name`,
    values
  );

  return {
    duty_attendance: dutyRows,
    submissions:     submissionRows,
    requirements:    reqRows,
    activities:      activityRows,
  };
};

// ─── DONOR REPORT ─────────────────────────────────────────────────────────────
// Summary per scholar — for donor transparency / progress report
const getDonorReport = async (filters) => {
  const { clause, values } = buildWhere(filters);

  const [rows] = await promiseDb.query(
    `SELECT
       s.id                                        AS scholar_id,
       s.name                                      AS scholar,
       s.course,
       s.year_level,
       s.gpa,
       COUNT(DISTINCT sub.id)                      AS reports_submitted,
       SUM(CASE WHEN sub.status = 'Verified'
                THEN 1 ELSE 0 END)                 AS reports_verified,
       COUNT(DISTINCT r.id)                        AS requirements_submitted,
       SUM(CASE WHEN r.status = 'Verified'
                THEN 1 ELSE 0 END)                 AS requirements_verified,
       SUM(COALESCE(da.hours_rendered, 0))         AS total_duty_hours,
       COUNT(DISTINCT CASE WHEN ap.attended = 1
                           THEN ap.id END)         AS activities_attended,
       COUNT(DISTINCT CASE WHEN ap.with_photos = 1
                           THEN ap.id END)         AS activities_with_photos
     FROM scholars s
     LEFT JOIN submissions sub         ON sub.scholar_id = s.id
     LEFT JOIN requirements r          ON r.scholar_id   = s.id
     LEFT JOIN duty_attendance da      ON da.scholar_id  = s.id
     LEFT JOIN activity_participation ap ON ap.scholar_id = s.id
     ${filters.scholar_id ? 'WHERE s.id = ?' : ''}
     GROUP BY s.id, s.name, s.course, s.year_level, s.gpa
     ORDER BY s.name`,
    filters.scholar_id ? [filters.scholar_id] : []
  );

  return rows;
};

// ─── AUDIT TRAIL REPORT ───────────────────────────────────────────────────────
// Full action log — for auditors / admin
const getAuditReport = async (filters) => {
  const conditions = [];
  const values = [];

  if (filters.scholar_id) {
    conditions.push('al.user_id = ?');
    values.push(filters.scholar_id);
  }
  if (filters.date_from) {
    conditions.push('DATE(al.created_at) >= ?');
    values.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push('DATE(al.created_at) <= ?');
    values.push(filters.date_to);
  }

  const [rows] = await promiseDb.query(
    `SELECT
       al.id,
       al.user_id,
       al.created_at   AS timestamp,
       u.full_name     AS performed_by,
       u.role,
       al.action,
       al.module,
       al.details,
       al.ip_address
      ,al.result
     FROM audit_logs al
     JOIN users u ON u.id = al.user_id
     WHERE u.role IN ('admin', 'officer', 'staff')
       ${conditions.length ? 'AND ' + conditions.join(' AND ') : ''}
     ORDER BY al.created_at DESC
     LIMIT 5000`,
    values
  );

  return rows;
};

module.exports = {
  getComplianceReport,
  getDonorReport,
  getAuditReport,
};