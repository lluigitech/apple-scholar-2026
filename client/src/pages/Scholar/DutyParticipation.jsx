import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
    CalendarDays, MapPin, Clock, ChevronDown,
    CheckCircle2, XCircle, QrCode, X, Loader2, Send,
    Search, SlidersHorizontal, ClipboardList, TrendingUp,
    AlarmClock, ShieldCheck, Inbox, UserRound, Repeat2, Info
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

const cardShadow = '0 1px 2px rgba(36,21,18,0.03), 0 6px 20px rgba(36,21,18,0.04)';

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
                background: cfg.tint, border: `1px solid ${cfg.color}30`, borderRadius: 999,
                padding: small ? '3px 9px' : '4px 12px', whiteSpace: 'nowrap',
            }}
        >
            <Icon size={small ? 11 : 12} />
            {cfg.label}
        </span>
    );
};

const parseDutyTime = (value) => {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
};

const formatDutyTime = (value) => {
    const time = parseDutyTime(value);
    if (!time) return null;
    const hour = time.hours % 12 || 12;
    return `${hour}:${String(time.minutes).padStart(2, '0')} ${time.hours >= 12 ? 'PM' : 'AM'}`;
};

const formatDuration = (hours) => {
    const totalMinutes = Math.round(Number(hours) * 60);
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '—';
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (wholeHours && minutes) return `${wholeHours}h ${minutes}m`;
    if (wholeHours) return `${wholeHours}h`;
    return `${minutes}m`;
};

const parseAttendanceTimestamp = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)
        ? text.replace(' ', 'T')
        : text;
    const timestamp = new Date(normalized).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
};

// Service credit follows recorded check-in/check-out timestamps, not the
// scheduled duty duration. Completed makeup duties receive one extra hour.
const getDutyHours = (duty) => {
    const checkedInAt = parseAttendanceTimestamp(duty.marked_at);
    const checkedOutAt = parseAttendanceTimestamp(duty.check_out_at);
    if (checkedInAt === null || checkedOutAt === null || checkedOutAt <= checkedInAt) return 0;
    const workedMinutes = Math.round((checkedOutAt - checkedInAt) / 60000);
    const makeupBonusMinutes = Number(duty.is_makeup) === 1 ? 60 : 0;
    return (workedMinutes + makeupBonusMinutes) / 60;
};

// ─── KPI card ─────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, description, accent = PRIMARY }) => (
    <div className="dp-kpi min-w-0" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 20px', boxShadow: cardShadow }}>
        <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, background: `${accent}14`, border: `1px solid ${accent}22` }}>
            <Icon size={17} style={{ color: accent }} />
        </div>
        <p style={{ ...display, fontVariantNumeric: 'tabular-nums', fontSize: '2rem', fontWeight: 600, color: INK, marginTop: 14, lineHeight: 1 }}>{value}</p>
        <p style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK, marginTop: 8 }}>{label}</p>
        <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>{description}</p>
    </div>
);

// Loading skeleton that mirrors the duty card layout.
const DutySkeleton = () => (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '20px 22px' }}>
        <div className="animate-pulse" style={{ width: 76, height: 22, borderRadius: 999, background: `${BORDER}99` }} />
        <div className="animate-pulse" style={{ width: '48%', height: 16, borderRadius: 8, background: `${BORDER}99`, marginTop: 14 }} />
        <div className="flex gap-4" style={{ marginTop: 16 }}>
            <div className="animate-pulse" style={{ width: 96, height: 10, borderRadius: 999, background: `${BORDER}66` }} />
            <div className="animate-pulse" style={{ width: 110, height: 10, borderRadius: 999, background: `${BORDER}66` }} />
            <div className="animate-pulse" style={{ width: 80, height: 10, borderRadius: 999, background: `${BORDER}66` }} />
        </div>
    </div>
);

// Info chip used in a duty card's information row.
const InfoChip = ({ icon: Icon, children, color = PRIMARY }) => (
    <div className="flex items-center gap-1.5 min-w-0" style={{ ...body, fontSize: '0.78rem', color: INK }}>
        <Icon size={13} style={{ color, flexShrink: 0 }} />
        <span style={{ overflowWrap: 'anywhere' }}>{children}</span>
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(36,21,18,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full sm:max-w-sm overflow-hidden rounded-t-3xl sm:rounded-3xl" style={{ background: SURFACE, border: `1px solid ${BORDER}`, boxShadow: '0 24px 48px -20px rgba(36,21,18,0.5)' }}>
                <div className="flex items-center justify-between gap-3" style={{ padding: '18px 20px 14px' }}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 11, background: `${PRIMARY}12`, border: `1px solid ${PRIMARY}22` }}>
                            <QrCode size={17} style={{ color: PRIMARY }} />
                        </div>
                        <div className="min-w-0">
                            <h3 style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK, lineHeight: 1.2 }}>Scan Duty QR</h3>
                            <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>Check in or out of your duty</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close scanner" className="dp-icon-btn flex-shrink-0" style={{ padding: 8, borderRadius: 10, border: 'none', background: 'none', color: MUTED, cursor: 'pointer' }}>
                        <X size={17} />
                    </button>
                </div>

                {/* Camera area. The overlay is a sibling of #qr-reader (not a child)
                    because html5-qrcode rewrites the container's contents. */}
                <div style={{ padding: '0 20px' }}>
                    <div className="relative overflow-hidden" style={{ borderRadius: 18, background: '#000', border: `1px solid ${BORDER}` }}>
                        <div id="qr-reader" className="w-full aspect-square" style={{ maxHeight: '58vh' }} />
                        {!error && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="relative" style={{ width: '62%', aspectRatio: '1 / 1' }}>
                                    {[
                                        { top: 0, left: 0, borderTop: '3px solid #fff', borderLeft: '3px solid #fff', borderTopLeftRadius: 12 },
                                        { top: 0, right: 0, borderTop: '3px solid #fff', borderRight: '3px solid #fff', borderTopRightRadius: 12 },
                                        { bottom: 0, left: 0, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', borderBottomLeftRadius: 12 },
                                        { bottom: 0, right: 0, borderBottom: '3px solid #fff', borderRight: '3px solid #fff', borderBottomRightRadius: 12 },
                                    ].map((s, i) => (
                                        <span key={i} className="absolute" style={{ width: 26, height: 26, opacity: 0.9, ...s }} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ padding: '14px 20px 20px' }}>
                    {error ? (
                        <div className="flex items-start gap-2.5" style={{ padding: '11px 14px', borderRadius: 12, background: `${DANGER}0d`, border: `1px solid ${DANGER}30` }}>
                            <XCircle size={15} style={{ color: DANGER, flexShrink: 0, marginTop: 1 }} />
                            <p style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: DANGER }}>{error}</p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <span className="animate-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: SUCCESS, flexShrink: 0 }} />
                            <p style={{ ...body, fontSize: '0.74rem', color: MUTED, textAlign: 'center' }}>
                                I-align ang QR code na naka-post sa duty location sa loob ng frame.
                            </p>
                        </div>
                    )}
                    <button onClick={onClose} className="dp-ghost w-full" style={{ ...body, marginTop: 14, fontSize: '0.82rem', fontWeight: 600, color: INK, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 16px', cursor: 'pointer' }}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

const DutyParticipation = () => {
    const [duties,     setDuties]     = useState([]);
    const [requiredHours, setRequiredHours] = useState(null);
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
            const [dutiesResult, complianceResult] = await Promise.allSettled([
                axios.get(`${API}/scholar/my-duties`, authHeaders()),
                axios.get(`${API}/scholar/compliance-status`, authHeaders()),
            ]);
            if (dutiesResult.status === 'fulfilled') {
                setDuties(dutiesResult.value.data || []);
            } else {
                console.error('Error fetching scholar duties:', dutiesResult.reason);
            }
            if (complianceResult.status === 'fulfilled') {
                const rawRequiredHours = complianceResult.value.data?.required_hours;
                const configuredHours = Number(rawRequiredHours);
                setRequiredHours(
                    rawRequiredHours !== null
                    && rawRequiredHours !== undefined
                    && rawRequiredHours !== ''
                    && Number.isFinite(configuredHours)
                    && configuredHours >= 0
                        ? configuredHours
                        : null
                );
            } else {
                console.error('Error fetching required service hours:', complianceResult.reason);
            }
        } catch (err) {
            console.error('Error loading duty participation:', err);
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

    // ── Derived stats ──
    const completedCount = duties.filter(d => d.computed_status === 'completed').length;
    const pendingCount   = duties.filter(d => d.computed_status === 'pending').length;

    const verifiedHours = useMemo(
        () => duties.filter(d => d.computed_status === 'completed').reduce((sum, d) => sum + getDutyHours(d), 0),
        [duties]
    );
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

    // Shared styling for the toolbar controls (consistent height + radius).
    const controlBox = { height: 42, borderRadius: 12, border: `1px solid ${BORDER}`, background: BG };
    const selectStyle = { ...body, fontSize: '0.8rem', fontWeight: 500, color: INK, border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', width: '100%', height: '100%', appearance: 'none', paddingRight: 22 };

    return (
        <div className="w-full min-w-0 max-w-full overflow-x-hidden" style={{ ...body, background: BG, minHeight: '100vh' }}>
            <style>{`
                .dp-kpi { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
                .dp-kpi:hover { transform: translateY(-2px); border-color: #d8c4ad; box-shadow: 0 2px 4px rgba(36,21,18,0.04), 0 12px 28px rgba(36,21,18,0.07); }
                .dp-card { transition: box-shadow .18s ease, border-color .18s ease; }
                .dp-card:hover { border-color: #d8c4ad; box-shadow: 0 2px 4px rgba(36,21,18,0.04), 0 12px 28px rgba(36,21,18,0.07); }
                .dp-toggle { transition: background .15s ease; }
                .dp-toggle:hover { background: ${PRIMARY}1f !important; }
                .dp-chevron { transition: transform .2s ease; }
                .dp-primary { transition: background .15s ease, transform .1s ease; }
                .dp-primary:hover:not(:disabled) { background: ${PRIMARY_DARK} !important; }
                .dp-primary:active:not(:disabled) { transform: scale(0.98); }
                .dp-ghost:hover, .dp-icon-btn:hover { background: #F3ECE0 !important; }
                .dp-control:focus-within { border-color: ${PRIMARY}66 !important; box-shadow: 0 0 0 4px ${PRIMARY}1a; }
                .dp-field { border: 1px solid ${BORDER}; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
                .dp-field:focus { border-color: ${PRIMARY}66; box-shadow: 0 0 0 4px ${PRIMARY}1a; }
                @keyframes dp-fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
                .dp-expand { animation: dp-fade .2s ease; }
            `}</style>

            {/* Toast */}
            {toast && (
                <div
                    className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[60] flex items-start gap-2.5"
                    style={{ padding: '12px 16px', borderRadius: 14, boxShadow: '0 12px 28px -10px rgba(36,21,18,0.45)', ...body, fontSize: '0.8rem', fontWeight: 600, color: '#fff', background: toast.type === 'success' ? SUCCESS : DANGER }}
                >
                    {toast.type === 'success' ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
                    <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{toast.message}</span>
                </div>
            )}

            <div className="w-full min-w-0 px-4 sm:px-6 lg:p-8">

                {/* ── 1. Personal header ── */}
                <div className="flex items-start justify-between gap-4 flex-wrap" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '22px 26px', marginBottom: 20 }}>
                    <div>
                        <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: BRONZE }}>SCHOLAR PORTAL</p>
                        <h1 style={{ ...display, fontSize: '1.7rem', fontWeight: 600, color: INK, marginTop: 4 }}>Duty &amp; Participation</h1>
                        <p style={{ ...body, fontSize: '0.84rem', color: MUTED, marginTop: 6, maxWidth: 460 }}>
                            View your attendance, service participation, and verified duty hours for the current semester.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
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
                            {checkingIn ? 'Recording attendance…' : 'Scan to Check In / Out'}
                        </button>
                    </div>
                </div>

                {/* ── 2. Participation overview ── */}
                {!loading && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" style={{ marginBottom: 20 }}>
                        <KpiCard icon={ShieldCheck} label="Verified Duty Hours" value={formatDuration(verifiedHours)} description={requiredHours === null ? 'required hours unavailable' : `of ${formatDuration(requiredHours)} required`} accent={SUCCESS} />
                        <KpiCard icon={TrendingUp} label="Attendance Rate" value={`${attendanceRate}%`} description={`${completedCount} of ${duties.length} duties`} accent={PRIMARY} />
                        <KpiCard icon={CalendarDays} label="Activities Joined" value={completedCount} description="verified this semester" accent={BRONZE} />
                        <KpiCard icon={AlarmClock} label="Pending Verification" value={pendingCount} description="awaiting check-in" accent={WARNING} />
                    </div>
                )}

                {/* ── 5. Filter toolbar ── */}
                {!loading && duties.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2.5 sm:gap-3 items-center min-w-0" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '12px 14px', marginBottom: 20 }}>
                        <div className="dp-control flex items-center gap-2 min-w-0" style={{ ...controlBox, padding: '0 14px' }}>
                            <Search size={15} style={{ color: MUTED, flexShrink: 0 }} />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search activity"
                                style={{ ...body, fontSize: '0.82rem', color: INK, border: 'none', outline: 'none', background: 'none', width: '100%', minWidth: 0 }}
                            />
                        </div>
                        <div className="dp-control relative flex items-center gap-2 sm:w-[190px]" style={{ ...controlBox, padding: '0 12px' }}>
                            <SlidersHorizontal size={13} style={{ color: MUTED, flexShrink: 0 }} />
                            <select
                                value={monthFilter}
                                onChange={(e) => setMonthFilter(e.target.value)}
                                aria-label="Filter by month"
                                style={selectStyle}
                            >
                                <option value="all">All months</option>
                                {months.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <ChevronDown size={13} className="absolute pointer-events-none" style={{ right: 12, color: MUTED }} />
                        </div>
                        <div className="dp-control relative flex items-center sm:w-[160px]" style={{ ...controlBox, padding: '0 12px' }}>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                aria-label="Filter by status"
                                style={selectStyle}
                            >
                                <option value="all">All statuses</option>
                                <option value="completed">Verified</option>
                                <option value="pending">Pending</option>
                                <option value="missed">Missed</option>
                            </select>
                            <ChevronDown size={13} className="absolute pointer-events-none" style={{ right: 12, color: MUTED }} />
                        </div>
                    </div>
                )}

                {/* ── 4. Duty records ── */}
                {loading ? (
                    <div className="space-y-3">{Array(3).fill(0).map((_, i) => <DutySkeleton key={i} />)}</div>
                ) : duties.length === 0 ? (
                    <div className="text-center" style={{ border: `1px dashed ${BORDER}`, background: SURFACE, borderRadius: RADIUS, padding: '48px 20px' }}>
                        <div className="mx-auto flex items-center justify-center" style={{ width: 68, height: 68, borderRadius: '50%', background: `${BRONZE}0f`, marginBottom: 14 }}>
                            <div className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, background: `${BRONZE}1c`, border: `1px solid ${BRONZE}30` }}>
                                <Inbox size={20} style={{ color: BRONZE }} />
                            </div>
                        </div>
                        <p style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>No Duty Records Found</p>
                        <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>Your verified participation records will appear here.</p>
                    </div>
                ) : filteredDuties.length === 0 ? (
                    <div className="text-center" style={{ border: `1px dashed ${BORDER}`, background: SURFACE, borderRadius: RADIUS, padding: '40px 20px' }}>
                        <div className="mx-auto flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, background: `${PRIMARY}10`, border: `1px solid ${PRIMARY}20`, marginBottom: 12 }}>
                            <ClipboardList size={20} style={{ color: PRIMARY }} />
                        </div>
                        <p style={{ ...body, fontSize: '0.88rem', fontWeight: 600, color: INK }}>No records match your filters.</p>
                        <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 4 }}>Try a different search, month, or status.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredDuties.map((duty) => {
                            const status = duty.computed_status; // 'pending' | 'completed' | 'missed'
                            const attendanceStatus = String(duty.attendance_status || '').toLowerCase() === 'excused'
                                ? 'absent'
                                : duty.attendance_status;
                            const dutyDate = new Date(duty.duty_date);
                            const isOpen = expanded === duty.id;
                            const hours = getDutyHours(duty);
                            const scheduledStart = formatDutyTime(duty.time_start);
                            const scheduledEnd = formatDutyTime(duty.time_end);
                            const statusColor = (statusMeta[status] || statusMeta.pending).color;

                            return (
                                <div key={duty.id} className="dp-card min-w-0" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, overflow: 'hidden', boxShadow: cardShadow }}>
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4" style={{ padding: '20px 22px' }}>
                                        <div className="flex-1 min-w-0">
                                            {/* Top: title + status + makeup */}
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <StatusBadge status={status} />
                                                {duty.is_makeup === 1 && (
                                                    <span className="inline-flex items-center gap-1" style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: BRONZE, background: `${BRONZE}14`, border: `1px solid ${BRONZE}30`, borderRadius: 999, padding: '3px 9px' }}>
                                                        <Repeat2 size={11} /> Makeup
                                                    </span>
                                                )}
                                            </div>
                                            <h4 style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{duty.title}</h4>

                                            {/* Information row */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2" style={{ marginTop: 14 }}>
                                                <InfoChip icon={CalendarDays}>
                                                    {dutyDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </InfoChip>
                                                {scheduledStart && scheduledEnd && (
                                                    <InfoChip icon={Clock}>{scheduledStart} – {scheduledEnd}</InfoChip>
                                                )}
                                                {duty.location && (
                                                    <InfoChip icon={MapPin}>{duty.location}</InfoChip>
                                                )}
                                                {duty.assigned_staff_name && (
                                                    <InfoChip icon={UserRound}>Officer in charge: {duty.assigned_staff_name}</InfoChip>
                                                )}
                                                {status === 'completed' && hours > 0 && (
                                                    <InfoChip icon={ShieldCheck} color={SUCCESS}>
                                                        <span style={{ fontWeight: 600, color: SUCCESS }}>{formatDuration(hours)} earned</span>
                                                    </InfoChip>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <button
                                            onClick={() => setExpanded(isOpen ? null : duty.id)}
                                            aria-expanded={isOpen}
                                            className="dp-toggle flex items-center justify-center gap-1.5 flex-shrink-0 w-full md:w-auto"
                                            style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: PRIMARY, background: `${PRIMARY}0f`, border: `1px solid ${PRIMARY}20`, borderRadius: 10, cursor: 'pointer', padding: '9px 14px' }}
                                        >
                                            {isOpen ? 'Hide Details' : 'View Details'}
                                            <ChevronDown size={14} className="dp-chevron" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                        </button>
                                    </div>

                                    {isOpen && (
                                        <div className="dp-expand" style={{ padding: '0 22px 22px' }}>
                                            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 22px' }}>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Left: duty details */}
                                                    <div className="min-w-0">
                                                        <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: MUTED, marginBottom: 12 }}>DUTY DETAILS</p>
                                                        <div className="space-y-2.5">
                                                            <div className="flex items-start gap-2.5" style={{ ...body, fontSize: '0.82rem', color: INK }}>
                                                                <CalendarDays size={14} style={{ color: PRIMARY, marginTop: 2 }} className="shrink-0" />
                                                                <span style={{ overflowWrap: 'anywhere' }}>{dutyDate.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                            </div>
                                                            {scheduledStart && scheduledEnd && (
                                                                <div className="flex items-start gap-2.5" style={{ ...body, fontSize: '0.82rem', color: INK }}>
                                                                    <Clock size={14} style={{ color: PRIMARY, marginTop: 2 }} className="shrink-0" />
                                                                    {scheduledStart} – {scheduledEnd}
                                                                </div>
                                                            )}
                                                            {duty.location && (
                                                                <div className="flex items-start gap-2.5" style={{ ...body, fontSize: '0.82rem', color: INK }}>
                                                                    <MapPin size={14} style={{ color: PRIMARY, marginTop: 2 }} className="shrink-0" />
                                                                    <span style={{ overflowWrap: 'anywhere' }}>{duty.location}</span>
                                                                </div>
                                                            )}
                                                            {duty.assigned_staff_name && (
                                                                <div className="flex items-start gap-2.5" style={{ ...body, fontSize: '0.82rem', color: INK }}>
                                                                    <UserRound size={14} style={{ color: PRIMARY, marginTop: 2 }} className="shrink-0" />
                                                                    <span style={{ overflowWrap: 'anywhere' }}>Officer: {duty.assigned_staff_name}</span>
                                                                </div>
                                                            )}
                                                            {status === 'pending' && (
                                                                <div className="flex items-start gap-2" style={{ marginTop: 6, padding: '9px 12px', borderRadius: 12, background: `${WARNING}12`, border: `1px solid ${WARNING}30` }}>
                                                                    <Info size={13} style={{ color: WARNING, flexShrink: 0, marginTop: 2 }} />
                                                                    <p style={{ ...body, fontSize: '0.74rem', fontWeight: 500, color: WARNING, lineHeight: 1.5 }}>
                                                                        Pending pa ang duty kung hindi pa tapos ang schedule nito. Kapag lumipas na ang duty nang walang check-in, mamarkahan itong missed.
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Right: my attendance */}
                                                    <div className="min-w-0 md:pl-6 md:border-l pt-5 md:pt-0 border-t md:border-t-0" style={{ borderColor: BORDER }}>
                                                        <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: MUTED, marginBottom: 12 }}>MY ATTENDANCE</p>
                                                        {duty.attendance_status ? (
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 size={16} style={{ color: statusColor }} />
                                                                    <span className="capitalize" style={{ ...body, fontSize: '0.9rem', fontWeight: 700, color: statusColor }}>
                                                                        {attendanceStatus}{duty.is_makeup ? ' (makeup)' : ''}
                                                                    </span>
                                                                </div>
                                                                <p style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                                                                    Marked via {duty.method} • {new Date(duty.marked_at).toLocaleDateString('en-PH')}
                                                                </p>
                                                                {duty.check_out_at ? (
                                                                    <p style={{ ...body, fontSize: '0.72rem', color: SUCCESS }}>
                                                                        Checked out at {new Date(duty.check_out_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                                                                    </p>
                                                                ) : (
                                                                    <p style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                                                                        Scan the duty QR again by 15 minutes after the scheduled duty ends. If you forget, the system will check you out at the scheduled end time.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p style={{ ...body, fontSize: '0.82rem', fontWeight: 500, color: MUTED }}>
                                                                {status === 'missed' ? 'Hindi nakadalo — lumipas na ang makeup window.' : 'Not yet checked in'}
                                                            </p>
                                                        )}

                                                        {(status === 'missed' || String(attendanceStatus || '').toLowerCase() === 'absent') && (() => {
                                                            const request = makeupRequests.find(item => Number(item.source_duty_id) === Number(duty.id) && ['pending', 'approved'].includes(item.status));
                                                            const options = makeupOptions[duty.id] || [];
                                                            return (
                                                                <div style={{ marginTop: 16, background: SURFACE, border: `1px solid ${BRONZE}40`, borderLeft: `3px solid ${BRONZE}`, borderRadius: 14, padding: '14px 16px' }}>
                                                                    <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                                                                        <Repeat2 size={14} style={{ color: BRONZE }} />
                                                                        <p style={{ ...body, fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.04em', color: BRONZE }}>MAKEUP DUTY</p>
                                                                    </div>
                                                                    {request ? (
                                                                        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 6 }}>
                                                                            <span style={{ ...body, fontSize: '0.78rem', color: INK }}>Makeup request:</span>
                                                                            <span className="capitalize" style={{ ...body, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em', color: request.status === 'approved' ? SUCCESS : WARNING, background: request.status === 'approved' ? `${SUCCESS}14` : `${WARNING}14`, border: `1px solid ${request.status === 'approved' ? SUCCESS : WARNING}30`, borderRadius: 999, padding: '3px 10px' }}>
                                                                                {request.status}
                                                                            </span>
                                                                        </div>
                                                                    ) : !makeupOptions[duty.id] ? (
                                                                        <div>
                                                                            <p style={{ ...body, fontSize: '0.74rem', color: MUTED, lineHeight: 1.5, marginBottom: 10 }}>
                                                                                Missed this duty? You can request to make it up on another scheduled duty.
                                                                            </p>
                                                                            <button onClick={() => loadMakeupOptions(duty.id)} disabled={loadingMakeup === duty.id}
                                                                                className="dp-primary inline-flex items-center justify-center gap-1.5 w-full sm:w-auto"
                                                                                style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: 'none', borderRadius: 10, padding: '9px 16px', cursor: loadingMakeup === duty.id ? 'default' : 'pointer', opacity: loadingMakeup === duty.id ? 0.7 : 1 }}>
                                                                                {loadingMakeup === duty.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                                                                {loadingMakeup === duty.id ? 'Loading options…' : 'Request Makeup'}
                                                                            </button>
                                                                        </div>
                                                                    ) : options.length > 0 ? (
                                                                        <div className="flex flex-col gap-2.5">
                                                                            <label style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: MUTED }}>Choose a duty to make up</label>
                                                                            <select value={makeupSelections[duty.id] || ''} onChange={e => setMakeupSelections(current => ({ ...current, [duty.id]: e.target.value }))}
                                                                                className="dp-field"
                                                                                style={{ width: '100%', borderRadius: 10, padding: '10px 12px', ...body, fontSize: '0.8rem', fontWeight: 500, color: INK, background: BG }}>
                                                                                <option value="">Choose another duty</option>
                                                                                {options.map(option => <option key={option.id} value={option.id}>{option.title} — {new Date(option.duty_date).toLocaleDateString('en-PH')}</option>)}
                                                                            </select>
                                                                            <button onClick={() => handleMakeupRequest(duty.id)} disabled={submittingMakeup === duty.id}
                                                                                className="dp-primary inline-flex items-center justify-center gap-1.5 w-full"
                                                                                style={{ borderRadius: 10, padding: '10px 14px', ...body, fontSize: '0.78rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: 'none', cursor: submittingMakeup === duty.id ? 'default' : 'pointer', opacity: submittingMakeup === duty.id ? 0.6 : 1 }}>
                                                                                {submittingMakeup === duty.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                                                                {submittingMakeup === duty.id ? 'Submitting…' : 'Submit Request'}
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>No upcoming duty is available for makeup.</p>
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