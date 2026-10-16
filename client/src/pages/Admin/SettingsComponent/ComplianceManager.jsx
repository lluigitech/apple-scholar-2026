import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Save, AlertTriangle, Percent, Clock3, ToggleLeft, ToggleRight, ListChecks, RotateCcw, CheckCircle2,
    FileText, UserX, CalendarClock, BarChart3, RefreshCw, Gift, Send, Users, Trophy,
} from 'lucide-react';
import AdminPageHeader from '../../../components/Admin/AdminPageHeader';

// ── Design tokens — single source of truth for this page ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_TINT = 'rgba(109, 33, 64, 0.08)';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#6B8F71';
const SUCCESS_TINT = 'rgba(107,143,113,.12)';
const WARNING = '#C08A3E';
const DANGER = '#A24A4A';
const DANGER_TINT = 'rgba(162,74,74,.12)';
const RADIUS = 16;

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const SETTING_FIELDS = [
    { key: 'missed_submission_deduction', label: 'Missed submission', hint: 'Deduction per missing report', icon: FileText },
    { key: 'service_hour_shortfall_deduction', label: 'Service hour shortfall', hint: 'Deduction per missing hour', icon: Clock3 },
    { key: 'absent_duty_deduction', label: 'Absent duty', hint: 'Deduction per missed duty', icon: UserX },
    { key: 'late_submission_deduction', label: 'Late submission', hint: 'Deduction per overdue month', icon: CalendarClock },
    { key: 'quality_drop_deduction', label: 'Quality drop', hint: 'Deduction per bucket below 70%', icon: BarChart3 },
];

const RECOVERY_GRACE_FIELDS = [
    { key: 'missed_submission_grace_count', label: 'Missed Submission Grace', hint: 'Reports allowed before penalty' },
    { key: 'late_submission_grace_count', label: 'Late Submission Grace', hint: 'Late periods allowed before penalty' },
];

const RECOVERY_BONUS_FIELDS = [
    { key: 'early_submission_bonus', label: 'Early submission', hint: 'Bonus for early monthly report', icon: Send },
    { key: 'service_hours_completion_bonus', label: 'Service hours met', hint: 'Bonus for completing required hours', icon: Clock3 },
    { key: 'consecutive_early_bonus', label: 'Consecutive early', hint: 'Bonus for multiple early reports', icon: BarChart3 },
    { key: 'perfect_attendance_bonus', label: 'Perfect attendance', hint: 'Bonus for perfect attendance', icon: Users },
    { key: 'monthly_recovery_cap', label: 'Monthly recovery cap', hint: 'Maximum bonus points per month', icon: Trophy },
];

const DEFAULT_SETTINGS = {
    min_compliance: '70',
    allowed_missed: '2',
    required_hours: '30',
    missed_submission_deduction: '2',
    service_hour_shortfall_deduction: '1',
    absent_duty_deduction: '2',
    late_submission_deduction: '1',
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

const cardStyle = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS };
const labelStyle = { ...body, fontSize: '0.78rem', fontWeight: 600, color: INK, display: 'block', marginBottom: 6 };
const helperStyle = { ...body, fontSize: '0.72rem', color: MUTED, marginTop: 6 };

const Skeleton = ({ style }) => (
    <div className="skeleton-pulse" style={{ background: '#EFE7D8', borderRadius: 8, ...style }} />
);

// ── Small presentational helpers (UI only) ──

const IconBadge = ({ icon: IconEl, size = 40 }) => (
    <span
        className="flex items-center justify-center shrink-0"
        style={{ width: size, height: size, borderRadius: '50%', background: PRIMARY_TINT, color: PRIMARY }}
    >
        <IconEl size={Math.round(size * 0.45)} strokeWidth={2} />
    </span>
);

const CardHeader = ({ icon, title, subtitle, right }) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
            <IconBadge icon={icon} />
            <div className="min-w-0">
                <h2 style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK, lineHeight: 1.2 }}>{title}</h2>
                <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 2 }}>{subtitle}</p>
            </div>
        </div>
        {right}
    </div>
);

