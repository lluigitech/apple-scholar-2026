'use strict';

/**
 * Apple Scholar — HTML email templates (Gmail-safe: tables, inline CSS, no scripts/fonts/remote CSS).
 *
 * Pure module: no DB, no Nodemailer, and it must NOT require notifyHelpers.js (avoids a circular import).
 * Every builder returns an HTML string. Keep the existing plain-text `text` property on each sendMail call.
 *
 * Links are never invented: a button/link is rendered only when the caller passes a valid http(s) URL.
 */

const BRAND_NAME = 'Apple Scholar'; // single place to change the wordmark/footer name
const TAGLINE = 'Learn · Grow · Make a Difference';

const COLORS = {
  primary: '#6D2140',
  deep: '#4A1730',
  rose: '#F9E9EE',
  surface: '#FFFDF9',
  border: '#E7D8C7',
  bronze: '#A9784E',
  text: '#241512',
  muted: '#8A7A68',
  success: '#3F8A55',
  warning: '#C08A3E',
  danger: '#A24A4A',
  white: '#FFFFFF',
  page: '#F7F4EE',
};

const FONT_HEAD = "Georgia, 'Times New Roman', serif";
const FONT_BODY = 'Arial, Helvetica, sans-serif';
const WRAP = 'word-wrap:break-word;overflow-wrap:anywhere;word-break:break-word;';

const TONES = {
  info: { bg: COLORS.rose, border: COLORS.primary, text: COLORS.deep, width: 4 },
  success: { bg: '#EAF4EC', border: COLORS.success, text: '#27573A', width: 4 },
  warning: { bg: '#FBF3E4', border: COLORS.warning, text: '#7A5518', width: 4 },
  urgent: { bg: '#F8E9D0', border: COLORS.warning, text: '#6B4510', width: 6 },
  danger: { bg: '#F6E7E7', border: COLORS.danger, text: '#7A2F2F', width: 4 },
};

// ───────────────────────── helpers ─────────────────────────

const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== '';

const escapeHtml = (value) => String(value === null || value === undefined ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/** Escape first, then convert line breaks. Never interprets HTML. */
const multilineHtml = (value) => escapeHtml(
  String(value === null || value === undefined ? '' : value).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
).replace(/\n/g, '<br>');

/** Returns a normalized http(s) URL string, or null. */
const safeUrl = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /[\s<>"]/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch (err) {
    return null;
  }
};

const toDate = (value) => {
  if (!hasValue(value)) return null;
  const d = value instanceof Date
    ? value
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim()) ? `${String(value).trim()}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDate = (value) => {
  const d = toDate(value);
  if (!d) return hasValue(value) ? String(value) : null;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatTime = (value) => {
  if (!hasValue(value)) return null;
  const raw = String(value).trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return raw;
  const h = Number(m[1]);
  if (h > 23) return raw;
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

const paragraph = (text, extraStyle = '') => `<p style="margin:0 0 16px 0;font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:${COLORS.text};${WRAP}${extraStyle}">${multilineHtml(text)}</p>`;

const greeting = (name) => (hasValue(name) ? `Hello ${String(name).trim()},` : 'Hello,');

/** rows: [{ label, value, multiline? }] — empty values are skipped. */
const detailRows = (rows) => {
  const items = (rows || []).filter((r) => r && hasValue(r.value));
  if (!items.length) return '';
  const body = items.map((r, i) => `
    <tr>
      <td valign="top" width="34%" style="padding:11px 12px 11px 16px;${i ? `border-top:1px solid ${COLORS.border};` : ''}font-family:${FONT_BODY};font-size:11px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.muted};">${escapeHtml(r.label)}</td>
      <td valign="top" style="padding:11px 16px 11px 0;${i ? `border-top:1px solid ${COLORS.border};` : ''}font-family:${FONT_BODY};font-size:14px;line-height:1.5;color:${COLORS.text};${WRAP}">${r.multiline ? multilineHtml(r.value) : escapeHtml(r.value)}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${COLORS.surface}" style="margin:0 0 20px 0;border:1px solid ${COLORS.border};border-radius:10px;">${body}</table>`;
};

