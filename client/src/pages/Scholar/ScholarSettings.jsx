import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Lock, Eye, EyeOff, CheckCircle, AlertTriangle,
    Shield, Bell, User, ChevronRight
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

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

    const getPasswordStrength = (pass) => {
        if (!pass) return { level: 0, label: '', color: '' };
        let score = 0;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-400' };
        if (score === 2) return { level: 2, label: 'Fair', color: 'bg-amber-400' };
        if (score === 3) return { level: 3, label: 'Good', color: 'bg-blue-400' };
        return { level: 4, label: 'Strong', color: 'bg-emerald-500' };
    };

    const strength = getPasswordStrength(newPassword);

    const inputClass = "w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 outline-none focus:border-[#7f2d3a] focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all placeholder:text-slate-300";

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

    const ToggleSwitch = ({ checked, onChange }) => (
        <button
            onClick={onChange}
            className={`relative w-11 h-6 rounded-full transition-all duration-300 ${checked ? 'bg-[#7f2d3a]' : 'bg-slate-200'}`}
        >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${checked ? 'left-6' : 'left-1'}`} />
        </button>
    );

    const displayName = profile.fullName || localStorage.getItem('name') || 'Scholar';
    const displayEmail = profile.email || localStorage.getItem('email') || 'you@example.com';

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 font-sans">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 mb-6">
                    <span className="inline-flex items-center rounded-full bg-[#7f2d3a]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#7f2d3a]">
                        Scholar Settings
                    </span>
                    <h1 className="mt-4 text-3xl font-black text-slate-900 tracking-tight">Account Preferences</h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-500">
                        Manage your profile details, password, and notification preferences in one place.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                    <aside className="space-y-6">
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5">
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7f2d3a] text-white text-xl font-black">
                                    {displayName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-black text-slate-900">{displayName}</p>
                                    <p className="text-xs text-slate-400">{displayEmail}</p>
                                </div>
                            </div>
                            <div className="mt-5 rounded-3xl bg-emerald-50 p-4 text-emerald-700">
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]">
                                    <Shield size={14} /> Verified Scholar
                                </div>
                                <p className="mt-2 text-[11px] text-emerald-700/80">You have access to scholar tools and updates.</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-4">Quick Links</p>
                            <div className="space-y-2">
                                {[
                                    { label: 'Requirement Checklist', path: '/scholar/checklist' },
                                    { label: 'Scholar Duties', path: '/scholar/duties' },
                                ].map((item) => (
                                    <button
                                        key={item.path}
                                        onClick={() => window.location.href = item.path}
                                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[#7f2d3a] rounded-[2rem] p-5 text-white">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-80 mb-4">Security Tips</p>
                            <ul className="space-y-3 text-sm text-white/80">
                                <li>Use at least 8 characters.</li>
                                <li>Mix uppercase and lowercase.</li>
                                <li>Add numbers and symbols.</li>
                                <li>Never share your password.</li>
                            </ul>
                        </div>
                    </aside>

                    <section className="space-y-6">
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 sm:p-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Settings</p>
                                    <h2 className="mt-2 text-2xl font-black text-slate-900">Update your account</h2>
                                </div>
                                <div className="inline-flex rounded-3xl bg-slate-100 p-1">
                                    {[
                                        { key: 'profile', label: 'Profile', icon: User },
                                        { key: 'password', label: 'Password', icon: Lock },
                                        { key: 'notifications', label: 'Notifications', icon: Bell },
                                    ].map((tab) => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={`inline-flex items-center gap-2 rounded-3xl px-4 py-3 text-sm font-semibold transition ${activeTab === tab.key ? 'bg-white text-[#7f2d3a] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            <tab.icon className="h-4 w-4" />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {activeTab === 'profile' && (
                            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 sm:p-8">
                                <h3 className="text-lg font-black text-slate-900 mb-5">Profile Settings</h3>
                                <div className="space-y-5">
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
                                        <input
                                            type="text"
                                            value={profile.fullName}
                                            onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
                                        <input
                                            type="email"
                                            value={profile.email}
                                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700">Phone</label>
                                        <input
                                            type="tel"
                                            value={profile.phone}
                                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700">Student ID</label>
                                        <input
                                            type="text"
                                            value={profile.studentId}
                                            disabled
                                            className="w-full bg-slate-100 border border-slate-200 px-4 py-3 rounded-xl text-sm text-slate-500 outline-none"
                                        />
                                    </div>

                                    {profileError && (
                                        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                                            {profileError}
                                        </div>
                                    )}
                                    {profileSuccess && (
                                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                            {profileSuccess}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSaveProfile}
                                        className="w-full rounded-2xl bg-[#7f2d3a] px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#63232d]"
                                    >
                                        Save Profile
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'password' && (
                            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 sm:p-8">
                                <h3 className="text-lg font-black text-slate-900 mb-5">Change Password</h3>
                                <div className="space-y-5">
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700">Current Password</label>
                                        <div className="relative">
                                            <input
                                                type={showCurrent ? 'text' : 'password'}
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                placeholder="Enter current password"
                                                className={inputClass}
                                            />
                                            <button
                                                onClick={() => setShowCurrent(!showCurrent)}
                                                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                                            >
                                                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700">New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showNew ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Enter new password"
                                                className={inputClass}
                                            />
                                            <button
                                                onClick={() => setShowNew(!showNew)}
                                                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
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
                                                            className={`h-1.5 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-slate-100'}`}
                                                        />
                                                    ))}
                                                </div>
                                                <p className={`text-xs font-semibold ${
                                                    strength.level <= 1 ? 'text-red-500' :
                                                    strength.level === 2 ? 'text-amber-500' :
                                                    strength.level === 3 ? 'text-sky-500' : 'text-emerald-500'
                                                }`}>
                                                    Password strength: {strength.label}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700">Confirm New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showConfirm ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Re-enter new password"
                                                className={inputClass}
                                            />
                                            <button
                                                onClick={() => setShowConfirm(!showConfirm)}
                                                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                                            >
                                                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {(passwordError || passwordSuccess) && (
                                        <div className={`rounded-2xl px-4 py-3 text-sm ${passwordError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                            {passwordError || passwordSuccess}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleChangePassword}
                                        disabled={passwordLoading}
                                        className="w-full rounded-2xl bg-[#7f2d3a] px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#63232d] disabled:opacity-50"
                                    >
                                        {passwordLoading ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 sm:p-8">
                                <h3 className="text-lg font-black text-slate-900 mb-5">Notification Preferences</h3>
                                <div className="space-y-4">
                                    {[
                                        { key: 'deadline_reminders', label: 'Deadline Reminders', desc: 'Get notified before submission deadlines' },
                                        { key: 'submission_updates', label: 'Submission Status Updates', desc: 'Get notified when staff reviews your submission' },
                                        { key: 'announcement_alerts', label: 'Announcement Alerts', desc: 'Get notified for new foundation announcements' },
                                        { key: 'duty_reminders', label: 'Duty Reminders', desc: 'Get notified for upcoming duty assignments' },
                                    ].map((item) => (
                                        <div key={item.key} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                            <div>
                                                <p className="font-semibold text-slate-900">{item.label}</p>
                                                <p className="text-sm text-slate-500">{item.desc}</p>
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
                                    <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                        {notifSuccess}
                                    </div>
                                )}

                                <button
                                    onClick={handleSaveNotifications}
                                    className="mt-6 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Save Preferences
                                </button>
                            </div>
                        )}

                        <div className="rounded-[2rem] border border-slate-100 bg-white p-6 text-center text-sm text-slate-500">
                            Apple Scholar Academic Year 2026 — Scholarship Management System
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ScholarSettings;
