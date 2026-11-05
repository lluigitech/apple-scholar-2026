import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, IdCard, ShieldCheck, Lock, KeyRound, Bell, CalendarDays, Settings,
  Eye, EyeOff, CheckCircle2, AlertTriangle, Save, Check, Circle, Megaphone, ClipboardList, X,
  QrCode, FileCheck, Undo2, RefreshCw, Activity,
  SlidersHorizontal, Rows3, ListFilter,
} from 'lucide-react';
// TODO: i-adjust ang path na ito kung saan talaga naka-define ang API_BASE at authHeaders sa Staff side.
import { API_BASE, authHeaders } from '../../components/Officer/Reports/ReportsHelpers';
import {
  DEFAULT_STAFF_WORK_PREFERENCES,
  readStaffWorkPreferences,
  writeStaffWorkPreferences,
} from '../../utils/staffWorkPreferences';

/* ───────── CONTRACT (assumed — hindi ko ma-inspect ang project mo; i-verify sa backend) ─────────
 * Relative sa API_BASE, gamit ang authHeaders() (Bearer token). Identity galing sa token sa server.
 * GET  /staff/profile -> { full_name, email, staff_id?, role, status? }
 * PUT  /staff/profile body { full_name, email }  (walang role/status/staff_id)
 * POST /staff/change-password body { current_password, new_password }
 * GET/PUT /staff/settings/notifications -> { announcements, task_assignments, duty_attendance,
 *          submission_updates, makeup_requests, system_updates } (booleans)
 * Kapag 404/405 ang notifications endpoint -> local-only preferences (localStorage).
 * Kapag walang PUT /staff/profile, gawing false ang PROFILE_EDITABLE para read-only.
 */
const PROFILE_PATH = '/staff/profile';
const PASSWORD_PATH = '/staff/change-password';
const NOTIF_PATH = '/staff/settings/notifications';
const VERIFY_PASSWORD_PATH = '/staff/settings/verify-password';
const NOTIF_LOCAL_KEY = 'staff_notification_preferences';
const PROFILE_EDITABLE = true;
const MIN_PASSWORD_LENGTH = 8; // i-match sa actual backend policy

// ── Staff tokens ──
const BG = '#F7F4EE', SURFACE = '#FFFDF9', BORDER = '#E7D8C7', PRIMARY = '#6D2140', DEEP = '#4A1730';
const BRONZE = '#A9784E', SUCCESS = '#6B8F71', WARNING = '#C08A3E', DANGER = '#C0473F', INK = '#241512', MUTED = '#8A7A68';
const BLUSH = '#F3EAE2';
const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'Inter', sans-serif" };
const tile = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: '0 8px 20px -16px rgba(36,21,18,0.35)' };

const NOTIF_EVENTS = [
  { key: 'announcements', label: 'Announcements', note: 'New announcements posted to staff.', icon: Megaphone },
  { key: 'task_assignments', label: 'New Task Assignments', note: 'When a task is assigned to you.', icon: ClipboardList },
  { key: 'duty_attendance', label: 'Duty and Attendance Updates', note: 'Changes to duties and attendance records.', icon: QrCode },
  { key: 'submission_updates', label: 'Submission Updates', note: 'Status changes on scholar submissions.', icon: FileCheck },
  { key: 'makeup_requests', label: 'Compliance or Makeup-Duty Requests', note: 'Requests that need your attention.', icon: Undo2 },
  { key: 'system_updates', label: 'System Updates', note: 'Portal maintenance and feature notices.', icon: Activity },
];
const DEFAULT_NOTIFS = NOTIF_EVENTS.reduce((a, e) => ({ ...a, [e.key]: true }), {});
const loadLocalNotifs = () => {
  try { return { ...DEFAULT_NOTIFS, ...(JSON.parse(localStorage.getItem(NOTIF_LOCAL_KEY)) || {}) }; }
  catch { return DEFAULT_NOTIFS; }
};

const classify = (err) => {
  const status = err?.response?.status;
  const message = err?.response?.data?.message || err?.response?.data?.error || '';
  if (status === 401 || /invalid or expired token|no token provided/i.test(message)) return { kind: 'auth', message: 'Your sign-in session has expired.' };
  if (status === 404 || status === 405) return { kind: 'unsupported', message: 'This feature is not available on the server yet.' };
  return { kind: 'error', message: message || err?.message || 'Something went wrong. Please try again.' };
};

