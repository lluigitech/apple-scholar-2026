import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Bell, CalendarCheck, Check, ChevronRight, ClipboardCheck, Database, Eye, FileText, Globe, GraduationCap, Info, Lock, Mail, MessageSquare, Monitor, RefreshCw,
  RotateCcw, Rows3, Rows4, Save, Send, Settings, ShieldCheck, SlidersHorizontal, StretchHorizontal, User, UserCog, Clock, Calendar, X, KeyRound,
} from 'lucide-react';
import ComplianceManager from './SettingsComponent/ComplianceManager';
import BackupRecovery from './SettingsComponent/BackupRecovery';
import SecurityAuditLogs from './SettingsComponent/SecurityAuditLogs';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

const STORAGE_KEY = 'admin-system-settings';
const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const DEFAULT_SETTINGS = {
  displayName: 'System Administrator',
  email: 'admin@applescholar.org',
  language: 'English (Philippines)',
  timezone: '(GMT+8) Manila, Philippines',
  dateFormat: 'MMMM DD, YYYY',
  tableDensity: 'comfortable',
  emailNotifications: true,
  inAppNotifications: true,
  compactTables: false,
  autoRefresh: true,
  scheduledBackups: true,
  backupIntervalHours: '24',
  backupRetentionCount: '14',
  backupTime: '23:59',
  backupTimezone: 'Asia/Manila',
  backupFullRetention: '4',
  sessionTimeout: '30',
  requireReauth: true,
  securityAlerts: true,
  logAdminActivity: true,
};

const c = { bg: '#F7F4EE', surface: '#FFFDF9', border: '#E7D8C7', primary: '#6D2140', dark: '#4A1730', ink: '#241512', muted: '#8A7A68', success: '#3F8A55' };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };
const display = { fontFamily: "'Playfair Display', Georgia, serif" };

const TABS = [
  ['general', 'General', Settings],
  ['compliance', 'Compliance', ShieldCheck],
  ['backup', 'Backup & Recovery', Database],
  ['security', 'Security Audit', FileText],
];
const DENSITIES = [
  ['comfortable', 'Comfortable', 'Default spacing', Rows3],
  ['compact', 'Compact', 'Tighter spacing', Rows4],
  ['condensed', 'Condensed', 'Minimal spacing', StretchHorizontal],
];
const LANGUAGES = ['English (Philippines)', 'English (US)', 'Filipino'];
const TIMEZONES = ['(GMT+8) Manila, Philippines', '(GMT+0) UTC', '(GMT+9) Tokyo, Japan', '(GMT-5) New York, USA'];
const DATE_FORMATS = [['MMMM DD, YYYY', 'October 28, 2026 (MMMM DD, YYYY)'], ['DD/MM/YYYY', '28/10/2026 (DD/MM/YYYY)'], ['YYYY-MM-DD', '2026-10-28 (YYYY-MM-DD)']];
const TIMEOUTS = [['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 hour'], ['120', '2 hours']];

// Privacy & Data Protection flags are loaded and saved through the admin privacy settings API (GET/PUT /admin/privacy).
const PRIVACY_ITEMS = [
  { key: 'roleBasedAccess', icon: UserCog, title: 'Role-Based Access Control', description: "Restrict scholar information according to the user's assigned role." },
  { key: 'documentProtection', icon: FileText, title: 'Scholar Document Protection', description: 'Limit access to uploaded scholar documents to authorized users.' },
  { key: 'accessLogging', icon: Eye, title: 'Sensitive Data Access Logging', description: 'Record access to protected scholar information for auditing.' },
  { key: 'privacyMonitoring', icon: Bell, title: 'Privacy Monitoring', description: 'Record denied access attempts for review in Security Audit Logs.' },
];

// Informational only — describes the role separation already enforced by the backend. Not editable.
const ACCESS_MODEL = [
  { role: 'ADMIN', icon: ShieldCheck, tint: c.primary, text: 'Full existing administrator access.', excludes: null },
  { role: 'OFFICER', icon: ClipboardCheck, tint: '#A9784E', text: 'Letter checking, review, validation, approval, and related letter workflow only.', excludes: 'Attendance management' },
  { role: 'STAFF', icon: CalendarCheck, tint: c.success, text: 'Attendance viewing, recording, updating, and monitoring only.', excludes: 'Letter checking, evaluation, and validation' },
  { role: 'SCHOLAR', icon: GraduationCap, tint: '#7A6A58', text: 'Own profile, records, submissions, and authorized documents only.', excludes: "Other scholars' information" },
];

const card = { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 18, padding: 20, boxShadow: '0 1px 2px rgba(74,23,48,0.05)', minWidth: 0 };
const inputStyle = { ...body, width: '100%', minHeight: 40, padding: '9px 12px', border: `1px solid ${c.border}`, borderRadius: 11, background: '#fff', color: c.ink, fontSize: '0.82rem', outline: 'none' };

const IconBadge = ({ icon: Icon, size = 38 }) => (
  <div className="flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, borderRadius: 12, background: `${c.primary}10`, color: c.primary }}>
    <Icon size={size * 0.46} />
  </div>
);

const CardHeader = ({ icon, title, subtitle }) => (
  <div className="flex items-start gap-3" style={{ marginBottom: 14 }}>
    <IconBadge icon={icon} />
    <div className="min-w-0">
      <h2 style={{ ...display, fontSize: '1.08rem', fontWeight: 700, color: c.ink, lineHeight: 1.25 }}>{title}</h2>
      <p style={{ ...body, fontSize: '0.75rem', color: c.muted, marginTop: 2 }}>{subtitle}</p>
    </div>
  </div>
);

const Field = ({ label, icon: Icon, children, disabled }) => (
  <label className="block min-w-0" style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: c.ink }}>
    {label}
    <span className="relative block" style={{ marginTop: 6 }}>
      {Icon && <Icon size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: disabled ? c.muted : c.primary, pointerEvents: 'none' }} />}
      {children}
    </span>
  </label>
);

const TextInput = ({ icon, label, value, onChange, type = 'text', disabled, ...rest }) => (
  <Field label={label} icon={icon} disabled={disabled}>
    <input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} {...rest}
      style={{ ...inputStyle, paddingLeft: icon ? 36 : 12, background: disabled ? '#F1ECE3' : '#fff', color: disabled ? c.muted : c.ink }} />
  </Field>
);

const SelectInput = ({ icon, label, value, onChange, options, compact }) => (
  <Field label={label} icon={icon}>
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
      style={{ ...inputStyle, paddingLeft: icon ? 36 : 12, minHeight: compact ? 36 : 40, cursor: 'pointer' }}>
      {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
    </select>
  </Field>
);

const Toggle = ({ checked, onChange, label, disabled = false }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
    style={{ width: 44, height: 24, flexShrink: 0, border: 0, borderRadius: 999, background: checked ? c.primary : '#C9BFB4', padding: 3, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, transition: 'background 150ms ease' }}>
    <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: checked ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 150ms ease' }} />
  </button>
);

const Row = ({ icon, title, description, last, children }) => (
  <div className="flex items-center justify-between gap-3" style={{ padding: '11px 0', borderBottom: last ? 0 : `1px solid ${c.border}` }}>
    <div className="flex items-start gap-3 min-w-0">
      <IconBadge icon={icon} size={32} />
      <div className="min-w-0">
        <p style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: c.ink }}>{title}</p>
        <p style={{ ...body, fontSize: '0.72rem', color: c.muted, marginTop: 2 }}>{description}</p>
      </div>
    </div>
    {children}
  </div>
);

// Privacy row: on small screens the status + toggle drop below the text instead of squeezing it.
const PrivacyRow = ({ icon, title, description, last, children }) => (
  <div
    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
    style={{ padding: '11px 0', borderBottom: last ? 0 : `1px solid ${c.border}` }}
  >
    <div className="flex items-start gap-3 min-w-0">
      <IconBadge icon={icon} size={32} />
      <div className="min-w-0">
        <p style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: c.ink }}>{title}</p>
        <p style={{ ...body, fontSize: '0.72rem', color: c.muted, marginTop: 2 }}>{description}</p>
      </div>
    </div>
    <div className="flex items-center gap-3 flex-shrink-0 pl-11 sm:pl-0">{children}</div>
  </div>
);

const PrivacyStatus = ({ enabled }) => (
  <span
    className="inline-flex items-center gap-1.5 whitespace-nowrap"
    style={{
      ...body, fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, padding: '4px 10px',
      color: enabled ? c.success : c.muted,
      background: enabled ? '#EAF3EB' : '#F1ECE3',
      border: `1px solid ${enabled ? '#CFE5D5' : c.border}`,
    }}
  >
    {enabled && <Check size={12} aria-hidden="true" />}
    {enabled ? 'Enabled' : 'Disabled'}
  </span>
);