const statusPanel = ({ tone = 'info', title, body } = {}) => {
  if (!hasValue(title) && !hasValue(body)) return '';
  const t = TONES[tone] || TONES.info;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;"><tr>
    <td bgcolor="${t.bg}" style="padding:14px 16px;border-left:${t.width}px solid ${t.border};border-radius:0 10px 10px 0;${WRAP}">
      ${hasValue(title) ? `<p style="margin:0 ${hasValue(body) ? '0 4px 0' : '0 0 0'};font-family:${FONT_BODY};font-size:14px;font-weight:bold;color:${t.text};">${escapeHtml(title)}</p>` : ''}
      ${hasValue(body) ? `<p style="margin:0;font-family:${FONT_BODY};font-size:13px;line-height:1.55;color:${t.text};">${multilineHtml(body)}</p>` : ''}
    </td></tr></table>`;
};

/** Bulletproof button (table cell + styled link, not an image). Empty string if URL is invalid. */
const actionButton = (label, url) => {
  const href = safeUrl(url);
  if (!href || !hasValue(label)) return '';
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 8px 0;"><tr>
    <td align="center" bgcolor="${COLORS.primary}" style="border-radius:8px;">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:${FONT_BODY};font-size:15px;font-weight:bold;color:${COLORS.white};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
    </td></tr></table>`;
};

const fallbackLink = (url, lead = 'If the button does not work, copy and paste this link into your browser:') => {
  const href = safeUrl(url);
  if (!href) return '';
  return `<p style="margin:12px 0 0 0;font-family:${FONT_BODY};font-size:12px;line-height:1.6;color:${COLORS.muted};${WRAP}">${escapeHtml(lead)}<br><a href="${escapeHtml(href)}" target="_blank" style="color:${COLORS.primary};text-decoration:underline;">${escapeHtml(href)}</a></p>`;
};

const calendarTile = (date) => {
  const month = date.toLocaleDateString('en-PH', { month: 'short' });
  const day = date.toLocaleDateString('en-PH', { day: 'numeric' });
  const weekday = date.toLocaleDateString('en-PH', { weekday: 'short' });
  return `<table role="presentation" width="72" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${COLORS.border};border-radius:10px;">
    <tr><td align="center" bgcolor="${COLORS.primary}" style="padding:5px 0;border-radius:9px 9px 0 0;font-family:${FONT_BODY};font-size:11px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.white};">${escapeHtml(month)}</td></tr>
    <tr><td align="center" bgcolor="${COLORS.white}" style="padding:6px 0 0 0;font-family:${FONT_HEAD};font-size:28px;font-weight:bold;line-height:1.1;color:${COLORS.deep};">${escapeHtml(day)}</td></tr>
    <tr><td align="center" bgcolor="${COLORS.white}" style="padding:0 0 8px 0;border-radius:0 0 9px 9px;font-family:${FONT_BODY};font-size:11px;color:${COLORS.muted};">${escapeHtml(weekday)}</td></tr>
  </table>`;
};

// ───────────────────────── shared layout ─────────────────────────

/**
 * @param {object} o
 * @param {string} [o.preheader]       hidden inbox preview text (plain text)
 * @param {string} o.title             heading (plain text)
 * @param {string} [o.intro]           intro paragraph (plain text, multiline ok)
 * @param {string} [o.contentHtml]     pre-built, already-escaped HTML
 * @param {string} [o.statusPanelHtml] output of statusPanel()
 * @param {string} [o.accentColor]     thin accent line under the header (defaults to bronze)
 * @param {string} [o.actionLabel]     button label
 * @param {string} [o.actionUrl]       button URL (rendered only if valid http/https)
 * @param {boolean}[o.showFallbackLink=true]
 * @param {string} [o.footerNote]
 */
const renderLayout = ({
  preheader = '', title, intro = '', contentHtml = '', statusPanelHtml = '',
  accentColor = COLORS.bronze, actionLabel = '', actionUrl = '', showFallbackLink = true, footerNote = '',
} = {}) => {
  const button = actionButton(actionLabel, actionUrl);
  const fallback = button && showFallbackLink ? fallbackLink(actionUrl) : '';
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .as-container { width: 100% !important; }
    .as-pad { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body bgcolor="${COLORS.page}" style="margin:0;padding:0;background-color:${COLORS.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${COLORS.page};">${escapeHtml(preheader || title)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${COLORS.page}" style="background-color:${COLORS.page};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" class="as-container" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
    <tr><td bgcolor="${COLORS.primary}" class="as-pad" style="padding:22px 32px;border-radius:14px 14px 0 0;">
      <p style="margin:0;font-family:${FONT_HEAD};font-size:24px;font-weight:bold;color:${COLORS.white};letter-spacing:0.01em;">${escapeHtml(BRAND_NAME)}</p>
      <p style="margin:4px 0 0 0;font-family:${FONT_BODY};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.rose};">${escapeHtml(TAGLINE)}</p>
    </td></tr>
    <tr><td bgcolor="${accentColor}" height="3" style="height:3px;line-height:3px;font-size:3px;">&nbsp;</td></tr>
    <tr><td bgcolor="${COLORS.surface}" class="as-pad" style="padding:30px 32px 26px 32px;border-left:1px solid ${COLORS.border};border-right:1px solid ${COLORS.border};">
      <h1 style="margin:0 0 14px 0;font-family:${FONT_HEAD};font-size:24px;line-height:1.25;font-weight:bold;color:${COLORS.primary};${WRAP}">${escapeHtml(title)}</h1>
      ${hasValue(intro) ? paragraph(intro) : ''}
      ${contentHtml}
      ${statusPanelHtml}
      ${button}
      ${fallback}
    </td></tr>
    <tr><td bgcolor="${COLORS.surface}" class="as-pad" style="padding:16px 32px 20px 32px;border:1px solid ${COLORS.border};border-top:1px solid ${COLORS.border};border-radius:0 0 14px 14px;">
      <p style="margin:0 0 4px 0;font-family:${FONT_BODY};font-size:12px;font-weight:bold;color:${COLORS.deep};">${escapeHtml(BRAND_NAME)} Portal</p>
      <p style="margin:0;font-family:${FONT_BODY};font-size:11px;line-height:1.6;color:${COLORS.muted};">${escapeHtml(footerNote || 'This is an automated notification from the portal.')} &copy; ${year} ${escapeHtml(BRAND_NAME)}.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
};

// ───────────────────────── templates ─────────────────────────

/** A. Duty reminder. `duty` = row from `duties` (title, description, location, duty_date, time_start, time_end). */
const buildDutyReminderEmail = ({ recipientName, duty = {}, actionUrl } = {}) => {
  const date = toDate(duty.duty_date);
  const start = formatTime(duty.time_start);
  const end = formatTime(duty.time_end);
  const timeText = start ? (end ? `${start} – ${end}` : start) : 'To be announced';
  const dateText = formatDate(duty.duty_date) || 'To be announced';

  const summary = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;"><tr>
    ${date ? `<td width="88" valign="top">${calendarTile(date)}</td>` : ''}
    <td valign="middle" style="${date ? 'padding-left:6px;' : ''}${WRAP}">
      <p style="margin:0 0 4px 0;font-family:${FONT_HEAD};font-size:18px;font-weight:bold;color:${COLORS.deep};">${escapeHtml(duty.title || 'Duty assignment')}</p>
      <p style="margin:0;font-family:${FONT_BODY};font-size:13px;color:${COLORS.muted};">${escapeHtml(dateText)} &middot; ${escapeHtml(timeText)}</p>
    </td></tr></table>`;

  return renderLayout({
    preheader: `Duty reminder: ${duty.title || 'new duty'} on ${dateText}`,
    title: 'Duty Reminder',
    intro: `${greeting(recipientName)}\nYou have a duty assigned to you. Here are the details.`,
    contentHtml: summary + detailRows([
      { label: 'Date', value: dateText },
      { label: 'Time', value: timeText },
      { label: 'Location', value: duty.location || 'To be announced' },
      { label: 'Description', value: duty.description, multiline: true },
    ]),
    actionLabel: 'View Duty Details',
    actionUrl,
    footerNote: 'You are receiving this because a duty was assigned to your group.',
  });
};

const buildDutyAbsenceEmail = ({ recipientName, duty = {}, scholars = [], actionUrl } = {}) => {
  const rows = Array.isArray(scholars) ? scholars : [];
  const scholarList = rows.length
    ? `<ul style="margin:0 0 16px 0;padding:0 0 0 22px;font-family:${FONT_BODY};font-size:14px;line-height:1.6;color:${COLORS.text};">${rows.map(scholar =>
      `<li style="padding:2px 0;${WRAP}">${escapeHtml(scholar.full_name || 'Unnamed Scholar')}${hasValue(scholar.scholar_id) ? ` <span style="color:${COLORS.muted};">(${escapeHtml(scholar.scholar_id)})</span>` : ''}</li>`
    ).join('')}</ul>`
    : '';
  const dateText = formatDate(duty.duty_date) || 'To be announced';

  return renderLayout({
    preheader: `${rows.length} scholar${rows.length === 1 ? '' : 's'} missed ${duty.title || 'a duty'}`,
    title: 'Duty Absence Notice',
    intro: `${greeting(recipientName)}\nThe check-in window has closed. The following assigned ${rows.length === 1 ? 'scholar was' : 'scholars were'} recorded absent.`,
    accentColor: COLORS.danger,
    contentHtml: detailRows([
      { label: 'Duty', value: duty.title },
      { label: 'Date', value: dateText },
      { label: 'Time', value: duty.time_start ? `${formatTime(duty.time_start)}${duty.time_end ? ` - ${formatTime(duty.time_end)}` : ''}` : null },
      { label: 'Location', value: duty.location },
    ]) + scholarList,
    statusPanelHtml: statusPanel({
      tone: 'warning',
      title: 'Follow-up needed',
      body: 'Please review the attendance record and arrange a makeup duty if needed.',
    }),
    actionLabel: 'Review Duty',
    actionUrl,
    footerNote: 'This is an internal duty attendance notification.',
  });
};

const buildMakeupDutyAssignmentEmail = ({ recipientName, scholarName, scholarId, duty = {}, recipientRole, actionUrl } = {}) => {
  const dateText = formatDate(duty.duty_date) || 'To be announced';
  const isScholar = recipientRole === 'scholar';
  return renderLayout({
    preheader: `Makeup duty assigned: ${duty.title || 'Duty'}`,
    title: 'Makeup Duty Assigned',
    intro: isScholar
      ? `${greeting(recipientName)}\nYou have been assigned to a makeup duty. Please review the details below.`
      : `${greeting(recipientName)}\nA scholar has been assigned to a makeup duty in your group.`,
    accentColor: COLORS.primary,
    contentHtml: detailRows([
      { label: 'Scholar', value: scholarName },
      { label: 'Scholar ID', value: scholarId },
      { label: 'Duty', value: duty.title },
      { label: 'Date', value: dateText },
      { label: 'Time', value: duty.time_start ? `${formatTime(duty.time_start)}${duty.time_end ? ` - ${formatTime(duty.time_end)}` : ''}` : null },
      { label: 'Location', value: duty.location },
    ]),
    statusPanelHtml: statusPanel({
      tone: 'info',
      title: 'Makeup duty assignment',
      body: isScholar
        ? 'Please attend this duty to make up for the missed duty.'
        : 'Please note this scholar in the attendance list for the selected duty.',
    }),
    actionLabel: isScholar ? 'View My Duties' : 'Review Duty',
    actionUrl,
    footerNote: 'You are receiving this because a makeup duty was assigned.',
  });
};

const buildComplianceThresholdEmail = ({
  recipientName,
  score,
  minimumScore,
  warningScore,
  belowMinimum = false,
  actionUrl,
} = {}) => {
  const scoreText = Number.isFinite(Number(score)) ? `${Number(score).toFixed(2)}%` : '';
  const minimumText = Number.isFinite(Number(minimumScore)) ? `${Number(minimumScore).toFixed(2)}%` : '';
  const warningText = Number.isFinite(Number(warningScore)) ? `${Number(warningScore).toFixed(2)}%` : '';
  return renderLayout({
    preheader: belowMinimum ? 'Your compliance points are below the required minimum' : 'Your compliance points are approaching the required minimum',
    title: belowMinimum ? 'Compliance Points Below Minimum' : 'Compliance Points Warning',
    intro: belowMinimum
      ? `${greeting(recipientName)}\nYour current compliance points are below the minimum required points. Please review your compliance status and take action.`
      : `${greeting(recipientName)}\nYour compliance points are approaching the minimum required points. Please review your compliance status to avoid falling below the minimum.`,
    accentColor: belowMinimum ? COLORS.danger : COLORS.warning,
    contentHtml: detailRows([
      { label: 'Current compliance points', value: scoreText },
      { label: 'Minimum required points', value: minimumText },
      { label: 'Warning level', value: warningText },
    ]),
    statusPanelHtml: statusPanel({
      tone: belowMinimum ? 'danger' : 'warning',
      title: belowMinimum ? 'Action needed' : 'Please review your status',
      body: belowMinimum
        ? 'Your compliance points are below the minimum. Check the compliance breakdown and contact your Officer if you need help.'
        : 'Your compliance points are within five points of the minimum. Check the compliance breakdown and address any outstanding requirements.',
    }),
    actionLabel: 'Review Compliance',
    actionUrl,
    footerNote: 'You are receiving this alert because your compliance points crossed a notification threshold.',
  });
};

/** B. Welcome / new account. Security-sensitive: never log the output. */
const buildWelcomeEmail = ({ fullName, loginId, email, temporaryPassword, setupUrl } = {}) => {
  const passwordBox = hasValue(temporaryPassword)
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;"><tr>
        <td bgcolor="${COLORS.rose}" style="padding:14px 16px;border:1px dashed ${COLORS.primary};border-radius:10px;">
          <p style="margin:0 0 6px 0;font-family:${FONT_BODY};font-size:11px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.muted};">Temporary password</p>
          <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:bold;letter-spacing:0.04em;color:${COLORS.deep};${WRAP}">${escapeHtml(temporaryPassword)}</p>
        </td></tr></table>`
    : '';

  return renderLayout({
    preheader: `Your ${BRAND_NAME} account is ready`,
    title: 'Welcome to the Portal',
    intro: `${greeting(fullName)}\nAn account has been created for you. Use the details below to sign in and finish your account setup.`,
    contentHtml: detailRows([
      { label: 'Login ID', value: loginId },
      { label: 'Email', value: email },
    ]) + passwordBox,
    statusPanelHtml: statusPanel({
      tone: 'warning',
      title: 'Change your password after signing in',
      body: 'For your security, please change this temporary password right after your first login, and do not share it with anyone.',
    }),
    actionLabel: 'Set Up My Account',
    actionUrl: setupUrl,
    footerNote: 'You are receiving this because an account was created for this email address.',
  });
};

/** C. Password reset. Never log the output (contains the reset link). */
const buildPasswordResetEmail = ({ fullName, resetUrl, expiresInMinutes = 15 } = {}) => renderLayout({
  preheader: 'Reset your portal password',
  title: 'Reset Your Password',
  intro: `${greeting(fullName)}\nWe received a request to reset the password for your portal account. Select the button below to choose a new password.`,
  statusPanelHtml: statusPanel({
    tone: 'warning',
    title: `This link expires in ${expiresInMinutes} minutes`,
    body: 'If you did not request a password reset, you can safely ignore this email. Your password will not change.',
  }),
  actionLabel: 'Reset Password',
  actionUrl: resetUrl,
  footerNote: 'For your security, never forward this email.',
});

/** D. Announcement. `meta` = optional [{label, value}] built from real fields (e.g. audience, posted by). */
const buildAnnouncementEmail = ({ title, content, meta = [], actionUrl, maxContentLength = 20000 } = {}) => {
  const raw = hasValue(content) ? String(content) : '';
  const truncated = raw.length > maxContentLength;
  const shown = truncated ? raw.slice(0, maxContentLength) : raw;

  const body = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;"><tr>
    <td bgcolor="${COLORS.white}" style="padding:18px 20px;border:1px solid ${COLORS.border};border-radius:10px;${WRAP}">
      <p style="margin:0 0 10px 0;font-family:${FONT_HEAD};font-size:19px;font-weight:bold;line-height:1.3;color:${COLORS.deep};">${escapeHtml(title || 'Announcement')}</p>
      <p style="margin:0;font-family:${FONT_BODY};font-size:14px;line-height:1.7;color:${COLORS.text};">${multilineHtml(shown) || 'No additional details were provided.'}</p>
      ${truncated ? `<p style="margin:12px 0 0 0;font-family:${FONT_BODY};font-size:12px;color:${COLORS.muted};">This announcement was shortened for email. Please check your dashboard to read the full text.</p>` : ''}
    </td></tr></table>`;

  return renderLayout({
    preheader: `New announcement: ${title || ''}`.trim(),
    title: 'New Announcement',
    intro: 'A new announcement has been posted.',
    contentHtml: detailRows(meta) + body,
    actionLabel: 'View Announcement',
    actionUrl,
    footerNote: 'Please check your dashboard for more details.',
  });
};

/** E. Task deadline reminder. daysLeft: 0 = due today; any other number = due in N days. */
const buildDeadlineReminderEmail = ({ recipientName, taskTitle, taskType, dueDate, daysLeft, actionUrl } = {}) => {
  const dueToday = Number(daysLeft) === 0;
  const dueText = formatDate(dueDate);
  const whenText = dueToday ? 'today' : `in ${Number.isFinite(Number(daysLeft)) ? Number(daysLeft) : 3} days`;
  return renderLayout({
    preheader: `${taskTitle || 'A task'} is due ${whenText}`,
    title: dueToday ? 'Deadline Today' : 'Upcoming Deadline',
    intro: `${greeting(recipientName)}\nYour task is due ${whenText}. Please submit the requirement through your Scholar Portal.`,
    accentColor: COLORS.warning,
    contentHtml: detailRows([
      { label: 'Task', value: taskTitle },
      { label: 'Type', value: taskType },
      { label: 'Deadline', value: dueText },
    ]),
    statusPanelHtml: statusPanel({
      tone: dueToday ? 'urgent' : 'warning',
      title: dueToday ? 'Due today' : `Due in ${Number.isFinite(Number(daysLeft)) ? Number(daysLeft) : 3} days`,
      body: dueText ? `Deadline: ${dueText}` : '',
    }),
    actionLabel: 'Open Scholar Portal',
    actionUrl,
  });
};

/**
 * F. Overdue requirement. audience: 'scholar' (second person) or 'staff' (third person about the scholar).
 */
const buildOverdueEmail = ({ audience = 'scholar', recipientName, scholarName, scholarId, taskTitle, dueDate, actionUrl } = {}) => {
  const isScholar = audience !== 'staff';
  const dueText = formatDate(dueDate);
  const who = hasValue(scholarName) ? scholarName : scholarId;
  return renderLayout({
    preheader: `Overdue requirement: ${taskTitle || ''}`.trim(),
    title: 'Overdue Requirement',
    intro: isScholar
      ? `${greeting(recipientName || scholarName)}\nA requirement assigned to you has passed its deadline and has not been completed. Please submit it through your Scholar Portal.`
      : `${greeting(recipientName)}\nThe following scholar has not completed an overdue requirement.`,
    accentColor: COLORS.danger,
    contentHtml: detailRows([
      ...(isScholar ? [] : [{ label: 'Scholar', value: who }, { label: 'Scholar ID', value: hasValue(scholarName) ? scholarId : '' }]),
      { label: 'Requirement', value: taskTitle },
      { label: 'Original deadline', value: dueText },
    ]),
    statusPanelHtml: statusPanel({
      tone: 'danger',
      title: 'Overdue',
      body: dueText ? `The deadline was ${dueText}.` : 'The deadline has passed.',
    }),
    actionLabel: isScholar ? 'Open Scholar Portal' : 'Open Portal',
    actionUrl,
    footerNote: isScholar ? '' : 'This is an internal notification for staff.',
  });
};

/** G. Repeated risk alert (internal). No letter contents or other personal data. */
const buildRepeatedRiskEmail = ({ recipientName, scholarName, scholarId, negativeCount, windowDays = 90, actionUrl } = {}) => {
  const count = hasValue(negativeCount) ? Number(negativeCount) : null;
  return renderLayout({
    preheader: `Repeated risk flag: ${scholarName || scholarId || ''}`.trim(),
    title: 'Repeated Risk Alert',
    intro: `${greeting(recipientName)}\nA scholar has been flagged for repeated negative correspondence and needs follow-up.`,
    accentColor: COLORS.danger,
    contentHtml: detailRows([
      { label: 'Scholar', value: scholarName || scholarId },
      { label: 'Scholar ID', value: hasValue(scholarName) ? scholarId : '' },
      { label: 'Negative flags', value: Number.isFinite(count) ? String(count) : '' },
      { label: 'Period', value: `Last ${windowDays} days` },
    ]),
    statusPanelHtml: statusPanel({
      tone: 'warning',
      title: 'Follow-up needed',
      body: Number.isFinite(count)
        ? `${scholarName || scholarId || 'This scholar'} has ${count} negative correspondence flags in the last ${windowDays} days.`
        : '',
    }),
    actionLabel: 'Review Scholar',
    actionUrl,
    footerNote: 'This is an internal notification for staff. Please handle it confidentially.',
  });
};

/** Consolidated alert sent to staff one day before a task deadline. */
const buildUnsubmittedTaskSummaryEmail = ({ taskTitle, taskType, dueDate, scholars = [], actionUrl } = {}) => {
  const rows = Array.isArray(scholars) ? scholars : [];
  const scholarList = rows.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${COLORS.white}" style="margin:0 0 20px 0;border:1px solid ${COLORS.border};border-radius:10px;">${rows.map((scholar, index) => `
      <tr>
        <td valign="top" width="42" style="padding:11px 8px 11px 16px;${index ? `border-top:1px solid ${COLORS.border};` : ''}font-family:${FONT_BODY};font-size:13px;font-weight:bold;color:${COLORS.bronze};">${index + 1}.</td>
        <td valign="top" style="padding:11px 16px 11px 0;${index ? `border-top:1px solid ${COLORS.border};` : ''}font-family:${FONT_BODY};font-size:14px;line-height:1.5;color:${COLORS.text};${WRAP}">
          <strong>${escapeHtml(scholar.full_name || 'Unnamed Scholar')}</strong>
          ${hasValue(scholar.scholar_id) ? `<br><span style="font-size:12px;color:${COLORS.muted};">${escapeHtml(scholar.scholar_id)}</span>` : ''}
          ${hasValue(scholar.year_level) ? `<br><span style="font-size:12px;color:${COLORS.muted};">${escapeHtml(scholar.year_level)}</span>` : ''}
        </td>
      </tr>`).join('')}</table>`
    : '';

  return renderLayout({
    preheader: `${rows.length} scholar${rows.length === 1 ? '' : 's'} have not submitted "${taskTitle || 'the requirement'}"`,
    title: 'Submission Deadline Tomorrow',
    intro: `The task deadline is tomorrow. The following ${rows.length === 1 ? 'scholar has' : 'scholars have'} not submitted the requirement yet.`,
    accentColor: COLORS.warning,
    contentHtml: detailRows([
      { label: 'Task', value: taskTitle },
      { label: 'Type', value: taskType },
      { label: 'Deadline', value: formatDate(dueDate) },
      { label: 'Not submitted', value: String(rows.length) },
    ]) + scholarList,
    statusPanelHtml: statusPanel({
      tone: 'urgent',
      title: 'Action needed before the task closes',
      body: 'This is one consolidated list. Each scholar who has not submitted is listed below.',
    }),
    actionLabel: 'Review Task',
    actionUrl,
    footerNote: 'This internal notification is sent one day before the task deadline.',
  });
};

/** H. Submission review result. status: 'approved' | 'returned' (anything else renders a neutral update). */
const buildSubmissionReviewEmail = ({ recipientName, submissionTitle, submissionType, status, comment, actionUrl, actionLabel } = {}) => {
  const s = String(status || '').toLowerCase();
  const approved = /approv/.test(s);
  const returned = /return|revis|reject/.test(s);
  const label = approved ? 'Approved' : returned ? 'Returned for Revision' : (hasValue(status) ? String(status) : 'Reviewed');

  const commentBox = hasValue(comment)
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;"><tr>
        <td bgcolor="${COLORS.white}" style="padding:14px 16px;border:1px solid ${COLORS.border};border-radius:10px;${WRAP}">
          <p style="margin:0 0 6px 0;font-family:${FONT_BODY};font-size:11px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.muted};">Officer feedback</p>
          <p style="margin:0;font-family:${FONT_BODY};font-size:14px;line-height:1.65;color:${COLORS.text};">${multilineHtml(comment)}</p>
        </td></tr></table>`
    : '';

  return renderLayout({
    preheader: `${submissionTitle || 'Your submission'}: ${label}`,
    title: approved ? 'Submission Approved' : returned ? 'Revision Requested' : 'Submission Review Update',
    intro: approved
      ? `${greeting(recipientName)}\nYour submission has been reviewed and approved.`
      : returned
        ? `${greeting(recipientName)}\nYour submission has been reviewed and needs a few changes before it can be approved.`
        : `${greeting(recipientName)}\nYour submission has been reviewed.`,
    accentColor: approved ? COLORS.success : returned ? COLORS.warning : COLORS.bronze,
    contentHtml: detailRows([
      { label: 'Submission', value: submissionTitle },
      { label: 'Type', value: submissionType },
      { label: 'Status', value: label },
    ]) + commentBox,
    statusPanelHtml: statusPanel({
      tone: approved ? 'success' : returned ? 'warning' : 'info',
      title: label,
      body: approved ? 'No further action is needed for this submission.' : returned ? 'Please review the feedback above and resubmit.' : '',
    }),
    actionLabel: actionLabel || (returned ? 'Review and Resubmit' : 'View Result'),
    actionUrl,
  });
};

/** Internal report sent to the Admin who created a task after its deadline. */
const buildTaskDeadlineSummaryEmail = ({
  recipientName,
  taskTitle,
  taskType,
  dueDate,
  actionUrl,
} = {}) => {
  return renderLayout({
    preheader: `The deadline has passed for ${taskTitle || 'your task'}`,
    title: 'Task Deadline Has Passed',
    intro: `${greeting(recipientName)}\nThe deadline for this compliance task has passed. You can check now who submitted and who has not.`,
    accentColor: COLORS.primary,
    contentHtml: detailRows([
      { label: 'Task', value: taskTitle },
      { label: 'Type', value: taskType },
      { label: 'Deadline', value: formatDate(dueDate) },
    ]),
    statusPanelHtml: statusPanel({
      tone: 'info',
      title: 'Submission status is ready to review',
      body: 'Open the task to see which scholars submitted and which did not.',
    }),
    actionLabel: 'Review Task',
    actionUrl,
    footerNote: 'This is an internal task summary for the Admin who created the task.',
  });
};

/** I. Gmail configuration test. Delivery success is decided by the real send operation, not this template. */
const buildTestEmail = ({ sentAt = new Date() } = {}) => {
  const when = toDate(sentAt);
  const whenText = when ? when.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Manila' }) : '';
  return renderLayout({
    preheader: 'Gmail configuration test',
    title: 'Gmail Configuration Test',
    intro: `This is a test message generated by the ${BRAND_NAME} Portal to check the configured email service.`,
    contentHtml: detailRows([{ label: 'Generated', value: whenText }]),
    statusPanelHtml: statusPanel({
      tone: 'info',
      title: 'Test message',
      body: 'If you can read this in your inbox, the email service is working. No action is needed.',
    }),
  });
};

module.exports = {
  BRAND_NAME,
  buildDutyReminderEmail,
  buildDutyAbsenceEmail,
  buildMakeupDutyAssignmentEmail,
  buildComplianceThresholdEmail,
  buildWelcomeEmail,
  buildPasswordResetEmail,
  buildAnnouncementEmail,
  buildDeadlineReminderEmail,
  buildOverdueEmail,
  buildRepeatedRiskEmail,
  buildUnsubmittedTaskSummaryEmail,
  buildTaskDeadlineSummaryEmail,
  buildSubmissionReviewEmail,
  buildTestEmail,
  // exported for tests
  escapeHtml,
  multilineHtml,
  safeUrl,
};