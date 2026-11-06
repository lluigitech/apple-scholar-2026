import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Lock, Eye, EyeOff, Mail, Phone, Hash, GraduationCap,
    Bell, User, KeyRound, X,
    CheckCircle2, AlertCircle, RotateCcw, Save, ClipboardList, ClipboardCheck, Megaphone, CalendarClock,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const YEAR_LEVEL_OPTIONS = [
    { value: 'grade_7', label: 'Grade 7' },
    { value: 'grade_8', label: 'Grade 8' },
    { value: 'grade_9', label: 'Grade 9' },
    { value: 'grade_10', label: 'Grade 10' },
    { value: 'grade_11', label: 'Grade 11' },
    { value: 'grade_12', label: 'Grade 12' },
    { value: 'college_1', label: '1st Year College' },
    { value: 'college_2', label: '2nd Year College' },
    { value: 'college_3', label: '3rd Year College' },
    { value: 'college_4', label: '4th Year College' },
    { value: 'college_5', label: '5th Year College' },
];

const normalizeYearLevelValue = (value) => {
    const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
    return YEAR_LEVEL_OPTIONS.find(option =>
        option.value === normalized || option.label.toLowerCase().replace(/\s+/g, '_') === normalized
    )?.value || '';
};

// ── Scholar Portal design system — same tokens as the Scholar Dashboard ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const PRIMARY_ACCENT = '#7C2D4C';
const GOLD = '#E4C28F';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER = '#C0473F';
const INK = '#241512';
const MUTED = '#8A7A68';
const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const cardShadow = '0 1px 2px rgba(36,21,18,0.04), 0 12px 28px -24px rgba(74,23,48,0.3)';

const authHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// ─── Reusable building blocks ───────────────────────────────────────────

const IconChip = ({ icon: Icon, color = PRIMARY, size = 38 }) => (
    <span className="flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, borderRadius: 11, background: `${color}12`, border: `1px solid ${color}22` }}>
        <Icon size={size > 34 ? 17 : 15} style={{ color }} />
    </span>
);

const Label = ({ htmlFor, children, hint }) => (
    <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
        <label htmlFor={htmlFor} style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: MUTED }}>{children}</label>
        {hint && <span style={{ ...body, fontSize: '0.66rem', color: '#B8AA9B' }}>{hint}</span>}
    </div>
);

const IconInput = ({ icon: Icon, trailing, className = '', ...props }) => (
    <div className="relative">
        <Icon size={15} className="absolute pointer-events-none" style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
        <input {...props} className={`st-field ${className}`} style={{ paddingLeft: 40, paddingRight: trailing ? 44 : 14, ...(props.style || {}) }} />
        {trailing}
    </div>
);

