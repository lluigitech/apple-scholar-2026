const db = require('../config/db'); // your mysql2 pool/connection
const promiseDb = db.promise();

const buildMonthPredicate = (column, month) => {
  if (!month) return '';
  return ` AND DATE_FORMAT(${column}, '%Y-%m') = ?`;
};

const monthValue = (month) => (month ? [month] : []);

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
  const gpaConditions = ["verification_status = 'approved'", 'finalized_at IS NOT NULL'];
  const reportConditions = ["submission_type IN ('letter', 'monthly letter', 'monthly_letter')"];
  const dutyConditions = [];
  const values = [];

  if (filters.month) {
    gpaConditions.push("DATE_FORMAT(finalized_at, '%Y-%m') = ?");
    reportConditions.push("DATE_FORMAT(submitted_at, '%Y-%m') = ?");
    dutyConditions.push("DATE_FORMAT(d.duty_date, '%Y-%m') = ?");
    values.push(filters.month, filters.month, filters.month);
  }

  if (filters.date_from) {
    gpaConditions.push('DATE(finalized_at) >= ?');
    reportConditions.push('DATE(submitted_at) >= ?');
    dutyConditions.push('DATE(d.duty_date) >= ?');
    values.push(filters.date_from, filters.date_from, filters.date_from);
  }

  if (filters.date_to) {
    gpaConditions.push('DATE(finalized_at) <= ?');
    reportConditions.push('DATE(submitted_at) <= ?');
    dutyConditions.push('DATE(d.duty_date) <= ?');
    values.push(filters.date_to, filters.date_to, filters.date_to);
  }

  if (filters.scholar_id) values.push(filters.scholar_id);
  if (filters.year_level) values.push(filters.year_level);
  if (filters.date_from) values.push(filters.date_from);
  if (filters.date_to) values.push(filters.date_to);

  const [rows] = await promiseDb.query(
    `SELECT
       u.scholar_id AS scholar_id,
       u.full_name AS scholar,
       u.scholar_id AS student_id,
       u.year_level,
       gpa.gpa AS gpa,
       COALESCE(submission_summary.reports_submitted, 0) AS reports_submitted,
       COALESCE(duty_summary.total_duty_hours, 0) AS total_duty_hours,
       COALESCE(duty_summary.activities_attended, 0) AS activities_attended,
       NULL AS compliance_rate,
       NULL AS photos,
       NULL AS narrative,
       NULL AS milestones
     FROM users u
     LEFT JOIN (
       SELECT scholar_id,
              ROUND(SUM(CASE WHEN units > 0 THEN units * grade ELSE 0 END) / NULLIF(SUM(CASE WHEN units > 0 THEN units ELSE 0 END), 0), 2) AS gpa
       FROM grades
       WHERE ${gpaConditions.join(' AND ')}
       GROUP BY scholar_id
     ) gpa ON gpa.scholar_id = u.scholar_id
     LEFT JOIN (
       SELECT scholar_id, COUNT(*) AS reports_submitted
       FROM submissions
       WHERE ${reportConditions.join(' AND ')}
       GROUP BY scholar_id
     ) submission_summary ON submission_summary.scholar_id = u.scholar_id
     LEFT JOIN (
       SELECT da.scholar_id,
              ROUND(SUM(CASE WHEN da.status = 'present' THEN COALESCE(TIMESTAMPDIFF(MINUTE, d.time_start, d.time_end), 0) / 60 ELSE 0 END), 2) AS total_duty_hours,
              SUM(CASE WHEN da.status = 'present' THEN 1 ELSE 0 END) AS activities_attended
       FROM duty_attendance da
       JOIN duties d ON d.id = da.duty_id
       WHERE ${dutyConditions.length ? dutyConditions.join(' AND ') : '1 = 1'}
       GROUP BY da.scholar_id
     ) duty_summary ON duty_summary.scholar_id = u.scholar_id
     WHERE u.role = 'scholar'
       AND u.status = 'active'
       ${filters.scholar_id ? ' AND u.scholar_id = ?' : ''}
       ${filters.year_level ? ' AND u.year_level = ?' : ''}
       ${filters.date_from ? ' AND DATE(u.created_at) >= ?' : ''}
       ${filters.date_to ? ' AND DATE(u.created_at) <= ?' : ''}
     ORDER BY u.full_name ASC`,
    values
  );

  return rows;
};

