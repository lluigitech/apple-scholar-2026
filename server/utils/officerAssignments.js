const db = require('../config/db');

const getAssignedYearLevels = (officerId) => new Promise((resolve, reject) => {
  db.query(
    'SELECT year_level FROM officer_year_level_assignments WHERE officer_id = ?',
    [officerId],
    (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(row => row.year_level));
    }
  );
});

const applyOfficerYearLevelFilter = async (req, conditions, values, column = 'u.year_level') => {
  if (req.user?.role !== 'officer') return;

  const levels = await getAssignedYearLevels(req.user.id);
  if (!levels.length) {
    conditions.push('1 = 0');
    return;
  }

  conditions.push(`${column} IN (${levels.map(() => '?').join(', ')})`);
  values.push(...levels);
};

module.exports = { getAssignedYearLevels, applyOfficerYearLevelFilter };