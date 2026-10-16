const db = require('../config/db');

const normalizeYearLevel = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const aliases = {
    grade7: 'grade_7', 'grade 7': 'grade_7',
    grade8: 'grade_8', 'grade 8': 'grade_8',
    grade9: 'grade_9', 'grade 9': 'grade_9',
    grade10: 'grade_10', 'grade 10': 'grade_10',
    grade11: 'grade_11', 'grade 11': 'grade_11',
    grade12: 'grade_12', 'grade 12': 'grade_12',
    '1st year': 'college_1', '1st year college': 'college_1', 'college 1': 'college_1',
    '2nd year': 'college_2', '2nd year college': 'college_2', 'college 2': 'college_2',
    '3rd year': 'college_3', '3rd year college': 'college_3', 'college 3': 'college_3',
    '4th year': 'college_4', '4th year college': 'college_4', 'college 4': 'college_4',
    '5th year': 'college_5', '5th year college': 'college_5', 'college 5': 'college_5',
  };
  return aliases[normalized] || normalized.replace(/\s+/g, '_');
};

const yearLevelSqlExpression = (column) => {
  const value = `LOWER(REPLACE(REPLACE(TRIM(${column}), '_', ' '), '-', ' '))`;
  const aliases = [
    [['grade7', 'grade 7'], 'grade_7'],
    [['grade8', 'grade 8'], 'grade_8'],
    [['grade9', 'grade 9'], 'grade_9'],
    [['grade10', 'grade 10'], 'grade_10'],
    [['grade11', 'grade 11'], 'grade_11'],
    [['grade12', 'grade 12'], 'grade_12'],
    [['1st year', '1st year college', 'college 1'], 'college_1'],
    [['2nd year', '2nd year college', 'college 2'], 'college_2'],
    [['3rd year', '3rd year college', 'college 3'], 'college_3'],
    [['4th year', '4th year college', 'college 4'], 'college_4'],
    [['5th year', '5th year college', 'college 5'], 'college_5'],
  ];
  const cases = aliases.map(([values, canonical]) =>
    `WHEN ${value} IN (${values.map(alias => `'${alias}'`).join(', ')}) THEN '${canonical}'`
  );
  return `CASE ${cases.join(' ')} ELSE REPLACE(${value}, ' ', '_') END`;
};

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

const getAllAssignedYearLevels = () => new Promise((resolve, reject) => {
  db.query(
    'SELECT DISTINCT year_level FROM officer_year_level_assignments ORDER BY year_level',
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

  conditions.push(`${yearLevelSqlExpression(column)} IN (${levels.map(() => '?').join(', ')})`);
  values.push(...levels.map(normalizeYearLevel));
};

module.exports = { getAssignedYearLevels, getAllAssignedYearLevels, applyOfficerYearLevelFilter, normalizeYearLevel, yearLevelSqlExpression };