const getDonorScholarReport = async ({ scholar_id, month }) => {
  const targetId = String(scholar_id || '').trim();
  if (!targetId) {
    return { narrative: null, photos: [], milestones: [] };
  }

  const [profileRows] = await promiseDb.query(
    `SELECT full_name AS scholar, scholar_id, year_level
     FROM users
     WHERE scholar_id = ? OR id = ?
     LIMIT 1`,
    [targetId, targetId]
  );

  const profile = profileRows[0] || { scholar: 'Scholar', scholar_id: targetId, year_level: null };

  const [gpaRows] = await promiseDb.query(
    `SELECT ROUND(SUM(CASE WHEN units > 0 THEN units * grade ELSE 0 END) / NULLIF(SUM(CASE WHEN units > 0 THEN units ELSE 0 END), 0), 2) AS gpa
     FROM grades
     WHERE scholar_id = ?
       AND verification_status = 'approved'
       AND finalized_at IS NOT NULL
       ${month ? "AND DATE_FORMAT(finalized_at, '%Y-%m') = ?" : ''}`,
    month ? [targetId, month] : [targetId]
  );

  const [reportRows] = await promiseDb.query(
    `SELECT id, submission_type, submitted_at, status, letter_content
     FROM submissions
     WHERE scholar_id = ?
       ${month ? "AND DATE_FORMAT(submitted_at, '%Y-%m') = ?" : ''}
     ORDER BY submitted_at DESC`,
    month ? [targetId, month] : [targetId]
  );

  const [photoRows] = await promiseDb.query(
    `SELECT sm.file_path AS url,
            sm.description AS caption,
            sm.approved_at,
            sm.approved_for_donor
     FROM submission_media sm
     JOIN submissions s ON s.id = sm.submission_id
     WHERE s.scholar_id = ?
       AND sm.approved_for_donor = 1
       ${month ? "AND DATE_FORMAT(s.submitted_at, '%Y-%m') = ?" : ''}
     ORDER BY sm.approved_at DESC, sm.id DESC`,
    month ? [targetId, month] : [targetId]
  );

  const latestLetter = reportRows.find((row) => row.submission_type === 'letter' || row.submission_type === 'monthly letter' || row.submission_type === 'monthly_letter');
  const letterText = latestLetter?.letter_content && String(latestLetter.letter_content).trim()
    ? latestLetter.letter_content.trim()
    : '';

  const gpa = gpaRows[0]?.gpa != null ? Number(gpaRows[0].gpa) : null;
  const reportsSubmitted = reportRows.length;
  const dutyHours = await promiseDb.query(
    `SELECT ROUND(SUM(CASE WHEN da.status = 'present' THEN COALESCE(TIMESTAMPDIFF(MINUTE, d.time_start, d.time_end), 0) / 60 ELSE 0 END), 2) AS total_duty_hours,
            SUM(CASE WHEN da.status = 'present' THEN 1 ELSE 0 END) AS activities_attended
     FROM duty_attendance da
     JOIN duties d ON d.id = da.duty_id
     WHERE da.scholar_id = ?
       ${month ? "AND DATE_FORMAT(d.duty_date, '%Y-%m') = ?" : ''}`,
    month ? [targetId, month] : [targetId]
  );

  const totalDutyHours = dutyHours[0][0]?.total_duty_hours != null ? Number(dutyHours[0][0].total_duty_hours) : null;
  const activitiesAttended = dutyHours[0][0]?.activities_attended != null ? Number(dutyHours[0][0].activities_attended) : null;

  const clauses = [];
  if (gpa !== null) clauses.push(`maintained a GPA of ${Number(gpa).toFixed(2)}`);
  if (reportsSubmitted > 0) clauses.push(`submitted ${reportsSubmitted} progress report${reportsSubmitted === 1 ? '' : 's'}`);
  if (totalDutyHours !== null) clauses.push(`completed ${Number(totalDutyHours).toFixed(1)} community service hour${Number(totalDutyHours) === 1 ? '' : 's'}`);
  if (activitiesAttended !== null) clauses.push(`participated in ${activitiesAttended} program activit${activitiesAttended === 1 ? 'y' : 'ies'}`);

  const narrative = letterText || (clauses.length
    ? `During this period, ${profile.scholar} ${clauses.join(', ')}.`
    : `Progress data for ${profile.scholar} is not yet available for this period.`);

  const milestones = reportRows
    .filter((row) => row.submission_type)
    .slice(0, 6)
    .map((row) => ({
      date: row.submitted_at ? new Date(row.submitted_at).toISOString().slice(0, 10) : null,
      title: String(row.submission_type || 'Submission').replace(/_/g, ' '),
      description: row.letter_content ? String(row.letter_content).replace(/\s+/g, ' ').slice(0, 180) : 'Submission recorded for the reporting period.',
    }));

  return {
    scholar: profile.scholar,
    scholar_id: profile.scholar_id,
    year_level: profile.year_level,
    narrative,
    photos: (photoRows || []).map((row) => ({
      url: row.url || '',
      caption: row.caption || profile.scholar,
      approved_at: row.approved_at,
    })).filter((row) => row.url),
    milestones,
  };
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

const getDonorDutyReport = async (filters) => {
  const conditions = ["u.role = 'scholar'", "u.status = 'active'"];
  const values = [];
  if (filters.month) { conditions.push("DATE_FORMAT(d.duty_date, '%Y-%m') = ?"); values.push(filters.month); }
  if (filters.date_from) { conditions.push('DATE(d.duty_date) >= ?'); values.push(filters.date_from); }
  if (filters.date_to) { conditions.push('DATE(d.duty_date) <= ?'); values.push(filters.date_to); }
  if (filters.scholar_id) { conditions.push('u.scholar_id = ?'); values.push(filters.scholar_id); }
  if (filters.year_level) { conditions.push('u.year_level = ?'); values.push(filters.year_level); }

  const [rows] = await promiseDb.query(
    `SELECT u.full_name AS scholar, u.year_level, d.title AS duty, d.duty_date AS date,
            CONCAT(COALESCE(DATE_FORMAT(d.time_start, '%h:%i %p'), 'time TBD'), ' - ',
                   COALESCE(DATE_FORMAT(d.time_end, '%h:%i %p'), 'time TBD')) AS schedule,
            da.status, ROUND(CASE WHEN da.status = 'present'
              THEN COALESCE(TIMESTAMPDIFF(MINUTE, d.time_start, d.time_end), 0) / 60
              ELSE 0 END, 2) AS hours,
            COALESCE(staff_names.assigned_staff, 'Unassigned') AS assigned_staff
     FROM duty_attendance da
     JOIN users u ON u.scholar_id = da.scholar_id
     JOIN duties d ON d.id = da.duty_id
     LEFT JOIN (
       SELECT dga.duty_id, gm.scholar_id,
              GROUP_CONCAT(DISTINCT staff.full_name ORDER BY staff.full_name SEPARATOR ', ') AS assigned_staff
       FROM duty_group_assignments dga
       JOIN scholar_group_members gm ON gm.group_id = dga.group_id
       LEFT JOIN scholar_groups sg ON sg.id = dga.group_id
       LEFT JOIN users staff ON staff.id = sg.assigned_staff_id AND LOWER(staff.role) = 'staff'
       GROUP BY dga.duty_id, gm.scholar_id
     ) staff_names ON staff_names.duty_id = da.duty_id AND staff_names.scholar_id = da.scholar_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY d.duty_date DESC, u.full_name ASC`,
    values
  );
  return rows;
};

const getDonorComplianceReport = async (filters) => {
  const conditions = ["u.role = 'scholar'", "u.status = 'active'"];
  const values = [];
  if (filters.month) { conditions.push("DATE_FORMAT(s.submitted_at, '%Y-%m') = ?"); values.push(filters.month); }
  if (filters.date_from) { conditions.push('DATE(s.submitted_at) >= ?'); values.push(filters.date_from); }
  if (filters.date_to) { conditions.push('DATE(s.submitted_at) <= ?'); values.push(filters.date_to); }
  if (filters.scholar_id) { conditions.push('u.scholar_id = ?'); values.push(filters.scholar_id); }
  if (filters.year_level) { conditions.push('u.year_level = ?'); values.push(filters.year_level); }

  const [rows] = await promiseDb.query(
    `SELECT u.full_name AS scholar,
            u.year_level,
            CASE
              WHEN LOWER(s.submission_type) IN ('letter', 'monthly letter', 'monthly_letter') THEN 'Monthly Letter'
              WHEN LOWER(s.submission_type) IN ('cor', 'certificate of registration', 'certificate_of_registration') THEN 'COR'
              WHEN LOWER(s.submission_type) IN ('grade', 'grades', 'grade report', 'grade_report') THEN 'Grades'
              ELSE s.submission_type
            END AS requirement,
            s.submitted_at AS submitted_at,
            s.status,
            COALESCE(s.officer_comment, s.staff_comment, '—') AS reviewer_comment
     FROM submissions s
     JOIN users u ON u.scholar_id = s.scholar_id
     WHERE ${conditions.join(' AND ')}
       AND LOWER(s.submission_type) IN ('letter', 'monthly letter', 'monthly_letter', 'cor', 'certificate of registration', 'certificate_of_registration', 'grade', 'grades', 'grade report', 'grade_report')
     ORDER BY s.submitted_at DESC, u.full_name ASC`,
    values
  );
  return rows;
};

module.exports = {
  getComplianceReport,
  getDonorReport,
  getDonorScholarReport,
  getDonorDutyReport,
  getDonorComplianceReport,
  getAuditReport,
};