const EyeButton = ({ shown, onClick }) => (
    <button type="button" onClick={onClick} aria-label={shown ? 'Hide password' : 'Show password'} className="st-eye absolute flex items-center justify-center" style={{ right: 6, top: 4, width: 36, height: 36, background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
);

const Toggle = ({ checked, onChange, label }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className="st-toggle relative"
        style={{ width: 44, height: 26, borderRadius: 999, background: checked ? PRIMARY : '#D9CBB9', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background .25s ease' }}
    >
        <span
            className="absolute"
            style={{ top: 3, width: 20, height: 20, borderRadius: '50%', boxShadow: '0 1px 3px rgba(36,21,18,0.3)', left: checked ? 21 : 3, background: '#fff', transition: 'left .25s ease' }}
        />
    </button>
);

const Banner = ({ type, children }) => {
    const color = type === 'error' ? DANGER : SUCCESS;
    const Icon = type === 'error' ? AlertCircle : CheckCircle2;
    return (
        <div role={type === 'error' ? 'alert' : 'status'} className="flex items-start gap-2" style={{ background: `${color}0d`, border: `1px solid ${color}30`, color, borderRadius: 12, padding: '10px 14px', ...body, fontSize: '0.8rem', fontWeight: 500 }}>
            <Icon size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{children}</span>
        </div>
    );
};

// Section card: tinted header with icon chip, body, optional footer actions.
const Card = ({ icon, title, description, children, footer, accent = PRIMARY }) => (
    <section className="min-w-0" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: cardShadow, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="flex items-center gap-3 px-5 sm:px-6" style={{ paddingTop: 18, paddingBottom: 16, borderBottom: `1px solid ${BORDER}`, background: `linear-gradient(180deg, ${accent}0A, transparent)` }}>
            <IconChip icon={icon} color={accent} />
            <div className="min-w-0">
                <h2 style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK, lineHeight: 1.25 }}>{title}</h2>
                <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{description}</p>
            </div>
        </div>
        <div style={{ flex: 1 }}>{children}</div>
        {footer && (
            <div className="px-5 sm:px-6" style={{ paddingTop: 14, paddingBottom: 14, background: BG, borderTop: `1px solid ${BORDER}` }}>
                {footer}
            </div>
        )}
    </section>
);

const StrengthDial = ({ level, color }) => {
    const angle = -60 + (level / 4) * 120;
    return (
        <svg viewBox="0 0 120 70" style={{ width: 76, height: 44, flexShrink: 0 }}>
            {[0, 1, 2, 3, 4].map((i) => {
                const a = (-60 + (i / 4) * 120 - 90) * (Math.PI / 180);
                const x1 = 60 + 46 * Math.cos(a);
                const y1 = 60 + 46 * Math.sin(a);
                const x2 = 60 + 54 * Math.cos(a);
                const y2 = 60 + 54 * Math.sin(a);
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={BORDER} strokeWidth="2.5" />;
            })}
            <path d="M14,60 A46,46 0 0 1 106,60" fill="none" stroke={BORDER} strokeWidth="4" />
            <line
                x1="60" y1="60"
                x2={60 + 40 * Math.cos((angle - 90) * (Math.PI / 180))}
                y2={60 + 40 * Math.sin((angle - 90) * (Math.PI / 180))}
                stroke={color || MUTED} strokeWidth="3" strokeLinecap="round"
                style={{ transition: 'all 0.3s ease' }}
            />
            <circle cx="60" cy="60" r="4.5" fill={color || MUTED} />
        </svg>
    );
};

const DEFAULT_NOTIFS = {
    deadline_reminders: true,
    submission_updates: true,
    announcement_alerts: true,
    duty_reminders: true,
};

const NOTIF_ITEMS = [
    { key: 'deadline_reminders', label: 'Deadline Reminders', desc: 'Get notified before submission deadlines', icon: CalendarClock },
    { key: 'submission_updates', label: 'Submission Status Updates', desc: 'Get notified when staff reviews your submission', icon: ClipboardCheck },
    { key: 'announcement_alerts', label: 'Announcement Alerts', desc: 'Get notified for new foundation announcements', icon: Megaphone },
    { key: 'duty_reminders', label: 'Duty Reminders', desc: 'Get notified for upcoming duty assignments', icon: ClipboardList },
];

const ScholarSettings = () => {
    const userId = localStorage.getItem('id');

    const [profile, setProfile] = useState({
        fullName: localStorage.getItem('name') || '',
        email: localStorage.getItem('email') || '',
        age: localStorage.getItem('age') || '',
        phone: localStorage.getItem('phone') || '',
        studentId: localStorage.getItem('scholar_id') || '',
        yearLevel: normalizeYearLevelValue(localStorage.getItem('year_level')),
        status: 'Active',
    });
    const [savedProfile, setSavedProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileError, setProfileError] = useState('');
    const [profileSaving, setProfileSaving] = useState(false);

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const [notifSettings, setNotifSettings] = useState(DEFAULT_NOTIFS);
    const [savedNotifSettings, setSavedNotifSettings] = useState(DEFAULT_NOTIFS);
    const [notifSuccess, setNotifSuccess] = useState('');

    useEffect(() => {
        const loadSettings = async () => {
            if (!userId) {
                setError('Scholar credentials not found. Please log in again.');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError('');

            try {
                const res = await axios.get(`${API_BASE}/scholar/profile/${userId}`, { headers: authHeader() });
                const data = res.data || {};
                setProfile((prev) => ({
                    ...prev,
                    fullName: data.full_name || prev.fullName,
                    email: data.email || prev.email,
                    age: data.age ?? prev.age,
                    phone: data.phone ?? prev.phone,
                    studentId: data.scholar_id || prev.studentId,
                    yearLevel: normalizeYearLevelValue(data.year_level) || prev.yearLevel,
                    status: data.status || prev.status,
                }));
                if (data.year_level) localStorage.setItem('year_level', data.year_level);
            } catch (err) {
                console.error('Error loading scholar profile', err);
                setError('Unable to load profile data. Please refresh or log in again.');
            } finally {
                setLoading(false);
            }

            const savedNotif = localStorage.getItem('notif_settings');
            if (savedNotif) {
                try {
                    const parsed = JSON.parse(savedNotif);
                    setNotifSettings(parsed);
                    setSavedNotifSettings(parsed);
                } catch (ignored) {
                    console.warn('Unable to restore notification preferences:', ignored);
                }
            }
        };

        loadSettings();
    }, [userId]);

    useEffect(() => {
        if (!loading) {
            setSavedProfile({ fullName: profile.fullName, email: profile.email, phone: profile.phone, yearLevel: profile.yearLevel });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    const profileDirty = savedProfile
        ? ['fullName', 'email', 'phone', 'yearLevel'].some((k) => profile[k] !== savedProfile[k])
        : false;
    const notifDirty = JSON.stringify(notifSettings) !== JSON.stringify(savedNotifSettings);

    const getPasswordStrength = (pass) => {
        if (!pass) return { level: 0, label: '', color: '' };
        let score = 0;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        if (score <= 1) return { level: 1, label: 'Weak', color: DANGER };
        if (score === 2) return { level: 2, label: 'Fair', color: WARNING };
        if (score === 3) return { level: 3, label: 'Good', color: BRONZE };
        return { level: 4, label: 'Strong', color: SUCCESS };
    };

    const strength = getPasswordStrength(newPassword);

    const handleSaveProfile = async () => {
        setProfileError('');
        setProfileSuccess('');

        if (!profile.fullName || !profile.email) {
            setProfileError('Please provide your name and email.');
            return;
        }

        const updates = {
            full_name: profile.fullName.trim(),
            email: profile.email.trim(),
            phone: profile.phone,
        };
        if (profile.yearLevel) updates.year_level = profile.yearLevel;

        try {
            setProfileSaving(true);
            const response = await axios.patch(
                `${API_BASE}/scholar/profile/${userId}`,
                updates,
                { headers: authHeader() }
            );
            const data = response.data || {};
            const nextFullName = data.full_name || updates.full_name;
            const nextEmail = data.email || updates.email;
            const nextPhone = data.phone ?? updates.phone;
            const nextYearLevel = normalizeYearLevelValue(data.year_level) || profile.yearLevel;
            setProfile(current => ({
                ...current,
                fullName: nextFullName,
                email: nextEmail,
                phone: nextPhone,
                yearLevel: normalizeYearLevelValue(data.year_level) || current.yearLevel,
            }));
            setSavedProfile({ fullName: nextFullName, email: nextEmail, phone: nextPhone, yearLevel: nextYearLevel });
            localStorage.setItem('name', data.full_name || updates.full_name);
            localStorage.setItem('email', data.email || updates.email);
            if (data.year_level) localStorage.setItem('year_level', data.year_level);
            setProfileSuccess('Profile updated successfully.');
            setTimeout(() => setProfileSuccess(''), 3000);
        } catch (err) {
            setProfileError(err.response?.data?.error || err.response?.data?.message || 'Unable to update profile. Please try again.');
        } finally {
            setProfileSaving(false);
        }
    };

    const handleResetProfile = () => {
        if (!savedProfile) return;
        setProfile((current) => ({ ...current, ...savedProfile }));
        setProfileError('');
        setProfileSuccess('');
    };

    const openPasswordModal = () => {
        setPasswordError('');
        setPasswordSuccess('');
        setShowPasswordModal(true);
    };

    const closePasswordModal = () => {
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
        setPasswordError('');
        setPasswordSuccess('');
    };

    const handleChangePassword = async () => {
        setPasswordError('');
        setPasswordSuccess('');

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('Please fill in all fields.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match.');
            return;
        }
        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters.');
            return;
        }
        if (strength.level < 2) {
            setPasswordError('Password is too weak. Add uppercase letters, numbers, or symbols.');
            return;
        }

        try {
            setPasswordLoading(true);
            await axios.post('http://localhost:5000/api/change-password', {
                current_password: currentPassword,
                new_password: newPassword,
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

            setPasswordSuccess('Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => closePasswordModal(), 1500);
        } catch (err) {
            setPasswordError(err.response?.data?.error || err.response?.data?.message || 'Unable to change password. Please try again.');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleSaveNotifications = () => {
        localStorage.setItem('notif_settings', JSON.stringify(notifSettings));
        setSavedNotifSettings(notifSettings);
        setNotifSuccess('Notification preferences saved!');
        setTimeout(() => setNotifSuccess(''), 3000);
    };

    const handleResetNotifications = () => {
        setNotifSettings(savedNotifSettings);
        setNotifSuccess('');
    };

    const notifOnCount = Object.values(notifSettings).filter(Boolean).length;
    const initial = (profile.fullName || 'S').trim().charAt(0).toUpperCase();
    const yearLabel = YEAR_LEVEL_OPTIONS.find(option => option.value === profile.yearLevel)?.label || 'Not set';

    const newPwHint = newPassword && newPassword.length < 8 ? 'Password must be at least 8 characters.' : '';
    const confirmHint = confirmPassword && newPassword !== confirmPassword ? 'New passwords do not match.' : '';

    const primaryBtn = (disabled) => ({
        ...body, fontSize: '0.82rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: 'none', borderRadius: 12,
        padding: '10px 22px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        boxShadow: '0 4px 12px rgba(109,33,64,0.22)',
    });
    const ghostBtn = (disabled) => ({
        ...body, fontSize: '0.82rem', fontWeight: 600, color: INK, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12,
        padding: '10px 18px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    });

    return (
        <div className="w-full min-w-0 max-w-full overflow-x-hidden" style={{ ...body, background: BG, minHeight: '100vh' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');
                .st-field { width: 100%; height: 44px; padding: 0 14px; background: #fff; border: 1px solid ${BORDER}; border-radius: 12px; outline: none;
                    font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif; font-size: 0.85rem; color: ${INK};
                    transition: border-color .15s ease, box-shadow .15s ease; }
                .st-field::placeholder { color: #B8AA9B; }
                .st-field:hover:not(:disabled) { border-color: #d8c4ad; }
                .st-field:focus { border-color: ${PRIMARY}66; box-shadow: 0 0 0 4px ${PRIMARY}1a; }
                .st-field:disabled { background: #F1EADD; color: ${MUTED}; cursor: not-allowed; }
                .st-select { appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238A7A68' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
                .st-primary { transition: background .15s ease, transform .1s ease; }
                .st-primary:hover:not(:disabled) { background: ${PRIMARY_DARK} !important; }
                .st-primary:active:not(:disabled) { transform: scale(0.98); }
                .st-ghost { transition: background .15s ease; }
                .st-ghost:hover:not(:disabled) { background: #F3ECE0 !important; }
                .st-eye:hover { color: ${PRIMARY} !important; }
                .st-toggle:focus-visible { outline: none; box-shadow: 0 0 0 4px ${PRIMARY}26; }
                .st-notif { transition: border-color .15s ease, background .15s ease; }
                .st-notif:hover { border-color: #d8c4ad !important; background: #FBF8F2 !important; }
                @keyframes st-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
                .st-modal { animation: st-pop .2s ease; }
                @media (prefers-reduced-motion: reduce) { .st-modal { animation: none; } }
            `}</style>

            <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8" style={{ paddingTop: 20, paddingBottom: 32 }}>

                {/* ── Hero (compact burgundy, same as the Dashboard) ── */}
                <section
                    className="relative"
                    style={{
                        background: `linear-gradient(120deg, ${PRIMARY_DARK} 0%, ${PRIMARY} 60%, ${PRIMARY_ACCENT} 100%)`,
                        borderRadius: 22,
                        padding: 'clamp(14px, 2vw, 18px) clamp(16px, 2.4vw, 24px)',
                        marginBottom: 16,
                        boxShadow: '0 18px 36px -28px rgba(74,23,48,0.65)',
                    }}
                >
                    <div aria-hidden="true" className="absolute inset-0 overflow-hidden" style={{ borderRadius: 22, pointerEvents: 'none' }}>
                        <div className="absolute" style={{ width: 260, height: 260, right: -70, top: -150, borderRadius: '50%', border: '1px solid rgba(228,194,143,0.16)' }} />
                        <div className="absolute" style={{ left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}88, transparent)` }} />
                    </div>
                    <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            <span
                                className="flex items-center justify-center flex-shrink-0"
                                style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: `2px solid ${GOLD}`, color: '#fff', ...display, fontSize: '1.4rem', fontWeight: 700 }}
                            >
                                {initial}
                            </span>
                            <div className="min-w-0">
                                <p style={{ ...body, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.15em', color: GOLD, textTransform: 'uppercase' }}>Scholar Portal</p>
                                <h1 style={{ ...display, fontSize: 'clamp(1.4rem, 2.6vw, 1.9rem)', lineHeight: 1.12, fontWeight: 700, color: '#fff', marginTop: 4 }}>
                                    Account Settings
                                </h1>
                                <p className="truncate" style={{ ...body, fontSize: '0.74rem', color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>
                                    {profile.fullName || 'Scholar'}{profile.email ? ` · ${profile.email}` : ''}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            {[
                                { icon: Hash, text: profile.studentId || '—', mono: true },
                                { icon: GraduationCap, text: yearLabel },
                            ].map(({ icon: Icon, text, mono }) => (
                                <span key={text} className="inline-flex items-center gap-1.5" style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 999, padding: '5px 11px', ...(mono ? { fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace" } : {}) }}>
                                    <Icon size={12} style={{ color: GOLD }} />
                                    {text}
                                </span>
                            ))}
                            <span className="inline-flex items-center gap-1.5" style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: '#fff', background: 'rgba(143,224,176,0.16)', border: '1px solid rgba(143,224,176,0.35)', borderRadius: 999, padding: '5px 11px', textTransform: 'capitalize' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8FE0B0' }} />
                                {profile.status || 'Active'}
                            </span>
                        </div>
                    </div>
                </section>

                {loading && (
                    <p className="mb-4" style={{ ...body, fontSize: '0.8rem', color: MUTED }}>Loading account settings…</p>
                )}
                {error && (
                    <div className="mb-4">
                        <Banner type="error">{error}</Banner>
                    </div>
                )}

                <div className="min-w-0">
<div className="flex flex-col gap-4">

                    {/* Account Profile */}
                        <Card
                            icon={User}
                            title="Account Profile"
                            description="Your personal and scholarship details"
                            footer={
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <p className="flex items-center gap-2" style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: profileDirty ? WARNING : MUTED }}>
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: profileDirty ? WARNING : SUCCESS }} />
                                        {profileDirty ? 'You have unsaved changes' : 'All changes saved'}
                                    </p>
                                    <div className="flex flex-col-reverse sm:flex-row gap-2.5">
                                        <button type="button" onClick={handleResetProfile} disabled={!profileDirty || profileSaving} className="st-ghost flex items-center justify-center gap-1.5 w-full sm:w-auto" style={ghostBtn(!profileDirty || profileSaving)}>
                                            <RotateCcw size={14} /> Reset changes
                                        </button>
                                        <button type="button" onClick={handleSaveProfile} disabled={profileSaving || loading} className="st-primary flex items-center justify-center gap-1.5 w-full sm:w-auto" style={primaryBtn(profileSaving || loading)}>
                                            <Save size={14} /> {profileSaving ? 'Saving…' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            }
                        >
                            <div className="px-5 sm:px-6" style={{ paddingTop: 20, paddingBottom: 22 }}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                                    <div>
                                        <Label htmlFor="st-fullname">Full Name</Label>
                                        <IconInput id="st-fullname" icon={User} type="text" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} />
                                    </div>
                                    <div>
                                        <Label htmlFor="st-email">Email</Label>
                                        <IconInput id="st-email" icon={Mail} type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                                    </div>
                                    <div>
                                        <Label htmlFor="st-phone">Phone</Label>
                                        <IconInput id="st-phone" icon={Phone} type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <Label htmlFor="scholar-year-level">Year Level</Label>
                                        <div className="relative">
                                            <GraduationCap size={15} className="absolute pointer-events-none" style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: MUTED, zIndex: 1 }} />
                                            <select
                                                id="scholar-year-level"
                                                className="st-field st-select"
                                                style={{ paddingLeft: 40, paddingRight: 36 }}
                                                value={profile.yearLevel}
                                                onChange={event => setProfile(current => ({ ...current, yearLevel: event.target.value }))}
                                                disabled={profileSaving || loading}
                                            >
                                                <option value="">Select year level</option>
                                                {YEAR_LEVEL_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <p style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 5 }}>
                                            Update this when you advance to a new school year.
                                        </p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <Label htmlFor="st-studentid" hint="Read-only">Student ID</Label>
                                        <IconInput
                                            id="st-studentid" icon={Hash} type="text" value={profile.studentId} disabled readOnly
                                            style={{ fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace", paddingRight: 40 }}
                                            trailing={<Lock size={14} className="absolute pointer-events-none" style={{ right: 14, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />}
                                        />
                                    </div>
                                </div>

                                {(profileError || profileSuccess) && (
                                    <div className="mt-4">
                                        <Banner type={profileError ? 'error' : 'success'}>{profileError || profileSuccess}</Banner>
                                    </div>
                                )}
                            </div>
                        </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
{/* Notification Preferences */}
                        <Card
                            icon={Bell}
                            title="Notification Preferences"
                            description={`Choose which alerts you want to receive · ${notifOnCount} of 4 on`}
                            accent={BRONZE}
                            footer={
                                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
                                    <button type="button" onClick={handleResetNotifications} disabled={!notifDirty} className="st-ghost flex items-center justify-center gap-1.5 w-full sm:w-auto" style={ghostBtn(!notifDirty)}>
                                        <RotateCcw size={14} /> Reset to Saved
                                    </button>
                                    <button type="button" onClick={handleSaveNotifications} className="st-primary flex items-center justify-center gap-1.5 w-full sm:w-auto" style={primaryBtn(false)}>
                                        <Save size={14} /> Save Preferences
                                    </button>
                                </div>
                            }
                        >
                            <div className="px-5 sm:px-6" style={{ paddingTop: 18, paddingBottom: 20 }}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {NOTIF_ITEMS.map((item) => (
                                        <div key={item.key} className="st-notif flex items-center gap-3 min-w-0" style={{ padding: '12px 14px', background: SURFACE, border: `1px solid ${checkedBorder(notifSettings[item.key])}`, borderRadius: 14 }}>
                                            <IconChip icon={item.icon} size={36} color={notifSettings[item.key] ? PRIMARY : MUTED} />
                                            <div className="flex-1 min-w-0">
                                                <p style={{ ...body, fontSize: '0.84rem', fontWeight: 600, color: INK }}>{item.label}</p>
                                                <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 2, lineHeight: 1.45 }}>{item.desc}</p>
                                            </div>
                                            <Toggle
                                                label={item.label}
                                                checked={notifSettings[item.key]}
                                                onChange={() => setNotifSettings(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {notifSuccess && (
                                    <div className="mt-4">
                                        <Banner type="success">{notifSuccess}</Banner>
                                    </div>
                                )}
                            </div>
                        </Card>

                        <div className="flex flex-col gap-4 min-w-0">
{/* Password & Security */}
                        <Card icon={KeyRound} title="Password & Security" description="Keep your Scholar account protected" accent={PRIMARY}>
                            <div className="px-5 sm:px-6" style={{ paddingTop: 18, paddingBottom: 20 }}>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px' }}>
                                    <div className="flex-1 min-w-0">
                                        <p style={{ ...body, fontSize: '0.86rem', fontWeight: 700, color: INK }}>Password</p>
                                        <p style={{ ...body, fontSize: '0.75rem', color: MUTED, marginTop: 2, lineHeight: 1.5 }}>
                                            Change the password you use to access your Scholar account.
                                        </p>
                                    </div>
                                    <button type="button" onClick={openPasswordModal} className="st-ghost flex items-center justify-center gap-1.5 w-full sm:w-auto flex-shrink-0" style={{ ...ghostBtn(false), borderColor: BRONZE, color: PRIMARY }}>
                                        <KeyRound size={14} /> Change Password
                                    </button>
                                </div>
                            </div>
                        </Card>

                        </div>
</div>
<div className="text-center" style={{ ...body, fontSize: '0.72rem', color: MUTED, paddingTop: 4 }}>
                            Apple Scholar · Academic Year 2026 — Scholarship Management System
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Change Password modal ─────────────────────────────── */}
            {showPasswordModal && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
                    style={{ background: 'rgba(36,21,18,0.55)', backdropFilter: 'blur(4px)' }}
                    onMouseDown={(e) => { if (e.target === e.currentTarget && !passwordLoading) closePasswordModal(); }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="st-pw-title"
                        className="st-modal w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-y-auto"
                        style={{ background: SURFACE, border: `1px solid ${BORDER}`, boxShadow: '0 24px 48px -20px rgba(36,21,18,0.5)', maxHeight: '92vh' }}
                    >
                        <div className="flex items-center justify-between gap-3" style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${BORDER}`, background: `linear-gradient(180deg, ${PRIMARY}0A, transparent)` }}>
                            <div className="flex items-center gap-3 min-w-0">
                                <IconChip icon={KeyRound} />
                                <div className="min-w-0">
                                    <h3 id="st-pw-title" style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK, lineHeight: 1.2 }}>Change Password</h3>
                                    <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>Choose a strong, unique password</p>
                                </div>
                            </div>
                            <button type="button" onClick={closePasswordModal} disabled={passwordLoading} aria-label="Close" className="st-ghost flex-shrink-0" style={{ padding: 8, borderRadius: 10, border: 'none', background: 'none', color: MUTED, cursor: 'pointer' }}>
                                <X size={17} />
                            </button>
                        </div>

                        <div className="space-y-4" style={{ padding: '20px 22px' }}>
                            <div>
                                <Label htmlFor="st-current-pw">Current Password</Label>
                                <IconInput
                                    id="st-current-pw" icon={Lock} type={showCurrent ? 'text' : 'password'}
                                    value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password"
                                    trailing={<EyeButton shown={showCurrent} onClick={() => setShowCurrent(!showCurrent)} />}
                                />
                            </div>
                            <div>
                                <Label htmlFor="st-new-pw">New Password</Label>
                                <IconInput
                                    id="st-new-pw" icon={KeyRound} type={showNew ? 'text' : 'password'}
                                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password"
                                    trailing={<EyeButton shown={showNew} onClick={() => setShowNew(!showNew)} />}
                                />
                                {newPwHint && <p style={{ ...body, fontSize: '0.72rem', color: DANGER, marginTop: 6 }}>{newPwHint}</p>}
                                {newPassword && (
                                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                                        <StrengthDial level={strength.level} color={strength.color} />
                                        <p style={{ ...body, fontSize: '0.78rem', fontWeight: 700, color: strength.color }}>Password strength: {strength.label}</p>
                                    </div>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="st-confirm-pw">Confirm New Password</Label>
                                <IconInput
                                    id="st-confirm-pw" icon={KeyRound} type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password"
                                    trailing={<EyeButton shown={showConfirm} onClick={() => setShowConfirm(!showConfirm)} />}
                                />
                                {confirmHint && <p style={{ ...body, fontSize: '0.72rem', color: DANGER, marginTop: 6 }}>{confirmHint}</p>}
                            </div>

                            {(passwordError || passwordSuccess) && (
                                <Banner type={passwordError ? 'error' : 'success'}>{passwordError || passwordSuccess}</Banner>
                            )}
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5" style={{ padding: '16px 22px 20px', background: BG, borderTop: `1px solid ${BORDER}` }}>
                            <button type="button" onClick={closePasswordModal} disabled={passwordLoading} className="st-ghost w-full sm:w-auto" style={ghostBtn(passwordLoading)}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleChangePassword} disabled={passwordLoading} className="st-primary w-full sm:w-auto" style={primaryBtn(passwordLoading)}>
                                {passwordLoading ? 'Updating…' : 'Update Password'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Border for a notification tile: tinted when the alert is on.
const checkedBorder = (on) => (on ? `${PRIMARY}33` : BORDER);

export default ScholarSettings;