import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, IdCard, ShieldCheck, Users, Lock, KeyRound, Bell, CalendarDays,
  SlidersHorizontal, ListFilter, Rows3, LineChart, Eye, EyeOff, CheckCircle2, AlertTriangle, Save, X,
  FileCheck, Hourglass, Undo2, Megaphone, AlarmClock, Rows2,
} from 'lucide-react';
import { API_BASE, authHeaders } from '../../components/Officer/Reports/ReportsHelpers';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';

/* ───────── CONTRACT — i-match sa backend (hindi ko ma-inspect ang project mo) ─────────
 * Relative sa API_BASE, gamit ang authHeaders() (Bearer token). Identity ay galing sa token sa server.
 * GET  /officer/profile -> { full_name, email, contact_number?, officer_id?, role, assigned_year_levels?: string[], created_at?, last_login? }
 * PUT  /officer/profile body { full_name, email, contact_number }   (hindi tatanggap ng role/officer_id/assignments)
 * POST /officer/change-password body { current_password, new_password }  (server verifies + hashes)
 * GET/PUT /officer/settings/notifications -> { new_submissions, pending_reviews, deadlines, returned_submissions, announcements } (booleans)
 * Work Preferences: browser-only (localStorage).
 */
const PROFILE_PATH = '/officer/profile';
const PASSWORD_PATH = '/officer/change-password';
const NOTIF_PATH = '/officer/settings/notifications';
const WORK_PREFS_KEY = 'appleScholar.officer.workPrefs.v1';

// ── Officer tokens ──
const MAROON = '#7f2d3a', MAROON_DEEP = '#4f1620', GOLD = '#b98b4e', IVORY = '#FBF7F2', INK = '#241512';
const SAGE = '#6b8f71', CLAY = '#c1666b', AMBER = '#b8863f', PAPER = '#F6EFE4', RULE = '#e8dccb';
const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'DM Sans', sans-serif" };
const tile = { background: '#fff', border: `1px solid ${RULE}`, borderRadius: 14, boxShadow: '0 8px 20px -16px rgba(36,21,18,0.35)' };

const NOTIF_EVENTS = [
  { key: 'new_submissions', label: 'New scholar submissions', note: 'Alert when a scholar submits a record.', icon: FileCheck },
  { key: 'pending_reviews', label: 'Pending reviews', note: 'Reminders for submissions awaiting action.', icon: Hourglass },
  { key: 'deadlines', label: 'Approaching deadlines', note: 'Tasks that are about to be due.', icon: AlarmClock },
  { key: 'returned_submissions', label: 'Returned submissions', note: 'When a returned record is resubmitted.', icon: Undo2 },
  { key: 'announcements', label: 'Important announcements', note: 'Announcements posted for officers.', icon: Megaphone },
];

const DEFAULT_WORK = { reviewStatus: 'all', pageSize: 10, period: '6m', density: 'comfortable' };
const loadWork = () => {
  try { return { ...DEFAULT_WORK, ...(JSON.parse(localStorage.getItem(WORK_PREFS_KEY)) || {}) }; }
  catch { return DEFAULT_WORK; }
};

const classify = (err) => {
  const status = err?.response?.status;
  const message = err?.response?.data?.message || err?.response?.data?.error || '';
  if (status === 401 || /invalid or expired token|no token provided/i.test(message)) return { kind: 'auth', message: 'Your sign-in session has expired.' };
  if (status === 404 || status === 405) return { kind: 'unsupported', message: 'This feature is not available on the server yet.' };
  return { kind: 'error', message: message || err?.message || 'Something went wrong. Please try again.' };
};

const fmtDateTime = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// ── Small UI ──
const inputBase = { ...sans, width: '100%', height: 40, padding: '0 12px 0 36px', border: `1px solid ${RULE}`, borderRadius: 10, background: '#fff', fontSize: '0.84rem', color: INK, outline: 'none' };
const primaryBtn = (disabled) => ({ ...sans, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: MAROON, color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 });
const ghostBtn = (disabled) => ({ ...sans, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 10, border: `1px solid ${MAROON}`, background: '#fff', color: MAROON, fontSize: '0.78rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 });
const linkBtn = { ...sans, fontSize: '0.74rem', fontWeight: 700, color: CLAY, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' };

const IconChip = ({ icon: Icon, size = 32 }) => (
  <span className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: size, height: size, borderRadius: 10, background: PAPER, color: MAROON }}>
    <Icon size={size * 0.5} strokeWidth={1.8} />
  </span>
);

const Card = ({ icon: Icon, title, description, children, className = '', footer }) => (
  <section className={`flex min-w-0 flex-col ${className}`} style={{ ...tile, padding: '18px 20px' }}>
    <div className="flex items-start gap-3" style={{ marginBottom: 14 }}>
      <IconChip icon={Icon} size={38} />
      <div style={{ minWidth: 0 }}>
        <h2 style={{ ...serif, fontSize: '1.08rem', fontWeight: 700, color: INK, lineHeight: 1.25 }}>{title}</h2>
        {description && <p style={{ ...sans, fontSize: '0.74rem', color: '#a89890', marginTop: 2 }}>{description}</p>}
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
      <Icon size={15} style={{ position: 'absolute', left: 12, top: 12.5, color: '#a89890', pointerEvents: 'none' }} />
      {children || (
        <input id={id} className="os-field" readOnly={readOnly} {...rest}
          style={{ ...inputBase, background: readOnly ? PAPER : '#fff', color: readOnly ? '#6b6058' : INK, borderColor: error ? `${CLAY}99` : RULE, paddingRight: readOnly ? 34 : 12 }} aria-invalid={!!error} />
      )}
      {readOnly && <Lock size={13} style={{ position: 'absolute', right: 12, top: 13.5, color: '#a89890' }} aria-label="Read-only" />}
    </div>
    {error && <p style={{ ...sans, fontSize: '0.7rem', color: CLAY, marginTop: 4 }}>{error}</p>}
  </div>
);

const SelectInput = ({ id, icon, label, value, onChange, options }) => (
  <IconInput id={id} icon={icon} label={label}>
    <select id={id} className="os-field" value={value} onChange={onChange} style={{ ...inputBase, cursor: 'pointer' }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </IconInput>
);

const Banner = ({ tone, children, action }) => {
  const color = tone === 'success' ? SAGE : tone === 'warn' ? AMBER : CLAY;
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
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
    style={{ width: 42, height: 24, borderRadius: 999, border: 'none', padding: 2, background: checked ? MAROON : RULE, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'background 120ms', flexShrink: 0 }}>
    <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: checked ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 120ms', boxShadow: '0 1px 2px rgba(0,0,0,.25)' }} />
  </button>
);

const skeletons = (n, h) => <div className="space-y-3">{Array.from({ length: n }).map((_, i) => <div key={i} className="animate-pulse" style={{ height: h, borderRadius: 10, background: PAPER }} />)}</div>;

// ─────────────────────────────────────────────────────────────
const OfficerSettings = () => {
  const navigate = useNavigate();

  const [authExpired, setAuthExpired] = useState(false);
  const signInAgain = () => {
    ['token', 'role', 'name', 'email', 'id', 'scholar_id', 'must_change_password'].forEach(k => localStorage.removeItem(k));
    navigate('/login', { replace: true });
  };

  // ── Profile ──
  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState('loading');
  const [profileMsg, setProfileMsg] = useState('');
  const [draft, setDraft] = useState({ full_name: '', email: '', contact_number: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);

  const loadProfile = useCallback(async () => {
    setProfileState('loading'); setProfileMsg('');
    try {
      const res = await axios.get(`${API_BASE}${PROFILE_PATH}`, authHeaders());
      const data = res.data || {};
      setProfile(data);
      setDraft({ full_name: data.full_name || '', email: data.email || '', contact_number: data.contact_number || '' });
      setProfileState('ready');
    } catch (e) {
      const c = classify(e);
      if (c.kind === 'auth') setAuthExpired(true);
      setProfileState(c.kind === 'unsupported' ? 'unsupported' : 'error'); setProfileMsg(c.message);
    }
  }, []);

  const profileDirty = !!profile && (draft.full_name !== (profile.full_name || '') || draft.email !== (profile.email || '') || draft.contact_number !== (profile.contact_number || ''));
  const emailValid = /^\S+@\S+\.\S+$/.test(draft.email.trim());
  const profileValid = draft.full_name.trim().length > 0 && emailValid;

  const saveProfile = async () => {
    if (!profileDirty || !profileValid || profileSaving) return;
    setProfileSaving(true); setProfileFeedback(null);
    try {
      const body = { full_name: draft.full_name.trim(), email: draft.email.trim(), contact_number: draft.contact_number.trim() };
      const res = await axios.put(`${API_BASE}${PROFILE_PATH}`, body, authHeaders());
      const next = { ...profile, ...body, ...(res.data && typeof res.data === 'object' ? res.data : {}) };
      setProfile(next);
      setDraft({ full_name: next.full_name || '', email: next.email || '', contact_number: next.contact_number || '' });
      setProfileFeedback({ tone: 'success', text: 'Profile updated.' });
    } catch (e) {
      const c = classify(e);
      if (c.kind === 'auth') setAuthExpired(true);
      setProfileFeedback({ tone: 'error', text: c.message });
    } finally { setProfileSaving(false); }
  };

  // ── Password (modal) ──
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwFeedback, setPwFeedback] = useState(null);
  const [pwDone, setPwDone] = useState(false);
  const pwErrors = {
    next: pw.next && pw.next.length < 8 ? 'Use at least 8 characters.' : pw.next && pw.next === pw.current ? 'New password must differ from the current one.' : '',
    confirm: pw.confirm && pw.confirm !== pw.next ? 'Passwords do not match.' : '',
  };
  const pwReady = pw.current && pw.next.length >= 8 && pw.next === pw.confirm && pw.next !== pw.current;

  const closePw = useCallback(() => {
    if (pwSaving) return;
    setPwOpen(false); setPw({ current: '', next: '', confirm: '' }); setShowPw({ current: false, next: false, confirm: false }); setPwFeedback(null);
  }, [pwSaving]);

  useEffect(() => {
    if (!pwOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closePw(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pwOpen, closePw]);

  const savePassword = async () => {
    if (!pwReady || pwSaving) return;
    setPwSaving(true); setPwFeedback(null);
    try {
      await axios.post(`${API_BASE}${PASSWORD_PATH}`, { current_password: pw.current, new_password: pw.next }, authHeaders());
      setPw({ current: '', next: '', confirm: '' });
      setPwOpen(false); setPwDone(true);
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
  const [notifMsg, setNotifMsg] = useState('');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState(null);

  const loadNotifs = useCallback(async () => {
    setNotifState('loading'); setNotifMsg('');
    try {
      const res = await axios.get(`${API_BASE}${NOTIF_PATH}`, authHeaders());
      const data = NOTIF_EVENTS.reduce((acc, ev) => ({ ...acc, [ev.key]: !!res.data?.[ev.key] }), {});
      setNotifSaved(data); setNotifDraft(data); setNotifState('ready');
    } catch (e) {
      const c = classify(e);
      if (c.kind === 'auth') setAuthExpired(true);
      setNotifState(c.kind === 'unsupported' ? 'unsupported' : 'error'); setNotifMsg(c.message);
    }
  }, []);
  const notifDirty = !!notifSaved && NOTIF_EVENTS.some(ev => notifDraft?.[ev.key] !== notifSaved[ev.key]);

  const saveNotifs = async () => {
    if (!notifDirty || notifSaving) return;
    setNotifSaving(true); setNotifFeedback(null);
    try {
      await axios.put(`${API_BASE}${NOTIF_PATH}`, notifDraft, authHeaders());
      setNotifSaved(notifDraft);
      setNotifFeedback({ tone: 'success', text: 'Notification preferences saved.' });
    } catch (e) {
      const c = classify(e);
      if (c.kind === 'auth') setAuthExpired(true);
      setNotifFeedback({ tone: 'error', text: c.message });
    } finally { setNotifSaving(false); }
  };

  // ── Work preferences (browser-only) ──
  const [workSaved, setWorkSaved] = useState(loadWork);
  const [workDraft, setWorkDraft] = useState(loadWork);
  const [workFeedback, setWorkFeedback] = useState(null);
  const workDirty = Object.keys(DEFAULT_WORK).some(k => workDraft[k] !== workSaved[k]);
  const saveWork = () => {
    try {
      localStorage.setItem(WORK_PREFS_KEY, JSON.stringify(workDraft));
      setWorkSaved(workDraft);
      setWorkFeedback({ tone: 'success', text: 'Preferences saved on this browser.' });
    } catch { setWorkFeedback({ tone: 'error', text: 'Could not save preferences in this browser.' }); }
  };

  useEffect(() => { loadProfile(); loadNotifs(); }, [loadProfile, loadNotifs]);

  const yearLevels = useMemo(() => (Array.isArray(profile?.assigned_year_levels) ? profile.assigned_year_levels.map(formatYearLevelLabel).join(', ') : ''), [profile]);
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const densityOptions = [
    { key: 'comfortable', title: 'Comfortable', note: 'Default spacing', icon: Rows3 },
    { key: 'compact', title: 'Compact', note: 'Tighter spacing', icon: Rows2 },
  ];

  const pwInput = (k, id, label, autoComplete, error) => (
    <IconInput id={id} icon={Lock} label={label} error={error}>
      <input id={id} className="os-field" type={showPw[k] ? 'text' : 'password'} autoComplete={autoComplete} value={pw[k]}
        onChange={e => setPw(p => ({ ...p, [k]: e.target.value }))} style={{ ...inputBase, paddingRight: 40, borderColor: error ? `${CLAY}99` : RULE }} aria-invalid={!!error} />
      <button type="button" onClick={() => setShowPw(s => ({ ...s, [k]: !s[k] }))} aria-label={showPw[k] ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: 6, top: 0, height: 40, width: 32, background: 'none', border: 'none', cursor: 'pointer', color: '#a89890' }}>
        {showPw[k] ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </IconInput>
  );

  const unsupported = (msg, what) => <Banner tone="warn">{msg} The {what} endpoint still needs to be added.</Banner>;

  return (
    <div className="min-h-screen" style={{ background: IVORY, ...sans }}>
      <style>{`
        .os-field:focus { border-color: ${GOLD} !important; box-shadow: 0 0 0 3px rgba(185,139,78,.15); }
        .os-btn:focus-visible, .os-opt:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        .os-opt:hover { background: ${PAPER}; }
        .os-nrow { border-top: 1px solid ${RULE}; }
        .os-nrow:first-child { border-top: none; }
        @media (min-width: 1024px) { .os-nrow:nth-child(2) { border-top: none; } }
      `}</style>

      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8" style={{ minWidth: 0 }}>

        {/* ── Standard Officer header ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <div style={{ ...tile, padding: '20px 24px' }}>
            <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: GOLD }}>OFFICER PORTAL</p>
            <h1 style={{ ...serif, fontSize: '1.75rem', fontWeight: 700, color: MAROON_DEEP, marginTop: 4, lineHeight: 1.2 }}>Settings</h1>
            <p style={{ ...sans, fontSize: '0.84rem', color: '#a89890', marginTop: 6, maxWidth: 640 }}>Manage your account, security, notifications, and work preferences.</p>
          </div>
          <div className="flex items-center gap-3" style={{ ...tile, padding: '16px 24px' }}>
            <span className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, background: `${MAROON}10` }}>
              <CalendarDays size={19} style={{ color: MAROON }} />
            </span>
            <div>
              <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890' }}>Today</p>
              <p style={{ ...sans, fontSize: '0.92rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{todayLabel}</p>
            </div>
          </div>
        </div>

        {authExpired && (
          <Banner tone="error" action={<button onClick={signInAgain} className="os-btn" style={linkBtn}>Sign in again</button>}>
            Your sign-in session has expired or is invalid.
          </Banner>
        )}
        {pwDone && <Banner tone="success" action={<button onClick={() => setPwDone(false)} className="os-btn" style={{ ...linkBtn, color: SAGE }}>Dismiss</button>}>Password updated.</Banner>}

        {/* ── Row 1: Officer Profile + Work Preferences ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card icon={User} title="Officer Profile" description="Update your name, email, and contact number."
            footer={profileState === 'ready' && (
              <>
                <button type="button" className="os-btn" disabled={!profileDirty || profileSaving} onClick={() => { setDraft({ full_name: profile.full_name || '', email: profile.email || '', contact_number: profile.contact_number || '' }); setProfileFeedback(null); }} style={ghostBtn(!profileDirty || profileSaving)}>Cancel</button>
                <button type="button" className="os-btn" disabled={!profileDirty || !profileValid || profileSaving} onClick={saveProfile} style={primaryBtn(!profileDirty || !profileValid || profileSaving)}><Save size={14} /> {profileSaving ? 'Saving…' : 'Save Changes'}</button>
              </>
            )}>
            {profileState === 'loading' && skeletons(3, 40)}
            {profileState === 'unsupported' && unsupported(profileMsg, 'profile')}
            {profileState === 'error' && <Banner tone="error" action={<button onClick={loadProfile} className="os-btn" style={linkBtn}>Retry</button>}>{profileMsg}</Banner>}
            {profileState === 'ready' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <IconInput id="os-name" icon={User} label="Display Name" value={draft.full_name} onChange={e => setDraft(d => ({ ...d, full_name: e.target.value }))} autoComplete="name" />
                  <IconInput id="os-email" icon={Mail} label="Email Address" type="email" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} autoComplete="email" error={draft.email && !emailValid ? 'Enter a valid email address.' : ''} />
                  <IconInput id="os-contact" icon={Phone} label="Contact Number" type="tel" value={draft.contact_number} onChange={e => setDraft(d => ({ ...d, contact_number: e.target.value }))} autoComplete="tel" />
                  <IconInput id="os-role" icon={ShieldCheck} label="Role" readOnly value={profile?.role || '—'} />
                  <IconInput id="os-officer-id" icon={IdCard} label="Officer ID" readOnly value={profile?.officer_id || '—'} />
                  <IconInput id="os-years" icon={Users} label="Assigned Year Levels" readOnly value={yearLevels || '—'} />
                </div>

                <div className="flex items-center justify-between gap-3 pt-3.5" style={{ borderTop: `1px solid ${RULE}` }}>
                  <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                    <IconChip icon={KeyRound} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK }}>Password</p>
                      <p style={{ ...sans, fontSize: '0.72rem', color: '#a89890' }}>Change the password you use to log in.</p>
                    </div>
                  </div>
                  <button type="button" className="os-btn flex-shrink-0" onClick={() => setPwOpen(true)} style={ghostBtn(false)}><KeyRound size={14} /> Change Password</button>
                </div>
                {(fmtDateTime(profile?.created_at) || fmtDateTime(profile?.last_login)) && (
                  <p style={{ ...sans, fontSize: '0.72rem', color: '#a89890' }}>
                    {fmtDateTime(profile?.created_at) && <>Account created {fmtDateTime(profile.created_at)}</>}
                    {fmtDateTime(profile?.created_at) && fmtDateTime(profile?.last_login) && ' · '}
                    {fmtDateTime(profile?.last_login) && <>Last login {fmtDateTime(profile.last_login)}</>}
                  </p>
                )}
                {profileFeedback && <Banner tone={profileFeedback.tone}>{profileFeedback.text}</Banner>}
              </div>
            )}
          </Card>

          <Card icon={SlidersHorizontal} title="Work Preferences" description="Default filters and display options. Saved on this browser only."
            footer={
              <>
                <button type="button" className="os-btn" disabled={!workDirty} onClick={() => { setWorkDraft(workSaved); setWorkFeedback(null); }} style={ghostBtn(!workDirty)}>Reset to Saved</button>
                <button type="button" className="os-btn" disabled={!workDirty} onClick={saveWork} style={primaryBtn(!workDirty)}><Save size={14} /> Save Preferences</button>
              </>
            }>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <SelectInput id="os-wp-status" icon={ListFilter} label="Default review status" value={workDraft.reviewStatus} onChange={e => setWorkDraft(d => ({ ...d, reviewStatus: e.target.value }))}
                  options={[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['returned', 'Returned']]} />
                <SelectInput id="os-wp-size" icon={Rows3} label="Default page size" value={workDraft.pageSize} onChange={e => setWorkDraft(d => ({ ...d, pageSize: Number(e.target.value) }))}
                  options={[10, 20, 50].map(n => [n, `${n} rows`])} />
                <SelectInput id="os-wp-period" icon={LineChart} label="Reporting period" value={workDraft.period} onChange={e => setWorkDraft(d => ({ ...d, period: e.target.value }))}
                  options={[['1m', 'Last month (1m)'], ['3m', 'Last 3 months (3m)'], ['6m', 'Last 6 months (6m)']]} />
              </div>

              <div>
                <Label>Table Density</Label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Table density">
                  {densityOptions.map(o => {
                    const active = workDraft.density === o.key;
                    return (
                      <button key={o.key} type="button" role="radio" aria-checked={active} onClick={() => setWorkDraft(d => ({ ...d, density: o.key }))} className="os-opt flex items-center gap-3 text-left transition-colors"
                        style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: active ? `${MAROON}0d` : '#fff', border: `1.5px solid ${active ? MAROON : RULE}` }}>
                        <IconChip icon={o.icon} />
                        <span style={{ minWidth: 0 }}>
                          <span className="block" style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, color: active ? MAROON : INK }}>{o.title}</span>
                          <span className="block" style={{ ...sans, fontSize: '0.7rem', color: '#a89890' }}>{o.note}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {workFeedback && <Banner tone={workFeedback.tone}>{workFeedback.text}</Banner>}
            </div>
          </Card>
        </div>

        {/* ── Row 2: Notifications ── */}
        <Card icon={Bell} title="Notifications" description="Choose which officer events notify you in the portal."
          footer={notifState === 'ready' && (
            <>
              <button type="button" className="os-btn" disabled={!notifDirty || notifSaving} onClick={() => { setNotifDraft(notifSaved); setNotifFeedback(null); }} style={ghostBtn(!notifDirty || notifSaving)}>Reset to Saved</button>
              <button type="button" className="os-btn" disabled={!notifDirty || notifSaving} onClick={saveNotifs} style={primaryBtn(!notifDirty || notifSaving)}><Save size={14} /> {notifSaving ? 'Saving…' : 'Save Preferences'}</button>
            </>
          )}>
          {notifState === 'loading' && skeletons(4, 48)}
          {notifState === 'unsupported' && unsupported(notifMsg, 'notification settings')}
          {notifState === 'error' && <Banner tone="error" action={<button onClick={loadNotifs} className="os-btn" style={linkBtn}>Retry</button>}>{notifMsg}</Banner>}
          {notifState === 'ready' && (
            <div>
              <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2">
                {NOTIF_EVENTS.map(ev => (
                  <div key={ev.key} className="os-nrow flex items-center gap-3 py-2.5">
                    <IconChip icon={ev.icon} />
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK }}>{ev.label}</p>
                      <p style={{ ...sans, fontSize: '0.72rem', color: '#a89890' }}>{ev.note}</p>
                    </div>
                    <Toggle checked={!!notifDraft?.[ev.key]} disabled={notifSaving} label={ev.label} onChange={v => setNotifDraft(d => ({ ...d, [ev.key]: v }))} />
                  </div>
                ))}
              </div>
              {notifFeedback && <div style={{ marginTop: 10 }}><Banner tone={notifFeedback.tone}>{notifFeedback.text}</Banner></div>}
            </div>
          )}
        </Card>
      </div>

      {/* ── Change Password modal ── */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,21,18,0.5)' }} onClick={closePw}>
          <div role="dialog" aria-modal="true" aria-labelledby="os-pw-title" onClick={e => e.stopPropagation()} className="flex w-full flex-col"
            style={{ ...tile, maxWidth: 440, maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)' }}>
            <div className="flex flex-shrink-0 items-start justify-between gap-3" style={{ padding: '18px 20px', borderBottom: `1px solid ${RULE}` }}>
              <div className="flex items-start gap-3">
                <IconChip icon={KeyRound} size={38} />
                <div>
                  <h2 id="os-pw-title" style={{ ...serif, fontSize: '1.08rem', fontWeight: 700, color: INK }}>Change Password</h2>
                  <p style={{ ...sans, fontSize: '0.74rem', color: '#a89890', marginTop: 2 }}>Enter your current password, then choose a new one.</p>
                </div>
              </div>
              <button type="button" onClick={closePw} disabled={pwSaving} aria-label="Close" className="os-btn" style={{ ...ghostBtn(pwSaving), padding: 0, width: 36, height: 36, borderColor: RULE, color: '#7a6a62' }}><X size={15} /></button>
            </div>
            <div className="flex flex-col gap-3.5 overflow-y-auto" style={{ padding: 20 }}>
              {pwInput('current', 'os-pw-current', 'Current Password', 'current-password')}
              {pwInput('next', 'os-pw-new', 'New Password', 'new-password', pwErrors.next)}
              {pwInput('confirm', 'os-pw-confirm', 'Confirm New Password', 'new-password', pwErrors.confirm)}
              {pwFeedback && <Banner tone={pwFeedback.tone}>{pwFeedback.text}</Banner>}
            </div>
            <div className="flex flex-shrink-0 justify-end gap-2.5" style={{ padding: '14px 20px', borderTop: `1px solid ${RULE}` }}>
              <button type="button" className="os-btn" onClick={closePw} disabled={pwSaving} style={ghostBtn(pwSaving)}>Cancel</button>
              <button type="button" className="os-btn" onClick={savePassword} disabled={!pwReady || pwSaving} style={primaryBtn(!pwReady || pwSaving)}>{pwSaving ? 'Updating…' : 'Update Password'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerSettings;