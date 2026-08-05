import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  QrCode, CheckCircle2, X, Users, ListChecks,
  Save, Search, AlertTriangle, ChevronDown, Clock,
  RefreshCw, Printer, CalendarClock, MapPin
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const API = 'http://localhost:5000/api';
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const StaffDutyAttendance = () => {
  const [duties, setDuties] = useState([]);
  const [subTab, setSubTab] = useState('qr');

  // qr / monitor tab
  const [qrDuty, setQrDuty] = useState('');
  const [dutyQR, setDutyQR] = useState(null);
  const [qrScholars, setQrScholars] = useState([]);
  const [qrLoading, setQrLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // manual tab
  const [manualDuty, setManualDuty] = useState('');
  const [scholars, setScholars] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/duties`, authHeaders())
      .then(res => setDuties(res.data.filter(d => d.status === 'upcoming' || d.status === 'ongoing')))
      .catch(err => console.error('Failed to fetch duties:', err));
  }, []);

  // ── QR Monitor tab ──────────────────────────────────────────

  const loadQRDuty = async (dutyId) => {
    setQrDuty(dutyId);
    setDutyQR(null);
    setQrScholars([]);
    if (!dutyId) return;
    setQrLoading(true);
    try {
      const [qrRes, scholarsRes] = await Promise.all([
        axios.get(`${API}/staff/duties/${dutyId}/qr`, authHeaders()),
        axios.get(`${API}/staff/duties/${dutyId}/scholars`, authHeaders()),
      ]);
      setDutyQR(qrRes.data);
      setQrScholars(scholarsRes.data);
    } catch (err) {
      console.error('Failed to load duty QR/scholars:', err);
    } finally {
      setQrLoading(false);
    }
  };

  const refreshQRScholars = async () => {
    if (!qrDuty) return;
    setRefreshing(true);
    try {
      const res = await axios.get(`${API}/staff/duties/${qrDuty}/scholars`, authHeaders());
      setQrScholars(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const handlePrintQR = () => {
    if (!dutyQR) return;
    const svgEl = document.getElementById('duty-qr-svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);

    const printWindow = window.open('', '_blank', 'width=500,height=650');
    printWindow.document.write(`
      <html>
        <head>
          <title>Duty QR Code — ${dutyQR.title}</title>
          <style>
            body { font-family: 'DM Sans', Arial, sans-serif; display: flex; flex-direction: column;
                   align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            h2 { color: #7f2d3a; margin-bottom: 4px; }
            p { color: #64748b; font-size: 13px; margin: 2px 0 20px; }
            .box { border: 2px dashed #7f2d3a; border-radius: 16px; padding: 24px; }
          </style>
        </head>
        <body>
          <h2>${dutyQR.title}</h2>
          <p>${new Date(dutyQR.duty_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}${dutyQR.location ? ' • ' + dutyQR.location : ''}</p>
          <div class="box">${svgData}</div>
          <p style="margin-top:20px;">I-scan gamit ang Apple Scholar app para mag-check-in.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const checkedIn = qrScholars.filter(s => s.attendance_status === 'present');
  const notYet = qrScholars.filter(s => s.attendance_status !== 'present');
  const qrPercent = qrScholars.length ? Math.round((checkedIn.length / qrScholars.length) * 100) : 0;

  // ── Manual Entry tab ────────────────────────────────────────

  const loadScholars = async (dutyId) => {
    setManualDuty(dutyId);
    setAttendance({});
    setSearchQuery('');
    setSaveMsg('');
    if (!dutyId) { setScholars([]); return; }
    setManualLoading(true);
    try {
      const res = await axios.get(`${API}/staff/duties/${dutyId}/scholars`, authHeaders());
      const list = res.data;
      setScholars(list);
      const init = {};
      list.forEach(s => { init[s.scholar_id] = s.attendance_status || null; });
      setAttendance(init);
    } catch (err) {
      console.error('Failed to fetch scholars:', err);
    } finally {
      setManualLoading(false);
    }
  };

  const setScholarStatus = (scholarId, status) => {
    setAttendance(prev => ({ ...prev, [scholarId]: prev[scholarId] === status ? null : status }));
  };

  const saveAttendance = async () => {
    if (!manualDuty) return;
    setSaving(true);
    try {
      const payload = Object.entries(attendance)
        .filter(([, status]) => status !== null)
        .map(([scholar_id, status]) => ({ scholar_id, status, method: 'manual' }));

      if (payload.length === 0) {
        setSaveMsg('Walang na-mark na scholar.');
        setSaving(false);
        return;
      }

      await axios.post(`${API}/staff/duties/${manualDuty}/attendance/bulk`,
        { records: payload }, authHeaders());
      setSaveMsg(`Saved — ${payload.length} of ${scholars.length} scholars marked.`);
      setTimeout(() => setSaveMsg(''), 3500);
    } catch (err) {
      setSaveMsg(err.response?.data?.error || 'Error saving. Please try again.');
    } finally {
      setSaving(false);
    }
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

  const selectedQrDuty = duties.find(d => String(d.id) === String(qrDuty));
  const selectedManualDuty = duties.find(d => String(d.id) === String(manualDuty));

  const dutySelect = (value, onChange, placeholder = '-- Select a duty --') => (
    <div className="relative mb-4">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 p-3 pr-9 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-[#7f2d3a] focus:bg-white focus:ring-4 focus:ring-[#7f2d3a]/5 transition-all appearance-none cursor-pointer">
        <option value="">{placeholder}</option>
        {duties.map(d => (
          <option key={d.id} value={d.id}>
            {d.title} — {new Date(d.duty_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );

  const statusChip = {
    present: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200',
    absent:  'bg-red-500 text-white border-red-500 shadow-sm shadow-red-200',
    excused: 'bg-amber-400 text-white border-amber-400 shadow-sm shadow-amber-200',
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6">

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="text-[10px] bg-amber-100 text-amber-700 font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">
            Staff — Attendance
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mt-2 tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Duty Attendance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor QR check-ins per duty, or mark attendance manually as a fallback.
          </p>
        </div>
        <div className="w-11 h-11 rounded-2xl bg-[#7f2d3a]/10 flex items-center justify-center shrink-0">
          <ListChecks size={20} className="text-[#7f2d3a]" />
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-3 mb-6">
        {[
          { key: 'qr',     label: 'QR Monitor',   icon: <QrCode size={14} /> },
          { key: 'manual', label: 'Manual Entry (Fallback)', icon: <ListChecks size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${
              subTab === t.key
                ? 'bg-[#7f2d3a] text-white border-[#7f2d3a] shadow-sm shadow-[#7f2d3a]/20'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* QR Monitor Tab */}
      {subTab === 'qr' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
              <QrCode size={14} className="text-slate-400" /> Duty QR Code
            </h3>
            <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest block mb-1.5">Select Duty *</label>
            {dutySelect(qrDuty, loadQRDuty)}

            {qrLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="bg-slate-100 rounded-2xl h-48" />
                <div className="bg-slate-100 rounded-lg h-3 w-2/3 mx-auto" />
              </div>
            ) : dutyQR ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-[#7f2d3a]/30 flex flex-col items-center p-5">
                {(dutyQR.duty_date || dutyQR.location) && (
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-bold mb-4">
                    <span className="flex items-center gap-1">
                      <CalendarClock size={12} />
                      {new Date(dutyQR.duty_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </span>
                    {dutyQR.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {dutyQR.location}
                      </span>
                    )}
                  </div>
                )}
                <div className="p-3 bg-white rounded-xl">
                  <QRCodeSVG id="duty-qr-svg" value={dutyQR.qr_token} size={176} fgColor="#7f2d3a" />
                </div>
                <p className="text-[10px] text-slate-400 mt-4 text-center max-w-[220px] leading-relaxed">
                  I-print at i-post ito sa duty location. Ang scholar ang mag-sscan nito para mag-check-in.
                </p>
                <button onClick={handlePrintQR}
                  className="mt-4 flex items-center gap-2 bg-[#7f2d3a] text-white text-xs font-black px-4 py-2.5 rounded-xl hover:bg-[#63232d] active:scale-[0.98] transition-all shadow-sm shadow-[#7f2d3a]/20">
                  <Printer size={14} /> Print QR Code
                </button>
              </div>
            ) : (
              <div className="text-center py-14 text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl">
                <QrCode size={30} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-bold text-slate-400">Pumili ng duty</p>
                <p className="text-xs text-slate-300 mt-0.5">para makita yung QR code nito.</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
                Checked In
              </h3>
              {qrDuty && qrScholars.length > 0 && (
                <button onClick={refreshQRScholars}
                  className="text-slate-400 hover:text-[#7f2d3a] transition-colors p-1 -m-1 rounded-lg">
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                </button>
              )}
            </div>

            {qrScholars.length === 0 ? (
              <div className="flex-1 text-center py-14 text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl mt-4">
                <Users size={30} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-bold text-slate-400">Pumili muna ng duty</p>
                <p className="text-xs text-slate-300 mt-0.5">para lumabas ang mga naka-assign na scholar.</p>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between mb-2 mt-3">
                  <p className="text-2xl font-black text-slate-800">
                    {checkedIn.length}<span className="text-slate-300 font-bold">/{qrScholars.length}</span>
                  </p>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">{qrPercent}% in</p>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${qrPercent}%` }} />
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {checkedIn.map(s => (
                    <div key={s.scholar_id} className="flex items-center justify-between p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                          {initials(s.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{s.full_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{s.scholar_id}{s.is_makeup ? ' • makeup' : ''}</p>
                        </div>
                      </div>
                      {s.marked_at && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0 ml-2">
                          <Clock size={10} /> {new Date(s.marked_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  ))}
                  {notYet.map(s => (
                    <div key={s.scholar_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0">
                          {initials(s.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-500 text-sm truncate">{s.full_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{s.scholar_id}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase shrink-0 ml-2">Pending</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Manual Tab */}
      {subTab === 'manual' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
              <ListChecks size={14} className="text-slate-400" /> Setup
            </h3>
            <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest block mb-1.5">Select Duty *</label>
            {dutySelect(manualDuty, loadScholars)}

            {manualLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="bg-slate-100 rounded-xl h-11" />
                <div className="bg-slate-100 rounded-xl h-16" />
              </div>
            ) : scholars.length > 0 && (
              <>
                <label className="text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest block mb-1.5">Search Scholar</label>
                <div className="relative mb-4">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Name or scholar ID..."
                    className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-3 rounded-xl text-sm outline-none focus:border-[#7f2d3a] focus:bg-white focus:ring-4 focus:ring-[#7f2d3a]/5 transition-all" />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Present', count: scholarCounts.present, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                    { label: 'Absent',  count: scholarCounts.absent,  color: 'bg-red-50 text-red-600 border-red-100' },
                    { label: 'Excused', count: scholarCounts.excused, color: 'bg-amber-50 text-amber-700 border-amber-100' },
                  ].map(c => (
                    <div key={c.label} className={`rounded-xl border p-3 text-center ${c.color}`}>
                      <p className="text-lg font-black">{c.count}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider">{c.label}</p>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-slate-400 font-bold mb-3 text-center">
                  {Object.values(attendance).filter(Boolean).length} of {scholars.length} marked
                </p>

                <button onClick={saveAttendance} disabled={saving}
                  className="w-full py-3.5 bg-[#7f2d3a] text-white font-black text-xs rounded-2xl uppercase tracking-widest hover:bg-[#63232d] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm shadow-[#7f2d3a]/20">
                  <Save size={13} /> {saving ? 'Saving...' : 'Save Attendance'}
                </button>
                {saveMsg && (
                  <p className={`text-xs font-bold text-center mt-3 ${saveMsg.startsWith('Error') || saveMsg.startsWith('Walang') ? 'text-red-500' : 'text-emerald-600'}`}>
                    {saveMsg}
                  </p>
                )}
              </>
            )}

            {!manualLoading && scholars.length === 0 && (
              <div className="text-center py-10 text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl">
                <ListChecks size={28} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-bold text-slate-400">Pumili ng duty</p>
                <p className="text-xs text-slate-300 mt-0.5">para simulan ang manual attendance.</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
              <Users size={14} className="text-slate-400" />
              Scholar List {scholars.length > 0 && (
                <span className="text-slate-400 font-bold normal-case">({filteredScholars.length})</span>
              )}
            </h3>
            {scholars.length === 0 ? (
              <div className="text-center py-14 text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl">
                <Users size={30} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-bold text-slate-400">No scholars loaded</p>
                <p className="text-xs text-slate-300 mt-1">Select a duty to load its assigned group members.</p>
              </div>
            ) : filteredScholars.length === 0 ? (
              <div className="text-center py-10 text-slate-300">
                <Search size={26} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-bold text-slate-400">No results for "{searchQuery}"</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
                {filteredScholars.map(s => {
                  const status = attendance[s.scholar_id];
                  return (
                    <div key={s.scholar_id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0">
                          {initials(s.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{s.full_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{s.scholar_id}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0 ml-3">
                        {[
                          { key: 'present', label: 'P', icon: <CheckCircle2 size={11} />, inactiveHover: 'hover:border-emerald-300 hover:text-emerald-600' },
                          { key: 'absent',  label: 'A', icon: <X size={11} />,            inactiveHover: 'hover:border-red-300 hover:text-red-500' },
                          { key: 'excused', label: 'E', icon: <AlertTriangle size={11} />, inactiveHover: 'hover:border-amber-300 hover:text-amber-600' },
                        ].map(btn => (
                          <button key={btn.key} onClick={() => setScholarStatus(s.scholar_id, btn.key)} title={btn.key}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-0.5 ${
                              status === btn.key
                                ? statusChip[btn.key]
                                : `bg-slate-50 text-slate-400 border-slate-200 ${btn.inactiveHover}`
                            }`}>
                            {btn.icon} {btn.label}
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
    </div>
  );
};

export default StaffDutyAttendance;