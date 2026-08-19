import { useState, useEffect } from 'react';
import axios from 'axios';
import { Sliders, Save, AlertTriangle } from 'lucide-react';

const SETTING_FIELDS = [
    { key: 'missed_submission_deduction', label: 'Missed Submission Deduction', hint: 'Points per missing report' },
    { key: 'service_hour_shortfall_deduction', label: 'Service Hour Shortfall Deduction', hint: 'Points per missing hour' },
    { key: 'absent_duty_deduction', label: 'Absent Duty Deduction', hint: 'Points per missed duty' },
    { key: 'late_submission_deduction', label: 'Late Submission Deduction', hint: 'Points per overdue month' },
    { key: 'negative_letter_deduction', label: 'Negative Letter Deduction', hint: 'Points per negative letter' },
    { key: 'quality_drop_deduction', label: 'Quality Drop Deduction', hint: 'Points per quality bucket below 70%' },
];

const RECOVERY_FIELDS = [
    { key: 'missed_submission_grace_count', label: 'Missed Submission Grace Count', hint: 'Reports allowed before penalties begin' },
    { key: 'late_submission_grace_count', label: 'Late Submission Grace Count', hint: 'Late periods allowed before penalties begin' },
    { key: 'early_submission_bonus', label: 'Early Submission Bonus', hint: 'Recovery points for an early monthly report' },
    { key: 'service_hours_completion_bonus', label: 'Service Hours Completion Bonus', hint: 'Recovery points for meeting service hours target' },
    { key: 'consecutive_early_bonus', label: 'Consecutive Early Submission Bonus', hint: 'Additional recovery for multiple early submissions' },
    { key: 'perfect_attendance_bonus', label: 'Perfect Attendance Bonus', hint: 'Recovery points for a perfect attendance record' },
    { key: 'monthly_recovery_cap', label: 'Monthly Recovery Cap', hint: 'Maximum recovery credit per month' },
];

const DEFAULT_SETTINGS = {
    min_compliance: '70',
    allowed_missed: '2',
    required_hours: '30',
    missed_submission_deduction: '2',
    service_hour_shortfall_deduction: '1',
    absent_duty_deduction: '2',
    late_submission_deduction: '1',
    negative_letter_deduction: '1',
    quality_drop_deduction: '0.5',
    extra_service_bonus: '2',
    good_maintenance_bonus: '5',
    missed_submission_grace_count: '2',
    late_submission_grace_count: '2',
    recovery_enabled: true,
    early_submission_bonus: '0.50',
    service_hours_completion_bonus: '2.00',
    consecutive_early_bonus: '1.00',
    perfect_attendance_bonus: '0.50',
    monthly_recovery_cap: '2.00',
};

