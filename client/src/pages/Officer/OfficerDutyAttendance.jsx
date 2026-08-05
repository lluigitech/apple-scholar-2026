import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  QrCode, CheckCircle, CheckCircle2, X, XCircle, Users, List,
  Save, Search, AlertTriangle, ChevronDown, Clock,
  Plus, Trash2, AlertCircle, CameraOff, UserCheck,
  Shield, Calendar, MapPin, BarChart2, Loader2
} from 'lucide-react';

const API = 'http://localhost:5000/api';
const MAROON = '#7f2d3a';

// ─── Helpers ──────────────────────────────────────────────────

const Avatar = ({ name, color }) => (
  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
    style={{ backgroundColor: color + '20', color }}>
    {name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
  </div>
);

const Toast = ({ msg, type }) => (
  <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl"
    style={{ backgroundColor: type === 'success' ? '#1a1a1a' : '#991b1b', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 600 }}>
    {type === 'success'
      ? <CheckCircle2 size={15} style={{ color: '#34d399' }} />
      : <AlertCircle size={15} style={{ color: '#fca5a5' }} />}
    {msg}
  </div>
);

// ─── QR Scanner Modal (Staff) ─────────────────────────────────

const StaffQRModal = ({ onScan, onClose, currentDate }) => {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const frameRef   = useRef(0);
  const [camErr,   setCamErr]   = useState('');
  const [scanned,  setScanned]  = useState(false);
  const [feedback, setFeedback] = useState('');
  const [manual,   setManual]   = useState('');
  const [duty,     setDuty]     = useState('');
  const [date,     setDate]     = useState(currentDate);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    script.onload = startCam;
    script.onerror = () => setCamErr('Failed to load QR library.');
    document.head.appendChild(script);

    async function startCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); requestAnimationFrame(loop); }
      } catch { setCamErr('Camera access denied. Use manual entry.'); }
    }

    function loop() {
      const jsQR = window.jsQR;
      if (!videoRef.current || !canvasRef.current || !jsQR) return;
      const v = videoRef.current; const c = canvasRef.current; const ctx = c.getContext('2d');
      if (!ctx || v.readyState !== v.HAVE_ENOUGH_DATA) { frameRef.current = requestAnimationFrame(loop); return; }
      c.width = v.videoWidth; c.height = v.videoHeight;
      ctx.drawImage(v, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height);
      if (code?.data) {
        setFeedback(`Scanned: ${code.data}`); setScanned(true);
        onScan(code.data, duty, date);
        streamRef.current?.getTracks().forEach(t => t.stop()); return;
      }
      frameRef.current = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      try { document.head.removeChild(script); } catch {}
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: MAROON }}>Scan</p>
            <h2 className="font-black text-slate-900 text-xl" style={{ fontFamily: "'Playfair Display', serif" }}>Staff QR Scanner</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MAROON }}>Duty Session</label>
              <input type="text" value={duty} onChange={e => setDuty(e.target.value)}
                placeholder="e.g. Library Duty"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm bg-slate-50"
                style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MAROON }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm bg-slate-50"
                style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden bg-slate-900 relative" style={{ aspectRatio: '4/3', maxHeight: 260 }}>
            {camErr ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                <CameraOff size={36} className="text-slate-500" />
                <p className="text-sm text-slate-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>{camErr}</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                {!scanned && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div style={{ width: 150, height: 150, position: 'relative' }}>
                      {[
                        { top: 0, left: 0, borderTop: `3px solid ${MAROON}`, borderLeft: `3px solid ${MAROON}` },
                        { top: 0, right: 0, borderTop: `3px solid ${MAROON}`, borderRight: `3px solid ${MAROON}` },
                        { bottom: 0, left: 0, borderBottom: `3px solid ${MAROON}`, borderLeft: `3px solid ${MAROON}` },
                        { bottom: 0, right: 0, borderBottom: `3px solid ${MAROON}`, borderRight: `3px solid ${MAROON}` },
                      ].map((s, i) => <div key={i} style={{ position: 'absolute', width: 20, height: 20, borderRadius: 2, ...s }} />)}
                    </div>
                  </div>
                )}
                {scanned && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <CheckCircle2 size={48} style={{ color: '#34d399' }} />
                    <p className="text-white font-black text-sm">Scanned!</p>
                  </div>
                )}
              </>
            )}
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {feedback && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-700">{feedback}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: MAROON }}>Manual Entry</p>
            <div className="flex gap-2">
              <input type="text" value={manual} onChange={e => setManual(e.target.value)}
                placeholder="Staff ID (e.g. STAFF-001)"
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-sm bg-slate-50"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
                onKeyDown={e => { if (e.key === 'Enter' && manual.trim()) { onScan(manual.trim(), duty, date); onClose(); }}} />
              <button onClick={() => { if (manual.trim()) { onScan(manual.trim(), duty, date); onClose(); }}}
                className="px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
                style={{ backgroundColor: MAROON }}>
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Add Staff Modal ──────────────────────────────────────────

const AddStaffModal = ({ onClose, onAdd }) => {
  const [form, setForm] = useState({ staff_name: '', role: 'Staff', duty: '', date: new Date().toISOString().split('T')[0], status: 'present' });
  const valid = form.staff_name.trim() && form.duty.trim() && form.date;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="font-black text-slate-900 text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>Add Staff Entry</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MAROON }}>Name</label>
              <input type="text" value={form.staff_name} onChange={e => setForm({ ...form, staff_name: e.target.value })}
                placeholder="Full name"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm bg-slate-50"
                style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MAROON }}>Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm bg-slate-50 appearance-none"
                style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <option>Staff</option><option>Officer</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MAROON }}>Duty</label>
              <input type="text" value={form.duty} onChange={e => setForm({ ...form, duty: e.target.value })}
                placeholder="e.g. Library Duty"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm bg-slate-50"
                style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MAROON }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm bg-slate-50"
                style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MAROON }}>Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm bg-slate-50 appearance-none"
              style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <option value="present">Present</option>
              <option value="missed">Missed Duty</option>
            </select>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition-all">Cancel</button>
          <button onClick={() => { if (valid) onAdd(form); }} disabled={!valid}
            className="flex-1 py-3 rounded-2xl text-white font-black text-xs transition-all disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: MAROON }}>Add Entry</button>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────