const initialsOf = (name = '') => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

// ── Small UI ──
const inputBase = { ...sans, width: '100%', height: 40, padding: '0 12px 0 36px', border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE, fontSize: '0.84rem', color: INK, outline: 'none' };
const primaryBtn = (disabled) => ({ ...sans, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 });
const ghostBtn = (disabled) => ({ ...sans, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 10, border: `1px solid ${PRIMARY}`, background: SURFACE, color: PRIMARY, fontSize: '0.78rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 });
const linkBtn = { ...sans, fontSize: '0.74rem', fontWeight: 700, color: DANGER, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' };

const IconChip = ({ icon: Icon, size = 32 }) => (
  <span className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: size, height: size, borderRadius: 10, background: BLUSH, color: PRIMARY }}>
    <Icon size={size * 0.5} strokeWidth={1.8} />
  </span>
);

const Card = ({ id, icon: Icon, title, description, children, footer }) => (
  <section id={id} className="flex min-w-0 flex-col" style={{ ...tile, padding: '18px 20px' }}>
    <div className="flex items-start gap-3" style={{ marginBottom: 14 }}>
      <IconChip icon={Icon} size={38} />
      <div style={{ minWidth: 0 }}>
        <h2 style={{ ...serif, fontSize: '1.08rem', fontWeight: 700, color: INK, lineHeight: 1.25 }}>{title}</h2>
        {description && <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{description}</p>}
      </div>
    </div>
    <div className="flex-1">{children}</div>
    {footer && <div className="flex flex-wrap items-center justify-end gap-2.5" style={{ marginTop: 14 }}>{footer}</div>}
  </section>
);

const Label = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} style={{ ...sans, display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#6b5a52', marginBottom: 5 }}>{children}</label>
);

const IconInput = ({ id, icon: Icon, label, readOnly, error, children, ...rest }) => (
  <div style={{ minWidth: 0 }}>
    <Label htmlFor={id}>{label}</Label>
    <div style={{ position: 'relative' }}>
      <Icon size={15} style={{ position: 'absolute', left: 12, top: 12.5, color: MUTED, pointerEvents: 'none' }} />
      {children || (
        <input id={id} className="ss-field" readOnly={readOnly} {...rest}
          style={{ ...inputBase, background: readOnly ? BLUSH : SURFACE, color: readOnly ? '#6b6058' : INK, borderColor: error ? `${DANGER}99` : BORDER, paddingRight: readOnly ? 34 : 12 }}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
      )}
      {readOnly && <Lock size={13} style={{ position: 'absolute', right: 12, top: 13.5, color: MUTED }} aria-label="Read-only" />}
    </div>
    {error && <p id={`${id}-err`} style={{ ...sans, fontSize: '0.7rem', color: DANGER, marginTop: 4 }}>{error}</p>}
  </div>
);

const Banner = ({ tone, children, action }) => {
  const color = tone === 'success' ? SUCCESS : tone === 'warn' ? WARNING : DANGER;
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div role={tone === 'success' ? 'status' : 'alert'} className="flex items-center justify-between gap-3"
      style={{ borderLeft: `3px solid ${color}`, background: `${color}0d`, borderRadius: '0 10px 10px 0', padding: '9px 12px', ...sans, fontSize: '0.78rem', fontWeight: 600, color }}>
      <span className="flex items-center gap-2"><Icon size={14} className="flex-shrink-0" />{children}</span>
      {action}
    </div>
  );
};

const Toggle = ({ checked, onChange, label, disabled }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="ss-btn"
    style={{ width: 42, height: 24, borderRadius: 999, border: 'none', padding: 2, background: checked ? PRIMARY : BORDER, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'background 120ms', flexShrink: 0 }}>
    <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: checked ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 120ms', boxShadow: '0 1px 2px rgba(0,0,0,.25)' }} />
  </button>
);

const skeletons = (n, h) => <div className="space-y-3">{Array.from({ length: n }).map((_, i) => <div key={i} className="animate-pulse" style={{ height: h, borderRadius: 10, background: BLUSH }} />)}</div>;

