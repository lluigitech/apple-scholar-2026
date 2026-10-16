const SETTINGS_KEY = 'admin-system-settings';

const LOCALES = {
  'English (Philippines)': 'en-PH',
  'English (US)': 'en-US',
  Filipino: 'fil-PH',
};

const TIMEZONES = {
  '(GMT+8) Manila, Philippines': 'Asia/Manila',
  '(GMT+0) UTC': 'UTC',
  '(GMT+9) Tokyo, Japan': 'Asia/Tokyo',
  '(GMT-5) New York, USA': 'America/New_York',
};

export const getAdminPreferences = () => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch (error) {
    console.error('Unable to read administrator preferences:', error);
    return {};
  }
};

export const getAdminLocale = (preferences = getAdminPreferences()) => LOCALES[preferences.language] || 'en-PH';
export const getAdminTimezone = (preferences = getAdminPreferences()) => TIMEZONES[preferences.timezone] || 'Asia/Manila';

export const formatAdminDate = (value, options = {}) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const preferences = getAdminPreferences();
  const locale = getAdminLocale(preferences);
  const timezone = getAdminTimezone(preferences);
  const dateFormat = preferences.dateFormat || 'MMMM DD, YYYY';
  if (dateFormat === 'YYYY-MM-DD') {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  if (dateFormat === 'DD/MM/YYYY') {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
    return `${values.day}/${values.month}/${values.year}`;
  }
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    ...options,
    year: 'numeric',
    month: options.month || 'long',
    day: 'numeric',
  }).format(date);
};

export const formatAdminMonth = (value, options = {}) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(getAdminLocale(), {
    timeZone: getAdminTimezone(),
    month: 'long',
    year: 'numeric',
    ...options,
  }).format(date);
};

export const formatAdminDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const time = new Intl.DateTimeFormat(getAdminLocale(), {
    timeZone: getAdminTimezone(),
    timeStyle: 'short',
  }).format(date);
  return `${formatAdminDate(date)} ${time}`;
};
