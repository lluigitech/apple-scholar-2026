import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
    CalendarDays, MapPin, Clock, ChevronDown, ChevronUp,
    CheckCircle2, XCircle, QrCode, X, Loader2, Send,
    Search, SlidersHorizontal, ClipboardList, TrendingUp,
    AlarmClock, ShieldCheck, ArrowRight, Inbox
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const API = 'http://localhost:5000/api';
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

// ── Scholar Portal design system ──
// Same tokens as the rest of the Scholar module (dashboard, compliance, etc.)
// so this page reads as one continuous experience rather than a separate app.
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

// Required service hours for the semester. The backend does not currently
// return a per-scholar requirement, so this is a placeholder assumption —
// swap in the real value (e.g. from a scholar/profile endpoint) when available.
const REQUIRED_HOURS = 20;

const statusMeta = {
    pending:   { label: 'Pending',  color: WARNING, tint: `${WARNING}14`, icon: AlarmClock },
    completed: { label: 'Verified', color: SUCCESS, tint: `${SUCCESS}14`, icon: ShieldCheck },
    missed:    { label: 'Missed',   color: DANGER,  tint: `${DANGER}14`,  icon: XCircle },
};

const StatusBadge = ({ status, size = 'md' }) => {
    const cfg = statusMeta[status] || statusMeta.pending;
    const Icon = cfg.icon;
    const small = size === 'sm';
    return (
        <span
            className="inline-flex items-center gap-1.5 flex-shrink-0"
            style={{
                ...body, fontSize: small ? '0.7rem' : '0.76rem', fontWeight: 600, color: cfg.color,
                background: cfg.tint, borderRadius: 999, padding: small ? '3px 9px' : '4px 12px',
            }}
        >
            <Icon size={small ? 11 : 12} />
            {cfg.label}
        </span>
    );
};

// Helper: derive hours for a duty. Prefers an explicit `hours` field from the
// API; falls back to computing from time_start/time_end when present.
const getDutyHours = (duty) => {
    if (duty.hours != null && !Number.isNaN(Number(duty.hours))) return Number(duty.hours);
    if (duty.duration_hours != null) return Number(duty.duration_hours);
    if (duty.time_start && duty.time_end) {
        const toDecimal = (t) => {
            const [h, m] = t.split(':').map(Number);
            return (h || 0) + (m || 0) / 60;
        };
        let diff = toDecimal(duty.time_end) - toDecimal(duty.time_start);
        if (diff < 0) diff += 24;
        return diff;
    }
    return 0;
};

// ─── Circular progress ring (service hours) ──────────────────────────────
const CircularProgress = ({ percent, size = 76, stroke = 8, color = SUCCESS }) => {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${BRONZE}22`} strokeWidth={stroke} />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <text x="50%" y="53%" textAnchor="middle" style={{ ...body, fontSize: size * 0.2, fontWeight: 700, fill: INK }}>
                {Math.round(percent)}%
            </text>
        </svg>
    );
};

// ─── KPI card ─────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, description, accent = PRIMARY }) => (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 20px' }}>
        <div className="flex items-center justify-between">
            <div className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}14` }}>
                <Icon size={16} style={{ color: accent }} />
            </div>
        </div>
        <p style={{ ...display, fontSize: '1.7rem', fontWeight: 600, color: INK, marginTop: 14 }}>{value}</p>
        <p style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: INK, marginTop: 2 }}>{label}</p>
        <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>{description}</p>
    </div>
);

