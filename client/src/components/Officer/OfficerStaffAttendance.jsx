import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { QrCode, Search, CheckCircle2, LogOut, ChevronDown, Loader2 } from 'lucide-react';
import { BrowserQRCodeReader } from '@zxing/browser';

const API = 'http://localhost:5000/api/officer';

export function Attendance() {
    const officerId  = localStorage.getItem('id')       || '';
    const markedBy   = localStorage.getItem('name')     || 'Officer';

    const [duties,      setDuties]      = useState([]);
    const [selectedDuty, setSelectedDuty] = useState('');
    const [attendance,  setAttendance]  = useState([]);
    const [activeView,  setActiveView]  = useState('scanner');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading,     setLoading]     = useState(false);
    const [scanning,    setScanning]    = useState(false);
    const [lastScan,    setLastScan]    = useState(null);
    const [toast,       setToast]       = useState(null);

    const videoRef  = useRef(null);
    const readerRef = useRef(null);

    // ── Fetch duties on mount ──────────────────────────────
    useEffect(() => {
        axios.get(`${API}/duties`)
            .then(res => {
                setDuties(res.data);
                if (res.data.length > 0) setSelectedDuty(res.data[0].id);
            })
            .catch(err => console.error('Error fetching duties:', err));
    }, []);

    // ── Fetch attendance when duty changes ─────────────────
    useEffect(() => {
        if (!selectedDuty) return;
        fetchAttendance();
    }, [selectedDuty]);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/attendance`, { params: { duty_id: selectedDuty } });
            setAttendance(res.data);
        } catch (err) {
            console.error('Error fetching attendance:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Toast helper ───────────────────────────────────────
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ── Mark check-in ──────────────────────────────────────
    const markAttendance = async (scholarId, method = 'manual') => {
        if (!selectedDuty) { showToast('Please select a duty first.', 'error'); return; }
        try {
            await axios.post(`${API}/attendance`, {
                officer_id: scholarId,
                duty_id:    selectedDuty,
                method,
                marked_by:  markedBy,
            });
            showToast('Attendance marked successfully!');
            fetchAttendance();
            return true;
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to mark attendance.';
            showToast(msg, 'error');
            return false;
        }
    };

    // ── Mark check-out ─────────────────────────────────────
    const markCheckout = async (attendanceId) => {
        try {
            await axios.patch(`${API}/attendance/${attendanceId}/checkout`);
            showToast('Check-out marked!');
            fetchAttendance();
        } catch (err) {
            showToast('Failed to mark checkout.', 'error');
        }
    };

    // ── QR Scanner ────────────────────────────────────────
    const startScanner = async () => {
        setScanning(true);
        try {
            readerRef.current = new BrowserQRCodeReader();
            await readerRef.current.decodeFromVideoDevice(undefined, videoRef.current, async (result, err) => {
                if (result) {
                    const scholarId = result.getText();
                    setLastScan(scholarId);
                    const success = await markAttendance(scholarId, 'qr');
                    if (success) stopScanner();
                }
            });
        } catch (err) {
            console.error('Scanner error:', err);
            showToast('Camera error. Check permissions.', 'error');
            setScanning(false);
        }
    };

    const stopScanner = () => {
        readerRef.current?.reset?.();
        setScanning(false);
    };

    useEffect(() => { return () => readerRef.current?.reset?.(); }, []);

    // ── Filtered attendance list ───────────────────────────
    const filtered = attendance.filter(a =>
        (a.full_name  || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.scholar_id || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const checkedInCount = attendance.filter(a => a.check_in).length;
    const selectedDutyObj = duties.find(d => d.id == selectedDuty);

    return (
        <div className="p-6 sm:p-8 relative">

            {/* Toast */}
            {toast && (
                <div
                    className="fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-bold"
                    style={{
                        background: toast.type === 'error' ? '#fee2e2' : '#dcfce7',
                        color:      toast.type === 'error' ? '#991b1b' : '#166534',
                    }}
                >
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="mb-6">
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', fontWeight: 700, color: '#1a1a1a' }}>
                    Attendance & QR Scanner
                </h1>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', color: '#6b7280' }}>
                    Track scholar attendance with QR codes or manual check-in
                </p>
            </div>

            {/* Duty Selector */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
                <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 700, color: '#802B36', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                    Select Duty
                </label>
                <div className="relative max-w-md">
                    <select
                        value={selectedDuty}
                        onChange={e => setSelectedDuty(e.target.value)}
                        className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border border-gray-200 bg-slate-50 text-sm outline-none focus:border-[#802B36] transition-all"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                        {duties.length === 0 && <option value="">No duties found</option>}
                        {duties.map(d => (
                            <option key={d.id} value={d.id}>{d.title} — {d.due_date}</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                </div>

                {/* Summary */}
                {selectedDutyObj && (
                    <div className="flex gap-4 mt-4">
                        <div className="text-center px-4 py-2 rounded-xl" style={{ background: '#dcfce7' }}>
                            <p className="text-xl font-black" style={{ color: '#166534' }}>{checkedInCount}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#166534' }}>Checked In</p>
                        </div>
                        <div className="text-center px-4 py-2 rounded-xl" style={{ background: '#f1f5f9' }}>
                            <p className="text-xl font-black text-slate-600">{attendance.length}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Records</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-gray-200 flex gap-6">
                {['scanner', 'manual'].map(view => (
                    <button
                        key={view}
                        onClick={() => { setActiveView(view); stopScanner(); }}
                        className="pb-3 px-1 transition-all relative capitalize"
                        style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            color: activeView === view ? '#802B36' : '#6b7280',
                            background: 'none', border: 'none', cursor: 'pointer',
                        }}
                    >
                        {view === 'scanner' ? 'QR Scanner' : 'Manual Check-In'}
                        {activeView === view && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: '#802B36' }} />
                        )}
                    </button>
                ))}
            </div>

            {/* QR Scanner View */}
            {activeView === 'scanner' && (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6" style={{ backgroundColor: '#F5E8EA' }}>
                            <QrCode className="w-10 h-10" style={{ color: '#802B36' }} />
                        </div>
                        <h2 className="mb-2" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a' }}>
                            QR Code Scanner
                        </h2>
                        <p className="mb-6" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', color: '#6b7280' }}>
                            {scanning ? 'Scanning — position QR code in frame' : 'Click Start Scanner to begin'}
                        </p>

                        {/* Video or placeholder */}
                        <div className="relative mx-auto mb-6" style={{ width: 320, height: 320 }}>
                            {scanning ? (
                                <video ref={videoRef} className="w-full h-full rounded-xl object-cover" />
                            ) : (
                                <div className="absolute inset-0 border-4 border-dashed rounded-xl flex items-center justify-center" style={{ borderColor: '#802B36' }}>
                                    <div className="text-center">
                                        <QrCode className="w-24 h-24 mx-auto mb-4" style={{ color: '#D4A5AE' }} />
                                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#6b7280' }}>
                                            Scan scholar QR code here
                                        </p>
                                    </div>
                                </div>
                            )}
                            {/* Corner frames */}
                            {!scanning && (
                                <>
                                    <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 rounded-tl-xl" style={{ borderColor: '#802B36' }} />
                                    <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 rounded-tr-xl" style={{ borderColor: '#802B36' }} />
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 rounded-bl-xl" style={{ borderColor: '#802B36' }} />
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 rounded-br-xl" style={{ borderColor: '#802B36' }} />
                                </>
                            )}
                        </div>

                        <button
                            onClick={scanning ? stopScanner : startScanner}
                            className="px-6 py-3 rounded-xl text-sm font-bold"
                            style={{
                                background: scanning ? '#fee2e2' : '#802B36',
                                color:      scanning ? '#991b1b' : '#fff',
                                border: 'none', cursor: 'pointer',
                                fontFamily: "'DM Sans', sans-serif",
                            }}
                        >
                            {scanning ? 'Stop Scanner' : 'Start Scanner'}
                        </button>

                        {lastScan && (
                            <p className="mt-4 text-xs text-slate-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                Last scan: <span className="font-bold text-[#802B36]">{lastScan}</span>
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Manual Check-In View */}
            {activeView === 'manual' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or scholar ID..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 outline-none"
                                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                            <Loader2 size={18} className="animate-spin" />
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }}>Loading...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16" style={{ fontFamily: "'DM Sans', sans-serif", color: '#9ca3af' }}>
                            No attendance records yet for this duty.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200" style={{ backgroundColor: '#F5E8EA' }}>
                                        {['Name', 'Scholar ID', 'Check-In', 'Check-Out', 'Method', 'Action'].map(h => (
                                            <th key={h} className="text-left px-6 py-4" style={{
                                                fontFamily: "'DM Sans', sans-serif",
                                                fontSize: '0.875rem', fontWeight: 600, color: '#802B36',
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(row => (
                                        <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', fontWeight: 600, color: '#1a1a1a' }}>
                                                {row.full_name || '—'}
                                            </td>
                                            <td className="px-6 py-4" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#374151' }}>
                                                {row.scholar_id || '—'}
                                            </td>
                                            <td className="px-6 py-4" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#374151' }}>
                                                {row.check_in ? new Date(row.check_in).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </td>
                                            <td className="px-6 py-4" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#374151' }}>
                                                {row.check_out ? new Date(row.check_out).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold px-2 py-1 rounded-lg capitalize"
                                                    style={{
                                                        background: row.method === 'qr' ? '#dbeafe' : '#f1f5f9',
                                                        color:      row.method === 'qr' ? '#1e40af' : '#64748b',
                                                    }}>
                                                    {row.method || 'manual'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {row.check_in && !row.check_out ? (
                                                    <button
                                                        onClick={() => markCheckout(row.id)}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
                                                        style={{ background: '#fee2e2', color: '#991b1b', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                                                    >
                                                        <LogOut size={12} /> Check Out
                                                    </button>
                                                ) : row.check_in && row.check_out ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                                                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>Done</span>
                                                    </div>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Attendance;