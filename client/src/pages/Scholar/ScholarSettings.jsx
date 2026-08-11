import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Lock, Eye, EyeOff, CheckCircle, AlertTriangle,
    ShieldCheck, Bell, User, ChevronRight, KeyRound,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

// ── Token system — shared across the Scholar Portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';
const ROSE = '#F5E8EA';

const authHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const ScholarSettings = () => {
    const userId = localStorage.getItem('id');
    const [activeTab, setActiveTab] = useState('profile');

    const [profile, setProfile] = useState({
        fullName: localStorage.getItem('name') || '',
        email: localStorage.getItem('email') || '',
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
                    studentId: data.scholar_id || prev.studentId,
                    yearLevel: data.year_level || prev.yearLevel,
                    status: data.status || prev.status,
                }));
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
                } catch (ignored) {}
            }
        };

        loadSettings();
    }, [userId]);

    // Recolored onto the shared ledger palette instead of arbitrary
    // red/amber/blue/emerald Tailwind tones.
    const getPasswordStrength = (pass) => {
        if (!pass) return { level: 0, label: '', color: '' };
        let score = 0;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        if (score <= 1) return { level: 1, label: 'Weak', color: '#991b1b' };
        if (score === 2) return { level: 2, label: 'Fair', color: '#92400e' };
        if (score === 3) return { level: 3, label: 'Good', color: GOLD };
        return { level: 4, label: 'Strong', color: '#15803d' };
    };

    const strength = getPasswordStrength(newPassword);

    const inputClass = "w-full pb-2.5 outline-none transition-colors bg-transparent placeholder:text-slate-300";
    const inputStyle = { color: INK, borderBottom: '1.5px solid #e9dfd8' };
    const onInputFocus = (e) => (e.target.style.borderBottom = `1.5px solid ${MAROON}`);
    const onInputBlur = (e) => (e.target.style.borderBottom = '1.5px solid #e9dfd8');

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

        if (!profile.email) {
            setPasswordError('Email not available for password verification.');
            return;
        }
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
            const verifyRes = await axios.post('http://localhost:5000/api/login', {
                email: profile.email,
                password: currentPassword,
            });

            if (verifyRes.data.status !== 'Success') {
                setPasswordError('Current password is incorrect.');
                return;
            }

            await axios.post('http://localhost:5000/api/change-password', {
                email: profile.email,
                new_password: newPassword,
            });

            setPasswordSuccess('Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordSuccess(''), 4000);
        } catch (err) {
            setPasswordError(err.response?.data?.message || 'Current password is incorrect.');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleSaveNotifications = () => {
        localStorage.setItem('notif_settings', JSON.stringify(notifSettings));
        setNotifSuccess('Notification preferences saved!');
        setTimeout(() => setNotifSuccess(''), 3000);
    };

    // Toggle switch recolored to the maroon/gold pair — reads as a small
    // brass-and-lacquer control rather than a generic default switch.
    const ToggleSwitch = ({ checked, onChange }) => (
        <button
            onClick={onChange}
            className="relative w-11 h-6 rounded-full transition-all duration-300"
            style={{ background: checked ? MAROON : '#e9dfd8' }}
        >
            <span
                className="absolute top-1 w-4 h-4 rounded-full shadow transition-all duration-300"
                style={{ left: checked ? 26 : 4, background: checked ? GOLD : '#fff' }}
            />
        </button>
    );

    const displayName = profile.fullName || localStorage.getItem('name') || 'Scholar';
    const displayEmail = profile.email || localStorage.getItem('email') || 'you@example.com';

    const serif = { fontFamily: "'Playfair Display', serif" };
    const sans = { fontFamily: "'DM Sans', sans-serif" };

    return (
        <div style={{ ...sans, background: IVORY, minHeight: '100vh' }}>

            {/* ── Hero band ─────────────────────────────────────── */}
            <div
                className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-14 sm:pb-16"
                style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
            >
                <svg
                    className="absolute -right-8 -top-10 w-52 h-52 sm:-right-6 sm:-top-8 sm:w-64 sm:h-64 opacity-[0.14] pointer-events-none"
                    viewBox="0 0 200 200"
                    fill="none"
                >
                    <path
                        d="M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z"
                        fill={GOLD}
                    />
                    <path d="M100 62c2-16 10-30 22-38" stroke={GOLD} strokeWidth="6" strokeLinecap="round" />
                </svg>

                <p className="relative text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] mb-2" style={{ color: GOLD }}>
                    Scholar Portal
                </p>
                <h1 className="relative text-2xl sm:text-3xl md:text-4xl font-bold text-white" style={serif}>Account Preferences</h1>
                <p className="relative text-xs mt-2 max-w-md" style={{ color: '#e9c9a8' }}>
                    Manage your profile details, password, and notification preferences in one place.
                </p>
            </div>

            <div className="px-4 sm:px-6 lg:p-8 lg:pt-0">
                <div className="max-w-6xl mx-auto">
                    <div className="relative -mt-8 sm:-mt-10 grid gap-6 lg:grid-cols-[280px_1fr]">
                        <aside className="space-y-5">
                            {/* ── Member card — a wallet ID card, not a generic profile box ── */}
                            <div
                                className="rounded-2xl overflow-hidden"
                                style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, boxShadow: '0 12px 30px -12px rgba(79,22,32,0.3)' }}
                            >
                                <div className="p-5">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)', border: `2px solid ${GOLD}`, color: GOLD }}>
                                            {displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white truncate" style={serif}>{displayName}</p>
                                            <p className="text-xs truncate" style={{ color: '#e9c9a8' }}>{displayEmail}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                                        <ShieldCheck size={14} style={{ color: GOLD }} />
                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Verified Scholar</span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl bg-white p-5" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-4" style={{ color: '#a56475' }}>Quick Links</p>
                                <div className="space-y-1.5">
                                    {[
                                        { label: 'Requirement Checklist', path: '/scholar/checklist' },
                                        { label: 'Scholar Duties', path: '/scholar/duties' },
                                    ].map((item) => (
                                        <button
                                            key={item.path}
                                            onClick={() => window.location.href = item.path}
                                            className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors"
                                            style={{ color: INK, background: IVORY }}
                                        >
                                            {item.label}
                                            <ChevronRight size={14} style={{ color: MAROON }} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Security tips — a small brass plate note */}
                            <div className="rounded-2xl p-5" style={{ background: ROSE }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <KeyRound size={13} style={{ color: MAROON }} />
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: MAROON_DEEP }}>Security Tips</p>
                                </div>
                                <ul className="space-y-2.5 text-sm" style={{ color: '#a56475' }}>
                                    <li>Use at least 8 characters.</li>
                                    <li>Mix uppercase and lowercase.</li>
                                    <li>Add numbers and symbols.</li>
                                    <li>Never share your password.</li>
                                </ul>
                            </div>
                        </aside>

                        <section className="space-y-6">
                            <div className="rounded-2xl bg-white p-5 sm:p-6" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: '#a56475' }}>Settings</p>
                                        <h2 className="mt-1 text-xl sm:text-2xl font-bold" style={{ ...serif, color: INK }}>Update your account</h2>
                                    </div>
                                    <div className="flex gap-6 border-b" style={{ borderColor: '#f0e6e0' }}>
                                        {[
                                            { key: 'profile', label: 'Profile', icon: User },
                                            { key: 'password', label: 'Password', icon: Lock },
                                            { key: 'notifications', label: 'Notifications', icon: Bell },
                                        ].map((tab) => (
                                            <button
                                                key={tab.key}
                                                onClick={() => setActiveTab(tab.key)}
                                                className="flex items-center gap-1.5 pb-2.5 text-sm font-semibold transition-colors"
                                                style={{
                                                    color: activeTab === tab.key ? MAROON : '#c9b3b8',
                                                    borderBottom: activeTab === tab.key ? `2px solid ${MAROON}` : '2px solid transparent',
                                                    marginBottom: -1,
                                                }}
                                            >
                                                <tab.icon className="h-3.5 w-3.5" />
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-2xl p-4 text-sm" style={{ background: '#FBE9E9', color: '#991b1b', border: '1px solid #f3c6c6' }}>
                                    {error}
                                </div>
                            )}

                            {activeTab === 'profile' && (
                                <div className="rounded-2xl bg-white p-6 sm:p-8" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)', borderTop: `2px solid ${GOLD}` }}>
                                    <h3 className="text-lg font-bold mb-6" style={{ ...serif, color: INK }}>Profile Settings</h3>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a56475' }}>Full Name</label>
                                            <input
                                                type="text"
                                                value={profile.fullName}
                                                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                                                className={inputClass}
                                                style={inputStyle}
                                                onFocus={onInputFocus} onBlur={onInputBlur}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a56475' }}>Email</label>
                                            <input
                                                type="email"
                                                value={profile.email}
                                                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                                className={inputClass}
                                                style={inputStyle}
                                                onFocus={onInputFocus} onBlur={onInputBlur}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a56475' }}>Phone</label>
                                            <input
                                                type="tel"
                                                value={profile.phone}
                                                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                                className={inputClass}
                                                style={inputStyle}
                                                onFocus={onInputFocus} onBlur={onInputBlur}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a56475' }}>Student ID</label>
                                            <input
                                                type="text"
                                                value={profile.studentId}
                                                disabled
                                                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                                style={{ background: IVORY, color: '#a89890', border: '1px solid #e9dfd8' }}
                                            />
                                        </div>

                                        {profileError && (
                                            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FBE9E9', color: '#991b1b' }}>
                                                {profileError}
                                            </div>
                                        )}
                                        {profileSuccess && (
                                            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#EAF3EC', color: '#15803d' }}>
                                                {profileSuccess}
                                            </div>
                                        )}

                                        <button
                                            onClick={handleSaveProfile}
                                            className="w-full rounded-full px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-90"
                                            style={{ background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
                                        >
                                            Save Profile
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'password' && (
                                <div className="rounded-2xl bg-white p-6 sm:p-8" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)', borderTop: `2px solid ${GOLD}` }}>
                                    <h3 className="text-lg font-bold mb-6" style={{ ...serif, color: INK }}>Change Password</h3>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a56475' }}>Current Password</label>
                                            <div className="relative">
                                                <input
                                                    type={showCurrent ? 'text' : 'password'}
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    placeholder="Enter current password"
                                                    className={inputClass}
                                                    style={inputStyle}
                                                    onFocus={onInputFocus} onBlur={onInputBlur}
                                                />
                                                <button
                                                    onClick={() => setShowCurrent(!showCurrent)}
                                                    className="absolute right-0 top-0 text-slate-400 hover:text-slate-600"
                                                >
                                                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a56475' }}>New Password</label>
                                            <div className="relative">
                                                <input
                                                    type={showNew ? 'text' : 'password'}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="Enter new password"
                                                    className={inputClass}
                                                    style={inputStyle}
                                                    onFocus={onInputFocus} onBlur={onInputBlur}
                                                />
                                                <button
                                                    onClick={() => setShowNew(!showNew)}
                                                    className="absolute right-0 top-0 text-slate-400 hover:text-slate-600"
                                                >
                                                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                            {newPassword && (
                                                <div className="mt-3">
                                                    <div className="flex gap-1 mb-2">
                                                        {[1, 2, 3, 4].map((i) => (
                                                            <span
                                                                key={i}
                                                                className="h-1.5 flex-1 rounded-full"
                                                                style={{ background: i <= strength.level ? strength.color : '#e9dfd8' }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="text-xs font-semibold" style={{ color: strength.color }}>
                                                        Password strength: {strength.label}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a56475' }}>Confirm New Password</label>
                                            <div className="relative">
                                                <input
                                                    type={showConfirm ? 'text' : 'password'}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="Re-enter new password"
                                                    className={inputClass}
                                                    style={inputStyle}
                                                    onFocus={onInputFocus} onBlur={onInputBlur}
                                                />
                                                <button
                                                    onClick={() => setShowConfirm(!showConfirm)}
                                                    className="absolute right-0 top-0 text-slate-400 hover:text-slate-600"
                                                >
                                                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        {(passwordError || passwordSuccess) && (
                                            <div className="rounded-xl px-4 py-3 text-sm" style={passwordError ? { background: '#FBE9E9', color: '#991b1b' } : { background: '#EAF3EC', color: '#15803d' }}>
                                                {passwordError || passwordSuccess}
                                            </div>
                                        )}

                                        <button
                                            onClick={handleChangePassword}
                                            disabled={passwordLoading}
                                            className="w-full rounded-full px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                                            style={{ background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
                                        >
                                            {passwordLoading ? 'Updating...' : 'Update Password'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'notifications' && (
                                <div className="rounded-2xl bg-white p-6 sm:p-8" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)', borderTop: `2px solid ${GOLD}` }}>
                                    <h3 className="text-lg font-bold mb-6" style={{ ...serif, color: INK }}>Notification Preferences</h3>
                                    <div className="space-y-3">
                                        {[
                                            { key: 'deadline_reminders', label: 'Deadline Reminders', desc: 'Get notified before submission deadlines' },
                                            { key: 'submission_updates', label: 'Submission Status Updates', desc: 'Get notified when staff reviews your submission' },
                                            { key: 'announcement_alerts', label: 'Announcement Alerts', desc: 'Get notified for new foundation announcements' },
                                            { key: 'duty_reminders', label: 'Duty Reminders', desc: 'Get notified for upcoming duty assignments' },
                                        ].map((item) => (
                                            <div key={item.key} className="flex items-center justify-between rounded-xl p-4" style={{ background: IVORY }}>
                                                <div className="min-w-0 pr-4">
                                                    <p className="font-semibold text-sm" style={{ color: INK }}>{item.label}</p>
                                                    <p className="text-xs mt-0.5" style={{ color: '#a89890' }}>{item.desc}</p>
                                                </div>
                                                <ToggleSwitch
                                                    checked={notifSettings[item.key]}
                                                    onChange={() => setNotifSettings(prev => ({
                                                        ...prev,
                                                        [item.key]: !prev[item.key]
                                                    }))}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {notifSuccess && (
                                        <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#EAF3EC', color: '#15803d' }}>
                                            {notifSuccess}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSaveNotifications}
                                        className="mt-6 w-full rounded-full px-5 py-3 text-sm font-semibold transition-colors"
                                        style={{ color: MAROON, border: `1.5px solid ${MAROON}`, background: '#fff' }}
                                    >
                                        Save Preferences
                                    </button>
                                </div>
                            )}

                            <div className="rounded-2xl bg-white p-6 text-center text-sm" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)', color: '#a89890' }}>
                                Apple Scholar · Academic Year 2026 — Scholarship Management System
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScholarSettings;