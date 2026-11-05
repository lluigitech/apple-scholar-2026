export const OFFICER_WORK_PREFERENCES_KEY = 'appleScholar.officer.workPrefs.v1';

export const DEFAULT_OFFICER_WORK_PREFERENCES = {
  reviewStatus: 'all',
  pageSize: 10,
  density: 'comfortable',
};

const allowedReviewStatuses = new Set(['all', 'pending', 'approved', 'returned']);
const allowedPageSizes = new Set([10, 20, 50]);
const allowedPeriods = new Set(['1m', '3m', '6m']);
const allowedDensities = new Set(['comfortable', 'compact']);

export const readOfficerWorkPreferences = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFICER_WORK_PREFERENCES_KEY) || '{}');
    const saved = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    return {
      reviewStatus: allowedReviewStatuses.has(saved.reviewStatus)
        ? saved.reviewStatus
        : DEFAULT_OFFICER_WORK_PREFERENCES.reviewStatus,
      pageSize: allowedPageSizes.has(Number(saved.pageSize))
        ? Number(saved.pageSize)
        : DEFAULT_OFFICER_WORK_PREFERENCES.pageSize,
      density: allowedDensities.has(saved.density)
        ? saved.density
        : DEFAULT_OFFICER_WORK_PREFERENCES.density,
    };
  } catch (error) {
    console.error('Failed to read Officer work preferences:', error);
    return { ...DEFAULT_OFFICER_WORK_PREFERENCES };
  }
};

export const writeOfficerWorkPreferences = preferences => {
  localStorage.setItem(OFFICER_WORK_PREFERENCES_KEY, JSON.stringify(preferences));
};

export const getOfficerDateRange = (period, now = new Date()) => {
  const monthCount = allowedPeriods.has(period) ? Number(period.slice(0, -1)) : 6;
  const start = new Date(now.getFullYear(), now.getMonth() - monthCount + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const toDateString = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return { date_from: toDateString(start), date_to: toDateString(end) };
};
