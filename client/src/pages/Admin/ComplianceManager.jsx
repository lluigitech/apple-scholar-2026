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
    { key: 'extra_service_bonus', label: 'Extra Service Bonus', hint: 'Points removed for extra service hours' },
    { key: 'good_maintenance_bonus', label: 'Good Maintenance Bonus', hint: 'Points removed for strong quality & attendance' },
];

const DEFAULT_SETTINGS = {
    min_compliance: '70',
    allowed_missed: '2',
    required_hours: '30',
    missed_submission_deduction: '12',
    service_hour_shortfall_deduction: '2',
    absent_duty_deduction: '6',
    late_submission_deduction: '5',
    negative_letter_deduction: '8',
    quality_drop_deduction: '4',
    extra_service_bonus: '2',
    good_maintenance_bonus: '5',
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
                    extra_service_bonus: String(res.data.extra_service_bonus ?? DEFAULT_SETTINGS.extra_service_bonus),
                    good_maintenance_bonus: String(res.data.good_maintenance_bonus ?? DEFAULT_SETTINGS.good_maintenance_bonus),
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
                const value = parseInt(settings[field.key], 10);
                if (Number.isNaN(value) || value < 0 || value > 1000) {
                    setError(`${field.label} must be a non-negative integer.`);
                    return;
                }
                parsedSettings[field.key] = value;
            }

            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            await axios.post(`${API}/admin/compliance-settings`, {
                min_compliance: parsedCompliance.toFixed(2),
                allowed_missed: parsedMissed,
                required_hours: parsedHours,
                ...parsedSettings,
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
                            <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Minimum Overall Compliance</label>
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
                            The flagged scholar algorithm reads these values from the database and computes weighted deductions across seven risk categories. The final flagged status is based on whether the combined compliance score falls below the configured minimum.
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