// Input with a unit label inside the box. `variant="field"` = full width, `variant="row"` = compact right-aligned cell.
const UnitInput = ({ id, value, onChange, unit, min, max, step, disabled, text, variant = 'row', ariaLabel }) => (
    <div
        className="unit-box flex items-stretch overflow-hidden"
        style={{
            border: `1px solid ${BORDER}`, borderRadius: 10, background: disabled ? BG : '#fff',
            width: variant === 'row' ? 'clamp(120px, 34vw, 150px)' : '100%', opacity: disabled ? 0.6 : 1,
        }}
    >
        <input
            id={id}
            aria-label={ariaLabel}
            type={text ? 'text' : 'number'}
            inputMode={text ? 'decimal' : undefined}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            style={{ ...body, fontSize: '0.88rem', color: INK, background: 'transparent', border: 'none', outline: 'none', minWidth: 0, flex: 1, padding: '9px 12px', height: 40 }}
        />
        {unit && (
            <span
                className="flex items-center"
                style={{
                    ...body, fontSize: '0.78rem', color: MUTED, padding: '0 12px', whiteSpace: 'nowrap',
                    background: variant === 'row' ? BG : 'transparent', borderLeft: variant === 'row' ? `1px solid ${BORDER}` : 'none',
                }}
            >
                {unit}
            </span>
        )}
    </div>
);

const RuleRow = ({ icon, label, hint, children }) => (
    <div className="rule-row flex items-center justify-between gap-3" style={{ padding: '12px 4px' }}>
        <div className="flex items-center gap-3 min-w-0">
            <IconBadge icon={icon} size={34} />
            <div className="min-w-0">
                <p style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: INK }}>{label}</p>
                <p style={{ ...body, fontSize: '0.75rem', color: MUTED, marginTop: 1 }}>{hint}</p>
            </div>
        </div>
        <div className="shrink-0">{children}</div>
    </div>
);

// `embedded` = rendered inside the Settings page, which already shows the page header and tabs.
const ComplianceManager = ({ embedded = false }) => {
    const [minCompliance, setMinCompliance] = useState(DEFAULT_SETTINGS.min_compliance);
    const [allowedMissed, setAllowedMissed] = useState(DEFAULT_SETTINGS.allowed_missed);
    const [requiredHours, setRequiredHours] = useState(DEFAULT_SETTINGS.required_hours);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);

    const snapshotRef = useRef(null);

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

                const nextMin = String(res.data.min_compliance ?? DEFAULT_SETTINGS.min_compliance);
                const nextMissed = String(res.data.allowed_missed ?? DEFAULT_SETTINGS.allowed_missed);
                const nextHours = String(res.data.required_hours ?? DEFAULT_SETTINGS.required_hours);
                const nextSettings = {
                    missed_submission_deduction: String(res.data.missed_submission_deduction ?? DEFAULT_SETTINGS.missed_submission_deduction),
                    service_hour_shortfall_deduction: String(res.data.service_hour_shortfall_deduction ?? DEFAULT_SETTINGS.service_hour_shortfall_deduction),
                    absent_duty_deduction: String(res.data.absent_duty_deduction ?? DEFAULT_SETTINGS.absent_duty_deduction),
                    late_submission_deduction: String(res.data.late_submission_deduction ?? DEFAULT_SETTINGS.late_submission_deduction),
                    quality_drop_deduction: String(res.data.quality_drop_deduction ?? DEFAULT_SETTINGS.quality_drop_deduction),
                    missed_submission_grace_count: String(res.data.missed_submission_grace_count ?? DEFAULT_SETTINGS.missed_submission_grace_count),
                    late_submission_grace_count: String(res.data.late_submission_grace_count ?? DEFAULT_SETTINGS.late_submission_grace_count),
                    recovery_enabled: res.data.recovery_enabled !== undefined ? Boolean(res.data.recovery_enabled) : DEFAULT_SETTINGS.recovery_enabled,
                    early_submission_bonus: String(res.data.early_submission_bonus ?? DEFAULT_SETTINGS.early_submission_bonus),
                    service_hours_completion_bonus: String(res.data.service_hours_completion_bonus ?? DEFAULT_SETTINGS.service_hours_completion_bonus),
                    consecutive_early_bonus: String(res.data.consecutive_early_bonus ?? DEFAULT_SETTINGS.consecutive_early_bonus),
                    perfect_attendance_bonus: String(res.data.perfect_attendance_bonus ?? DEFAULT_SETTINGS.perfect_attendance_bonus),
                    monthly_recovery_cap: String(res.data.monthly_recovery_cap ?? DEFAULT_SETTINGS.monthly_recovery_cap),
                };

                setMinCompliance(nextMin);
                setAllowedMissed(nextMissed);
                setRequiredHours(nextHours);
                setSettings(nextSettings);
                snapshotRef.current = { min: nextMin, missed: nextMissed, hours: nextHours, settings: nextSettings };
                setDirty(false);
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

    const markDirty = () => setDirty(true);

    const handleSettingChange = (key, value) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
        markDirty();
    };

    const handleMinComplianceChange = (v) => { setMinCompliance(v); markDirty(); };
    const handleAllowedMissedChange = (v) => { setAllowedMissed(v); markDirty(); };
    const handleRequiredHoursChange = (v) => { setRequiredHours(v); markDirty(); };

    const handleReset = () => {
        if (!snapshotRef.current) return;
        setMinCompliance(snapshotRef.current.min);
        setAllowedMissed(snapshotRef.current.missed);
        setRequiredHours(snapshotRef.current.hours);
        setSettings(snapshotRef.current.settings);
        setError('');
        setDirty(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSaved(false);

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

            snapshotRef.current = { min: minCompliance, missed: allowedMissed, hours: requiredHours, settings };
            setDirty(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
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

    const activeRuleCount = SETTING_FIELDS.length + RECOVERY_GRACE_FIELDS.length + RECOVERY_BONUS_FIELDS.length;
    const minScoreNumber = parseFloat(minCompliance);
    const minScoreLabel = Number.isNaN(minScoreNumber) ? `${minCompliance}%` : `${minScoreNumber.toFixed(2)}%`;

    const kpiCards = [
        { key: 'min', label: 'Minimum Score', value: minScoreLabel, icon: Percent },
        { key: 'hours', label: 'Required Service Hours', value: `${requiredHours} hrs`, icon: Clock3 },
        { key: 'recovery', label: 'Recovery Status', value: settings.recovery_enabled ? 'On' : 'Off', icon: settings.recovery_enabled ? ToggleRight : ToggleLeft },
        { key: 'rules', label: 'Active Policy Rules', value: activeRuleCount, icon: ListChecks },
    ];

    const recoveryOff = !settings.recovery_enabled;

    return (
        <section className="min-h-full" style={{ background: embedded ? 'transparent' : BG }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');

                .unit-box:focus-within { border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px ${PRIMARY_TINT}; }

                .skeleton-pulse { animation: exec-pulse 1.4s ease-in-out infinite; }
                @keyframes exec-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

                .rule-row + .rule-row { border-top: 1px solid ${BORDER}; }
                .rule-row:hover { background: #FBF7EE; }

                .savebar { position: sticky; bottom: 0; z-index: 20; }
                @media (max-width: 1023px) { .savebar { position: static; } }
            `}</style>

            <div
                className={embedded ? 'w-full' : 'w-full px-4 sm:px-6 lg:px-8 pb-14'}
                style={embedded ? { paddingBottom: 16 } : undefined}
            >
                {!embedded && (
                    <AdminPageHeader
                        title="Compliance Settings"
                        description="Configure scholar compliance thresholds, policy rules, and recovery settings."
                    />
                )}
                {error && (
                    <div role="alert" className="mb-5 flex items-start gap-2.5 px-4 py-3" style={{ background: DANGER_TINT, borderRadius: 14 }}>
                        <AlertTriangle size={16} style={{ color: DANGER, marginTop: 1, flexShrink: 0 }} />
                        <span style={{ ...body, fontSize: '0.83rem', color: DANGER }}>{error}</span>
                    </div>
                )}
                {saved && (
                    <div role="status" className="mb-5 flex items-center gap-2.5 px-4 py-3" style={{ background: SUCCESS_TINT, borderRadius: 14 }}>
                        <CheckCircle2 size={16} style={{ color: SUCCESS, flexShrink: 0 }} />
                        <span style={{ ...body, fontSize: '0.83rem', color: SUCCESS }}>Policy saved successfully.</span>
                    </div>
                )}

                {/* ── 1. KPI cards ── */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ marginBottom: 20 }}>
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4" style={{ ...cardStyle, padding: '16px 20px' }}>
                                <Skeleton style={{ width: 44, height: 44, borderRadius: '50%' }} />
                                <div style={{ flex: 1 }}>
                                    <Skeleton style={{ width: '50%', height: 22 }} />
                                    <Skeleton style={{ width: '70%', height: 10, marginTop: 8 }} />
                                </div>
                            </div>
                        ))
                    ) : (
                        kpiCards.map(({ key, label, value, icon }) => (
                            <div key={key} className="flex items-center gap-4" style={{ ...cardStyle, padding: '16px 20px' }}>
                                <IconBadge icon={icon} size={44} />
                                <div className="min-w-0">
                                    <p style={{ ...display, fontSize: '1.5rem', fontWeight: 700, color: INK, lineHeight: 1.1 }}>{value}</p>
                                    <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, marginTop: 4 }}>
                                        {label}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {loading ? (
                    <div className="flex flex-col gap-5">
                        {[110, 260, 240].map((h, i) => (
                            <div key={i} style={{ ...cardStyle, padding: 20 }}>
                                <Skeleton style={{ width: 220, height: 16 }} />
                                <Skeleton style={{ width: '100%', height: h - 60, marginTop: 16 }} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">

                        {/* ── 2. Core Compliance Requirements ── */}
                        <div style={{ ...cardStyle, padding: 20 }}>
                            <CardHeader icon={FileText} title="Core Compliance Requirements" subtitle="Set the main compliance thresholds for all scholars." />
                            <div className="grid gap-5 sm:grid-cols-3" style={{ marginTop: 18 }}>
                                <div>
                                    <label htmlFor="min-compliance" style={labelStyle}>Minimum Compliance</label>
                                    <UnitInput id="min-compliance" variant="field" value={minCompliance} onChange={handleMinComplianceChange} unit="%" min="0" max="100" step="0.01" />
                                    <p style={helperStyle}>Minimum overall compliance score</p>
                                </div>
                                <div>
                                    <label htmlFor="allowed-missed" style={labelStyle}>Max Missed Submissions</label>
                                    <UnitInput id="allowed-missed" variant="field" value={allowedMissed} onChange={handleAllowedMissedChange} min="0" max="100" />
                                    <p style={helperStyle}>Reports allowed before penalty</p>
                                </div>
                                <div>
                                    <label htmlFor="required-hours" style={labelStyle}>Required Service Hours</label>
                                    <UnitInput id="required-hours" variant="field" value={requiredHours} onChange={handleRequiredHoursChange} unit="hrs" min="0" max="10000" />
                                    <p style={helperStyle}>Total service hours per period</p>
                                </div>
                            </div>
                        </div>

                        {/* ── 3. Penalty Rules ── */}
                        <div style={{ ...cardStyle, padding: 20 }}>
                            <CardHeader icon={AlertTriangle} title="Penalty Rules" subtitle="Points deducted for each compliance violation." />
                            <div style={{ marginTop: 14 }}>
                                {SETTING_FIELDS.map(({ key, label, hint, icon }) => (
                                    <RuleRow key={key} icon={icon} label={label} hint={hint}>
                                        <UnitInput
                                            ariaLabel={`${label} points`}
                                            value={settings[key]}
                                            onChange={(v) => handleSettingChange(key, v)}
                                            unit="points"
                                            min="0" max="1000"
                                            step={key === 'quality_drop_deduction' ? '0.1' : '1'}
                                        />
                                    </RuleRow>
                                ))}
                            </div>
                        </div>

                        {/* ── 4. Recovery System + Recovery Bonuses ── */}
                        <div className="grid gap-5 lg:grid-cols-2 items-start">

                            <div style={{ ...cardStyle, padding: 20 }}>
                                <CardHeader icon={RefreshCw} title="Recovery System" subtitle="Configure recovery settings and grace allowances." />

                                <div className="flex items-center justify-between gap-4" style={{ marginTop: 16, padding: '12px 14px', background: BG, borderRadius: 12 }}>
                                    <div>
                                        <p style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: INK }}>Enable Recovery System</p>
                                        <p style={{ ...body, fontSize: '0.75rem', color: MUTED, marginTop: 1 }}>Allow scholars to recover from deductions.</p>
                                    </div>
                                    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none shrink-0">
                                        <span style={{ ...body, fontSize: '0.74rem', fontWeight: 700, color: settings.recovery_enabled ? SUCCESS : MUTED }}>
                                            {settings.recovery_enabled ? 'On' : 'Off'}
                                        </span>
                                        <span className="relative inline-block" style={{ width: 40, height: 22 }}>
                                            <input
                                                type="checkbox"
                                                role="switch"
                                                aria-label="Enable recovery system"
                                                checked={settings.recovery_enabled}
                                                onChange={(e) => handleSettingChange('recovery_enabled', e.target.checked)}
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            />
                                            <span className="absolute inset-0 rounded-full transition-colors" style={{ background: settings.recovery_enabled ? PRIMARY : BORDER }} />
                                            <span className="absolute rounded-full bg-white transition-transform" style={{ width: 18, height: 18, top: 2, left: 2, transform: settings.recovery_enabled ? 'translateX(18px)' : 'translateX(0)', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
                                        </span>
                                    </label>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-3" style={{ marginTop: 18, opacity: recoveryOff ? 0.55 : 1, transition: 'opacity 200ms ease' }}>
                                    {RECOVERY_GRACE_FIELDS.map(({ key, label, hint }) => (
                                        <div key={key}>
                                            <label htmlFor={`rec-${key}`} style={labelStyle}>{label}</label>
                                            <UnitInput id={`rec-${key}`} variant="field" value={settings[key]} onChange={(v) => handleSettingChange(key, v)} disabled={recoveryOff} min="0" max="100" />
                                            <p style={helperStyle}>{hint}</p>
                                        </div>
                                    ))}
                                    <div>
                                        <label htmlFor="rec-cap" style={labelStyle}>Monthly Recovery Cap</label>
                                        <UnitInput id="rec-cap" variant="field" text value={settings.monthly_recovery_cap} onChange={(v) => handleSettingChange('monthly_recovery_cap', v)} unit="points" disabled={recoveryOff} />
                                        <p style={helperStyle}>Maximum recovery points per month</p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ ...cardStyle, padding: 20, opacity: recoveryOff ? 0.75 : 1, transition: 'opacity 200ms ease' }}>
                                <CardHeader icon={Gift} title="Recovery Bonuses" subtitle="Points awarded for good performance and recovery." />
                                <div style={{ marginTop: 14 }}>
                                    {RECOVERY_BONUS_FIELDS.map(({ key, label, hint, icon }) => (
                                        <RuleRow key={key} icon={icon} label={label} hint={hint}>
                                            <UnitInput
                                                ariaLabel={`${label} points`}
                                                text
                                                value={settings[key]}
                                                onChange={(v) => handleSettingChange(key, v)}
                                                unit="points"
                                                disabled={recoveryOff}
                                            />
                                        </RuleRow>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── 5. Action bar ── */}
            <div
                className="savebar"
                style={embedded
                    ? { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }
                    : { background: SURFACE, borderTop: `1px solid ${BORDER}` }}
            >
                <div className="w-full flex flex-wrap items-center justify-between gap-3" style={{ minHeight: 64, padding: embedded ? '10px 20px' : '10px 32px' }}>
                    <div className="flex items-center gap-2">
                        {dirty ? (
                            <>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: WARNING, display: 'inline-block' }} />
                                <span style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: WARNING }}>Unsaved changes</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={14} style={{ color: SUCCESS }} />
                                <span style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: MUTED }}>All changes saved</span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={!dirty || saving}
                            className="flex items-center gap-2"
                            style={{
                                ...body, fontSize: '0.82rem', fontWeight: 600, color: dirty ? PRIMARY : MUTED,
                                background: SURFACE, border: `1px solid ${dirty ? PRIMARY : BORDER}`,
                                borderRadius: 10, height: 40, padding: '0 16px',
                                cursor: dirty ? 'pointer' : 'default', opacity: dirty ? 1 : 0.6,
                            }}
                        >
                            <RotateCcw size={14} /> Reset Changes
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="flex items-center gap-2"
                            style={{
                                ...body, fontSize: '0.82rem', fontWeight: 700, color: '#fff',
                                background: PRIMARY, border: 'none', borderRadius: 10, height: 40, padding: '0 18px',
                                cursor: saving || loading ? 'wait' : 'pointer', opacity: saving || loading ? 0.7 : 1,
                            }}
                        >
                            <Save size={14} /> {saving ? 'Saving…' : saved ? 'Saved' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ComplianceManager;