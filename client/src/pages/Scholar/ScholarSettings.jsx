import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Lock, Eye, EyeOff,
    ShieldCheck, Bell, User, ChevronRight, KeyRound, Download, Trash2,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

// ── Scholar Portal design system — same tokens as ScholarProfile /
// ScholarNotification, so this page reads as one continuous workspace. ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER = '#C0473F';
const INK = '#241512';
const MUTED = '#8A7A68';
const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const authHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Password-strength dial — same semi-circle gauge motif used for the
// compliance score on the Profile page, recolored for this context.
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

// Section tabs — doubles as this page's "toolbar" row, since there is no
// searchable record list here to filter.
const SectionTabs = ({ tabs, active, onSelect }) => (
    <div className="inline-flex flex-wrap" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 999, padding: 3, gap: 2 }}>
        {tabs.map((tab) => {
            const isActive = active === tab.key;
            return (
                <button
                    key={tab.key}
                    onClick={() => onSelect(tab.key)}
                    className="flex items-center gap-1.5 transition-all"
                    style={{
                        ...body, fontSize: '0.78rem', fontWeight: 600,
                        padding: '8px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                        color: isActive ? '#fff' : MUTED,
                        background: isActive ? `linear-gradient(120deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)` : 'transparent',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <tab.icon size={13} />
                    {tab.label}
                </button>
            );
        })}
    </div>
);

const ToggleSwitch = ({ checked, onChange }) => (
    <button
        onClick={onChange}
        className="relative transition-all duration-300"
        style={{ width: 42, height: 24, borderRadius: 999, background: checked ? PRIMARY : BORDER, border: 'none', cursor: 'pointer', flexShrink: 0 }}
    >
        <span
            className="absolute top-1 transition-all duration-300"
            style={{ width: 16, height: 16, borderRadius: '50%', boxShadow: '0 1px 2px rgba(36,21,18,0.3)', left: checked ? 22 : 4, background: '#fff' }}
        />
    </button>
);

const fieldLabelStyle = { ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: MUTED, marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', paddingBottom: 10, border: 'none', borderBottom: `1.5px solid ${BORDER}`, background: 'none', outline: 'none', ...body, fontSize: '0.85rem', color: INK };
const onInputFocus = (e) => (e.target.style.borderBottom = `1.5px solid ${PRIMARY}`);
const onInputBlur = (e) => (e.target.style.borderBottom = `1.5px solid ${BORDER}`);

const ScholarSettings = () => {
    const userId = localStorage.getItem('id');
    const [activeTab, setActiveTab] = useState('profile');

    const [profile, setProfile] = useState({
        fullName: localStorage.getItem('name') || '',
        email: localStorage.getItem('email') || '',
        age: localStorage.getItem('age') || '',
        phone: localStorage.getItem('phone') || '',
        studentId: localStorage.getItem('scholar_id') || '',
        yearLevel: localStorage.getItem('year_level') || '',
        status: 'Active',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileError, setProfileError] = useState('');

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const [notifSettings, setNotifSettings] = useState({
        deadline_reminders: true,
        submission_updates: true,
        announcement_alerts: true,
        duty_reminders: true,
    });
    const [notifSuccess, setNotifSuccess] = useState('');
    const [dataConsent, setDataConsent] = useState({ consented: false, consented_at: null });
    const [consentLoading, setConsentLoading] = useState(false);
    const [consentMessage, setConsentMessage] = useState('');
    const [privacyRequestLoading, setPrivacyRequestLoading] = useState(false);

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
                    studentId: data.scholar_id || prev.studentId,
                    yearLevel: data.year_level || prev.yearLevel,
                    status: data.status || prev.status,
                }));
                const consentRes = await axios.get(`${API_BASE}/scholar/data-consent`, { headers: authHeader() });
                setDataConsent({ consented: Boolean(consentRes.data?.consented), consented_at: consentRes.data?.consented_at || null });
            } catch (err) {
                console.error('Error loading scholar profile', err);
                setError('Unable to load profile data. Please refresh or log in again.');
            } finally {
                setLoading(false);
            }

            const savedNotif = localStorage.getItem('notif_settings');
            if (savedNotif) {
                try {
                    setNotifSettings(JSON.parse(savedNotif));
                } catch (ignored) {
                    console.warn('Unable to restore notification preferences:', ignored);
                }
            }
        };

        loadSettings();
    }, [userId]);

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

    const handleSaveProfile = () => {
        setProfileError('');
        setProfileSuccess('');

        if (!profile.fullName || !profile.email) {
            setProfileError('Please provide your name and email.');
            return;
        }

        localStorage.setItem('name', profile.fullName);
        localStorage.setItem('email', profile.email);
        setProfileSuccess('Profile details updated locally.');
        setTimeout(() => setProfileSuccess(''), 3000);
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
            setTimeout(() => setPasswordSuccess(''), 4000);
        } catch (err) {
            setPasswordError(err.response?.data?.error || err.response?.data?.message || 'Unable to change password. Please try again.');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleSaveNotifications = () => {
        localStorage.setItem('notif_settings', JSON.stringify(notifSettings));
        setNotifSuccess('Notification preferences saved!');
        setTimeout(() => setNotifSuccess(''), 3000);
    };

    const handleConsentChange = async () => {
        setConsentLoading(true);
        setConsentMessage('');
        try {
            const res = await axios.patch(`${API_BASE}/scholar/data-consent`, { consented: !dataConsent.consented }, { headers: authHeader() });
            setDataConsent(current => ({ ...current, consented: Boolean(res.data?.consented), consented_at: res.data?.consented ? new Date().toISOString() : null }));
            setConsentMessage(res.data?.consented ? 'Data collection consent recorded.' : 'Data collection consent revoked.');
        } catch (err) {
            setConsentMessage(err.response?.data?.error || 'Unable to update data consent.');
        } finally {
            setConsentLoading(false);
        }
    };

    const handlePrivacyRequest = async (requestType) => {
        setPrivacyRequestLoading(true);
        setConsentMessage('');
        try {
            await axios.post(`${API_BASE}/scholar/privacy-requests`, { request_type: requestType }, { headers: authHeader() });
            const label = requestType === 'export' ? 'data export' : 'account deletion';
            setConsentMessage(`Your ${label} request has been submitted and is now pending admin review.`);
        } catch (err) {
            setConsentMessage(err.response?.data?.error || 'Unable to create privacy request.');
        } finally {
            setPrivacyRequestLoading(false);
        }
    };

    const handleDataExport = async () => {
        setPrivacyRequestLoading(true);
        setConsentMessage('');
        try {
            const response = await axios.get(`${API_BASE}/scholar/privacy-export`, { headers: authHeader(), responseType: 'blob' });
            const url = URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = `apple-scholar-data-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
            setConsentMessage('Your personal data export has been downloaded.');
        } catch (err) {
            setConsentMessage(err.response?.data?.error || 'Unable to download your data export.');
        } finally {
            setPrivacyRequestLoading(false);
        }
    };

    const displayName = profile.fullName || localStorage.getItem('name') || 'Scholar';
    const displayEmail = profile.email || localStorage.getItem('email') || 'you@example.com';

    // Quick-overview figures — existing values only, no new calculations.
    const notifOnCount = Object.values(notifSettings).filter(Boolean).length;

    return (
        <div style={{ ...body, background: BG, minHeight: '100vh' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');
                .settings-toolbar { position: sticky; top: 12px; z-index: 5; box-shadow: 0 12px 28px -18px rgba(36,21,18,0.25); }
            `}</style>

            <div className="w-full px-4 sm:px-6 lg:p-8">

                {/* ── 1. Scholar header ─────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4 flex-wrap" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '20px 24px', marginBottom: 20 }}>
                    <div>
                        <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: BRONZE }}>SCHOLAR PORTAL</p>
                        <h1 style={{ ...display, fontSize: '1.6rem', fontWeight: 600, color: INK, marginTop: 4 }}>Account Settings</h1>
                        <p style={{ ...body, fontSize: '0.84rem', color: MUTED, marginTop: 6, maxWidth: 480 }}>
                            Manage your profile details, password, and notification preferences in one place.
                        </p>
                    </div>
                    <span style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY, background: `${PRIMARY}12`, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 16px', flexShrink: 0 }}>
                        {profile.status || 'Active'}
                    </span>
                </div>

                {loading && (
                    <p className="mb-4" style={{ ...body, fontSize: '0.8rem', color: MUTED }}>Loading account settings…</p>
                )}
                {error && (
                    <div className="mb-5" style={{ background: `${DANGER}0d`, color: DANGER, border: `1px solid ${DANGER}33`, borderRadius: 12, padding: 14, ...body, fontSize: '0.82rem' }}>
                        {error}
                    </div>
                )}

                {/* ── 2. Hero information card (burgundy) ───────────────── */}
                <div
                    className="flex flex-col sm:flex-row sm:items-center gap-6"
                    style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, borderRadius: RADIUS, padding: '24px 26px', marginBottom: 20, color: '#fff' }}
                >
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="flex items-center justify-center flex-shrink-0" style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: `2px solid ${BRONZE}` }}>
                            <span style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>{displayName.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                            <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)' }}>FEATURED INFORMATION</p>
                            <p style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: '#fff', marginTop: 2 }} className="truncate">{displayName}</p>
                            <p style={{ ...body, fontSize: '0.76rem', color: 'rgba(255,255,255,0.75)' }} className="truncate">{displayEmail}</p>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0" style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: 24 }}>
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck size={13} style={{ color: '#fff' }} />
                            <span style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>VERIFIED SCHOLAR</span>
                        </div>
                        <p style={{ ...body, fontSize: '0.82rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
                            {dataConsent.consented
                                ? `Data consent given${dataConsent.consented_at ? ` on ${new Date(dataConsent.consented_at).toLocaleDateString('en-PH')}` : ''}.`
                                : 'Data collection consent has not been recorded yet.'}
                        </p>
                    </div>

                    <button
                        onClick={() => setActiveTab('profile')}
                        className="flex-shrink-0 transition-opacity hover:opacity-90"
                        style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: PRIMARY, background: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', cursor: 'pointer' }}
                    >
                        Manage Privacy
                    </button>
                </div>

                {/* ── 3. Quick overview — 3 KPI cards ───────────────────── */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4" style={{ marginBottom: 20 }}>
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 16px 14px' }}>
                        <div className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, background: `${PRIMARY}14` }}>
                            <Bell size={14} style={{ color: PRIMARY }} />
                        </div>
                        <p style={{ ...display, fontSize: '1.35rem', fontWeight: 600, color: INK, marginTop: 10 }}>{notifOnCount}/4</p>
                        <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>Notifications On</p>
                    </div>
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 16px 14px' }}>
                        <div className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, background: `${dataConsent.consented ? SUCCESS : WARNING}14` }}>
                            <ShieldCheck size={14} style={{ color: dataConsent.consented ? SUCCESS : WARNING }} />
                        </div>
                        <p style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK, marginTop: 10 }}>{dataConsent.consented ? 'Given' : 'Not Given'}</p>
                        <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>Data Consent</p>
                    </div>
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 16px 14px' }}>
                        <div className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, background: `${BRONZE}14` }}>
                            <User size={14} style={{ color: BRONZE }} />
                        </div>
                        <p style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK, marginTop: 10 }}>{profile.status || 'Active'}</p>
                        <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>Account Status</p>
                    </div>
                </div>

                {/* ── 4. Section toolbar (tabs, in place of search/filter — no record list exists on this page) ── */}
                <div className="settings-toolbar flex items-center justify-between flex-wrap gap-3" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 14, marginBottom: 20 }}>
                    <SectionTabs
                        tabs={[
                            { key: 'profile', label: 'Profile', icon: User },
                            { key: 'password', label: 'Password', icon: Lock },
                            { key: 'notifications', label: 'Notifications', icon: Bell },
                        ]}
                        active={activeTab}
                        onSelect={setActiveTab}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => window.location.href = '/scholar/checklist'}
                            className="flex items-center gap-1.5 transition-colors"
                            style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: INK, background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}
                        >
                            Checklist <ChevronRight size={13} style={{ color: PRIMARY }} />
                        </button>
                        <button
                            onClick={() => window.location.href = '/scholar/duties'}
                            className="flex items-center gap-1.5 transition-colors"
                            style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: INK, background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}
                        >
                            Duties <ChevronRight size={13} style={{ color: PRIMARY }} />
                        </button>
                    </div>
                </div>

                {/* ── 5. Section content, styled as premium cards ───────── */}
                {activeTab === 'profile' && (
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '22px 24px', marginBottom: 20 }}>
                        <h3 style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: INK, marginBottom: 18 }}>Profile Settings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                            <div>
                                <label style={fieldLabelStyle}>FULL NAME</label>
                                <input type="text" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>EMAIL</label>
                                <input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>PHONE</label>
                                <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>STUDENT ID</label>
                                <input type="text" value={profile.studentId} disabled style={{ width: '100%', padding: '10px 12px', borderRadius: 10, ...body, fontSize: '0.85rem', color: MUTED, background: BG, border: `1px solid ${BORDER}`, outline: 'none' }} />
                            </div>
                        </div>

                        {profileError && <div className="mt-5" style={{ background: `${DANGER}0d`, color: DANGER, borderRadius: 10, padding: '10px 14px', ...body, fontSize: '0.8rem' }}>{profileError}</div>}
                        {profileSuccess && <div className="mt-5" style={{ background: `${SUCCESS}0d`, color: SUCCESS, borderRadius: 10, padding: '10px 14px', ...body, fontSize: '0.8rem' }}>{profileSuccess}</div>}

                        <button
                            onClick={handleSaveProfile}
                            className="w-full mt-5 transition-opacity hover:opacity-90"
                            style={{ padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer', ...body, fontSize: '0.82rem', fontWeight: 700, color: '#fff', background: `linear-gradient(120deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)` }}
                        >
                            Save Profile
                        </button>

                        {/* Privacy consent — styled as a registry-card row: left icon+desc, right status+action */}
                        <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${BORDER}` }}>
                            <div className="flex items-start gap-3" style={{ background: BG, borderRadius: 14, padding: 18 }}>
                                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: `${PRIMARY}14` }}>
                                    <ShieldCheck size={16} style={{ color: PRIMARY }} />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p style={{ ...body, fontSize: '0.86rem', fontWeight: 700, color: INK }}>Data Privacy Consent</p>
                                    <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 4, lineHeight: 1.55 }}>
                                        I consent to the collection and processing of my scholar profile, submissions, attendance, grades, and uploaded documents for scholarship monitoring and reporting. No external AI service is used to evaluate this data.
                                    </p>
                                    <div className="mt-3 flex flex-col xs:flex-row sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <span style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: dataConsent.consented ? SUCCESS : WARNING }}>
                                            {dataConsent.consented ? `Consented${dataConsent.consented_at ? ` on ${new Date(dataConsent.consented_at).toLocaleDateString('en-PH')}` : ''}` : 'Consent not recorded'}
                                        </span>
                                        <button onClick={handleConsentChange} disabled={consentLoading}
                                            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', ...body, fontSize: '0.76rem', fontWeight: 700, color: '#fff', background: dataConsent.consented ? DANGER : PRIMARY, opacity: consentLoading ? 0.6 : 1, flexShrink: 0 }}>
                                            {consentLoading ? 'Saving…' : dataConsent.consented ? 'Revoke Consent' : 'Give Consent'}
                                        </button>
                                    </div>
                                    {consentMessage && <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 8 }}>{consentMessage}</p>}
                                    <div className="mt-4 flex flex-wrap gap-2" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                                        <button type="button" onClick={handleDataExport} disabled={privacyRequestLoading}
                                            className="flex items-center gap-1.5"
                                            style={{ padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${BRONZE}`, background: 'none', cursor: 'pointer', ...body, fontSize: '0.74rem', fontWeight: 700, color: PRIMARY, opacity: privacyRequestLoading ? 0.6 : 1 }}>
                                            <Download size={13} /> Download My Data
                                        </button>
                                        <button type="button" onClick={() => handlePrivacyRequest('deletion')} disabled={privacyRequestLoading}
                                            className="flex items-center gap-1.5"
                                            style={{ padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${DANGER}88`, background: 'none', cursor: 'pointer', ...body, fontSize: '0.74rem', fontWeight: 700, color: DANGER, opacity: privacyRequestLoading ? 0.6 : 1 }}>
                                            <Trash2 size={13} /> Request Data Deletion
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'password' && (
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '22px 24px', marginBottom: 20 }}>
                        <h3 style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: INK, marginBottom: 18 }}>Change Password</h3>
                        <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
                            <div className="space-y-5">
                                <div>
                                    <label style={fieldLabelStyle}>CURRENT PASSWORD</label>
                                    <div className="relative">
                                        <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" style={{ ...inputStyle, paddingRight: 28 }} onFocus={onInputFocus} onBlur={onInputBlur} />
                                        <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-0 top-0" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
                                            {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label style={fieldLabelStyle}>NEW PASSWORD</label>
                                    <div className="relative">
                                        <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" style={{ ...inputStyle, paddingRight: 28 }} onFocus={onInputFocus} onBlur={onInputBlur} />
                                        <button onClick={() => setShowNew(!showNew)} className="absolute right-0 top-0" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
                                            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    {newPassword && (
                                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                                            <StrengthDial level={strength.level} color={strength.color} />
                                            <p style={{ ...body, fontSize: '0.76rem', fontWeight: 700, color: strength.color }}>Password strength: {strength.label}</p>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label style={fieldLabelStyle}>CONFIRM NEW PASSWORD</label>
                                    <div className="relative">
                                        <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" style={{ ...inputStyle, paddingRight: 28 }} onFocus={onInputFocus} onBlur={onInputBlur} />
                                        <button onClick={() => setShowConfirm(!showConfirm)} className="absolute right-0 top-0" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
                                            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {(passwordError || passwordSuccess) && (
                                    <div style={{ borderRadius: 10, padding: '10px 14px', ...body, fontSize: '0.8rem', color: passwordError ? DANGER : SUCCESS, background: passwordError ? `${DANGER}0d` : `${SUCCESS}0d` }}>
                                        {passwordError || passwordSuccess}
                                    </div>
                                )}

                                <button
                                    onClick={handleChangePassword}
                                    disabled={passwordLoading}
                                    className="w-full transition-opacity hover:opacity-90"
                                    style={{ padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer', ...body, fontSize: '0.82rem', fontWeight: 700, color: '#fff', background: `linear-gradient(120deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, opacity: passwordLoading ? 0.6 : 1 }}
                                >
                                    {passwordLoading ? 'Updating…' : 'Update Password'}
                                </button>
                            </div>

                            <div style={{ background: BG, borderRadius: 14, padding: 16, borderLeft: `3px solid ${PRIMARY}`, height: 'fit-content' }}>
                                <div className="flex items-center gap-2 mb-2.5">
                                    <KeyRound size={13} style={{ color: PRIMARY }} />
                                    <p style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: PRIMARY_DARK }}>SECURITY TIPS</p>
                                </div>
                                <ul className="space-y-1.5 list-disc pl-4" style={{ ...body, fontSize: '0.78rem', color: MUTED }}>
                                    <li>Use at least 8 characters.</li>
                                    <li>Mix uppercase and lowercase.</li>
                                    <li>Add numbers and symbols.</li>
                                    <li>Never share your password.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '22px 24px', marginBottom: 20 }}>
                        <h3 style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: INK, marginBottom: 18 }}>Notification Preferences</h3>
                        <div className="space-y-2.5">
                            {[
                                { key: 'deadline_reminders', label: 'Deadline Reminders', desc: 'Get notified before submission deadlines', icon: Lock },
                                { key: 'submission_updates', label: 'Submission Status Updates', desc: 'Get notified when staff reviews your submission', icon: ShieldCheck },
                                { key: 'announcement_alerts', label: 'Announcement Alerts', desc: 'Get notified for new foundation announcements', icon: Bell },
                                { key: 'duty_reminders', label: 'Duty Reminders', desc: 'Get notified for upcoming duty assignments', icon: User },
                            ].map((item) => (
                                <div key={item.key} className="flex items-start gap-3" style={{ background: BG, borderRadius: 14, padding: '14px 16px' }}>
                                    <span className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: 10, background: `${PRIMARY}14`, marginTop: 1 }}>
                                        <item.icon size={14} style={{ color: PRIMARY }} />
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p style={{ ...body, fontSize: '0.84rem', fontWeight: 700, color: INK }}>{item.label}</p>
                                        <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{item.desc}</p>
                                    </div>
                                    <ToggleSwitch
                                        checked={notifSettings[item.key]}
                                        onChange={() => setNotifSettings(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                                    />
                                </div>
                            ))}
                        </div>

                        {notifSuccess && (
                            <div className="mt-4" style={{ background: `${SUCCESS}0d`, color: SUCCESS, borderRadius: 10, padding: '10px 14px', ...body, fontSize: '0.8rem' }}>
                                {notifSuccess}
                            </div>
                        )}

                        <button
                            onClick={handleSaveNotifications}
                            className="w-full transition-colors"
                            style={{ marginTop: 18, padding: '11px 0', borderRadius: 12, border: `1.5px solid ${PRIMARY}`, background: '#fff', cursor: 'pointer', ...body, fontSize: '0.82rem', fontWeight: 700, color: PRIMARY }}
                        >
                            Save Preferences
                        </button>
                    </div>
                )}

                <div className="text-center mb-10" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                    Apple Scholar · Academic Year 2026 — Scholarship Management System
                </div>
            </div>
        </div>
    );
};

export default ScholarSettings;