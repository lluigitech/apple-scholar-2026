import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  QrCode, CheckCircle2, X, Users, ListChecks,
  Save, Search, AlertTriangle, Clock, Hourglass, XCircle,
  RefreshCw, Printer, CalendarClock, CalendarDays, MapPin,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';

const API = 'http://localhost:5000/api';
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

// ── Design tokens — Apple Scholar premium system ──
const BG = '#F3EEE6';
const CARD = '#FFFDF9';
const BORDER = '#E7D8C7';
const MAROON = '#6D2140';
const MAROON_DEEP = '#4A1730';
const GOLD = '#A9784E';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const SUCCESS_BG = '#EAF6EC';
const AMBER = '#C77F1F';
const AMBER_BG = '#FBF1DF';
const CLAY = '#C0473F';
const CLAY_BG = '#FBEAE8';
const RADIUS = 16;

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const cardShadow = { boxShadow: '0 12px 28px -20px rgba(36,21,18,0.22)' };
const cardWrap = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, ...cardShadow, overflow: 'hidden' };
const subCard = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14 };
const bordField = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, background: '#fff', ...body, fontSize: '0.85rem', color: INK, outline: 'none', appearance: 'none', cursor: 'pointer' };
const fieldLabel = { ...body, fontSize: '0.7rem', color: MUTED, display: 'block', marginBottom: 6 };
const filledBtn  = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', border: 'none', borderRadius: 10, background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, color: '#fff', ...body, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', width: '100%' };