// ─── QR Scanner Modal ─────────────────────────────────────────────────────
const QRScannerModal = ({ onScan, onClose }) => {
    const scannerRef = useRef(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        // Clear the container before starting a fresh scanner — in React
        // StrictMode this effect runs twice (mount → unmount → mount), and if
        // a leftover video element from the first instance survives, two
        // camera feeds end up stacked on top of each other.
        const container = document.getElementById('qr-reader');
        if (container) container.innerHTML = '';

        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        // Single teardown helper — called by both cleanup() and the "already
        // cancelled but start() resolved anyway" race.
        const teardown = () => {
            try {
                if (scanner?.isScanning && typeof scanner.stop === 'function') {
                    Promise.resolve(scanner.stop())
                        .catch(() => {})
                        .finally(() => {
                            if (typeof scanner.clear === 'function') {
                                Promise.resolve(scanner.clear()).catch(() => {});
                            }
                        });
                } else if (typeof scanner?.clear === 'function') {
                    Promise.resolve(scanner.clear()).catch(() => {});
                }
            } catch (_) {
                // Ignore QR cleanup errors during strict unmounts.
            }
        };

        scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: 240 },
            (decodedText) => {
                // Guard: might already be stopped (or unmounted) before this fires.
                if (scannerRef.current && scanner.isScanning) {
                    Promise.resolve(scanner.stop())
                        .catch(() => {})
                        .finally(() => {
                            if (typeof scanner.clear === 'function') {
                                Promise.resolve(scanner.clear()).catch(() => {});
                            }
                            if (!cancelled) onScan(decodedText);
                        });
                }
            },
            () => { /* ignore per-frame scan errors */ }
        ).then(() => {
            // This is where the double-camera-feed bug actually comes from:
            // start() resolved (camera video attached to the DOM) but this
            // effect was already cleaned up before it finished (StrictMode
            // double-mount race). If so, remove the video this instance just
            // attached.
            if (cancelled) teardown();
        }).catch(() => {
            if (!cancelled) setError('Hindi ma-access ang camera. I-allow ang camera permission.');
        });

        return () => {
            cancelled = true;
            teardown();
            scannerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,21,18,0.55)' }}>
            <div className="w-full max-w-sm overflow-hidden" style={{ background: SURFACE, borderRadius: RADIUS, border: `1px solid ${BORDER}`, boxShadow: '0 24px 48px -20px rgba(36,21,18,0.5)' }}>
                <div className="flex items-center justify-between" style={{ padding: '18px 20px 12px' }}>
                    <h3 className="flex items-center gap-2" style={{ ...body, fontSize: '0.9rem', fontWeight: 700, color: INK }}>
                        <QrCode size={16} style={{ color: PRIMARY }} /> Scan Duty QR
                    </h3>
                    <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'none', color: MUTED, cursor: 'pointer' }}>
                        <X size={16} />
                    </button>
                </div>
                <div id="qr-reader" className="w-full aspect-square bg-black" />
                <div style={{ padding: 16, background: `${DANGER}0a` }}>
                    {error ? (
                        <p style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: DANGER, textAlign: 'center' }}>{error}</p>
                    ) : (
                        <p style={{ ...body, fontSize: '0.72rem', color: MUTED, textAlign: 'center' }}>
                            I-align ang QR code na naka-post sa duty location sa loob ng frame.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const DutyParticipation = () => {
    const [duties,     setDuties]     = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [expanded,   setExpanded]   = useState(null);
    const [showScanner, setShowScanner] = useState(false);
    const [checkingIn, setCheckingIn] = useState(false);
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }
    const [makeupRequests, setMakeupRequests] = useState([]);
    const [makeupOptions, setMakeupOptions] = useState({});
    const [makeupSelections, setMakeupSelections] = useState({});
    const [loadingMakeup, setLoadingMakeup] = useState(null);
    const [submittingMakeup, setSubmittingMakeup] = useState(null);

    // UI-only filter state (no backend change — filtering happens client-side
    // over the duties already returned by /scholar/my-duties).
    const [searchQuery, setSearchQuery] = useState('');
    const [monthFilter, setMonthFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchDuties = async () => {
        try {
            const res = await axios.get(`${API}/scholar/my-duties`, authHeaders());
            setDuties(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMakeupRequests = async () => {
        try {
            const res = await axios.get(`${API}/scholar/makeup-requests`, authHeaders());
            setMakeupRequests(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { fetchDuties(); fetchMakeupRequests(); }, []);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const handleScan = async (qrToken) => {
        setShowScanner(false);
        setCheckingIn(true);
        try {
            const res = await axios.post(`${API}/scholar/checkin`, { qr_token: qrToken }, authHeaders());
            showToast('success', res.data.message || 'Checked in successfully!');
            await fetchDuties();
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Check-in failed. Please try again.');
        } finally {
            setCheckingIn(false);
        }
    };

    const loadMakeupOptions = async (sourceDutyId) => {
        setLoadingMakeup(sourceDutyId);
        try {
            const res = await axios.get(`${API}/scholar/makeup-options/${sourceDutyId}`, authHeaders());
            setMakeupOptions(current => ({ ...current, [sourceDutyId]: res.data.options || [] }));
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Could not load makeup duties.');
        } finally {
            setLoadingMakeup(null);
        }
    };

    const handleMakeupRequest = async (sourceDutyId) => {
        const makeupDutyId = makeupSelections[sourceDutyId];
        if (!makeupDutyId) return showToast('error', 'Select a duty for your makeup request.');
        setSubmittingMakeup(sourceDutyId);
        try {
            const res = await axios.post(`${API}/scholar/makeup-requests`, {
                source_duty_id: sourceDutyId,
                makeup_duty_id: makeupDutyId,
            }, authHeaders());
            showToast('success', res.data.message || 'Makeup request submitted.');
            await fetchMakeupRequests();
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Makeup request failed.');
        } finally {
            setSubmittingMakeup(null);
        }
    };

    const Skeleton = () => <div className="animate-pulse" style={{ background: `${BORDER}88`, height: 108, borderRadius: RADIUS }} />;

    // ── Derived stats ──
    const completedCount = duties.filter(d => d.computed_status === 'completed').length;
    const pendingCount   = duties.filter(d => d.computed_status === 'pending').length;

    const verifiedHours = useMemo(
        () => duties.filter(d => d.computed_status === 'completed').reduce((sum, d) => sum + getDutyHours(d), 0),
        [duties]
    );
    const remainingHours = Math.max(0, REQUIRED_HOURS - verifiedHours);
    const completionPct = REQUIRED_HOURS > 0 ? Math.min(100, (verifiedHours / REQUIRED_HOURS) * 100) : 0;

    const progressStatus = completionPct >= 100
        ? { label: 'Completed', color: SUCCESS }
        : completionPct >= 50
            ? { label: 'On Track', color: SUCCESS }
            : { label: 'Needs More Hours', color: WARNING };

    const attendanceRate = duties.length ? Math.round((completedCount / duties.length) * 100) : 0;

    const months = useMemo(() => {
        const set = new Set(duties.map(d => new Date(d.duty_date).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })));
        return Array.from(set);
    }, [duties]);

    const filteredDuties = useMemo(() => {
        return duties.filter(d => {
            if (statusFilter !== 'all' && d.computed_status !== statusFilter) return false;
            if (monthFilter !== 'all') {
                const label = new Date(d.duty_date).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
                if (label !== monthFilter) return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const haystack = `${d.title || ''} ${d.group_name || ''} ${d.assigned_staff_name || ''}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [duties, statusFilter, monthFilter, searchQuery]);

    return (
        <div style={{ ...body, background: BG, minHeight: '100vh' }}>

            {/* Toast */}
            {toast && (
                <div
                    className="fixed top-4 right-4 z-[60]"
                    style={{ padding: '10px 16px', borderRadius: 12, boxShadow: '0 8px 20px -8px rgba(36,21,18,0.4)', ...body, fontSize: '0.78rem', fontWeight: 600, color: '#fff', background: toast.type === 'success' ? SUCCESS : DANGER }}
                >
                    {toast.message}
                </div>
            )}

            <div className="w-full px-4 sm:px-6 lg:p-8">

                {/* ── 1. Personal header ── */}
                <div className="flex items-start justify-between gap-4 flex-wrap" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '22px 26px', marginBottom: 20 }}>
                    <div>
                        <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: BRONZE }}>SCHOLAR PORTAL</p>
                        <h1 style={{ ...display, fontSize: '1.7rem', fontWeight: 600, color: INK, marginTop: 4 }}>Duty &amp; Participation</h1>
                        <p style={{ ...body, fontSize: '0.84rem', color: MUTED, marginTop: 6, maxWidth: 460 }}>
                            View your attendance, service participation, and verified duty hours for the current semester.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY, background: `${PRIMARY}12`, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 16px' }}>
                            1st Semester, AY 2026–2027
                        </span>
                        <button
                            onClick={() => setShowScanner(true)}
                            disabled={checkingIn}
                            className="flex items-center gap-2 shrink-0 transition-opacity hover:opacity-90"
                            style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: '#fff', padding: '10px 18px', border: 'none', borderRadius: 12, background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, cursor: 'pointer', opacity: checkingIn ? 0.6 : 1 }}
                        >
                            {checkingIn ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                            {checkingIn ? 'Checking in…' : 'Scan to Check In'}
                        </button>
                    </div>
                </div>

                {/* ── 2. Participation overview ── */}
                {!loading && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 20 }}>
                        <KpiCard icon={ShieldCheck} label="Verified Duty Hours" value={`${verifiedHours.toFixed(1)}h`} description={`of ${REQUIRED_HOURS}h required`} accent={SUCCESS} />
                        <KpiCard icon={TrendingUp} label="Attendance Rate" value={`${attendanceRate}%`} description={`${completedCount} of ${duties.length} duties`} accent={PRIMARY} />
                        <KpiCard icon={CalendarDays} label="Activities Joined" value={completedCount} description="verified this semester" accent={BRONZE} />
                        <KpiCard icon={AlarmClock} label="Pending Verification" value={pendingCount} description="awaiting check-in" accent={WARNING} />
                    </div>
                )}

                {/* ── 3. Service hour progress ── */}
                {!loading && (
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '22px 26px', marginBottom: 20 }}>
                        <div className="flex items-center justify-between gap-6 flex-wrap">
                            <div className="flex items-center gap-5">
                                <CircularProgress percent={completionPct} color={progressStatus.color} />
                                <div>
                                    <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', color: MUTED }}>SERVICE HOURS</p>
                                    <p style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: INK, marginTop: 2 }}>
                                        {verifiedHours.toFixed(1)}h completed <span style={{ color: MUTED, fontWeight: 400, fontSize: '0.9rem' }}>· {remainingHours.toFixed(1)}h remaining</span>
                                    </p>
                                </div>
                            </div>
                            <span style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: progressStatus.color, background: `${progressStatus.color}14`, borderRadius: 999, padding: '7px 16px' }}>
                                {progressStatus.label}
                            </span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: `${BRONZE}20`, marginTop: 20, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${completionPct}%`, borderRadius: 999, background: progressStatus.color, transition: 'width 0.6s ease' }} />
                        </div>
                    </div>
                )}

                {/* ── 5. Filter bar ── */}
                {!loading && duties.length > 0 && (
                    <div className="flex items-center gap-3 flex-wrap" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '12px 16px', marginBottom: 20 }}>
                        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                            <Search size={15} style={{ color: MUTED }} />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search activity"
                                style={{ ...body, fontSize: '0.82rem', color: INK, border: 'none', outline: 'none', background: 'none', width: '100%' }}
                            />
                        </div>
                        <div className="flex items-center gap-2" style={{ borderLeft: `1px solid ${BORDER}`, paddingLeft: 14 }}>
                            <SlidersHorizontal size={13} style={{ color: MUTED }} />
                            <select
                                value={monthFilter}
                                onChange={(e) => setMonthFilter(e.target.value)}
                                style={{ ...body, fontSize: '0.8rem', fontWeight: 500, color: INK, border: 'none', outline: 'none', background: 'none', cursor: 'pointer' }}
                            >
                                <option value="all">All months</option>
                                {months.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2" style={{ borderLeft: `1px solid ${BORDER}`, paddingLeft: 14 }}>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                style={{ ...body, fontSize: '0.8rem', fontWeight: 500, color: INK, border: 'none', outline: 'none', background: 'none', cursor: 'pointer' }}
                            >
                                <option value="all">All statuses</option>
                                <option value="completed">Verified</option>
                                <option value="pending">Pending</option>
                                <option value="missed">Missed</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* ── 4. Duty records ── */}
                {loading ? (
                    <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} />)}</div>
                ) : duties.length === 0 ? (
                    <div className="text-center" style={{ border: `1px dashed ${BORDER}`, background: SURFACE, borderRadius: RADIUS, padding: '64px 20px' }}>
                        <div className="mx-auto flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, background: `${BRONZE}14`, marginBottom: 16 }}>
                            <Inbox size={22} style={{ color: BRONZE }} />
                        </div>
                        <p style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>No Duty Records Found</p>
                        <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>Your verified participation records will appear here.</p>
                    </div>
                ) : filteredDuties.length === 0 ? (
                    <div className="text-center" style={{ border: `1px dashed ${BORDER}`, background: SURFACE, borderRadius: RADIUS, padding: '48px 20px' }}>
                        <ClipboardList size={28} style={{ margin: '0 auto 10px', color: BORDER }} />
                        <p style={{ ...body, fontSize: '0.84rem', fontWeight: 600, color: MUTED }}>No records match your filters.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredDuties.map((duty) => {
                            const status = duty.computed_status; // 'pending' | 'completed' | 'missed'
                            const dutyDate = new Date(duty.duty_date);
                            const isOpen = expanded === duty.id;
                            const hours = getDutyHours(duty);

                            return (
                                <div key={duty.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, overflow: 'hidden' }}>
                                    <div className="flex items-start justify-between gap-4 flex-wrap" style={{ padding: '18px 22px' }}>
                                        <div className="flex-1 min-w-[220px]">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <StatusBadge status={status} />
                                                {duty.is_makeup === 1 && (
                                                    <span style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: BRONZE }}>· Makeup</span>
                                                )}
                                            </div>
                                            <h4 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>{duty.title}</h4>
                                            {duty.assigned_staff_name && (
                                                <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>Officer in charge: {duty.assigned_staff_name}</p>
                                            )}

                                            <div className="flex flex-wrap gap-x-5 gap-y-1.5" style={{ marginTop: 12 }}>
                                                <div className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.78rem', color: INK }}>
                                                    <CalendarDays size={13} style={{ color: PRIMARY }} />
                                                    {dutyDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                                {duty.time_start && (
                                                    <div className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.78rem', color: INK }}>
                                                        <Clock size={13} style={{ color: PRIMARY }} />
                                                        {duty.time_start} – {duty.time_end}
                                                    </div>
                                                )}
                                                {duty.location && (
                                                    <div className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.78rem', color: INK }}>
                                                        <MapPin size={13} style={{ color: PRIMARY }} />
                                                        {duty.location}
                                                    </div>
                                                )}
                                                {hours > 0 && (
                                                    <span style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: SUCCESS }}>
                                                        {hours.toFixed(1)}h earned
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button onClick={() => setExpanded(isOpen ? null : duty.id)}
                                            className="flex items-center gap-1.5 hover:opacity-70 transition-opacity flex-shrink-0"
                                            style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: PRIMARY, background: `${PRIMARY}0f`, border: 'none', borderRadius: 10, cursor: 'pointer', padding: '8px 14px' }}>
                                            {isOpen ? 'Hide Details' : 'View Details'}
                                            {isOpen ? <ChevronUp size={13} /> : <ArrowRight size={13} />}
                                        </button>
                                    </div>

                                    {isOpen && (
                                        <div style={{ padding: '0 22px 22px' }}>
                                            <div style={{ background: BG, borderRadius: 14, padding: '18px 20px' }}>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                    <div>
                                                        <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: MUTED, marginBottom: 10 }}>DUTY DETAILS</p>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2" style={{ ...body, fontSize: '0.82rem', color: INK }}>
                                                                <CalendarDays size={13} style={{ color: PRIMARY }} className="shrink-0" />
                                                                {dutyDate.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                            </div>
                                                            {duty.time_start && (
                                                                <div className="flex items-center gap-2" style={{ ...body, fontSize: '0.82rem', color: INK }}>
                                                                    <Clock size={13} style={{ color: PRIMARY }} className="shrink-0" />
                                                                    {duty.time_start} – {duty.time_end}
                                                                </div>
                                                            )}
                                                            {duty.location && (
                                                                <div className="flex items-center gap-2" style={{ ...body, fontSize: '0.82rem', color: INK }}>
                                                                    <MapPin size={13} style={{ color: PRIMARY }} className="shrink-0" />
                                                                    {duty.location}
                                                                </div>
                                                            )}
                                                            {duty.assigned_staff_name && (
                                                                <div className="flex items-center gap-2" style={{ ...body, fontSize: '0.82rem', color: INK }}>
                                                                    <span className="w-3 text-center font-bold" style={{ color: PRIMARY }}>•</span>
                                                                    Officer: {duty.assigned_staff_name}
                                                                </div>
                                                            )}
                                                            {status === 'pending' && (
                                                                <p style={{ ...body, fontSize: '0.74rem', fontWeight: 500, color: WARNING, marginTop: 8 }}>
                                                                    Pwede ka pang mag-check-in hanggang 7 araw mula sa duty date.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="sm:pl-6 sm:border-l" style={{ borderColor: BORDER }}>
                                                        <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: MUTED, marginBottom: 10 }}>MY ATTENDANCE</p>
                                                        {duty.attendance_status ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 size={15} style={{ color: (statusMeta[status] || statusMeta.pending).color }} />
                                                                    <span className="capitalize" style={{ ...body, fontSize: '0.88rem', fontWeight: 700, color: (statusMeta[status] || statusMeta.pending).color }}>
                                                                        {duty.attendance_status}{duty.is_makeup ? ' (makeup)' : ''}
                                                                    </span>
                                                                </div>
                                                                <p style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                                                                    Marked via {duty.method} • {new Date(duty.marked_at).toLocaleDateString('en-PH')}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p style={{ ...body, fontSize: '0.82rem', fontWeight: 500, color: MUTED }}>
                                                                {status === 'missed' ? 'Hindi nakadalo — lumipas na ang makeup window.' : 'Not yet checked in'}
                                                            </p>
                                                        )}
                                                        {(status === 'missed' || ['absent', 'excused'].includes(String(duty.attendance_status || '').toLowerCase())) && (() => {
                                                            const request = makeupRequests.find(item => Number(item.source_duty_id) === Number(duty.id) && ['pending', 'approved'].includes(item.status));
                                                            const options = makeupOptions[duty.id] || [];
                                                            return request ? (
                                                                <p style={{ marginTop: 12, ...body, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em', color: request.status === 'approved' ? SUCCESS : WARNING, textTransform: 'capitalize' }}>
                                                                    Makeup request: {request.status}
                                                                </p>
                                                            ) : (
                                                                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${BORDER}` }}>
                                                                    {!makeupOptions[duty.id] ? (
                                                                        <button onClick={() => loadMakeupOptions(duty.id)} disabled={loadingMakeup === duty.id}
                                                                            className="inline-flex items-center gap-1.5"
                                                                            style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer' }}>
                                                                            {loadingMakeup === duty.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                                                            Request Makeup
                                                                        </button>
                                                                    ) : options.length > 0 ? (
                                                                        <div className="flex flex-col gap-2">
                                                                            <select value={makeupSelections[duty.id] || ''} onChange={e => setMakeupSelections(current => ({ ...current, [duty.id]: e.target.value }))}
                                                                                style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 10px', ...body, fontSize: '0.78rem', fontWeight: 500, color: INK, background: SURFACE }}>
                                                                                <option value="">Choose another duty</option>
                                                                                {options.map(option => <option key={option.id} value={option.id}>{option.title} — {new Date(option.duty_date).toLocaleDateString('en-PH')}</option>)}
                                                                            </select>
                                                                            <button onClick={() => handleMakeupRequest(duty.id)} disabled={submittingMakeup === duty.id}
                                                                                className="inline-flex items-center justify-center gap-1.5"
                                                                                style={{ borderRadius: 10, padding: '8px 12px', ...body, fontSize: '0.76rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: 'none', cursor: 'pointer', opacity: submittingMakeup === duty.id ? 0.6 : 1 }}>
                                                                                {submittingMakeup === duty.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                                                                Submit Request
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <p style={{ ...body, fontSize: '0.74rem', color: MUTED }}>No upcoming duty is available for makeup.</p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showScanner && (
                <QRScannerModal onScan={handleScan} onClose={() => setShowScanner(false)} />
            )}
        </div>
    );
};

export default DutyParticipation;