const OutlineButton = ({ onClick, children, icon: Icon, full, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className="flex items-center justify-center gap-2"
    style={{ ...body, width: full ? '100%' : 'auto', minHeight: 36, padding: '7px 14px', border: `1px solid ${c.primary}`, borderRadius: 10, background: 'transparent', color: c.primary, fontSize: '0.78rem', fontWeight: 600, cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
    {Icon && <Icon size={14} />}{children}
  </button>
);

const ActionCard = ({ icon, title, text, button, onClick, status, loading }) => (
  <div className="flex flex-col gap-3" style={{ border: `1px solid ${c.border}`, borderRadius: 14, padding: 14, background: '#fff' }}>
    <div className="flex items-start gap-3">
      <IconBadge icon={icon} size={34} />
      <div className="min-w-0">
        <p style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: c.ink }}>{title}</p>
        <p style={{ ...body, fontSize: '0.72rem', color: c.muted, marginTop: 2 }}>{text}</p>
      </div>
    </div>
    <div className="mt-auto">
      <OutlineButton full onClick={onClick} icon={status ? Check : undefined} disabled={loading}>{loading ? 'Working…' : status || button}</OutlineButton>
    </div>
  </div>
);

/* Password confirmation dialog: appears only when the person presses Save or Reset */
const PasswordDialog = ({ title, text, confirmLabel, busy, error, onCancel, onConfirm }) => {
  const [password, setPassword] = useState('');
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(36,21,18,0.45)', zIndex: 60 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="pw-title" className="w-full"
        onSubmit={(e) => { e.preventDefault(); if (password) onConfirm(password); }}
        style={{ maxWidth: 420, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 18, padding: 22, boxShadow: '0 12px 32px rgba(74,23,48,0.2)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <IconBadge icon={Lock} />
            <div className="min-w-0">
              <h2 id="pw-title" style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color: c.ink }}>{title}</h2>
              <p style={{ ...body, fontSize: '0.78rem', color: c.muted, marginTop: 2 }}>{text}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Close" style={{ border: 0, background: 'transparent', color: c.muted, cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ marginTop: 16 }}>
          <TextInput icon={Lock} label="Current password" type="password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus />
        </div>
        {error && <p role="alert" style={{ ...body, color: '#A24A4A', background: '#FBEAE8', border: '1px solid #E8C5C1', borderRadius: 10, padding: '8px 12px', marginTop: 12, fontSize: '0.78rem' }}>{error}</p>}
        <div className="flex justify-end gap-2" style={{ marginTop: 18 }}>
          <button type="button" onClick={onCancel} disabled={busy}
            style={{ ...body, minHeight: 40, padding: '9px 16px', border: `1px solid ${c.border}`, borderRadius: 11, background: c.surface, color: c.primary, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={busy || !password}
            style={{ ...body, minHeight: 40, padding: '9px 18px', border: 0, borderRadius: 11, background: c.primary, color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy || !password ? 0.6 : 1 }}>
            {busy ? 'Confirming…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

/* Change password dialog */
const ChangePasswordDialog = ({ onClose, onChanged }) => {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (form.next.length < 8) return setError('New password must be at least 8 characters.');
    if (form.next === form.current) return setError('New password must be different from your current password.');
    if (form.next !== form.confirm) return setError('New password and confirmation do not match.');
    setBusy(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      // Assumed endpoint: adjust to match your backend route.
      await axios.put(`${API}/admin/settings/password`, { currentPassword: form.current, newPassword: form.next }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onChanged();
      onClose();
    } catch (err) {
      console.error('Failed to change password:', err);
      setError(err.response?.data?.error || 'Unable to change password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const ready = form.current && form.next && form.confirm;
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(36,21,18,0.45)', zIndex: 60 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="cp-title" className="w-full" onSubmit={submit}
        style={{ maxWidth: 440, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 18, padding: 22, boxShadow: '0 12px 32px rgba(74,23,48,0.2)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <IconBadge icon={KeyRound} />
            <div className="min-w-0">
              <h2 id="cp-title" style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color: c.ink }}>Change Password</h2>
              <p style={{ ...body, fontSize: '0.78rem', color: c.muted, marginTop: 2 }}>Use at least 8 characters. You will stay logged in.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ border: 0, background: 'transparent', color: c.muted, cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="grid grid-cols-1 gap-3" style={{ marginTop: 16 }}>
          <TextInput icon={Lock} label="Current password" type="password" value={form.current} onChange={set('current')} autoComplete="current-password" autoFocus />
          <TextInput icon={KeyRound} label="New password" type="password" value={form.next} onChange={set('next')} autoComplete="new-password" />
          <TextInput icon={KeyRound} label="Confirm new password" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
        </div>
        {error && <p role="alert" style={{ ...body, color: '#A24A4A', background: '#FBEAE8', border: '1px solid #E8C5C1', borderRadius: 10, padding: '8px 12px', marginTop: 12, fontSize: '0.78rem' }}>{error}</p>}
        <div className="flex justify-end gap-2" style={{ marginTop: 18 }}>
          <button type="button" onClick={onClose} disabled={busy}
            style={{ ...body, minHeight: 40, padding: '9px 16px', border: `1px solid ${c.border}`, borderRadius: 11, background: c.surface, color: c.primary, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={busy || !ready}
            style={{ ...body, minHeight: 40, padding: '9px 18px', border: 0, borderRadius: 11, background: c.primary, color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy || !ready ? 0.6 : 1 }}>
            {busy ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [initialState] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return {
        settings: {
          ...DEFAULT_SETTINGS,
          ...(stored && typeof stored === 'object' ? stored : {}),
          displayName: localStorage.getItem('name') || DEFAULT_SETTINGS.displayName,
          email: localStorage.getItem('email') || DEFAULT_SETTINGS.email,
        },
        error: '',
      };
    } catch (loadError) {
      console.error('Failed to read saved administrator preferences:', loadError);
      return {
        settings: { ...DEFAULT_SETTINGS },
        error: 'Saved preferences could not be read. Save your settings again to replace them.',
      };
    }
  });
  const [settings, setSettings] = useState(initialState.settings);
  const [savedSettings, setSavedSettings] = useState(initialState.settings);
  const [saved, setSaved] = useState(false);
  const [actionDone, setActionDone] = useState('');
  const [error, setError] = useState(initialState.error);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [confirmKind, setConfirmKind] = useState(null); // 'save' | 'defaults' | null
  const [confirmError, setConfirmError] = useState('');
  const [privacySettings, setPrivacySettings] = useState(null);
  const [savedPrivacySettings, setSavedPrivacySettings] = useState(null);
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyError, setPrivacyError] = useState('');
  const [privacySaved, setPrivacySaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API}/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(({ data }) => {
        if (!mounted) return;
        setSettings((current) => ({ ...current, ...data }));
        setSavedSettings((current) => ({ ...current, ...data }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem('name', data.displayName);
        localStorage.setItem('email', data.email);
        window.dispatchEvent(new Event('admin-settings-updated'));
      }).catch((loadError) => {
        if (!mounted) return;
        console.error('Failed to load administrator profile:', loadError);
        if (loadError.response?.status === 401) {
          setError('Your login session is invalid or expired. Log out, then sign in again.');
        } else if (loadError.response?.status === 403) {
          setError('This account does not have administrator access. Sign in with an administrator account.');
        } else {
          setError(loadError.response?.data?.error || loadError.response?.data?.message || 'Unable to load administrator profile.');
        }
      });
    }
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('token');
    if (!token) {
      setPrivacyError('Sign in with an administrator account to load privacy settings.');
      setPrivacyLoading(false);
      return () => { mounted = false; };
    }
    axios.get(`${API}/admin/privacy`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(({ data }) => {
      if (!mounted) return;
      setPrivacySettings(data);
      setSavedPrivacySettings(data);
      setPrivacyError('');
    }).catch((loadError) => {
      if (!mounted) return;
      console.error('Failed to load privacy settings:', loadError);
      const status = loadError.response?.status;
      setPrivacyError(status === 401
        ? 'Your login session has expired. Sign in again to load privacy settings.'
        : status === 403
          ? 'Only administrators can view privacy settings.'
          : loadError.response?.data?.error || 'Privacy settings are unavailable. Check that the privacy migration has been run.');
    }).finally(() => {
      if (mounted) setPrivacyLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);
  const privacyDirty = useMemo(
    () => JSON.stringify(privacySettings) !== JSON.stringify(savedPrivacySettings),
    [privacySettings, savedPrivacySettings]
  );

  const update = (key, value) => { setSettings((s) => ({ ...s, [key]: value })); setSaved(false); };
  const setDensity = (value) => {
    setSettings((s) => ({ ...s, tableDensity: value, compactTables: value !== 'comfortable' }));
    setSaved(false);
  };
  const setCompact = (on) => {
    setSettings((s) => ({ ...s, compactTables: on, tableDensity: on ? (s.tableDensity === 'comfortable' ? 'compact' : s.tableDensity) : 'comfortable' }));
    setSaved(false);
  };

  const buildPayload = (values, currentPassword) => ({
    displayName: values.displayName,
    email: values.email,
    preferences: {
      language: values.language,
      timezone: values.timezone,
      dateFormat: values.dateFormat,
      tableDensity: values.tableDensity,
      compactTables: values.compactTables,
      emailNotifications: values.emailNotifications,
      inAppNotifications: values.inAppNotifications,
      autoRefresh: values.autoRefresh,
      sessionTimeout: values.sessionTimeout,
      requireReauth: values.requireReauth,
      securityAlerts: values.securityAlerts,
      logAdminActivity: values.logAdminActivity,
    },
    scheduledBackups: values.scheduledBackups,
    backupIntervalHours: values.backupIntervalHours,
    backupRetentionCount: values.backupRetentionCount,
    currentPassword,
  });

  const persist = async (values, currentPassword) => {
    const token = localStorage.getItem('token');
    const { data } = await axios.put(`${API}/admin/settings`, buildPayload(values, currentPassword), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const next = { ...values, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem('name', data.displayName);
    localStorage.setItem('email', data.email);
    setSettings(next);
    setSavedSettings(next);
    window.dispatchEvent(new Event('admin-settings-updated'));
  };

  const savePrivacySettings = async () => {
    if (!privacySettings) return;
    setPrivacySaving(true);
    setPrivacyError('');
    setPrivacySaved(false);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.put(`${API}/admin/privacy`, privacySettings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPrivacySettings(data);
      setSavedPrivacySettings(data);
      setPrivacySaved(true);
      window.setTimeout(() => setPrivacySaved(false), 2500);
    } catch (saveError) {
      console.error('Failed to save privacy settings:', saveError);
      const status = saveError.response?.status;
      setPrivacyError(status === 401
        ? 'Your login session has expired. Sign in again to save privacy settings.'
        : status === 403
          ? 'Only administrators can change privacy settings.'
          : saveError.response?.data?.error || 'Unable to save privacy settings.');
    } finally {
      setPrivacySaving(false);
    }
  };

  const saveSettings = async (password) => {
    await persist(settings, password);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };
  const resetDefaults = async (password) => {
    const defaults = { ...DEFAULT_SETTINGS, displayName: settings.displayName, email: settings.email };
    await persist(defaults, password);
    setActionDone('defaults');
    window.setTimeout(() => setActionDone(''), 3000);
  };

  // Ask for the password only when the person presses Save / Reset Settings
  const requestProtected = (kind) => {
    setError('');
    setConfirmError('');
    if (savedSettings.requireReauth === false) runProtected(kind, '');
    else setConfirmKind(kind);
  };
  const runProtected = async (kind, password) => {
    const inDialog = savedSettings.requireReauth !== false;
    setSaving(true);
    setConfirmError('');
    try {
      if (kind === 'save') await saveSettings(password);
      else await resetDefaults(password);
      setConfirmKind(null);
    } catch (e) {
      console.error(`Protected action failed (${kind}):`, e);
      const message = e.response?.data?.error || 'Unable to complete this. Please try again.';
      if (inDialog) setConfirmError(message); else setError(message);
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => { setSettings(savedSettings); setSaved(false); setError(''); };

  const runAction = (key, action) => async () => {
    setActionLoading(key);
    setActionDone('');
    setError('');
    try {
      await action();
      setActionDone(key);
      window.setTimeout(() => setActionDone(''), 3000);
    } catch (actionError) {
      console.error(`Administrator action failed (${key}):`, actionError);
      setError(actionError.response?.data?.error || actionError.message || 'The action could not be completed.');
    } finally {
      setActionLoading('');
    }
  };

  const clearCache = async () => {
    if (!('caches' in window)) throw new Error('Browser cache clearing is not supported in this browser.');
    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
  };
  const refreshReports = async () => {
    const token = localStorage.getItem('token');
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const [compliance, submissions] = await Promise.all([
      axios.get(`${API}/admin/reports/compliance-summary`, auth),
      axios.get(`${API}/admin/reports/monthly-submissions`, auth),
    ]);
    window.dispatchEvent(new CustomEvent('admin-refresh-reports', {
      detail: { compliance: compliance.data, submissions: submissions.data },
    }));
  };
  const sendTestEmail = async () => {
    const token = localStorage.getItem('token');
    const { data } = await axios.post(`${API}/admin/notifications/test/gmail`, { email: settings.email }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!data?.ok) throw new Error(data?.send?.error || data?.verify?.error || 'The test email was not delivered.');
  };

  const tabButton = (key, label, Icon) => {
    const active = activeTab === key;
    return (
      <button key={key} type="button" onClick={() => setActiveTab(key)} aria-current={active ? 'page' : undefined}
        className="flex items-center justify-center gap-2"
        style={{ ...body, flex: '1 0 auto', minHeight: 40, padding: '9px 18px', border: 0, borderRadius: 11, background: active ? c.primary : 'transparent', color: active ? '#fff' : c.muted, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <Icon size={15} style={{ color: active ? '#fff' : c.primary }} />{label}
      </button>
    );
  };

  const privacySaveDisabled = !privacySettings || privacySaving || !privacyDirty;

  return (
    <div className="px-4 sm:px-6 lg:px-8" style={{ background: c.bg, ...body, minHeight: '100%', overflowX: 'hidden' }}>
      <div className="w-full">
        <AdminPageHeader
          title="System Settings"
          description="Manage administrator preferences, notifications, security, appearance, and system defaults."
          actions={
            <div className="flex items-center gap-3" style={{ background: dirty ? '#F4EFE7' : '#EEF6F0', border: `1px solid ${dirty ? c.border : '#CFE5D5'}`, borderRadius: 14, padding: '10px 16px' }}>
            <div className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: '50%', background: dirty ? c.primary : c.success, color: '#fff' }}>{dirty ? <Settings size={16} /> : <Check size={16} />}</div>
            <div>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, color: dirty ? c.primary : c.success }}>{dirty ? 'Unsaved changes' : saved ? 'Settings saved' : 'All systems configured'}</p>
              <p style={{ fontSize: '0.72rem', color: c.muted }}>{dirty ? 'Press Save Settings to apply them.' : 'Your settings are up to date.'}</p>
              </div>
            </div>
            }
            className="mb-4"
          />
          {error && <p role="alert" style={{ ...body, color: '#A24A4A', background: '#FBEAE8', border: '1px solid #E8C5C1', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: '0.82rem' }}>{error}</p>}

        {/* Tabs */}
        <div role="tablist" className="flex gap-1 overflow-x-auto" style={{ padding: 5, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, marginBottom: 16 }}>
          {TABS.map(([key, label, Icon]) => tabButton(key, label, Icon))}
        </div>

        {activeTab === 'general' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Administrator Profile */}
              <section style={card}>
                <CardHeader icon={User} title="Administrator Profile" subtitle="Update your administrator name and email on your account." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextInput icon={User} label="Display Name" value={settings.displayName} onChange={(v) => update('displayName', v)} />
                  <TextInput icon={Mail} label="Email Address" type="email" value={settings.email} onChange={(v) => update('email', v)} />
                  <TextInput icon={ShieldCheck} label="Role" value="Administrator" onChange={() => {}} disabled readOnly />
                  <SelectInput icon={Globe} label="Language & locale" value={settings.language} onChange={(v) => update('language', v)} options={LANGUAGES} />
                </div>
                <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${c.border}` }}>
                  <div className="flex items-start gap-3 min-w-0">
                    <IconBadge icon={KeyRound} size={32} />
                    <div className="min-w-0">
                      <p style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: c.ink }}>Password</p>
                      <p style={{ ...body, fontSize: '0.72rem', color: passwordChanged ? c.success : c.muted, marginTop: 2 }}>{passwordChanged ? 'Password updated successfully.' : 'Change the password you use to log in.'}</p>
                    </div>
                  </div>
                  <OutlineButton icon={KeyRound} onClick={() => setShowChangePassword(true)}>Change Password</OutlineButton>
                </div>
              </section>

              {/* Appearance & Workspace */}
              <section style={card}>
                <CardHeader icon={Monitor} title="Appearance & Workspace" subtitle="Customize your workspace display and regional preferences." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectInput icon={Clock} label="Timezone" value={settings.timezone} onChange={(v) => update('timezone', v)} options={TIMEZONES} />
                  <SelectInput icon={Calendar} label="Date Format" value={settings.dateFormat} onChange={(v) => update('dateFormat', v)} options={DATE_FORMATS} />
                </div>
                <p style={{ fontSize: '0.74rem', fontWeight: 600, color: c.ink, margin: '14px 0 6px' }}>Table Density</p>
                <div role="radiogroup" aria-label="Table density" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {DENSITIES.map(([key, label, hint, Icon]) => {
                    const on = settings.tableDensity === key;
                    return (
                      <button key={key} type="button" role="radio" aria-checked={on} onClick={() => setDensity(key)}
                        className="flex items-center gap-2 text-left"
                        style={{ padding: '9px 10px', borderRadius: 12, border: `${on ? 2 : 1}px solid ${on ? c.primary : c.border}`, background: on ? `${c.primary}08` : '#fff', cursor: 'pointer' }}>
                        <IconBadge icon={Icon} size={30} />
                        <span className="min-w-0">
                          <span className="block" style={{ fontSize: '0.78rem', fontWeight: 700, color: on ? c.primary : c.ink }}>{label}</span>
                          <span className="block" style={{ fontSize: '0.68rem', color: c.muted }}>{hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" style={{ marginTop: 16 }}>
              {/* System Preferences */}
              <section style={card}>
                <CardHeader icon={SlidersHorizontal} title="System Preferences" subtitle="These preferences control this administrator workspace." />
                <Row icon={Bell} title="Email notifications (Gmail)" description="Receive system alerts in the administrator email inbox."><Toggle label="Email notifications (Gmail)" checked={settings.emailNotifications} onChange={(v) => update('emailNotifications', v)} /></Row>
                <Row icon={MessageSquare} title="Website notifications" description="Show new system alerts on the admin website."><Toggle label="Website notifications" checked={settings.inAppNotifications} onChange={(v) => update('inAppNotifications', v)} /></Row>
                <Row icon={Rows4} title="Compact tables" description="Use tighter spacing in registry and report tables."><Toggle label="Compact tables" checked={settings.compactTables} onChange={setCompact} /></Row>
                <Row icon={RefreshCw} title="Auto-refresh dashboard" description="Automatically refresh dashboard data every 5 minutes." last><Toggle label="Auto-refresh dashboard" checked={settings.autoRefresh} onChange={(v) => update('autoRefresh', v)} /></Row>
              </section>

              {/* Backup Defaults */}
              <section style={card} className="flex flex-col">
                <CardHeader icon={Database} title="Backup Defaults" subtitle="Configure the server-wide daily database and weekly full backup policy." />
                <Row icon={Clock} title="Scheduled backups" description="Enable automatic backup schedule." last><Toggle label="Scheduled backups" checked={settings.scheduledBackups} onChange={(v) => update('scheduledBackups', v)} /></Row>
                <div style={{ marginTop: 10 }}>
                  <TextInput label="Daily database retention (valid backups)" type="number" min="1" max="1000" value={settings.backupRetentionCount} onChange={(v) => update('backupRetentionCount', v)} />
                </div>
                <div className="flex items-start gap-3 mt-auto" style={{ marginTop: 14, background: '#EEF6F0', border: '1px solid #CFE5D5', borderRadius: 12, padding: '10px 12px' }}>
                  <ShieldCheck size={18} style={{ color: c.success, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: '0.76rem', fontWeight: 700, color: c.success }}>Server schedule: {settings.scheduledBackups ? `daily at ${settings.backupTime || '23:59'} ${settings.backupTimezone || 'Asia/Manila'}` : 'paused'}</p>
                    <p style={{ fontSize: '0.7rem', color: c.muted }}>Keep {settings.backupRetentionCount} valid daily backups and {settings.backupFullRetention || 4} weekly full backups. Weekly full backup runs Sunday.</p>
                  </div>
                </div>
              </section>

              {/* Security */}
              <section style={card} className="md:col-span-2 xl:col-span-1">
                <CardHeader icon={ShieldCheck} title="Security" subtitle="Manage session and security preferences for your account." />
                <Row icon={Lock} title="Session timeout" description="Log out after a period of inactivity.">
                  <div style={{ width: 132 }}><SelectInput compact label="Session timeout" value={settings.sessionTimeout} onChange={(v) => update('sessionTimeout', v)} options={TIMEOUTS} /></div>
                </Row>
                <Row icon={Monitor} title="Require re-authentication" description="Ask for your password before saving settings."><Toggle label="Require re-authentication" checked={settings.requireReauth} onChange={(v) => update('requireReauth', v)} /></Row>
                <Row icon={ShieldCheck} title="Show security alerts" description="Display system security notifications."><Toggle label="Show security alerts" checked={settings.securityAlerts} onChange={(v) => update('securityAlerts', v)} /></Row>
                <Row icon={FileText} title="Log admin activities" description="Keep a log of administrator actions." last><Toggle label="Log admin activities" checked={settings.logAdminActivity} onChange={(v) => update('logAdminActivity', v)} /></Row>
              </section>
            </div>

            {/* Privacy & Data Protection */}
            <section style={{ ...card, marginTop: 16 }} aria-labelledby="privacy-protection-title">
              <div className="flex items-start gap-3" style={{ marginBottom: 14 }}>
                <IconBadge icon={ShieldCheck} />
                <div className="min-w-0">
                  <h2 id="privacy-protection-title" style={{ ...display, fontSize: '1.08rem', fontWeight: 700, color: c.ink, lineHeight: 1.25 }}>Privacy &amp; Data Protection</h2>
                  <p style={{ ...body, fontSize: '0.75rem', color: c.muted, marginTop: 2 }}>Control how sensitive scholar information is accessed and protected.</p>
                </div>
              </div>

              {/* Privacy controls */}
              <div>
                {PRIVACY_ITEMS.map((item, index) => (
                  <PrivacyRow key={item.key} icon={item.icon} title={item.title} description={item.description} last={index === PRIVACY_ITEMS.length - 1}>
                    {privacyLoading ? (
                      <span style={{ ...body, fontSize: '0.72rem', color: c.muted }}>Loading…</span>
                    ) : privacySettings ? (
                      <>
                        <PrivacyStatus enabled={Boolean(privacySettings[item.key])} />
                        <Toggle
                          label={item.title}
                          checked={Boolean(privacySettings[item.key])}
                          disabled={privacySaving}
                          onChange={(enabled) => {
                            setPrivacySettings((current) => ({ ...current, [item.key]: enabled }));
                            setPrivacySaved(false);
                          }}
                        />
                      </>
                    ) : (
                      <span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: '#A24A4A' }}>Unavailable</span>
                    )}
                  </PrivacyRow>
                ))}
              </div>
              {privacyError && <p role="alert" style={{ ...body, color: '#A24A4A', background: '#FBEAE8', border: '1px solid #E8C5C1', borderRadius: 10, padding: '9px 12px', marginTop: 12, fontSize: '0.76rem' }}>{privacyError}</p>}

              {/* One shared link to the audit logs, instead of a chevron on every row */}
              <div className="flex" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto"
                  style={{ ...body, minHeight: 36, padding: '7px 14px', border: `1px solid ${c.primary}`, borderRadius: 10, background: 'transparent', color: c.primary, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  <FileText size={14} aria-hidden="true" /> View Security Audit Logs <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>

              {/* Access Model — informational only */}
              <div style={{ marginTop: 16, border: `1px solid ${c.border}`, borderRadius: 14, background: '#fff', padding: 14 }}>
                <h3 style={{ ...display, fontSize: '0.98rem', fontWeight: 700, color: c.ink }}>Access Model</h3>
                <p style={{ ...body, fontSize: '0.74rem', color: c.muted, marginTop: 2 }}>Access to scholar information is limited by role and responsibility.</p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5" style={{ marginTop: 12, listStyle: 'none', padding: 0 }}>
                  {ACCESS_MODEL.map(({ role, icon: RoleIcon, tint, text, excludes }) => (
                    <li key={role} style={{ border: `1px solid ${c.border}`, borderRadius: 12, background: c.surface, padding: '10px 12px', minWidth: 0 }}>
                      <span
                        className="inline-flex items-center gap-1.5"
                        style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', color: tint, background: `${tint}14`, border: `1px solid ${tint}30`, borderRadius: 999, padding: '3px 10px' }}
                      >
                        <RoleIcon size={12} aria-hidden="true" /> {role}
                      </span>
                      <p style={{ ...body, fontSize: '0.75rem', color: c.ink, marginTop: 8, lineHeight: 1.5 }}>{text}</p>
                      {excludes && (
                        <p style={{ ...body, fontSize: '0.7rem', color: c.muted, marginTop: 4, lineHeight: 1.45 }}>
                          <span style={{ fontWeight: 600 }}>Not included:</span> {excludes}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Protected Scholar Information */}
              <div className="flex items-start gap-3" style={{ marginTop: 14, background: `${c.primary}08`, border: `1px solid ${c.primary}1f`, borderRadius: 12, padding: '12px 14px' }}>
                <Info size={17} style={{ color: c.primary, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <div className="min-w-0">
                  <p style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: c.primary }}>Protected Scholar Information</p>
                  <p style={{ ...body, fontSize: '0.74rem', color: c.muted, marginTop: 3, lineHeight: 1.55 }}>
                    Apple Scholar contains personal information, academic records, attendance records, scholarship records, service hours, correspondence, and uploaded documents.
                  </p>
                  <p style={{ ...body, fontSize: '0.74rem', color: c.muted, marginTop: 2, lineHeight: 1.55 }}>
                    Access is restricted according to each user&apos;s assigned role and responsibility.
                  </p>
                </div>
              </div>

              {/* Save privacy settings */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3" style={{ marginTop: 14 }}>
                {privacySaved && <span role="status" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: c.success }}>Privacy settings saved.</span>}
                <button
                  type="button"
                  onClick={savePrivacySettings}
                  disabled={privacySaveDisabled}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto"
                  style={{ minHeight: 40, padding: '9px 18px', border: 0, borderRadius: 11, background: c.primary, color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: privacySaving ? 'wait' : privacySaveDisabled ? 'not-allowed' : 'pointer', opacity: privacySaveDisabled ? 0.55 : 1 }}
                >
                  {privacySaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {privacySaving ? 'Saving…' : 'Save Privacy Settings'}
                </button>
              </div>
            </section>

            {/* Administrator Actions */}
            <section style={{ ...card, marginTop: 16 }}>
              <CardHeader icon={UserCog} title="Administrator Actions" subtitle="Manage system maintenance and configuration actions." />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <ActionCard icon={Database} title="Clear Cache" text="Clear cached files for this site in this browser." button="Clear Cache" status={actionDone === 'cache' ? 'Cache cleared' : ''} loading={actionLoading === 'cache'} onClick={runAction('cache', clearCache)} />
                <ActionCard icon={FileText} title="Refresh Reports" text="Reload the latest compliance and submission report data from the server." button="Refresh Reports" status={actionDone === 'reports' ? 'Reports refreshed' : ''} loading={actionLoading === 'reports'} onClick={runAction('reports', refreshReports)} />
                <ActionCard icon={Send} title="Test Email Notifications" text={`Send a real test email to ${settings.email || 'the configured address'}.`} button="Send Test Email" status={actionDone === 'email' ? 'Test email sent' : ''} loading={actionLoading === 'email'} onClick={runAction('email', sendTestEmail)} />
                <ActionCard icon={RotateCcw} title="Reset to Defaults" text="Restore workspace preferences to defaults. Profile details are kept." button="Reset Settings" status={actionDone === 'defaults' ? 'Defaults restored' : ''} loading={saving && confirmKind === 'defaults'} onClick={() => requestProtected('defaults')} />
              </div>
            </section>

            {/* Action bar */}
            <div className="flex items-center justify-end gap-2 flex-wrap" style={{ marginTop: 16 }}>
              {saved && <span className="flex items-center gap-1" role="status" style={{ fontSize: '0.78rem', fontWeight: 600, color: c.success, marginRight: 6 }}><Check size={15} /> Settings saved.</span>}
              <button type="button" onClick={resetChanges} disabled={!dirty} className="flex items-center gap-2"
                style={{ minHeight: 40, padding: '9px 16px', border: `1px solid ${c.border}`, borderRadius: 11, background: c.surface, color: c.primary, fontSize: '0.8rem', fontWeight: 600, cursor: dirty ? 'pointer' : 'not-allowed', opacity: dirty ? 1 : 0.55 }}>
                <RotateCcw size={14} /> Reset Changes
              </button>
              <button type="button" onClick={() => requestProtected('save')} disabled={saving} className="flex items-center gap-2"
                style={{ minHeight: 40, padding: '9px 18px', border: 0, borderRadius: 11, background: saved ? c.success : c.primary, color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.65 : 1, transition: 'background 150ms ease' }}>
                {saving && confirmKind === null ? <RefreshCw size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />} {saved ? 'Saved' : 'Save Settings'}
              </button>
            </div>
          </>
        )}

        {activeTab === 'compliance' && <ComplianceManager embedded />}
        {activeTab === 'backup' && <BackupRecovery embedded />}
        {activeTab === 'security' && <SecurityAuditLogs embedded />}
      </div>

      {showChangePassword && (
        <ChangePasswordDialog
          onClose={() => setShowChangePassword(false)}
          onChanged={() => { setPasswordChanged(true); window.setTimeout(() => setPasswordChanged(false), 4000); }}
        />
      )}

      {confirmKind && (
        <PasswordDialog
          title={confirmKind === 'save' ? 'Confirm your password' : 'Reset to defaults?'}
          text={confirmKind === 'save' ? 'Enter your current password to save these settings.' : 'Enter your current password to restore workspace defaults.'}
          confirmLabel={confirmKind === 'save' ? 'Confirm & Save' : 'Confirm & Reset'}
          busy={saving}
          error={confirmError}
          onCancel={() => { setConfirmKind(null); setConfirmError(''); }}
          onConfirm={(password) => runProtected(confirmKind, password)}
        />
      )}
    </div>
  );
};

export default AdminSettings;