const ComplianceManager = () => {
    const [minCompliance, setMinCompliance] = useState(DEFAULT_SETTINGS.min_compliance);
    const [allowedMissed, setAllowedMissed] = useState(DEFAULT_SETTINGS.allowed_missed);
    const [requiredHours, setRequiredHours] = useState(DEFAULT_SETTINGS.required_hours);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const RAW_API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const API = RAW_API.replace(/\/+$/, '').replace(/\/api$/, '') + '/api';

    useEffect(() => {
        let mounted = true;
        const fetchSettings = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const res = await axios.get(`${API}/admin/compliance-settings`, { headers });
                if (!mounted) return;
                setMinCompliance(String(res.data.min_compliance ?? DEFAULT_SETTINGS.min_compliance));
                setAllowedMissed(String(res.data.allowed_missed ?? DEFAULT_SETTINGS.allowed_missed));
                setRequiredHours(String(res.data.required_hours ?? DEFAULT_SETTINGS.required_hours));
                setSettings({
                    missed_submission_deduction: String(res.data.missed_submission_deduction ?? DEFAULT_SETTINGS.missed_submission_deduction),
                    service_hour_shortfall_deduction: String(res.data.service_hour_shortfall_deduction ?? DEFAULT_SETTINGS.service_hour_shortfall_deduction),
                    absent_duty_deduction: String(res.data.absent_duty_deduction ?? DEFAULT_SETTINGS.absent_duty_deduction),
                    late_submission_deduction: String(res.data.late_submission_deduction ?? DEFAULT_SETTINGS.late_submission_deduction),
                    negative_letter_deduction: String(res.data.negative_letter_deduction ?? DEFAULT_SETTINGS.negative_letter_deduction),
                    quality_drop_deduction: String(res.data.quality_drop_deduction ?? DEFAULT_SETTINGS.quality_drop_deduction),
                    missed_submission_grace_count: String(res.data.missed_submission_grace_count ?? DEFAULT_SETTINGS.missed_submission_grace_count),
                    late_submission_grace_count: String(res.data.late_submission_grace_count ?? DEFAULT_SETTINGS.late_submission_grace_count),
                    recovery_enabled: res.data.recovery_enabled !== undefined ? Boolean(res.data.recovery_enabled) : DEFAULT_SETTINGS.recovery_enabled,
                    early_submission_bonus: String(res.data.early_submission_bonus ?? DEFAULT_SETTINGS.early_submission_bonus),
                    service_hours_completion_bonus: String(res.data.service_hours_completion_bonus ?? DEFAULT_SETTINGS.service_hours_completion_bonus),
                    consecutive_early_bonus: String(res.data.consecutive_early_bonus ?? DEFAULT_SETTINGS.consecutive_early_bonus),
                    perfect_attendance_bonus: String(res.data.perfect_attendance_bonus ?? DEFAULT_SETTINGS.perfect_attendance_bonus),
                    monthly_recovery_cap: String(res.data.monthly_recovery_cap ?? DEFAULT_SETTINGS.monthly_recovery_cap),
                });
            } catch (e) {
                console.error('Failed to load compliance settings', e);
                setError('Failed to load compliance settings.');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchSettings();
        return () => { mounted = false; };
    }, [API]);

    const handleSettingChange = (key, value) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');

        try {
            const parsedCompliance = parseFloat(minCompliance);
            if (Number.isNaN(parsedCompliance) || parsedCompliance < 0 || parsedCompliance > 100) {
                setError('Minimum overall compliance must be a number between 0 and 100.');
                return;
            }

            const parsedMissed = parseInt(allowedMissed, 10);
            if (Number.isNaN(parsedMissed) || parsedMissed < 0 || parsedMissed > 100) {
                setError('Max missed submissions must be an integer between 0 and 100.');
                return;
            }

            const parsedHours = parseInt(requiredHours, 10);
            if (Number.isNaN(parsedHours) || parsedHours < 0 || parsedHours > 10000) {
                setError('Required service hours must be an integer between 0 and 10000.');
                return;
            }

            const parsedSettings = {};
            for (const field of SETTING_FIELDS) {
                const rawValue = settings[field.key];
                const value = field.key === 'quality_drop_deduction'
                    ? parseFloat(rawValue)
                    : parseInt(rawValue, 10);

                if (Number.isNaN(value) || value < 0 || value > 1000) {
                    setError(`${field.label} must be a non-negative number.`);
                    return;
                }
                parsedSettings[field.key] = value;
            }

            parsedSettings.extra_service_bonus = parseInt(settings.extra_service_bonus ?? DEFAULT_SETTINGS.extra_service_bonus, 10);
            parsedSettings.good_maintenance_bonus = parseInt(settings.good_maintenance_bonus ?? DEFAULT_SETTINGS.good_maintenance_bonus, 10);

            const parsedRecoverySettings = {
                missed_submission_grace_count: parseInt(settings.missed_submission_grace_count, 10),
                late_submission_grace_count: parseInt(settings.late_submission_grace_count, 10),
                recovery_enabled: Boolean(settings.recovery_enabled),
                early_submission_bonus: parseFloat(settings.early_submission_bonus),
                service_hours_completion_bonus: parseFloat(settings.service_hours_completion_bonus),
                consecutive_early_bonus: parseFloat(settings.consecutive_early_bonus),
                perfect_attendance_bonus: parseFloat(settings.perfect_attendance_bonus),
                monthly_recovery_cap: parseFloat(settings.monthly_recovery_cap),
            };

            if (Number.isNaN(parsedRecoverySettings.missed_submission_grace_count) || parsedRecoverySettings.missed_submission_grace_count < 0 || parsedRecoverySettings.missed_submission_grace_count > 100) {
                setError('Missed Submission Grace Count must be a non-negative integer.');
                return;
            }
            if (Number.isNaN(parsedRecoverySettings.late_submission_grace_count) || parsedRecoverySettings.late_submission_grace_count < 0 || parsedRecoverySettings.late_submission_grace_count > 100) {
                setError('Late Submission Grace Count must be a non-negative integer.');
                return;
            }
            for (const key of ['early_submission_bonus', 'service_hours_completion_bonus', 'consecutive_early_bonus', 'perfect_attendance_bonus', 'monthly_recovery_cap']) {
                const value = parsedRecoverySettings[key];
                if (Number.isNaN(value) || value < 0 || value > 100) {
                    setError(`${key.replace(/_/g, ' ')} must be a non-negative number.`);
                    return;
                }
            }

            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            await axios.post(`${API}/admin/compliance-settings`, {
                min_compliance: parsedCompliance.toFixed(2),
                allowed_missed: parsedMissed,
                required_hours: parsedHours,
                ...parsedSettings,
                ...parsedRecoverySettings,
            }, { headers });

            alert('System Threshold Parameters Synchronized Successfully.');
        } catch (e) {
            console.error('Failed to save compliance settings', e);
            if (e.response && (e.response.status === 401 || e.response.status === 403)) {
                setError('Unauthorized. Please sign in as an admin.');
            } else if (e.response && e.response.data && e.response.data.message) {
                setError(e.response.data.message);
            } else {
                setError('Failed to save settings.');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 font-sans">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8">
                <span className="text-[10px] bg-[#7f2d3a]/10 text-[#7f2d3a] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                    Rule-Based Criteria Settings
                </span>
                <h1 className="text-3xl font-black text-slate-800 mt-2 tracking-tight">Compliance Manager</h1>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">Threshold Parameters</h2>
                            <p className="text-sm text-slate-500">Configure incident-based deductions and bonuses for scholar compliance scoring.</p>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                            <Sliders size={16} className="text-[#7f2d3a]" />
                            Incident-based points
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Minimum Compliance Credits</label>
                            <input
                                type="text"
                                value={minCompliance}
                                onChange={(e) => setMinCompliance(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Max Missed Submissions</label>
                            <input
                                type="number"
                                value={allowedMissed}
                                onChange={(e) => setAllowedMissed(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Required Service Hours</label>
                            <input
                                type="number"
                                value={requiredHours}
                                onChange={(e) => setRequiredHours(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {SETTING_FIELDS.map(({ key, label, hint }) => (
                            <div key={key} className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="1000"
                                    value={settings[key]}
                                    onChange={(e) => handleSettingChange(key, e.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                                />
                                <p className="text-[10px] text-slate-400">{hint}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Grace & Recovery Settings</p>
                                <p className="text-sm text-slate-600">Enable grace periods and recovery bonuses for scholars who improve their performance.</p>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={settings.recovery_enabled}
                                    onChange={(e) => handleSettingChange('recovery_enabled', e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-[#7f2d3a] focus:ring-[#7f2d3a]"
                                />
                                Recovery Enabled
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {RECOVERY_FIELDS.map(({ key, label, hint }) => (
                            <div key={key} className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</label>
                                <input
                                    type={key.includes('bonus') || key.includes('cap') ? 'text' : 'number'}
                                    min="0"
                                    step={key.includes('bonus') || key.includes('cap') ? '0.01' : '1'}
                                    max="1000"
                                    value={settings[key]}
                                    onChange={(e) => handleSettingChange(key, e.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                                />
                                <p className="text-[10px] text-slate-400">{hint}</p>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                            <div className="flex items-start gap-2">
                                <AlertTriangle size={16} />
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#7f2d3a] px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#5f222a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>

                <aside className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">How this works</p>
                        <h2 className="text-xl font-black text-slate-900">Weight-based flagged scoring</h2>
                        <p className="text-sm leading-6 text-slate-600">
                            The compliance engine uses these values as incident-based point deductions and bonuses. Each rule lowers or restores a scholar's current compliance score, and the final status is compared against the configured minimum threshold.
                        </p>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                        <p className="font-semibold text-slate-800">Incident-based scoring</p>
                        <ul className="mt-2 space-y-1 text-[13px] text-slate-600">
                            <li>Missed submissions deduct per missing report.</li>
                            <li>Service hour shortfalls deduct per missing hour.</li>
                            <li>Absent duty, late submission, negative sentiment, and quality drops are incident-based.</li>
                            <li>Extra service hours and good maintenance earn bonus deduction credit.</li>
                        </ul>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                        <p className="font-semibold text-slate-800">Recovery and grace support</p>
                        <p className="mt-2 text-slate-600">
                            New grace period and recovery controls are now editable. Scholars can earn recovery credits for early reports, meeting service hour targets, perfect attendance, and consecutive early submissions.
                        </p>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-[#7f2d3a]/5 p-4 text-sm text-slate-800">
                        <p className="font-semibold text-[#3f1c1e]">Save rule</p>
                        <p className="mt-2 text-slate-600">These fields configure how many compliance points are deducted or restored for each incident, rather than fixed weights.</p>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default ComplianceManager;