// ─────────────────────────────────────────────────────────────
const StaffSettings = () => {
  const navigate = useNavigate();
  const [initialWorkPreferences] = useState(() => {
    try {
      return { preferences: readStaffWorkPreferences(), error: '' };
    } catch (error) {
      console.error('Failed to read Staff work preferences:', error);
      return {
        preferences: { ...DEFAULT_STAFF_WORK_PREFERENCES },
        error: 'Saved work preferences could not be loaded from this browser. Check browser storage, then save your preferences again.',
      };
    }
  });

  const [authExpired, setAuthExpired] = useState(false);
  const signInAgain = () => {
    ['token', 'role', 'name', 'email', 'id', 'must_change_password'].forEach(k => localStorage.removeItem(k));
    navigate('/login', { replace: true });
  };

  // ── Profile ──
  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState('loading');
  const [profileMsg, setProfileMsg] = useState('');
  const [draft, setDraft] = useState({ full_name: '', email: '' });

  const loadProfile = useCallback(async () => {
    setProfileState('loading'); setProfileMsg('');
    try {
      const res = await axios.get(`${API_BASE}${PROFILE_PATH}`, authHeaders());
      const data = res.data || {};
      setProfile(data);
      setDraft({ full_name: data.full_name || '', email: data.email || '' });
      setProfileState('ready');
    } catch (e) {
      const c = classify(e);
      if (c.kind === 'auth') setAuthExpired(true);
      setProfileState(c.kind === 'unsupported' ? 'unsupported' : 'error'); setProfileMsg(c.message);
    }
  }, []);

  const profileDirty = !!profile && (draft.full_name !== (profile.full_name || '') || draft.email !== (profile.email || ''));
  const emailValid = /^\S+@\S+\.\S+$/.test(draft.email.trim());
  const profileValid = draft.full_name.trim().length > 0 && emailValid;
  // ── Password change modal ──
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwFeedback, setPwFeedback] = useState(null);

  const checks = useMemo(() => ([
    { label: `At least ${MIN_PASSWORD_LENGTH} characters`, ok: pw.next.length >= MIN_PASSWORD_LENGTH, required: true },
    { label: 'Upper and lowercase letters', ok: /[a-z]/.test(pw.next) && /[A-Z]/.test(pw.next) },
    { label: 'At least one number', ok: /\d/.test(pw.next) },
    { label: 'At least one symbol', ok: /[^A-Za-z0-9]/.test(pw.next) },
  ]), [pw.next]);
  const strength = pw.next ? Math.max(1, checks.filter(c => c.ok).length) : 0;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];

  const pwErrors = {
    next: pw.next && pw.next.length < MIN_PASSWORD_LENGTH ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : pw.next && pw.next === pw.current ? 'New password must differ from the current one.' : '',
    confirm: pw.confirm && pw.confirm !== pw.next ? 'Passwords do not match.' : '',
  };
  const pwReady = !!pw.current && pw.next.length >= MIN_PASSWORD_LENGTH && pw.next === pw.confirm && pw.next !== pw.current;

  const savePassword = async () => {
    if (!pwReady || pwSaving) return;
    setPwSaving(true); setPwFeedback(null);
    try {
      await axios.post(`${API_BASE}${PASSWORD_PATH}`, { current_password: pw.current, new_password: pw.next }, authHeaders());
      setPw({ current: '', next: '', confirm: '' });
      setShowPw({ current: false, next: false, confirm: false });
      setPwOpen(false);
      setPwDone(true);
    } catch (e) {
      const c = classify(e);
      if (c.kind === 'auth') setAuthExpired(true);
      setPwFeedback({ tone: c.kind === 'unsupported' ? 'warn' : 'error', text: c.kind === 'unsupported' ? `${c.message} The change-password endpoint still needs to be added.` : c.message });
    } finally { setPwSaving(false); }
  };

  // ── Notifications ──
  const [notifSaved, setNotifSaved] = useState(null);
  const [notifDraft, setNotifDraft] = useState(null);
  const [notifState, setNotifState] = useState('loading');
  const [notifLocal, setNotifLocal] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [workSaved, setWorkSaved] = useState(initialWorkPreferences.preferences);
  const [workDraft, setWorkDraft] = useState(() => ({ ...initialWorkPreferences.preferences }));
  const [workStorageError, setWorkStorageError] = useState(initialWorkPreferences.error);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const canEdit = PROFILE_EDITABLE;

  const loadNotifs = useCallback(async () => {
    setNotifState('loading'); setNotifMsg('');
    try {
      const res = await axios.get(`${API_BASE}${NOTIF_PATH}`, authHeaders());
      const data = NOTIF_EVENTS.reduce((acc, ev) => ({ ...acc, [ev.key]: !!res.data?.[ev.key] }), {});
      setNotifLocal(false); setNotifSaved(data); setNotifDraft(data); setNotifState('ready');
    } catch (e) {
      const c = classify(e);
      if (c.kind === 'auth') setAuthExpired(true);
      if (c.kind === 'unsupported') { // walang server endpoint -> local UI preferences
        const data = loadLocalNotifs();
        setNotifLocal(true); setNotifSaved(data); setNotifDraft(data); setNotifState('ready');
      } else { setNotifState('error'); setNotifMsg(c.message); }
    }
  }, [setAuthExpired, setNotifDraft, setNotifLocal, setNotifMsg, setNotifSaved, setNotifState]);
  const notifDirty = !!notifSaved && NOTIF_EVENTS.some(ev => notifDraft?.[ev.key] !== notifSaved[ev.key]);

  const workDirty = Object.keys(DEFAULT_STAFF_WORK_PREFERENCES).some(key => workDraft[key] !== workSaved[key]);
  const settingsDirty = (canEdit && profileDirty) || notifDirty || workDirty;

  const saveSettings = async (currentPassword) => {
    if (settingsSaving || !settingsDirty || (profileDirty && !profileValid)) return;
    setSettingsSaving(true);
    setSettingsFeedback(null);

    const profileDraft = { full_name: draft.full_name.trim(), email: draft.email.trim() };
    const notificationDraft = notifDraft ? { ...notifDraft } : null;
    const workPreferencesDraft = { ...workDraft };
    const tasks = [];
    if (canEdit && profileDirty) {
      tasks.push({
        key: 'profile',
        save: () => axios.put(`${API_BASE}${PROFILE_PATH}`, { ...profileDraft, currentPassword }, authHeaders()),
      });
    }
    if (notifDirty && notificationDraft) {
      tasks.push({
        key: 'notifications',
        save: () => notifLocal
          ? Promise.resolve(localStorage.setItem(NOTIF_LOCAL_KEY, JSON.stringify(notificationDraft)))
          : axios.put(`${API_BASE}${NOTIF_PATH}`, { ...notificationDraft, currentPassword }, authHeaders()),
      });
    }
    if (workDirty) {
      tasks.push({
        key: 'work',
        save: () => Promise.resolve(writeStaffWorkPreferences(workPreferencesDraft)),
      });
    }

    try {
      const outcomes = await Promise.all(tasks.map(async task => {
        try {
          return { key: task.key, response: await task.save() };
        } catch (error) {
          return { key: task.key, error };
        }
      }));

      const failures = [];
      outcomes.forEach(outcome => {
        if (outcome.error) {
          const classified = classify(outcome.error);
          if (classified.kind === 'auth') setAuthExpired(true);
          const label = outcome.key === 'profile'
            ? 'Profile'
            : outcome.key === 'work' ? 'Work preferences' : 'Notification preferences';
          failures.push(`${label}: ${classified.message}`);
          return;
        }

        if (outcome.key === 'profile') {
          const next = {
            ...profile,
            ...profileDraft,
            ...(outcome.response.data && typeof outcome.response.data === 'object' ? outcome.response.data : {}),
          };
          setProfile(next);
          setDraft({ full_name: next.full_name || '', email: next.email || '' });
        } else if (outcome.key === 'notifications') {
          setNotifSaved(notificationDraft);
        } else {
          setWorkSaved(workPreferencesDraft);
          setWorkStorageError('');
        }
      });

      if (failures.length) {
        const labelFor = key => ({
          profile: 'Profile',
          notifications: 'Notification preferences',
          work: 'Work preferences',
        }[key]);
        const successful = outcomes.filter(outcome => !outcome.error).map(outcome => labelFor(outcome.key));
        const failureMessage = failures.join(' ');
        setSettingsFeedback({
          tone: 'error',
          text: `${successful.length ? `${successful.join(' and ')} saved. ` : ''}${failureMessage}`,
        });
        setConfirmError(failureMessage);
      } else {
        setSettingsFeedback({
          tone: 'success',
          text: tasks.every(task => task.key === 'work' || (task.key === 'notifications' && notifLocal))
            ? 'Settings saved on this browser.'
            : 'Settings saved.',
        });
      }
      return failures.length === 0;
    } finally {
      setSettingsSaving(false);
    }
  };

  const closeSettingsConfirmation = () => {
    if (confirmBusy) return;
    setConfirmOpen(false);
    setConfirmPassword('');
    setConfirmError('');
  };

  const confirmSettingsSave = async (event) => {
    event.preventDefault();
    if (!confirmPassword || confirmBusy) return;
    setConfirmBusy(true);
    setConfirmError('');
    try {
      await axios.post(`${API_BASE}${VERIFY_PASSWORD_PATH}`, { currentPassword: confirmPassword }, authHeaders());
      const saved = await saveSettings(confirmPassword);
      if (saved) {
        setConfirmOpen(false);
        setConfirmPassword('');
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Unable to verify your current password. Please try again.';
      if (error.response?.status === 401 && /invalid or expired token|no token provided/i.test(message)) setAuthExpired(true);
      setConfirmError(message);
    } finally {
      setConfirmBusy(false);
    }
  };

  useEffect(() => {
    if (!confirmOpen && !pwOpen) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape' && !confirmBusy && !pwSaving) {
        setConfirmOpen(false);
        setConfirmPassword('');
        setConfirmError('');
        setPwOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmOpen, pwOpen, confirmBusy, pwSaving]);

  const closePasswordModal = () => {
    if (pwSaving) return;
    setPwOpen(false);
    setPw({ current: '', next: '', confirm: '' });
    setShowPw({ current: false, next: false, confirm: false });
    setPwFeedback(null);
  };

  useEffect(() => { loadProfile(); loadNotifs(); }, [loadProfile, loadNotifs]);

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const pwInput = (k, id, label, autoComplete, error) => (
    <IconInput id={id} icon={Lock} label={label} error={error}>
      <input id={id} className="ss-field" type={showPw[k] ? 'text' : 'password'} autoComplete={autoComplete} value={pw[k]}
        onChange={e => { setPw(p => ({ ...p, [k]: e.target.value })); setPwFeedback(null); }}
        style={{ ...inputBase, paddingRight: 40, borderColor: error ? `${DANGER}99` : BORDER }} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
      <button type="button" className="ss-btn" onClick={() => setShowPw(s => ({ ...s, [k]: !s[k] }))} aria-label={showPw[k] ? `Hide ${label}` : `Show ${label}`}
        style={{ position: 'absolute', right: 6, top: 0, height: 40, width: 32, background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
        {showPw[k] ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </IconInput>
  );

  const unsupported = (msg, what) => <Banner tone="warn">{msg} The {what} endpoint still needs to be added.</Banner>;

  return (
    <div className="min-h-screen" style={{ background: BG, ...sans }}>
      <style>{`
        .ss-field:focus { border-color: ${BRONZE} !important; box-shadow: 0 0 0 3px rgba(169,120,78,.15); }
        .ss-btn:focus-visible { outline: 2px solid ${BRONZE}; outline-offset: 2px; }
        .ss-nrow { border-top: 1px solid ${BORDER}; }
        .ss-nrow:first-child { border-top: none; }
        @media (min-width: 1024px) { .ss-nrow:nth-child(2) { border-top: none; } }
      `}</style>

      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8" style={{ minWidth: 0 }}>

        {/* ── Header ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <div className="relative overflow-hidden flex items-center gap-4" style={{ ...tile, padding: '22px 24px', background: `linear-gradient(135deg, ${SURFACE} 0%, ${BLUSH} 100%)` }}>
            <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${PRIMARY}, ${BRONZE})` }} />
            <IconChip icon={Settings} size={46} />
            <div style={{ minWidth: 0 }}>
              <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: BRONZE }}>STAFF PORTAL</p>
              <h1 style={{ ...serif, fontSize: '1.75rem', fontWeight: 700, color: PRIMARY, marginTop: 4, lineHeight: 1.2 }}>Settings</h1>
              <p style={{ ...sans, fontSize: '0.84rem', color: MUTED, marginTop: 6, maxWidth: 640 }}>Manage your account, security preferences, and notification settings.</p>
            </div>
          </div>
          <div className="flex items-center gap-3" style={{ ...tile, padding: '16px 24px' }}>
            <span className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, background: `${PRIMARY}10` }}>
              <CalendarDays size={19} style={{ color: PRIMARY }} />
            </span>
            <div>
              <p style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>Today</p>
              <p style={{ ...sans, fontSize: '0.92rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{todayLabel}</p>
            </div>
          </div>
        </div>

        {authExpired && (
          <Banner tone="error" action={<button onClick={signInAgain} className="ss-btn" style={linkBtn}>Sign in again</button>}>
            Your sign-in session has expired or is invalid.
          </Banner>
        )}

        {pwDone && <Banner tone="success" action={<button onClick={() => setPwDone(false)} className="ss-btn" style={{ ...linkBtn, color: SUCCESS }}>Dismiss</button>}>Password updated.</Banner>}

        {/* ── Account & Profile ── */}
        <div className="grid grid-cols-1 gap-4">
          <Card id="account" icon={User} title="Account & Profile" description={canEdit ? 'Update your name and email.' : 'Your account information.'}
            footer={profileState === 'ready' && canEdit && (
              <button type="button" className="ss-btn" disabled={!profileDirty || settingsSaving} onClick={() => { setDraft({ full_name: profile.full_name || '', email: profile.email || '' }); setSettingsFeedback(null); }} style={ghostBtn(!profileDirty || settingsSaving)}>Cancel</button>
            )}>
            {profileState === 'loading' && skeletons(4, 40)}
            {profileState === 'unsupported' && unsupported(profileMsg, 'profile')}
            {profileState === 'error' && <Banner tone="error" action={<button onClick={loadProfile} className="ss-btn" style={linkBtn}>Retry</button>}>{profileMsg}</Banner>}
            {profileState === 'ready' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: 48, height: 48, borderRadius: '50%', background: PRIMARY, color: '#fff', ...serif, fontWeight: 700, fontSize: '1rem' }}>{initialsOf(profile?.full_name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ ...sans, fontSize: '0.92rem', fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{profile?.full_name || '—'}</p>
                    <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, overflowWrap: 'anywhere' }}>{profile?.email || '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <IconInput id="ss-name" icon={User} label="Full Name" readOnly={!canEdit} disabled={settingsSaving} value={canEdit ? draft.full_name : (profile?.full_name || '—')} onChange={e => { setDraft(d => ({ ...d, full_name: e.target.value })); setSettingsFeedback(null); }} autoComplete="name" error={canEdit && !draft.full_name.trim() ? 'Name is required.' : ''} />
                  <IconInput id="ss-email" icon={Mail} label="Email Address" type="email" readOnly={!canEdit} disabled={settingsSaving} value={canEdit ? draft.email : (profile?.email || '—')} onChange={e => { setDraft(d => ({ ...d, email: e.target.value })); setSettingsFeedback(null); }} autoComplete="email" error={canEdit && draft.email && !emailValid ? 'Enter a valid email address.' : ''} />
                  {profile?.staff_id && <IconInput id="ss-staff-id" icon={IdCard} label="Staff ID" readOnly value={profile.staff_id} />}
                  <IconInput id="ss-role" icon={ShieldCheck} label="Role" readOnly value={profile?.role || '—'} />
                  {profile?.status && <IconInput id="ss-status" icon={CheckCircle2} label="Account Status" readOnly value={profile.status} />}
                </div>
                <div className="flex items-center justify-between gap-3 pt-3.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                    <IconChip icon={KeyRound} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK }}>Password</p>
                      <p style={{ ...sans, fontSize: '0.72rem', color: MUTED }}>Change the password you use to log in.</p>
                    </div>
                  </div>
                  <button type="button" className="ss-btn flex-shrink-0" onClick={() => { setPwOpen(true); setPwFeedback(null); }} style={ghostBtn(false)}><KeyRound size={14} /> Change Password</button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card id="work-preferences" icon={SlidersHorizontal} title="Work Preferences"
          description="Choose the default attendance report view. Saved on this browser."
          footer={(
            <button type="button" className="ss-btn" disabled={!workDirty || settingsSaving}
              onClick={() => { setWorkDraft(workSaved); setSettingsFeedback(null); }}
              style={ghostBtn(!workDirty || settingsSaving)}>Reset to Saved</button>
          )}>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <IconInput id="ss-work-status" icon={ListFilter} label="Default attendance status">
              <select id="ss-work-status" className="ss-field" value={workDraft.attendanceStatus} disabled={settingsSaving}
                onChange={event => { setWorkDraft(draftValue => ({ ...draftValue, attendanceStatus: event.target.value })); setSettingsFeedback(null); }}
                style={{ ...inputBase, cursor: 'pointer' }}>
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </select>
            </IconInput>
            <IconInput id="ss-work-page-size" icon={Rows3} label="Default rows per page">
              <select id="ss-work-page-size" className="ss-field" value={workDraft.pageSize} disabled={settingsSaving}
                onChange={event => { setWorkDraft(draftValue => ({ ...draftValue, pageSize: Number(event.target.value) })); setSettingsFeedback(null); }}
                style={{ ...inputBase, cursor: 'pointer' }}>
                {[10, 20, 50].map(size => <option key={size} value={size}>{size} rows</option>)}
              </select>
            </IconInput>
            <IconInput id="ss-work-density" icon={Rows3} label="Table density">
              <select id="ss-work-density" className="ss-field" value={workDraft.density} disabled={settingsSaving}
                onChange={event => { setWorkDraft(draftValue => ({ ...draftValue, density: event.target.value })); setSettingsFeedback(null); }}
                style={{ ...inputBase, cursor: 'pointer' }}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </IconInput>
          </div>
        </Card>

        {workStorageError && <Banner tone="error">{workStorageError}</Banner>}
        {settingsFeedback && <Banner tone={settingsFeedback.tone}>{settingsFeedback.text}</Banner>}

        {/* ── Row 2: Notification Preferences (full width) ── */}
        <Card id="notifications" icon={Bell} title="Notification Preferences"
          description={notifLocal ? 'Saved on this browser only. These are UI preferences, not email, SMS, or push subscriptions.' : 'Choose which staff events notify you in the portal.'}
          footer={(
            <>
              {notifState === 'ready' && <button type="button" className="ss-btn" disabled={!notifDirty || settingsSaving} onClick={() => { setNotifDraft(notifSaved); setSettingsFeedback(null); }} style={ghostBtn(!notifDirty || settingsSaving)}>Reset to Saved</button>}
              <button type="button" className="ss-btn" disabled={!settingsDirty || (profileDirty && !profileValid) || settingsSaving} onClick={() => { setConfirmOpen(true); setConfirmPassword(''); setConfirmError(''); }} style={primaryBtn(!settingsDirty || (profileDirty && !profileValid) || settingsSaving)}><Save size={14} /> {settingsSaving ? 'Saving…' : 'Save Settings'}</button>
            </>
          )}>
          {notifState === 'loading' && skeletons(4, 48)}
          {notifState === 'error' && <Banner tone="error" action={<button onClick={loadNotifs} className="ss-btn" style={linkBtn}><RefreshCw size={12} style={{ display: 'inline', marginRight: 4 }} />Retry</button>}>{notifMsg}</Banner>}
          {notifState === 'ready' && (
            <div>
              <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2">
                {NOTIF_EVENTS.map(ev => (
                  <div key={ev.key} className="ss-nrow flex items-center gap-3 py-2.5">
                    <IconChip icon={ev.icon} />
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK }}>{ev.label}</p>
                      <p style={{ ...sans, fontSize: '0.72rem', color: MUTED }}>{ev.note}</p>
                    </div>
                    <Toggle checked={!!notifDraft?.[ev.key]} disabled={settingsSaving} label={ev.label} onChange={v => { setNotifDraft(d => ({ ...d, [ev.key]: v })); setSettingsFeedback(null); }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(36,21,18,0.5)' }}
          onMouseDown={event => { if (event.target === event.currentTarget) closeSettingsConfirmation(); }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="ss-confirm-title"
            onSubmit={confirmSettingsSave}
            className="w-full"
            style={{ ...tile, maxWidth: 420, padding: 20, boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <IconChip icon={Lock} size={38} />
                <div>
                  <h2 id="ss-confirm-title" style={{ ...serif, fontSize: '1.08rem', fontWeight: 700, color: INK }}>Confirm your password</h2>
                  <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>Enter your current password to save these settings.</p>
                </div>
              </div>
              <button type="button" onClick={closeSettingsConfirmation} disabled={confirmBusy} aria-label="Close" className="ss-btn" style={{ ...ghostBtn(confirmBusy), padding: 0, width: 34, height: 34, borderColor: BORDER, color: MUTED }}><X size={15} /></button>
            </div>
            <div style={{ marginTop: 16 }}>
              <IconInput id="ss-confirm-current-password" icon={Lock} label="Current Password">
                <input
                  id="ss-confirm-current-password"
                  className="ss-field"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={confirmPassword}
                  onChange={event => { setConfirmPassword(event.target.value); setConfirmError(''); }}
                  style={inputBase}
                />
              </IconInput>
            </div>
            {confirmError && <p role="alert" style={{ ...sans, color: DANGER, background: `${DANGER}12`, border: `1px solid ${DANGER}44`, borderRadius: 10, padding: '8px 12px', marginTop: 12, fontSize: '0.78rem' }}>{confirmError}</p>}
            <div className="flex justify-end gap-2" style={{ marginTop: 18 }}>
              <button type="button" onClick={closeSettingsConfirmation} disabled={confirmBusy} className="ss-btn" style={ghostBtn(confirmBusy)}>Cancel</button>
              <button type="submit" disabled={confirmBusy || !confirmPassword} className="ss-btn" style={primaryBtn(confirmBusy || !confirmPassword)}>
                {confirmBusy ? 'Confirming…' : 'Confirm & Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,21,18,0.5)' }} onClick={closePasswordModal}>
          <div role="dialog" aria-modal="true" aria-labelledby="ss-pw-title" onClick={event => event.stopPropagation()} className="flex w-full flex-col"
            style={{ ...tile, maxWidth: 440, maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)' }}>
            <div className="flex flex-shrink-0 items-start justify-between gap-3" style={{ padding: '18px 20px', borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-start gap-3">
                <IconChip icon={KeyRound} size={38} />
                <div>
                  <h2 id="ss-pw-title" style={{ ...serif, fontSize: '1.08rem', fontWeight: 700, color: INK }}>Change Password</h2>
                  <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>Enter your current password, then choose a new one.</p>
                </div>
              </div>
              <button type="button" onClick={closePasswordModal} disabled={pwSaving} aria-label="Close" className="ss-btn" style={{ ...ghostBtn(pwSaving), padding: 0, width: 36, height: 36, borderColor: BORDER, color: MUTED }}><X size={15} /></button>
            </div>
            <div className="flex flex-col gap-3.5 overflow-y-auto" style={{ padding: 20 }}>
              {pwInput('current', 'ss-pw-current', 'Current Password', 'current-password')}
              {pwInput('next', 'ss-pw-new', 'New Password', 'new-password', pwErrors.next)}
              {pw.next && (
                <div aria-live="polite">
                  <div className="flex items-center gap-1.5" aria-hidden>
                    {[1, 2, 3, 4].map(i => <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i <= strength ? BRONZE : BORDER, transition: 'background 120ms' }} />)}
                  </div>
                  <p style={{ ...sans, fontSize: '0.7rem', color: MUTED, marginTop: 4 }}>Password strength: <strong style={{ color: BRONZE }}>{strengthLabel}</strong></p>
                </div>
              )}
              {pwInput('confirm', 'ss-pw-confirm', 'Confirm New Password', 'new-password', pwErrors.confirm)}
              <div style={{ background: BLUSH, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: DEEP, marginBottom: 6 }}>Password requirements</p>
                <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {checks.map(check => (
                    <li key={check.label} className="flex items-center gap-1.5" style={{ ...sans, fontSize: '0.72rem', color: check.ok ? SUCCESS : MUTED }}>
                      {check.ok ? <Check size={13} /> : <Circle size={11} />}
                      <span>{check.label}{check.required ? '' : ' (recommended)'}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {pwFeedback && <Banner tone={pwFeedback.tone}>{pwFeedback.text}</Banner>}
            </div>
            <div className="flex flex-shrink-0 justify-end gap-2.5" style={{ padding: '14px 20px', borderTop: `1px solid ${BORDER}` }}>
              <button type="button" className="ss-btn" onClick={closePasswordModal} disabled={pwSaving} style={ghostBtn(pwSaving)}>Cancel</button>
              <button type="button" className="ss-btn" onClick={savePassword} disabled={!pwReady || pwSaving} style={primaryBtn(!pwReady || pwSaving)}>{pwSaving ? 'Updating…' : 'Update Password'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffSettings;