const db = require('../config/db');

const queryRows = (sql, values = []) => new Promise((resolve, reject) => {
  db.query(sql, values, (error, rows) => {
    if (error) return reject(error);
    resolve(rows);
  });
});

const toCount = (value) => {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Administrator dashboard aggregate returned an invalid count.');
  }
  return count;
};

const aggregateRow = (rows) => {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('Administrator dashboard aggregate returned an unexpected result.');
  }
  return rows[0];
};

exports.getSummary = async (req, res) => {
  const userSummarySql = `
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN role = 'scholar' THEN 1 ELSE 0 END), 0) AS scholars
    FROM users
    WHERE NOT (role = 'scholar' AND COALESCE(status, '') = 'archived')
  `;

  const recentUsersSql = `
    SELECT id, full_name, email, role, created_at
    FROM users
    WHERE NOT (role = 'scholar' AND COALESCE(status, '') = 'archived')
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `;

  const scholarGrowthSql = `
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total
    FROM users
    WHERE role = 'scholar'
      AND COALESCE(status, '') <> 'archived'
      AND created_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    ORDER BY month ASC
  `;

  const announcementSql = `
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active,
      COALESCE(SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END), 0) AS withdrawn
    FROM announcements
  `;

  const taskSql = `
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active,
      COALESCE(SUM(CASE WHEN is_active = 1 AND due_date < CURRENT_DATE() THEN 1 ELSE 0 END), 0) AS overdue
    FROM tasks
  `;

  const dutySql = `
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
      COALESCE(SUM(CASE
        WHEN duty_date > CURRENT_DATE()
          AND COALESCE(LOWER(status), 'upcoming') NOT IN ('cancelled', 'completed')
        THEN 1 ELSE 0
      END), 0) AS upcoming,
      COALESCE(SUM(CASE
        WHEN duty_date = CURRENT_DATE()
          AND COALESCE(LOWER(status), 'upcoming') <> 'cancelled'
        THEN 1 ELSE 0
      END), 0) AS today,
      COALESCE(SUM(CASE
        WHEN duty_date < CURRENT_DATE()
          AND COALESCE(LOWER(status), 'upcoming') <> 'cancelled'
        THEN 1 ELSE 0
      END), 0) AS past,
      (
        SELECT COUNT(*)
        FROM (
          SELECT DISTINCT dga.duty_id, dga.group_id
          FROM duty_group_assignments dga
          INNER JOIN duties assigned_duty ON assigned_duty.id = dga.duty_id
          WHERE COALESCE(LOWER(assigned_duty.status), 'upcoming') <> 'cancelled'
        ) AS distinct_group_assignments
      ) AS assigned_groups,
      (
        SELECT COUNT(*)
        FROM (
          SELECT DISTINCT dga.duty_id, sgm.scholar_id
          FROM duty_group_assignments dga
          INNER JOIN duties assigned_duty ON assigned_duty.id = dga.duty_id
          INNER JOIN scholar_group_members sgm ON sgm.group_id = dga.group_id
          INNER JOIN users u
            ON u.scholar_id = sgm.scholar_id
           AND u.role = 'scholar'
           AND u.status = 'active'
          WHERE COALESCE(LOWER(assigned_duty.status), 'upcoming') <> 'cancelled'
        ) AS distinct_scholar_assignments
      ) AS assigned_scholar_assignments
    FROM duties
  `;

  const submissionSql = `
    SELECT
      COUNT(*) AS total_records,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected,
      COALESCE(SUM(CASE WHEN sentiment_score > 0 THEN 1 ELSE 0 END), 0) AS positive_sentiment,
      COALESCE(SUM(CASE WHEN sentiment_score = 0 THEN 1 ELSE 0 END), 0) AS neutral_sentiment,
      COALESCE(SUM(CASE WHEN sentiment_score < 0 THEN 1 ELSE 0 END), 0) AS negative_sentiment,
      COALESCE(SUM(CASE WHEN sentiment_score IS NULL THEN 1 ELSE 0 END), 0) AS unscored_sentiment
    FROM submissions
  `;

  const activitySql = `
    SELECT al.id, al.action, al.module, al.details, al.result, al.created_at,
           u.full_name AS actor_name
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC, al.id DESC
    LIMIT ?
  `;

  try {
    const [userSummaryRows, recentUsers, scholarGrowth, announcementRows, taskRows, dutyRows, submissionRows, activityRows] = await Promise.all([
      queryRows(userSummarySql),
      queryRows(recentUsersSql, [5]),
      queryRows(scholarGrowthSql),
      queryRows(announcementSql),
      queryRows(taskSql),
      queryRows(dutySql),
      queryRows(submissionSql),
      queryRows(activitySql, [10]),
    ]);
    const users = aggregateRow(userSummaryRows);
    const announcements = aggregateRow(announcementRows);
    const tasks = aggregateRow(taskRows);
    const duties = aggregateRow(dutyRows);
    const submissions = aggregateRow(submissionRows);

    res.json({
      users: {
        total: toCount(users.total),
        scholars: toCount(users.scholars),
      },
      recentUsers,
      scholarGrowth: scholarGrowth.map((row) => ({
        month: row.month,
        total: toCount(row.total),
      })),
      announcements: {
        total: toCount(announcements.total),
        active: toCount(announcements.active),
        withdrawn: toCount(announcements.withdrawn),
      },
      tasks: {
        total: toCount(tasks.total),
        active: toCount(tasks.active),
        overdue: toCount(tasks.overdue),
      },
      duties: {
        total: toCount(duties.total),
        cancelled: toCount(duties.cancelled),
        upcoming: toCount(duties.upcoming),
        today: toCount(duties.today),
        past: toCount(duties.past),
        assignedGroups: toCount(duties.assigned_groups),
        assignedScholarAssignments: toCount(duties.assigned_scholar_assignments),
      },
      submissions: {
        totalRecords: toCount(submissions.total_records),
        approved: toCount(submissions.approved),
        pending: toCount(submissions.pending),
        rejected: toCount(submissions.rejected),
        sentiment: {
          positive: toCount(submissions.positive_sentiment),
          neutral: toCount(submissions.neutral_sentiment),
          negative: toCount(submissions.negative_sentiment),
          unscored: toCount(submissions.unscored_sentiment),
        },
      },
      recentActivity: activityRows,
    });
  } catch (error) {
    console.error('Failed to load administrator dashboard summary:', error);
    res.status(500).json({ error: 'Failed to load administrator dashboard summary.' });
  }
};