const DeleteModal = ({ onClose, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50">
        <Trash2 size={28} className="text-red-500" />
      </div>
      <h2 className="font-black text-slate-900 text-xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Delete Entry?</h2>
      <p className="text-sm text-slate-400 mb-6">This action cannot be undone.</p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition-all">Cancel</button>
        <button onClick={onConfirm}
          className="flex-1 py-3 rounded-2xl text-white font-black text-xs bg-red-500 hover:bg-red-600 transition-all">Yes, Delete</button>
      </div>
    </div>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────

const OfficerDutyAttendance = () => {
  const officerName = localStorage.getItem('name') || 'Officer';
  const [mainTab, setMainTab] = useState('scholar');

  // ── Scholar state ─────────────────────────────────────────
  const [duties,      setDuties]      = useState([]);
  const [subTab,      setSubTab]      = useState('qr');
  const [qrDuty,      setQrDuty]      = useState('');
  const [scanning,    setScanning]    = useState(false);
  const [scanLog,     setScanLog]     = useState([]);
  const [qrError,     setQrError]     = useState('');
  const [manualDuty,  setManualDuty]  = useState('');
  const [scholars,    setScholars]    = useState([]);
  const [attendance,  setAttendance]  = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [saveMsg,     setSaveMsg]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const videoRef   = useRef(null);
  const scannerRef = useRef(null);

  // ── Staff state ───────────────────────────────────────────
  const [staffList,         setStaffList]         = useState([]);
  const [staffLoading,      setStaffLoading]      = useState(false);
  const [staffSearch,       setStaffSearch]       = useState('');
  const [staffRoleFilter,   setStaffRoleFilter]   = useState('All');
  const [staffStatusFilter, setStaffStatusFilter] = useState('All');
  const [showAddStaff,      setShowAddStaff]      = useState(false);
  const [deleteId,          setDeleteId]          = useState(null);
  const [showStaffQR,       setShowStaffQR]       = useState(false);
  const [toast,             setToast]             = useState('');
  const [toastType,         setToastType]         = useState('success');

  // ── Load duties ───────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/duties`)
      .then(res => setDuties(res.data.filter(d => d.status === 'upcoming' || d.status === 'ongoing')))
      .catch(err => console.error(err));
  }, []);

  // ── Load staff attendance when tab switches ───────────────
  useEffect(() => {
    if (mainTab === 'staff') fetchStaffAttendance();
  }, [mainTab]);

  const fetchStaffAttendance = async () => {
    setStaffLoading(true);
    try {
      const res = await axios.get(`${API}/staff/attendance`);
      setStaffList(res.data);
    } catch (err) {
      console.error('Error fetching staff attendance:', err);
      showToast('Failed to load staff attendance.', 'error');
    } finally {
      setStaffLoading(false);
    }
  };

  // ── Toast ─────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 3000);
  };

  // ── Scholar QR ────────────────────────────────────────────
  const startScanner = async () => {
    if (!qrDuty) { setQrError('Select a duty first.'); return; }
    setQrError(''); setScanning(true);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      scannerRef.current = reader;
      await reader.decodeFromVideoDevice(null, videoRef.current, async (result) => {
        if (result) {
          try {
            const data = JSON.parse(result.getText());
            const scholarId = data.scholar_id;
            await axios.post(`${API}/duties/${qrDuty}/attendance`, {
              scholar_id: scholarId, status: 'present', method: 'qr', marked_by: officerName,
            });
            setScanLog(prev => {
              if (prev.find(s => s.scholar_id === scholarId)) return prev;
              return [{ scholar_id: scholarId, name: data.full_name || 'Scholar', time: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) }, ...prev];
            });
          } catch (e) { console.error(e); }
        }
      });
    } catch (err) { console.error(err); setScanning(false); }
  };

  const stopScanner = () => {
    try { scannerRef.current?.reset?.(); } catch {}
    setScanning(false);
  };

  const switchSubTab = (t) => { if (scanning) stopScanner(); setSubTab(t); };

  // ── Scholar Manual ────────────────────────────────────────
  const loadScholars = async (id) => {
    setManualDuty(id); setAttendance({}); setSearchQuery(''); setSaveMsg('');
    if (!id) { setScholars([]); return; }
    try {
      const res = await axios.get(`${API}/duties/${id}/scholars`);
      setScholars(res.data);
      const init = {};
      res.data.forEach(s => { init[s.scholar_id] = s.attendance_status || null; });
      setAttendance(init);
    } catch (e) { console.error(e); }
  };

  const setScholarStatus = (id, status) => {
    setAttendance(prev => ({ ...prev, [id]: prev[id] === status ? null : status }));
  };

  const saveAttendance = async () => {
    if (!manualDuty) return;
    setSaving(true);
    try {
      const payload = Object.entries(attendance)
        .filter(([, s]) => s !== null)
        .map(([scholar_id, status]) => ({ scholar_id, status, method: 'manual', marked_by: officerName }));
      await axios.post(`${API}/duties/${manualDuty}/attendance/bulk`, { records: payload });
      setSaveMsg(`Saved — ${payload.length} of ${scholars.length} scholars marked.`);
      setTimeout(() => setSaveMsg(''), 3500);
    } catch { setSaveMsg('Error saving. Please try again.'); }
    finally { setSaving(false); }
  };

  const filteredScholars = scholars.filter(s =>
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.scholar_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scholarCounts = {
    present: Object.values(attendance).filter(v => v === 'present').length,
    absent:  Object.values(attendance).filter(v => v === 'absent').length,
    excused: Object.values(attendance).filter(v => v === 'excused').length,
  };

  // ── Staff QR scan → uses /attendance/qr endpoint ─────────
  const handleStaffQR = async (qrValue, duty, date) => {
    try {
      const res = await axios.post(`${API}/staff/attendance/qr`, {
        qr_value:  qrValue,
        duty:      duty || 'Unspecified',
        date:      date || new Date().toISOString().split('T')[0],
        marked_by: officerName,
      });
      showToast(res.data.message);
      fetchStaffAttendance();
    } catch (err) {
      showToast(err.response?.data?.error || `Unknown QR: ${qrValue}`, 'error');
    }
    setShowStaffQR(false);
  };

  // ── Add staff manually → save to DB ──────────────────────
  const handleAddStaff = async (form) => {
    try {
      await axios.post(`${API}/staff/attendance`, {
        staff_id:   form.staff_name.replace(/\s+/g, '_').toLowerCase(),
        staff_name: form.staff_name,
        role:       form.role,
        duty:       form.duty,
        date:       form.date,
        status:     form.status,
        method:     'manual',
        marked_by:  officerName,
      });
      showToast(`${form.staff_name} added successfully`);
      fetchStaffAttendance();
      setShowAddStaff(false);
    } catch (err) {
      showToast('Failed to add entry.', 'error');
    }
  };

  // ── Toggle status in DB ───────────────────────────────────
  const toggleStatus = async (id) => {
    try {
      const res = await axios.patch(`${API}/staff/attendance/${id}/toggle`);
      const newStatus = res.data.status;
      setStaffList(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    } catch {
      showToast('Failed to update status.', 'error');
    }
  };

  // ── Delete from DB ────────────────────────────────────────
  const handleDeleteStaff = async (id) => {
    try {
      await axios.delete(`${API}/staff/attendance/${id}`);
      setStaffList(prev => prev.filter(s => s.id !== id));
      showToast('Entry deleted.');
    } catch {
      showToast('Failed to delete entry.', 'error');
    }
    setDeleteId(null);
  };

  const filteredStaff = staffList.filter(s => {
    const matchSearch = s.staff_name?.toLowerCase().includes(staffSearch.toLowerCase()) || s.duty?.toLowerCase().includes(staffSearch.toLowerCase());
    const matchRole   = staffRoleFilter === 'All' || s.role === staffRoleFilter;
    const matchStatus = staffStatusFilter === 'All' || s.status === staffStatusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const presentCount   = staffList.filter(s => s.status === 'present').length;
  const missedCount    = staffList.filter(s => s.status === 'missed').length;
  const attendanceRate = staffList.length > 0 ? Math.round((presentCount / staffList.length) * 100) : 0;

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="min-h-screen p-5 sm:p-8" style={{ backgroundColor: '#f8f7f9', fontFamily: "'DM Sans', sans-serif" }}>

      {toast && <Toast msg={toast} type={toastType} />}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${MAROON}18` }}>
            <Shield size={14} style={{ color: MAROON }} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: MAROON }}>Officer Portal</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 leading-none mb-1"
          style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '-0.02em' }}>
          Duty Attendance
        </h1>
        <p className="text-sm text-slate-400">Track scholar and staff attendance per duty session.</p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#ede9ee' }}>
        {[
          { key: 'scholar', label: 'Scholar Attendance', icon: Users     },
          { key: 'staff',   label: 'Staff Attendance',   icon: UserCheck },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { if (scanning) stopScanner(); setMainTab(key); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            style={{
              backgroundColor: mainTab === key ? '#fff' : 'transparent',
              color:           mainTab === key ? MAROON  : '#94a3b8',
              boxShadow:       mainTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ══ SCHOLAR ATTENDANCE ══ */}
      {mainTab === 'scholar' && (
        <>
          <div className="flex gap-2 mb-6">
            {[
              { key: 'qr',     label: 'QR Scanner',  icon: QrCode },
              { key: 'manual', label: 'Manual Entry', icon: List   },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => switchSubTab(key)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all"
                style={{
                  backgroundColor: subTab === key ? '#1e293b' : '#fff',
                  color:           subTab === key ? '#fff' : '#94a3b8',
                  borderColor:     subTab === key ? '#1e293b' : '#e2e8f0',
                }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {subTab === 'qr' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: MAROON }}>Scanner Setup</p>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Select Duty *</label>
                <div className="relative mb-4">
                  <select value={qrDuty} onChange={e => { setQrDuty(e.target.value); setQrError(''); }}
                    className="w-full bg-slate-50 border border-slate-200 p-3 pr-9 rounded-xl text-sm outline-none appearance-none">
                    <option value="">— Select a duty —</option>
                    {duties.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.title} · {new Date(d.duty_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {qrError && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100 mb-4">
                    <AlertCircle size={13} className="text-red-500 shrink-0" />
                    <p className="text-xs font-bold text-red-600">{qrError}</p>
                  </div>
                )}

                {scanning && (
                  <div className="rounded-2xl overflow-hidden bg-slate-900 mb-4">
                    <video ref={videoRef} className="w-full" />
                  </div>
                )}

                {!scanning ? (
                  <button onClick={startScanner}
                    className="w-full py-3.5 rounded-2xl text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90"
                    style={{ backgroundColor: MAROON }}>
                    <QrCode size={14} /> Start Scanning
                  </button>
                ) : (
                  <button onClick={stopScanner}
                    className="w-full py-3.5 rounded-2xl text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 bg-slate-900 hover:bg-red-600">
                    <X size={14} /> Stop Scanner
                  </button>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: MAROON }}>Scanned Today</p>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: `${MAROON}12`, color: MAROON }}>{scanLog.length}</span>
                </div>
                {scanLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-200">
                    <QrCode size={40} strokeWidth={1} className="mb-3" />
                    <p className="text-sm font-bold text-slate-300">No scans yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {scanLog.map((log, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={13} className="text-white" />
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-sm leading-none">{log.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{log.scholar_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0 ml-2">
                          <Clock size={10} /> {log.time}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {subTab === 'manual' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: MAROON }}>Setup</p>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Select Duty *</label>
                <div className="relative mb-5">
                  <select value={manualDuty} onChange={e => loadScholars(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 pr-9 rounded-xl text-sm outline-none appearance-none">
                    <option value="">— Select a duty —</option>
                    {duties.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.title} · {new Date(d.duty_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {scholars.length > 0 && (
                  <>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Search</label>
                    <div className="relative mb-5">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Name or scholar ID..."
                        className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-3 rounded-xl text-sm outline-none" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-5">
                      {[
                        { label: 'Present', count: scholarCounts.present, bg: '#d1fae5', color: '#065f46' },
                        { label: 'Absent',  count: scholarCounts.absent,  bg: '#fee2e2', color: '#991b1b' },
                        { label: 'Excused', count: scholarCounts.excused, bg: '#fef3c7', color: '#92400e' },
                      ].map(c => (
                        <div key={c.label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: c.bg }}>
                          <p className="text-xl font-black" style={{ color: c.color, fontFamily: "'Playfair Display', serif" }}>{c.count}</p>
                          <p className="text-[10px] font-black uppercase tracking-wider mt-0.5" style={{ color: c.color }}>{c.label}</p>
                        </div>
                      ))}
                    </div>

                    <button onClick={saveAttendance} disabled={saving}
                      className="w-full py-3.5 rounded-2xl text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: MAROON }}>
                      <Save size={13} /> {saving ? 'Saving...' : 'Save Attendance'}
                    </button>
                    {saveMsg && (
                      <p className={`text-xs font-bold text-center mt-3 ${saveMsg.startsWith('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
                        {saveMsg}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: MAROON }}>Scholar List</p>
                  {scholars.length > 0 && (
                    <span className="text-xs font-black px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: `${MAROON}12`, color: MAROON }}>{filteredScholars.length}</span>
                  )}
                </div>
                {scholars.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-200">
                    <Users size={40} strokeWidth={1} className="mb-3" />
                    <p className="text-sm font-bold text-slate-300">No scholars loaded.</p>
                    <p className="text-xs text-slate-300 mt-1">Select a duty to load the list.</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
                    {filteredScholars.map(s => {
                      const status = attendance[s.scholar_id];
                      return (
                        <div key={s.scholar_id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                          <div>
                            <p className="font-black text-slate-800 text-sm leading-none">{s.full_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{s.scholar_id}</p>
                          </div>
                          <div className="flex gap-1.5 shrink-0 ml-3">
                            {[
                              { key: 'present', icon: <CheckCircle size={10} />, active: 'bg-emerald-500 text-white border-emerald-500' },
                              { key: 'absent',  icon: <X size={10} />,           active: 'bg-red-500 text-white border-red-500'        },
                              { key: 'excused', icon: <AlertTriangle size={10} />, active: 'bg-amber-400 text-white border-amber-400'  },
                            ].map(btn => (
                              <button key={btn.key} onClick={() => setScholarStatus(s.scholar_id, btn.key)}
                                className={`w-8 h-8 rounded-lg text-[10px] font-black border-2 transition-all flex items-center justify-center ${
                                  status === btn.key ? btn.active : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                                }`}>
                                {btn.icon}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ STAFF ATTENDANCE ══ */}
      {mainTab === 'staff' && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total',   value: staffList.length, color: '#1e293b', bg: '#f8fafc', icon: Users       },
              { label: 'Present', value: presentCount,     color: '#10b981', bg: '#f0fdf4', icon: CheckCircle2 },
              { label: 'Missed',  value: missedCount,      color: '#ef4444', bg: '#fef2f2', icon: XCircle      },
              { label: 'Rate',    value: `${attendanceRate}%`, color: MAROON, bg: '#fdf2f3', icon: BarChart2  },
            ].map(({ label, value, color, bg, icon: Icon }) => (
              <div key={label} className="rounded-2xl p-5 border border-white shadow-sm" style={{ backgroundColor: bg }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                </div>
                <p className="text-4xl font-black" style={{ color, fontFamily: "'Playfair Display', serif" }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search name or duty..." value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none text-sm bg-white" />
            </div>
            <div className="relative">
              <select value={staffRoleFilter} onChange={e => setStaffRoleFilter(e.target.value)}
                className="appearance-none pl-4 pr-9 py-2.5 rounded-xl border border-slate-200 outline-none text-sm bg-white">
                <option value="All">All Roles</option>
                <option>Staff</option><option>Officer</option>
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={staffStatusFilter} onChange={e => setStaffStatusFilter(e.target.value)}
                className="appearance-none pl-4 pr-9 py-2.5 rounded-xl border border-slate-200 outline-none text-sm bg-white">
                <option value="All">All Status</option>
                <option value="present">Present</option>
                <option value="missed">Missed</option>
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => setShowStaffQR(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 hover:opacity-90">
                <QrCode size={13} /> Scan QR
              </button>
              <button onClick={() => setShowAddStaff(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:opacity-90"
                style={{ backgroundColor: MAROON }}>
                <Plus size={13} /> Add Entry
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {staffLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: `${MAROON}0a` }}>
                      {['Name', 'Role', 'Duty Session', 'Date', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest" style={{ color: MAROON }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-300 font-bold">No entries found.</td>
                      </tr>
                    )}
                    {filteredStaff.map(s => (
                      <tr key={s.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={s.staff_name} color={s.role === 'Officer' ? '#f59e0b' : MAROON} />
                            <p className="font-black text-slate-800 text-sm">{s.staff_name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                            style={{
                              backgroundColor: s.role === 'Officer' ? '#fef3c7' : `${MAROON}12`,
                              color:           s.role === 'Officer' ? '#92400e' : MAROON,
                            }}>
                            {s.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{s.duty}</td>
                        <td className="px-6 py-4 text-sm text-slate-400 font-mono">{s.date}</td>
                        <td className="px-6 py-4">
                          <button onClick={() => toggleStatus(s.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all hover:opacity-80"
                            style={{
                              backgroundColor: s.status === 'present' ? '#d1fae5' : '#fee2e2',
                              color:           s.status === 'present' ? '#065f46' : '#991b1b',
                            }}>
                            {s.status === 'present'
                              ? <><CheckCircle2 size={11} /> Present</>
                              : <><AlertCircle size={11} /> Missed</>}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => setDeleteId(s.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-400 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showStaffQR  && <StaffQRModal onScan={handleStaffQR} onClose={() => setShowStaffQR(false)} currentDate={new Date().toISOString().split('T')[0]} />}
      {showAddStaff && <AddStaffModal onClose={() => setShowAddStaff(false)} onAdd={handleAddStaff} />}
      {deleteId !== null && <DeleteModal onClose={() => setDeleteId(null)} onConfirm={() => handleDeleteStaff(deleteId)} />}
    </div>
  );
};

export default OfficerDutyAttendance;