export const STAFF_WORK_PREFERENCES_KEY = 'appleScholar.staff.workPrefs.v1';

export const DEFAULT_STAFF_WORK_PREFERENCES = {
  attendanceStatus: 'all',
  pageSize: 10,
  density: 'comfortable',
};

const allowedAttendanceStatuses = new Set(['all', 'present', 'late', 'absent']);
const allowedPageSizes = new Set([10, 20, 50]);
const allowedDensities = new Set(['comfortable', 'compact']);

export const readStaffWorkPreferences = () => {
  const parsed = JSON.parse(localStorage.getItem(STAFF_WORK_PREFERENCES_KEY) || '{}');
  const saved = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  return {
    attendanceStatus: allowedAttendanceStatuses.has(saved.attendanceStatus)
      ? saved.attendanceStatus
      : DEFAULT_STAFF_WORK_PREFERENCES.attendanceStatus,
    pageSize: allowedPageSizes.has(Number(saved.pageSize))
      ? Number(saved.pageSize)
      : DEFAULT_STAFF_WORK_PREFERENCES.pageSize,
    density: allowedDensities.has(saved.density)
      ? saved.density
      : DEFAULT_STAFF_WORK_PREFERENCES.density,
  };
};

export const writeStaffWorkPreferences = preferences => {
  localStorage.setItem(STAFF_WORK_PREFERENCES_KEY, JSON.stringify(preferences));
};
