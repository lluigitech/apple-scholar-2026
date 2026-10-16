const YEAR_LEVEL_LABELS = {
  college_1: '1st Year College',
  college_2: '2nd Year College',
  college_3: '3rd Year College',
  college_4: '4th Year College',
  college_5: '5th Year College',
  grade_7: 'Grade 7',
  grade_8: 'Grade 8',
  grade_9: 'Grade 9',
  grade_10: 'Grade 10',
  grade_11: 'Grade 11',
  grade_12: 'Grade 12',
};

export const formatYearLevelLabel = (value) => {
  if (!value) return '—';
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, '_');
  return YEAR_LEVEL_LABELS[normalized] || value;
};

export default YEAR_LEVEL_LABELS;
