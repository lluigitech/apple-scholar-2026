import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    CalendarDays, MapPin, Clock, ChevronDown, ChevronUp,
    CheckCircle, XCircle, QrCode, X, Loader2
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const API = 'http://localhost:5000/api';
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

// ── Token system — shared with ScholarProfile ─────────────
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';

const statusStyles = {
    pending:   { color: '#92400e', bg: '#FBF0DE', icon: Clock,       label: 'Pending' },
    completed: { color: '#15803d', bg: '#EAF3EC', icon: CheckCircle, label: 'Completed' },
    missed:    { color: '#991b1b', bg: '#FBE9E9', icon: XCircle,     label: 'Missed' },
};

const StatusTag = ({ status }) => {
    const cfg = statusStyles[status] || statusStyles.pending;
    return (
        <span
            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
            style={{ color: cfg.color }}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
            {cfg.label}
        </span>
    );
};

// ─── QR Scanner Modal ─────────────────────────────────────────────────────────
const QRScannerModal = ({ onScan, onClose }) => {
    const scannerRef = useRef(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: 240 },
            (decodedText) => {
                // I-guard: baka na-stop na (o nag-unmount na) bago pa dumating dito
                if (scannerRef.current && scanner.isScanning) {
                    scanner.stop()
                        .catch(() => {})
                        .finally(() => { if (isMounted) onScan(decodedText); });
                }
            },
            () => { /* ignore per-frame scan errors */ }
        ).catch(() => {
            if (isMounted) setError('Hindi ma-access ang camera. I-allow ang camera permission.');
        });

        return () => {
            isMounted = false;
            // I-check muna kung talagang naka-scan bago tumawag ng stop(),
            // dahil pag hindi pa naka-start (o na-stop na), nag-e-error ito
            if (scanner.isScanning) {
                scanner.stop().catch(() => {});
            }
            scannerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <h3 className="font-black text-sm flex items-center gap-2" style={{ color: INK }}>
                        <QrCode size={16} style={{ color: MAROON }} /> Scan Duty QR
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X size={16} />
                    </button>
                </div>
                <div id="qr-reader" className="w-full aspect-square bg-black" />
                <div className="p-4" style={{ background: '#F5E8EA' }}>
                    {error ? (
                        <p className="text-xs text-red-500 font-bold text-center">{error}</p>
                    ) : (
                        <p className="text-[11px] text-center" style={{ color: '#a56475' }}>
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

    useEffect(() => { fetchDuties(); }, []);

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

    const getStatusIcon = (status) => {
        const cfg = statusStyles[status] || statusStyles.pending;
        const Icon = cfg.icon;
        return <Icon size={16} style={{ color: cfg.color }} />;
    };

    const Skeleton = () => <div className="animate-pulse rounded-2xl h-32" style={{ background: '#EFE7E2' }} />;

    const completedCount = duties.filter(d => d.computed_status === 'completed').length;
    const pendingCount   = duties.filter(d => d.computed_status === 'pending').length;

    const serif = { fontFamily: "'Playfair Display', serif" };
    const sans = { fontFamily: "'DM Sans', sans-serif" };

    return (
        <div style={{ ...sans, background: IVORY, minHeight: '100vh' }}>

            {/* Toast */}
            {toast && (
                <div
                    className="fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl shadow-lg text-xs font-bold text-white"
                    style={{ background: toast.type === 'success' ? '#15803d' : '#991b1b' }}
                >
                    {toast.message}
                </div>
            )}

            {/* ── Hero band ─────────────────────────────────────── */}
            <div
                className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16 sm:pb-20"
                style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
            >
                {/* apple silhouette mark, nodding to "Apple Scholar" */}
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

                <div className="relative flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] mb-2" style={{ color: GOLD }}>
                            Kalinga Foundation
                        </p>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white" style={serif}>Duty Participation</h1>
                        <p className="text-xs mt-2" style={{ color: '#e9c9a8' }}>Your group's service schedule and duty history.</p>
                    </div>
                    <button
                        onClick={() => setShowScanner(true)}
                        disabled={checkingIn}
                        className="shrink-0 flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-full transition-colors disabled:opacity-60"
                        style={{ background: GOLD, color: MAROON_DEEP }}
                    >
                        {checkingIn ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                        {checkingIn ? 'Checking in…' : 'Scan to Check In'}
                    </button>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:p-8 lg:pt-0">

                {/* ── Summary — floats over the hero, quiet + even ──── */}
                {!loading && (
                    <div className="relative -mt-10 sm:-mt-12 mb-8 sm:mb-10 rounded-2xl bg-white p-5 sm:p-6" style={{ boxShadow: '0 12px 30px -12px rgba(79,22,32,0.25)' }}>
                        <div className="grid grid-cols-3 divide-x divide-slate-100">
                            <div className="text-center px-2">
                                <p className="text-xl sm:text-2xl font-bold" style={{ ...serif, color: MAROON }}>{duties.length}</p>
                                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5 text-slate-400">Total Duties</p>
                            </div>
                            <div className="text-center px-2">
                                <p className="text-xl sm:text-2xl font-bold text-[#15803d]" style={serif}>{completedCount}</p>
                                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5 text-slate-400">Completed</p>
                            </div>
                            <div className="text-center px-2">
                                <p className="text-xl sm:text-2xl font-bold text-[#92400e]" style={serif}>{pendingCount}</p>
                                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5 text-slate-400">Pending</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── List ──────────────────────────────────────────── */}
                {loading ? (
                    <div className="space-y-4 pt-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} />)}</div>
                ) : duties.length === 0 ? (
                    <div className="rounded-[2rem] p-16 text-center bg-white" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                        <CalendarDays size={40} className="mx-auto mb-3" style={{ color: '#e9d9dc' }} />
                        <p className="text-sm font-bold" style={{ color: '#c9b3b8' }}>No duties assigned yet.</p>
                        <p className="text-xs mt-1" style={{ color: '#c9b3b8' }}>Check back later or contact your staff officer.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {duties.map((duty) => {
                            const status = duty.computed_status; // 'pending' | 'completed' | 'missed'
                            const detailBg = status === 'completed' ? '#EAF3EC' : status === 'missed' ? '#FBE9E9' : '#FBF0DE';
                            const detailAccent = statusStyles[status]?.color || '#92400e';
                            const dutyDate = new Date(duty.duty_date);
                            const dayNum = dutyDate.toLocaleDateString('en-PH', { day: '2-digit' });
                            const monthAbbr = dutyDate.toLocaleDateString('en-PH', { month: 'short' });
                            const isOpen = expanded === duty.id;

                            return (
                                <div key={duty.id} className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 10px 28px -16px rgba(36,21,18,0.22)' }}>
                                    <div className="grid grid-cols-[1fr_auto]">
                                        {/* main leaf */}
                                        <div className="p-5 sm:p-6 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <StatusTag status={status} />
                                                {duty.group_name && (
                                                    <span className="text-[10px] font-semibold text-slate-400">· {duty.group_name}</span>
                                                )}
                                                {duty.is_makeup === 1 && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>· Makeup</span>
                                                )}
                                            </div>
                                            <h4 className="font-bold text-base sm:text-lg" style={{ ...serif, color: INK }}>{duty.title}</h4>
                                            {duty.description && (
                                                <p className="text-xs text-slate-400 mt-1">{duty.description}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                                                {duty.time_start && (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <Clock size={12} style={{ color: MAROON }} />
                                                        {duty.time_start} — {duty.time_end}
                                                    </div>
                                                )}
                                                {duty.location && (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <MapPin size={12} style={{ color: MAROON }} />
                                                        {duty.location}
                                                    </div>
                                                )}
                                            </div>
                                            <button onClick={() => setExpanded(isOpen ? null : duty.id)}
                                                className="text-[10px] font-bold text-slate-400 flex items-center gap-1 hover:text-slate-600 transition-colors mt-3">
                                                Details
                                                {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                        </div>

                                        {/* ticket stub — a fine dashed edge with punched notches, elegant serif date */}
                                        <div
                                            className="relative w-24 sm:w-28 flex flex-col items-center justify-center gap-2 px-2 text-center flex-shrink-0"
                                            style={{ borderLeft: `1.5px dashed ${GOLD}99`, background: detailBg }}
                                        >
                                            <span className="absolute -left-[7px] -top-[7px] w-3.5 h-3.5 rounded-full" style={{ background: IVORY }} />
                                            <span className="absolute -left-[7px] -bottom-[7px] w-3.5 h-3.5 rounded-full" style={{ background: IVORY }} />
                                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: detailAccent }}>{monthAbbr}</span>
                                            <span className="text-3xl sm:text-4xl font-bold leading-none" style={{ ...serif, color: detailAccent }}>{dayNum}</span>
                                            <span className="w-5 h-px" style={{ background: `${detailAccent}55` }} />
                                            {getStatusIcon(status)}
                                        </div>
                                    </div>

                                    {isOpen && (
                                        <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                                            <div className="rounded-xl p-4 sm:p-5" style={{ background: IVORY }}>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5 text-slate-400">Duty Details</p>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2 text-xs" style={{ color: INK }}>
                                                                <CalendarDays size={12} style={{ color: MAROON }} className="shrink-0" />
                                                                {dutyDate.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                            </div>
                                                            {duty.time_start && (
                                                                <div className="flex items-center gap-2 text-xs" style={{ color: INK }}>
                                                                    <Clock size={12} style={{ color: MAROON }} className="shrink-0" />
                                                                    {duty.time_start} — {duty.time_end}
                                                                </div>
                                                            )}
                                                            {duty.location && (
                                                                <div className="flex items-center gap-2 text-xs" style={{ color: INK }}>
                                                                    <MapPin size={12} style={{ color: MAROON }} className="shrink-0" />
                                                                    {duty.location}
                                                                </div>
                                                            )}
                                                            {status === 'pending' && (
                                                                <p className="text-[10px] font-semibold mt-2" style={{ color: '#92400e' }}>
                                                                    Pwede ka pang mag-check-in hanggang 7 araw mula sa duty date.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="sm:pl-6 sm:border-l" style={{ borderColor: '#e9dfd8' }}>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5 text-slate-400">My Attendance</p>
                                                        {duty.attendance_status ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    {getStatusIcon(status)}
                                                                    <span className="text-sm font-bold capitalize" style={{ color: detailAccent }}>
                                                                        {duty.attendance_status}{duty.is_makeup ? ' (makeup)' : ''}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400">
                                                                    Marked via {duty.method} • {new Date(duty.marked_at).toLocaleDateString('en-PH')}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs font-medium text-slate-400">
                                                                {status === 'missed' ? 'Hindi nakadalo -- lumipas na ang makeup window.' : 'Not yet checked in'}
                                                            </p>
                                                        )}
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