const iconBadge = (color) => ({ width: 38, height: 38, borderRadius: 12, background: `${color}16`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Presentation-only: "13:00" / "13:00:00" -> "01:00 PM". Falls back to the raw value.
const formatTime = (value) => {
  if (!value) return '';
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value);
  const h = Number(match[1]);
  if (Number.isNaN(h) || h > 23) return String(value);
  return `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0')}:${match[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};

const STATUS_STAMPS = [
  { key: 'present', label: 'Present', short: 'P', icon: <CheckCircle2 size={12} />, color: SUCCESS },
  { key: 'late',    label: 'Late',    short: 'L', icon: <Clock size={12} />,       color: AMBER },
  { key: 'absent',  label: 'Absent',  short: 'A', icon: <X size={12} />,            color: CLAY },
  { key: 'excused', label: 'Excused', short: 'E', icon: <AlertTriangle size={12} />, color: AMBER },
];

const ROSTER_PAGE_SIZE = 8;

// ---------------------------------------------------------------------------
// Presentational-only helpers
// ---------------------------------------------------------------------------

const KPICard = ({ icon: Icon, label, value, accent, sub, progress }) => (
  <div className="min-w-0 h-full" style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 18px)' }}>
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, borderRadius: 14, background: `${accent}16`, color: accent }}>
        <Icon size={21} />
      </div>
      <div className="min-w-0 flex-1">
        <p style={{ ...display, fontSize: 'clamp(1.35rem, 4vw, 1.7rem)', fontWeight: 700, color: MAROON, lineHeight: 1 }}>{value}</p>
        <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 5 }}>{label}</p>
      </div>
    </div>
    {sub && (
      <div style={{ marginTop: 10 }}>
        <p style={{ ...body, fontSize: '0.7rem', color: accent, fontWeight: 600 }}>{sub}</p>
        {progress !== undefined && (
          <div style={{ height: 5, background: `${accent}1f`, borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: accent, borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
        )}
      </div>
    )}
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    present: { label: 'Checked In', color: SUCCESS, background: SUCCESS_BG },
    late:    { label: 'Late',       color: AMBER,   background: AMBER_BG },
    absent:  { label: 'Absent',     color: CLAY,    background: CLAY_BG },
    excused: { label: 'Excused',    color: AMBER,   background: AMBER_BG },
  };
  const cfg = map[status] || { label: 'Waiting', color: MUTED, background: BG };
  return (
    <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700, borderRadius: 999, padding: '4px 12px', background: cfg.background, color: cfg.color, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {cfg.label}
    </span>
  );
};

const SectionHead = ({ icon: Icon, title, subtitle, color = MAROON }) => (
  <div className="flex items-center gap-3 min-w-0">
    <span style={iconBadge(color)}><Icon size={17} /></span>
    <div className="min-w-0">
      <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: MAROON }}>{title}</h2>
      {subtitle && <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{subtitle}</p>}
    </div>
  </div>
);

const StaffDutyAttendance = () => {
  const [duties, setDuties] = useState([]);
  const [subTab, setSubTab] = useState('qr');

  const [qrDuty, setQrDuty] = useState('');
  const [dutyQR, setDutyQR] = useState(null);
  const [qrScholars, setQrScholars] = useState([]);
  const [qrLoading, setQrLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [manualDuty, setManualDuty] = useState('');
  const [scholars, setScholars] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);

  // ---- Presentation-only: roster search, status filter and pagination over
  // the already-loaded live roster (qrScholars). No extra requests.
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState('all');
  const [rosterPage, setRosterPage] = useState(1);

  useEffect(() => {
    axios.get(`${API}/duties`, authHeaders())
      .then(res => setDuties(res.data.filter(d => d.status === 'upcoming' || d.status === 'ongoing')))
      .catch(err => console.error('Failed to fetch duties:', err));
  }, []);

  useEffect(() => { setRosterPage(1); setRosterFilter('all'); setRosterSearch(''); }, [qrDuty]);

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

  useEffect(() => {
    if (!qrDuty) return undefined;
    const intervalId = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/staff/duties/${qrDuty}/scholars`, authHeaders());
        setQrScholars(res.data);
      } catch (err) {
        console.error(`Failed to refresh attendance for duty ${qrDuty}:`, err);
      }
    }, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [qrDuty]);

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
            h2 { color: #6D2140; margin-bottom: 4px; }
            p { color: #64748b; font-size: 13px; margin: 2px 0 20px; }
            .box { border: 2px dashed #A9784E; border-radius: 16px; padding: 24px; }
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

  const checkedIn = qrScholars.filter(s => s.attendance_status === 'present' || s.attendance_status === 'late');
  const notYet = qrScholars.filter(s => s.attendance_status !== 'present' && s.attendance_status !== 'late');
  const qrPercent = qrScholars.length ? Math.round((checkedIn.length / qrScholars.length) * 100) : 0;

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
    late:    Object.values(attendance).filter(v => v === 'late').length,
    absent:  Object.values(attendance).filter(v => v === 'absent').length,
    excused: Object.values(attendance).filter(v => v === 'excused').length,
  };

  const dutySelect = (value, onChange, ariaLabel, placeholder = '-- Select a duty --') => (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={ariaLabel} style={bordField}>
      <option value="">{placeholder}</option>
      {duties.map(d => (
        <option key={d.id} value={d.id}>
          {d.title} — {new Date(d.duty_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
        </option>
      ))}
    </select>
  );

  // ---- Presentation-only derived values for KPIs, roster search/filter/pagination ----
  const rosterMatches = (s) => !rosterSearch.trim() ||
    s.full_name?.toLowerCase().includes(rosterSearch.toLowerCase()) ||
    s.scholar_id?.toLowerCase().includes(rosterSearch.toLowerCase());

  const filteredRoster = {
    checkedIn: checkedIn.filter(rosterMatches),
    notYet: notYet.filter(rosterMatches),
  };

  const lateCount = qrScholars.filter(s => s.attendance_status === 'late').length;
  const absentExcusedCount = qrScholars.filter(s => s.attendance_status === 'absent' || s.attendance_status === 'excused').length;
  const pct = (n) => (qrScholars.length ? Math.round((n / qrScholars.length) * 1000) / 10 : 0);

  const ROSTER_FILTERS = [
    { key: 'all',     label: 'All',            count: qrScholars.length, dot: MAROON,  match: () => true },
    { key: 'present', label: 'Checked In',     count: qrScholars.filter(s => s.attendance_status === 'present').length, dot: SUCCESS, match: s => s.attendance_status === 'present' },
    { key: 'late',    label: 'Late',           count: lateCount,         dot: AMBER,   match: s => s.attendance_status === 'late' },
    { key: 'absent',  label: 'Absent/Excused', count: absentExcusedCount, dot: CLAY,   match: s => s.attendance_status === 'absent' || s.attendance_status === 'excused' },
  ];
  const activeFilter = ROSTER_FILTERS.find(f => f.key === rosterFilter) || ROSTER_FILTERS[0];

  const rosterRows = [...filteredRoster.checkedIn, ...filteredRoster.notYet].filter(activeFilter.match);
  const totalPages = Math.max(1, Math.ceil(rosterRows.length / ROSTER_PAGE_SIZE));
  const currentPage = Math.min(rosterPage, totalPages);
  const pageStart = (currentPage - 1) * ROSTER_PAGE_SIZE;
  const pagedRows = rosterRows.slice(pageStart, pageStart + ROSTER_PAGE_SIZE);

  const handleRefreshAll = () => {
    if (qrDuty) refreshQRScholars();
  };

  const selectedDuty = duties.find(d => String(d.id) === String(qrDuty));
  const todayLabel = new Date().toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });

  const thStyle = { ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: MUTED, textAlign: 'left', padding: '11px 12px', borderBottom: `1px solid ${BORDER}`, background: BG, whiteSpace: 'nowrap' };
  const tdStyle = { ...body, fontSize: '0.78rem', color: INK, padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'middle' };

  const tabStyle = (active) => ({
    ...body, fontSize: '0.84rem', fontWeight: 700, borderRadius: 12, padding: '11px 22px', cursor: 'pointer', border: 'none',
    background: active ? MAROON : 'transparent', color: active ? '#fff' : MAROON,
    transition: 'background-color 160ms ease, color 160ms ease',
  });

  return (
    <div className="min-h-screen" style={{ background: BG, ...body, overflowX: 'hidden' }}>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">

        {/* ── Standard Staff header: title card + date card ── */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 sm:gap-4 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0" style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 20px)' }}>
            <div className="min-w-0">
              <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: GOLD }}>STAFF PORTAL</p>
              <h1 style={{ ...display, fontSize: 'clamp(1.3rem, 4vw, 1.6rem)', fontWeight: 600, color: MAROON, marginTop: 4, lineHeight: 1.2 }}>Duty Attendance</h1>
              <p style={{ ...body, fontSize: '0.82rem', color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
                Record and monitor scholar attendance for assigned duties.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={!qrDuty}
              className="flex items-center justify-center gap-1.5 flex-shrink-0"
              style={{ background: '#fff', color: MAROON, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '8px 16px', ...body, fontSize: '0.78rem', fontWeight: 700, cursor: qrDuty ? 'pointer' : 'not-allowed', opacity: qrDuty ? 1 : 0.6 }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <div className="flex items-center gap-3" style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 20px)' }}>
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: 42, height: 42, borderRadius: 12, background: `${GOLD}22`, color: GOLD }}>
              <CalendarDays size={17} />
            </div>
            <div>
              <p style={{ ...mono, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.05em', color: MUTED }}>Today</p>
              <p style={{ ...display, fontSize: '0.95rem', fontWeight: 600, color: INK, marginTop: 2, whiteSpace: 'nowrap' }}>{todayLabel}</p>
            </div>
          </div>
        </div>

        {/* ── KPI cards (real counts from the loaded roster) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-5">
          <KPICard icon={Users} label="Assigned Scholars" value={qrScholars.length || '—'} accent={MAROON} />
          <KPICard icon={CheckCircle2} label="Checked In" value={qrScholars.length ? checkedIn.length : '—'} accent={SUCCESS}
            sub={qrScholars.length ? `${qrPercent}% attendance rate` : undefined} progress={qrScholars.length ? qrPercent : undefined} />
          <KPICard icon={Hourglass} label="Late" value={qrScholars.length ? lateCount : '—'} accent={AMBER}
            sub={qrScholars.length ? `${pct(lateCount)}%` : undefined} progress={qrScholars.length ? pct(lateCount) : undefined} />
          <KPICard icon={XCircle} label="Absent / Excused" value={qrScholars.length ? absentExcusedCount : '—'} accent={CLAY}
            sub={qrScholars.length ? `${pct(absentExcusedCount)}%` : undefined} progress={qrScholars.length ? pct(absentExcusedCount) : undefined} />
        </div>

        {/* ── Workspace card: tabs + content ── */}
        <section style={{ ...cardWrap, padding: 'clamp(12px, 2.5vw, 18px)' }}>
          <div role="tablist" aria-label="Check-in mode" className="flex flex-wrap gap-2" style={{ marginBottom: 'clamp(12px, 2.5vw, 16px)' }}>
            <button type="button" role="tab" id="tab-qr" aria-selected={subTab === 'qr'} aria-controls="panel-qr" onClick={() => setSubTab('qr')} className="flex items-center gap-2" style={tabStyle(subTab === 'qr')}>
              <QrCode size={15} /> QR Check-In
            </button>
            <button type="button" role="tab" id="tab-manual" aria-selected={subTab === 'manual'} aria-controls="panel-manual" onClick={() => setSubTab('manual')} className="flex items-center gap-2" style={tabStyle(subTab === 'manual')}>
              <ListChecks size={15} /> Manual Check-In
            </button>
          </div>

          {/* ═════════ QR CHECK-IN TAB ═════════ */}
          {subTab === 'qr' && (
            <div id="panel-qr" role="tabpanel" aria-labelledby="tab-qr" className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 items-start">

              {/* LEFT — 1. Select duty, 2. Duty QR code */}
              <div className="flex flex-col gap-4 min-w-0">
                <div style={{ ...subCard, padding: 'clamp(14px, 3vw, 18px)' }}>
                  <SectionHead icon={CalendarClock} title="1. Select Duty Schedule" subtitle="Choose a duty to generate the QR code for check-in." />
                  <div style={{ marginTop: 14 }}>{dutySelect(qrDuty, loadQRDuty, 'Select duty for QR code')}</div>
                </div>

                <div style={{ ...subCard, padding: 'clamp(14px, 3vw, 18px)' }}>
                  <SectionHead icon={QrCode} title="2. Duty QR Code" subtitle="Display this code for scholars to scan." />

                  <div style={{ marginTop: 14 }}>
                    {qrLoading ? (
                      <div className="animate-pulse" style={{ background: `${BORDER}88`, height: 220, borderRadius: 10 }} />
                    ) : dutyQR ? (
                      <>
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                          <div className="flex items-center justify-center flex-shrink-0" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
                            <QRCodeSVG id="duty-qr-svg" value={dutyQR.qr_token} size={168} fgColor={GOLD} />
                          </div>

                          {/* Duty information (only fields returned by the existing endpoints) */}
                          <div className="min-w-0 flex-1" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
                            <p style={{ ...mono, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', color: GOLD }}>DUTY INFORMATION</p>
                            <p style={{ ...display, fontSize: '1rem', fontWeight: 600, color: INK, marginTop: 6, wordBreak: 'break-word' }}>{dutyQR.title}</p>
                            <div className="flex flex-col gap-2" style={{ marginTop: 10, ...body, fontSize: '0.78rem', color: INK }}>
                              {dutyQR.duty_date && (
                                <span className="flex items-center gap-2">
                                  <CalendarDays size={13} style={{ color: GOLD, flexShrink: 0 }} />
                                  {new Date(dutyQR.duty_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                              )}
                              {selectedDuty?.time_start && (
                                <span className="flex items-center gap-2">
                                  <Clock size={13} style={{ color: GOLD, flexShrink: 0 }} />
                                  {formatTime(selectedDuty.time_start)}{selectedDuty.time_end ? ` – ${formatTime(selectedDuty.time_end)}` : ''}
                                </span>
                              )}
                              {dutyQR.location && (
                                <span className="flex items-start gap-2">
                                  <MapPin size={13} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} />
                                  <span style={{ wordBreak: 'break-word' }}>{dutyQR.location}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 14, textAlign: 'center', lineHeight: 1.55 }}>
                          I-print at i-post ito sa duty location. Ang scholar ang mag-sscan nito para mag-check-in.
                        </p>
                        <button type="button" onClick={handlePrintQR} style={{ ...filledBtn, marginTop: 14 }}>
                          <Printer size={15} /> Print QR Code
                        </button>
                      </>
                    ) : (
                      <div className="text-center" style={{ background: '#fff', border: `1.5px dashed ${GOLD}`, borderRadius: 12, padding: '44px 20px' }}>
                        <QrCode size={26} style={{ margin: '0 auto 12px', color: BORDER }} />
                        <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: MUTED }}>Select a duty first</p>
                        <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>Generate a QR code to begin attendance.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT — Live Attendance */}
              <div className="min-w-0" style={{ ...subCard, padding: 'clamp(14px, 3vw, 18px)' }}>
                <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-3">
                  <SectionHead icon={Users} title="Live Attendance" subtitle="Scholars assigned to the selected duty" />
                  {qrDuty && qrScholars.length > 0 && (
                    <div className="flex items-center gap-2 w-full 2xl:w-auto">
                      <div className="flex items-center gap-1.5 flex-1 2xl:flex-none" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 12px' }}>
                        <Search size={13} style={{ color: MUTED, flexShrink: 0 }} />
                        <input
                          type="text"
                          value={rosterSearch}
                          onChange={e => { setRosterSearch(e.target.value); setRosterPage(1); }}
                          placeholder="Search scholar name or ID…"
                          aria-label="Search live roster by name or ID"
                          className="min-w-0 flex-1 2xl:w-52 2xl:flex-none"
                          style={{ border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.78rem', color: INK }}
                        />
                      </div>
                      <button type="button" onClick={refreshQRScholars} aria-label="Refresh live roster" style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', lineHeight: 0, padding: 6 }}>
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  )}
                </div>

                {qrScholars.length === 0 ? (
                  <div className="text-center" style={{ background: '#fff', border: `1.5px dashed ${GOLD}`, borderRadius: 12, padding: '56px 20px', marginTop: 16 }}>
                    <QrCode size={26} style={{ margin: '0 auto 12px', color: BORDER }} />
                    <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: MUTED }}>Select a duty first</p>
                    <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>Generate a QR code to begin attendance.</p>
                  </div>
                ) : (
                  <>
                    {/* Status filters */}
                    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter roster by status" style={{ marginTop: 16 }}>
                      {ROSTER_FILTERS.map(f => {
                        const active = f.key === activeFilter.key;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            aria-pressed={active}
                            onClick={() => { setRosterFilter(f.key); setRosterPage(1); }}
                            className="flex items-center gap-2 flex-shrink-0"
                            style={{
                              ...body, fontSize: '0.74rem', fontWeight: 600, borderRadius: 999, padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                              border: `1px solid ${active ? MAROON : BORDER}`,
                              background: active ? MAROON : '#fff',
                              color: active ? '#fff' : INK,
                            }}
                          >
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#fff' : f.dot, flexShrink: 0 }} />
                            {f.label} ({f.count})
                          </button>
                        );
                      })}
                    </div>

                    {/* Table */}
                    <div style={{ marginTop: 14, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                      {rosterRows.length === 0 ? (
                        <div className="text-center" style={{ padding: '36px 16px' }}>
                          <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>
                            {rosterSearch.trim() ? `No scholars match "${rosterSearch}".` : 'No scholars in this status.'}
                          </p>
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th scope="col" style={{ ...thStyle, width: 40 }}>#</th>
                                <th scope="col" style={thStyle}>Scholar</th>
                                <th scope="col" style={thStyle}>Year Level</th>
                                <th scope="col" style={thStyle}>Time In</th>
                                <th scope="col" style={thStyle}>Status</th>
                                <th scope="col" style={thStyle}>Make-up</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pagedRows.map((s, i) => {
                                const hasTime = (s.attendance_status === 'present' || s.attendance_status === 'late') && s.marked_at;
                                const checked = s.attendance_status === 'present' || s.attendance_status === 'late';
                                return (
                                  <tr key={s.scholar_id}>
                                    <td style={{ ...tdStyle, color: MUTED }}>{pageStart + i + 1}</td>
                                    <td style={{ ...tdStyle, minWidth: 190 }}>
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span style={{ width: 34, height: 34, borderRadius: '50%', background: checked ? MAROON : BG, color: checked ? '#fff' : MUTED, ...body, fontSize: '0.64rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          {initials(s.full_name)}
                                        </span>
                                        <div className="min-w-0">
                                          <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: checked ? INK : MUTED }} className="truncate">{s.full_name}</p>
                                          <p style={{ ...mono, fontSize: '0.64rem', color: MUTED }}>{s.scholar_id}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ ...tdStyle, color: MUTED, whiteSpace: 'nowrap' }}>{s.year_level ? formatYearLevelLabel(s.year_level) : '—'}</td>
                                    <td style={{ ...tdStyle, ...mono, fontSize: '0.72rem', color: MUTED, whiteSpace: 'nowrap' }}>
                                      {hasTime ? new Date(s.marked_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </td>
                                    <td style={tdStyle}><StatusBadge status={s.attendance_status} /></td>
                                    <td style={{ ...tdStyle, color: MUTED }}>{s.is_makeup ? 'Make-up' : '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Pagination (client-side over the loaded roster) */}
                    {rosterRows.length > 0 && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ marginTop: 14 }}>
                        <p style={{ ...body, fontSize: '0.74rem', color: MUTED }}>
                          Showing {pageStart + 1} – {Math.min(pageStart + ROSTER_PAGE_SIZE, rosterRows.length)} of {rosterRows.length} scholars
                        </p>
                        {totalPages > 1 && (
                          <nav aria-label="Roster pages" className="flex items-center gap-1.5 flex-wrap">
                            <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setRosterPage(currentPage - 1)}
                              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: MAROON, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>‹</button>
                            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(n => (
                              <button key={n} type="button" aria-label={`Page ${n}`} aria-current={n === currentPage ? 'page' : undefined} onClick={() => setRosterPage(n)}
                                style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${n === currentPage ? MAROON : BORDER}`, background: n === currentPage ? MAROON : '#fff', color: n === currentPage ? '#fff' : INK, ...body, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}>{n}</button>
                            ))}
                            <button type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setRosterPage(currentPage + 1)}
                              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: MAROON, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>›</button>
                          </nav>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ═════════ MANUAL CHECK-IN TAB ═════════ */}
          {subTab === 'manual' && (
            <div id="panel-manual" role="tabpanel" aria-labelledby="tab-manual" className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 items-start">

              {/* LEFT — duty, search, counts, save */}
              <div className="min-w-0" style={{ ...subCard, padding: 'clamp(14px, 3vw, 18px)' }}>
                <SectionHead icon={ListChecks} title="Manual Check-In" subtitle="Fallback roll call for a duty" />
                <div style={{ marginTop: 14 }}>
                  <span style={fieldLabel}>Select duty</span>
                  {dutySelect(manualDuty, loadScholars, 'Select duty for manual check-in')}
                </div>

                {manualLoading ? (
                  <div className="animate-pulse space-y-3" style={{ marginTop: 18 }}>
                    <div style={{ background: `${BORDER}88`, height: 40, borderRadius: 8 }} />
                    <div style={{ background: `${BORDER}88`, height: 60, borderRadius: 8 }} />
                  </div>
                ) : scholars.length > 0 ? (
                  <>
                    <div style={{ marginTop: 16 }}>
                      <span style={fieldLabel}>Search scholar</span>
                      <div className="flex items-center gap-2" style={{ ...bordField, cursor: 'text' }}>
                        <Search size={13} style={{ color: MUTED, flexShrink: 0 }} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Name or scholar ID…"
                          aria-label="Search scholar by name or ID"
                          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.85rem', color: INK }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2" style={{ marginTop: 16 }}>
                      {[
                        { label: 'Present', count: scholarCounts.present, color: SUCCESS },
                        { label: 'Late',    count: scholarCounts.late,    color: AMBER },
                        { label: 'Absent',  count: scholarCounts.absent,  color: CLAY },
                        { label: 'Excused', count: scholarCounts.excused, color: AMBER },
                      ].map(c => (
                        <div key={c.label} className="text-center" style={{ background: `${c.color}12`, border: `1px solid ${c.color}30`, borderRadius: 8, padding: '10px 4px' }}>
                          <p style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: c.color }}>{c.count}</p>
                          <p style={{ ...body, fontSize: '0.66rem', fontWeight: 600, color: c.color, marginTop: 1 }}>{c.label}</p>
                        </div>
                      ))}
                    </div>

                    <p style={{ ...mono, fontSize: '0.7rem', color: MUTED, textAlign: 'center', margin: '14px 0 16px' }}>
                      {Object.values(attendance).filter(Boolean).length} of {scholars.length} marked
                    </p>

                    <button type="button" onClick={saveAttendance} disabled={saving} style={{ ...filledBtn, opacity: saving ? 0.6 : 1 }}>
                      <Save size={14} /> {saving ? 'Saving…' : 'Save attendance'}
                    </button>
                    {saveMsg && (
                      <p role="status" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, textAlign: 'center', marginTop: 12, color: saveMsg.startsWith('Error') || saveMsg.startsWith('Walang') ? CLAY : SUCCESS }}>
                        {saveMsg}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center" style={{ background: BG, border: `1.5px dashed ${GOLD}88`, borderRadius: 12, padding: '40px 20px', marginTop: 18 }}>
                    <ListChecks size={24} style={{ margin: '0 auto 12px', color: BORDER }} />
                    <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: MUTED }}>Select a duty first</p>
                    <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>to begin manual attendance.</p>
                  </div>
                )}
              </div>

              {/* RIGHT — scholar list with P / A / E controls */}
              <div className="min-w-0" style={{ ...subCard, padding: 'clamp(14px, 3vw, 18px)' }}>
                <SectionHead icon={Users} title="Scholar Roll Call" subtitle="Mark each scholar Present, Late, Absent or Excused" color={SUCCESS} />
                {scholars.length === 0 ? (
                  <div className="text-center" style={{ background: '#fff', border: `1.5px dashed ${GOLD}`, borderRadius: 12, padding: '56px 20px', marginTop: 16 }}>
                    <Users size={26} style={{ margin: '0 auto 12px', color: BORDER }} />
                    <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: MUTED }}>No scholars loaded</p>
                    <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>Select a duty to see its scholars.</p>
                  </div>
                ) : (
                  <div style={{ marginTop: 14, maxHeight: 520, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: 12, background: '#fff' }}>
                    {filteredScholars.length === 0 ? (
                      <div className="text-center" style={{ padding: '28px 16px' }}>
                        <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>No results for "{searchQuery}"</p>
                      </div>
                    ) : filteredScholars.map(s => {
                      const status = attendance[s.scholar_id];
                      return (
                        <div key={s.scholar_id} className="flex items-center justify-between" style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span style={{ width: 30, height: 30, borderRadius: '50%', background: BG, color: MUTED, ...body, fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {initials(s.full_name)}
                            </span>
                            <div className="min-w-0">
                              <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }} className="truncate">{s.full_name}</p>
                              <p style={{ ...mono, fontSize: '0.64rem', color: MUTED }}>{s.scholar_id}</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0" style={{ marginLeft: 10 }}>
                            {STATUS_STAMPS.map(stamp => {
                              const active = status === stamp.key;
                              return (
                                <button
                                  key={stamp.key}
                                  type="button"
                                  onClick={() => setScholarStatus(s.scholar_id, stamp.key)}
                                  title={stamp.label}
                                  aria-label={`Mark ${s.full_name} ${stamp.label}`}
                                  aria-pressed={active}
                                  className="flex items-center gap-1"
                                  style={{
                                    padding: '5px 8px', borderRadius: 8,
                                    border: `1.5px solid ${active ? stamp.color : BORDER}`,
                                    background: active ? stamp.color : 'transparent',
                                    color: active ? '#fff' : MUTED,
                                    ...body, fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer',
                                  }}
                                >
                                  {stamp.icon} {stamp.short}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default StaffDutyAttendance;