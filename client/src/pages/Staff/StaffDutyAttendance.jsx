import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  QrCode, CheckCircle2, X, Users, ListChecks,
  Search, Clock, Hourglass, XCircle,
  RefreshCw, Printer, CalendarClock, CalendarDays, MapPin, AlertCircle, ChevronDown, LogOut,
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

// Accepts an ISO string, Date or timestamp. Never renders "Invalid Date".
const formatAttendanceTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
};

const getDutyEndTimestamp = (duty, extraHours = 0) => {
  if (!duty?.duty_date) return null;
  const dutyDate = duty.duty_date instanceof Date
    ? duty.duty_date
    : /^\d{4}-\d{2}-\d{2}$/.test(String(duty.duty_date))
      ? new Date(`${duty.duty_date}T00:00:00`)
      : new Date(duty.duty_date);
  if (Number.isNaN(dutyDate.getTime())) return null;
  const year = dutyDate.getFullYear();
  const month = dutyDate.getMonth() + 1;
  const day = dutyDate.getDate();
  const [hours, minutes, seconds = 0] = String(duty.time_end || '23:59:59').split(':').map(Number);
  const endTime = new Date(year, month - 1, day, hours, minutes, seconds + extraHours * 60 * 60).getTime();
  return Number.isFinite(endTime) ? endTime : null;
};

const getCheckInLockTimestamp = (duty) => {
  if (!duty?.duty_date) return null;
  const dutyDate = duty.duty_date instanceof Date
    ? duty.duty_date
    : /^\d{4}-\d{2}-\d{2}$/.test(String(duty.duty_date))
      ? new Date(`${duty.duty_date}T00:00:00`)
      : new Date(duty.duty_date);
  if (Number.isNaN(dutyDate.getTime())) return null;
  const [hours, minutes, seconds = 0] = String(duty.time_start || '00:00:00').split(':').map(Number);
  const lockTime = new Date(
    dutyDate.getFullYear(),
    dutyDate.getMonth(),
    dutyDate.getDate(),
    hours,
    minutes,
    seconds + 60 * 60
  ).getTime();
  return Number.isFinite(lockTime) ? lockTime : null;
};

const hasDutyEnded = (duty, now = Date.now()) => {
  const lockTime = getDutyEndTimestamp(duty, 1);
  return lockTime !== null && now >= lockTime;
};

const STATUS_STAMPS = [
  { key: 'present', label: 'Present', short: 'P', icon: <CheckCircle2 size={12} />, color: SUCCESS },
  { key: 'late',    label: 'Late',    short: 'L', icon: <Clock size={12} />,       color: AMBER },
  { key: 'absent',  label: 'Absent',  short: 'A', icon: <X size={12} />,            color: CLAY },
];

const ROSTER_PAGE_SIZE = 8;

// Duties that already finished stay selectable in the Manual tab for this many days,
// because check-out only opens once the scheduled duty has ended.
const CHECKOUT_WINDOW_DAYS = 3;

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

const StatusBadge = ({ status, checkedOut = false }) => {
  const normalizedStatus = status === 'excused' ? 'absent' : status;
  const map = {
    present: { label: 'Checked In', color: SUCCESS, background: SUCCESS_BG },
    late:    { label: 'Late',       color: AMBER,   background: AMBER_BG },
    absent:  { label: 'Absent',     color: CLAY,    background: CLAY_BG },
  };
  const isCheckedOut = checkedOut && (normalizedStatus === 'present' || normalizedStatus === 'late');
  const cfg = isCheckedOut
    ? { label: 'Checked Out', color: MAROON, background: `${MAROON}12` }
    : (map[normalizedStatus] || { label: 'Waiting', color: MUTED, background: BG });
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
  const [recentCompleted, setRecentCompleted] = useState([]);
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
  const [savingScholarId, setSavingScholarId] = useState('');
  const [checkingOutScholar, setCheckingOutScholar] = useState('');

  // ---- Check-Out tab (separate from manual check-in) ----
  const [outDuty, setOutDuty] = useState('');
  const [outScholars, setOutScholars] = useState([]);
  const [outLoading, setOutLoading] = useState(false);
  const [outRefreshing, setOutRefreshing] = useState(false);
  const [outSearch, setOutSearch] = useState('');
  const [outFeedback, setOutFeedback] = useState(null); // { tone: 'success' | 'error', text }
  const [manualLoading, setManualLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // ---- Presentation-only: roster search, status filter and pagination over
  // the already-loaded live roster (qrScholars). No extra requests.
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState('all');
  const [rosterPage, setRosterPage] = useState(1);
  const [makeupSources, setMakeupSources] = useState([]);
  const [makeupOpen, setMakeupOpen] = useState(true);
  const [makeupLoading, setMakeupLoading] = useState(true);
  const [makeupRefreshing, setMakeupRefreshing] = useState(false);
  const [makeupError, setMakeupError] = useState('');

  const fetchMakeupRequestData = async (isManualRefresh = false) => {
    if (isManualRefresh) setMakeupRefreshing(true);
    try {
      const res = await axios.get(`${API}/staff/makeup-request-data`, authHeaders());
      setMakeupSources(res.data.sources || []);
      setMakeupError('');
    } catch (err) {
      console.error('Failed to fetch make-up duty requests:', err);
      setMakeupError(err.response?.data?.error || 'Unable to load make-up duty requests.');
    } finally {
      setMakeupLoading(false);
      if (isManualRefresh) setMakeupRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadMakeupRequestData = () => {
      axios.get(`${API}/staff/makeup-request-data`, authHeaders())
        .then(res => {
          if (!active) return;
          setMakeupSources(res.data.sources || []);
          setMakeupError('');
        })
        .catch(err => {
          if (!active) return;
          console.error('Failed to fetch make-up duty requests:', err);
          setMakeupError(err.response?.data?.error || 'Unable to load make-up duty requests.');
        })
        .finally(() => {
          if (active) setMakeupLoading(false);
        });
    };

    loadMakeupRequestData();
    const intervalId = setInterval(loadMakeupRequestData, 60 * 1000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    axios.get(`${API}/duties`, authHeaders())
      .then(res => {
        const all = Array.isArray(res.data) ? res.data : [];
        setDuties(all.filter(d => d.status === 'upcoming' || d.status === 'ongoing'));
        // Check-out only opens after a duty ends, so recently finished duties must stay reachable.
        const cutoff = Date.now() - CHECKOUT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        setRecentCompleted(all.filter(d => d.status === 'completed' && (getDutyEndTimestamp(d) ?? 0) >= cutoff));
      })
      .catch(err => console.error('Failed to fetch duties:', err));
  }, []);

  useEffect(() => {
    const initializeTimeout = setTimeout(() => setCurrentTime(Date.now()), 0);
    const intervalId = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => {
      clearTimeout(initializeTimeout);
      clearInterval(intervalId);
    };
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
          <p style="margin-top:20px;">I-scan gamit ang Apple Scholar app para mag-check-in. I-scan muli ang parehong QR pagkatapos ng duty para mag-check-out. Para sa make-up duty, mag-check-out isang oras pagkatapos ng nakatakdang oras ng pagtatapos.</p>
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

  const refreshManualScholars = async (dutyId) => {
    const res = await axios.get(`${API}/staff/duties/${dutyId}/scholars`, authHeaders());
    const list = res.data;
    setScholars(list);
    setAttendance(previous => {
      const next = { ...previous };
      list.forEach(scholar => {
        if (scholar.attendance_status) {
          next[scholar.scholar_id] = scholar.attendance_status === 'excused' ? 'absent' : scholar.attendance_status;
        }
      });
      return next;
    });
    return list;
  };

  useEffect(() => {
    if (subTab !== 'manual' || !manualDuty) return undefined;
    const intervalId = setInterval(() => {
      refreshManualScholars(manualDuty).catch(err =>
        console.error(`Failed to refresh manual attendance for duty ${manualDuty}:`, err)
      );
    }, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [subTab, manualDuty]);

  // ---- Check-Out tab: load / refresh the roster of the selected duty ----
  const loadOutScholars = async (dutyId) => {
    setOutDuty(dutyId);
    setOutScholars([]);
    setOutSearch('');
    setOutFeedback(null);
    if (!dutyId) return;
    setOutLoading(true);
    try {
      const res = await axios.get(`${API}/staff/duties/${dutyId}/scholars`, authHeaders());
      setOutScholars(res.data);
    } catch (err) {
      console.error('Failed to load scholars for check-out:', err);
      setOutFeedback({ tone: 'error', text: 'Unable to load the scholars for this duty.' });
    } finally {
      setOutLoading(false);
    }
  };

  const refreshOutScholars = async (dutyId) => {
    const res = await axios.get(`${API}/staff/duties/${dutyId}/scholars`, authHeaders());
    setOutScholars(res.data);
  };

  const setScholarStatus = async (scholarId, status) => {
    const scholar = scholars.find(item => item.scholar_id === scholarId);
    if (!manualDuty || manualCheckInLocked || scholar?.attendance_status || savingScholarId) return;
    setSavingScholarId(scholarId);
    setSaveMsg('');
    try {
      const response = await axios.post(`${API}/staff/duties/${manualDuty}/attendance/bulk`, {
        records: [{ scholar_id: scholarId, status, method: 'manual' }],
      }, authHeaders());
      const refreshedScholars = await refreshManualScholars(manualDuty);
      const savedStatus = response.data?.records?.find(record => record.scholar_id === scholarId)?.status
        || refreshedScholars.find(record => record.scholar_id === scholarId)?.attendance_status
        || status;
      setSaveMsg(`${scholar?.full_name || scholarId} saved as ${savedStatus}.`);
      setTimeout(() => setSaveMsg(''), 3500);
    } catch (err) {
      setSaveMsg(err.response?.data?.error
        ? `Error: ${err.response.data.error}`
        : 'Error saving. Please try again.');
    } finally {
      setSavingScholarId('');
    }
  };

  const checkOutScholar = async (scholarId) => {
    if (!outDuty) return;
    setCheckingOutScholar(scholarId);
    setOutFeedback(null);
    try {
      await axios.post(
        `${API}/staff/duties/${outDuty}/attendance/${encodeURIComponent(scholarId)}/checkout`,
        {},
        authHeaders()
      );
      setOutFeedback({ tone: 'success', text: 'Scholar checked out successfully.' });
      try {
        await refreshOutScholars(outDuty);
      } catch (refreshErr) {
        console.error('Check-out saved, but the roster could not refresh:', refreshErr);
        setOutFeedback({ tone: 'error', text: 'Scholar checked out, but the list could not refresh. Press the refresh button.' });
      }
    } catch (err) {
      setOutFeedback({ tone: 'error', text: err.response?.data?.error || 'Unable to record check-out. Please try again.' });
    } finally {
      setCheckingOutScholar('');
    }
  };

  const reloadOutScholars = async () => {
    if (!outDuty) return;
    setOutRefreshing(true);
    try {
      await refreshOutScholars(outDuty);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setOutRefreshing(false), 400);
    }
  };

  // Keep the Check-Out list fresh (scholars may also check out by QR).
  useEffect(() => {
    if (subTab !== 'checkout' || !outDuty) return undefined;
    const intervalId = setInterval(() => {
      refreshOutScholars(outDuty).catch(err => console.error(`Failed to refresh check-out list for duty ${outDuty}:`, err));
    }, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [subTab, outDuty]);

  const filteredScholars = scholars.filter(s =>
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.scholar_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scholarCounts = {
    present: Object.values(attendance).filter(v => v === 'present').length,
    late:    Object.values(attendance).filter(v => v === 'late').length,
    absent:  Object.values(attendance).filter(v => v === 'absent').length,
  };

  const manualDuties = [...duties, ...recentCompleted];

  const dutySelect = (value, onChange, ariaLabel, placeholder = '-- Select a duty --', list = duties) => (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={ariaLabel} style={bordField}>
      <option value="">{placeholder}</option>
      {list.map(d => (
        <option key={d.id} value={d.id}>
          {d.title} — {new Date(d.duty_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
          {d.status === 'completed'
            ? ' (Completed)'
            : currentTime && hasDutyEnded(d, currentTime) ? ' (Attendance locked)' : ''}
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
  const absentCount = qrScholars.filter(s => s.attendance_status === 'absent' || s.attendance_status === 'excused').length;
  const pct = (n) => (qrScholars.length ? Math.round((n / qrScholars.length) * 1000) / 10 : 0);

  const ROSTER_FILTERS = [
    { key: 'all',     label: 'All',            count: qrScholars.length, dot: MAROON,  match: () => true },
    { key: 'present', label: 'Checked In',     count: qrScholars.filter(s => s.attendance_status === 'present').length, dot: SUCCESS, match: s => s.attendance_status === 'present' },
    { key: 'late',    label: 'Late',           count: lateCount,         dot: AMBER,   match: s => s.attendance_status === 'late' },
    { key: 'absent',  label: 'Absent',         count: absentCount,        dot: CLAY,   match: s => s.attendance_status === 'absent' || s.attendance_status === 'excused' },
  ];
  const activeFilter = ROSTER_FILTERS.find(f => f.key === rosterFilter) || ROSTER_FILTERS[0];

  const rosterRows = [...filteredRoster.checkedIn, ...filteredRoster.notYet].filter(activeFilter.match);
  const totalPages = Math.max(1, Math.ceil(rosterRows.length / ROSTER_PAGE_SIZE));
  const currentPage = Math.min(rosterPage, totalPages);
  const pageStart = (currentPage - 1) * ROSTER_PAGE_SIZE;
  const pagedRows = rosterRows.slice(pageStart, pageStart + ROSTER_PAGE_SIZE);

  const selectedDuty = duties.find(d => String(d.id) === String(qrDuty));
  const selectedManualDuty = manualDuties.find(d => String(d.id) === String(manualDuty));
  const manualCheckInLockTime = getCheckInLockTimestamp(selectedManualDuty);
  const manualCheckInLocked = Boolean(selectedManualDuty && (
    !currentTime || (manualCheckInLockTime !== null && currentTime >= manualCheckInLockTime)
  ));
  const qrCheckInLockTime = getCheckInLockTimestamp(selectedDuty);
  const qrCheckInLocked = Boolean(selectedDuty && currentTime > 0
    && qrCheckInLockTime !== null && currentTime >= qrCheckInLockTime);
  // ---- Check-Out tab derived values ----
  const selectedOutDuty = manualDuties.find(d => String(d.id) === String(outDuty));
  const outOpensAt = getDutyEndTimestamp(selectedOutDuty, 0);
  const outIsOpen = currentTime > 0 && outOpensAt !== null && currentTime >= outOpensAt;
  const outLocksAt = getDutyEndTimestamp(selectedOutDuty, 2);
  const outIsLocked = currentTime > 0 && outLocksAt !== null && currentTime >= outLocksAt;
  const outCheckedIn = outScholars.filter(s => ['present', 'late'].includes(s.attendance_status));
  const outDoneCount = outCheckedIn.filter(s => s.check_out_at).length;
  const outRows = outCheckedIn.filter(s =>
    !outSearch.trim() ||
    s.full_name?.toLowerCase().includes(outSearch.toLowerCase()) ||
    s.scholar_id?.toLowerCase().includes(outSearch.toLowerCase())
  );

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

        {/* ── Standard Staff page header ── */}
        <div className="mb-5">
          <div className="staff-page-header-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0" style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 20px)' }}>
            <div className="min-w-0">
              <p className="staff-page-eyebrow">STAFF PORTAL</p>
              <h1 className="staff-page-title">Duty Attendance</h1>
              <p className="staff-page-description">
                Record and monitor scholar attendance for assigned duties.
              </p>
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
          <KPICard icon={XCircle} label="Absent" value={qrScholars.length ? absentCount : '—'} accent={CLAY}
            sub={qrScholars.length ? `${pct(absentCount)}%` : undefined} progress={qrScholars.length ? pct(absentCount) : undefined} />
        </div>

        {/* ── Workspace card: tabs + content ── */}
        <section style={{ ...cardWrap, padding: 'clamp(12px, 2.5vw, 18px)' }}>
          <div role="tablist" aria-label="Check-in mode" className="flex flex-wrap gap-2" style={{ marginBottom: 'clamp(12px, 2.5vw, 16px)' }}>
            <button type="button" role="tab" id="tab-qr" aria-selected={subTab === 'qr'} aria-controls="panel-qr" onClick={() => setSubTab('qr')} className="flex items-center gap-2" style={tabStyle(subTab === 'qr')}>
              <QrCode size={15} /> QR Check-In / Out
            </button>
            <button type="button" role="tab" id="tab-manual" aria-selected={subTab === 'manual'} aria-controls="panel-manual" onClick={() => setSubTab('manual')} className="flex items-center gap-2" style={tabStyle(subTab === 'manual')}>
              <ListChecks size={15} /> Manual Check-In
            </button>
            <button type="button" role="tab" id="tab-checkout" aria-selected={subTab === 'checkout'} aria-controls="panel-checkout" onClick={() => setSubTab('checkout')} className="flex items-center gap-2" style={tabStyle(subTab === 'checkout')}>
              <LogOut size={15} /> Manual Check-Out
            </button>
          </div>

          {/* ═════════ QR CHECK-IN TAB ═════════ */}
          {subTab === 'qr' && (
            <div id="panel-qr" role="tabpanel" aria-labelledby="tab-qr" className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 items-start">

              {/* LEFT — 1. Select duty, 2. Duty QR code */}
              <div className="flex flex-col gap-4 min-w-0">
                <div style={{ ...subCard, padding: 'clamp(14px, 3vw, 18px)' }}>
                  <SectionHead icon={CalendarClock} title="1. Select Duty Schedule" subtitle="Choose a duty to generate the QR code for check-in and check-out." />
                  <div style={{ marginTop: 14 }}>{dutySelect(qrDuty, loadQRDuty, 'Select duty for QR code')}</div>
                  {qrCheckInLocked && (
                    <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: '10px 12px', border: `1px solid ${CLAY}55`, borderRadius: 9, background: CLAY_BG, color: CLAY, ...body, fontSize: '0.76rem', fontWeight: 600, lineHeight: 1.5 }}>
                      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                      QR check-in is locked one hour after the scheduled start. Scholars without attendance are automatically marked Absent and become available for admin make-up assignment.
                    </div>
                  )}
                </div>

                <div style={{ ...subCard, padding: 'clamp(14px, 3vw, 18px)' }}>
                  <SectionHead icon={QrCode} title="2. Duty QR Code" subtitle="Scholars scan this code to check in, then scan it again to check out." />

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
                                <th scope="col" style={thStyle}>Time Out</th>
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
                                      {hasTime ? formatAttendanceTime(s.marked_at) : '—'}
                                    </td>
                                    <td style={{ ...tdStyle, ...mono, fontSize: '0.72rem', color: MUTED, whiteSpace: 'nowrap' }}>
                                      {formatAttendanceTime(s.check_out_at)}
                                    </td>
                                    <td style={tdStyle}><StatusBadge status={s.attendance_status} checkedOut={Boolean(s.check_out_at)} /></td>
                                    <td style={{ ...tdStyle, color: MUTED }}>{Number(s.is_makeup) === 1 ? 'Make-up' : '—'}</td>
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
                <SectionHead icon={ListChecks} title="Manual Check-In / Out" subtitle="Mark each scholar’s attendance. Check-out is done in the Check-Out tab." />
                <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 8 }}>
                  Check-in after 15 minutes from the scheduled start is automatically recorded as Late.
                </p>
                <div style={{ marginTop: 14 }}>
                  <span style={fieldLabel}>Select duty</span>
                  {dutySelect(manualDuty, loadScholars, 'Select duty for manual check-in', undefined, manualDuties)}
                </div>
                {manualCheckInLocked && (
                  <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 12px', border: `1px solid ${CLAY}55`, borderRadius: 9, background: CLAY_BG, color: CLAY, ...body, fontSize: '0.76rem', fontWeight: 600 }}>
                    <AlertCircle size={15} />
                    Manual check-in is locked one hour after the scheduled start. Use the Check-Out tab when the duty ends.
                  </div>
                )}

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
                      ].map(c => (
                        <div key={c.label} className="text-center" style={{ background: `${c.color}12`, border: `1px solid ${c.color}30`, borderRadius: 8, padding: '10px 4px' }}>
                          <p style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: c.color }}>{c.count}</p>
                          <p style={{ ...body, fontSize: '0.66rem', fontWeight: 600, color: c.color, marginTop: 1 }}>{c.label}</p>
                        </div>
                      ))}
                    </div>

                    <p style={{ ...mono, fontSize: '0.7rem', color: MUTED, textAlign: 'center', margin: '14px 0 16px' }}>
                      {scholars.filter(s => s.attendance_status).length} of {scholars.length} marked
                    </p>
                    <p style={{ ...body, fontSize: '0.72rem', color: MUTED, textAlign: 'center', marginBottom: 10 }}>
                      Choose a status to save it immediately. Saved attendance cannot be changed.
                    </p>
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

              {/* RIGHT — scholar list with P / L / A / E controls and check-out */}
              <div className="min-w-0" style={{ ...subCard, padding: 'clamp(14px, 3vw, 18px)' }}>
                <SectionHead icon={Users} title="Scholar Roll Call" subtitle="Mark each scholar Present, Late or Absent" color={SUCCESS} />
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
                      const isMakeup = Number(s.is_makeup) === 1;
                      const isCheckedOut = Boolean(s.check_out_at);
                      const isAttendanceSaved = Boolean(s.attendance_status);
                      return (
                        <div key={s.scholar_id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2" style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
                          <div className="flex items-center gap-3 min-w-0 flex-1" style={{ minWidth: 200 }}>
                            <span style={{ width: 30, height: 30, borderRadius: '50%', background: BG, color: MUTED, ...body, fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {initials(s.full_name)}
                            </span>
                            <div className="min-w-0">
                              <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }} className="truncate">{s.full_name}</p>
                              <p style={{ ...mono, fontSize: '0.64rem', color: MUTED }}>
                                {s.scholar_id}{isMakeup ? ' · Make-up' : ''}
                              </p>
                              <p style={{ ...mono, fontSize: '0.62rem', color: MUTED, marginTop: 2 }}>
                                In {formatAttendanceTime(s.marked_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2" style={{ marginLeft: 'auto' }}>
                            {isCheckedOut && (
                              <span className="inline-flex items-center gap-1" style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: MAROON, background: `${MAROON}12`, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                                <LogOut size={11} /> Checked out
                              </span>
                            )}

                            <div className="flex gap-1.5">
                              {STATUS_STAMPS.map(stamp => {
                                const active = status === stamp.key;
                                const isSaving = savingScholarId === s.scholar_id;
                                const disabled = manualCheckInLocked || isAttendanceSaved || isCheckedOut || Boolean(savingScholarId);
                                return (
                                  <button
                                    key={stamp.key}
                                    type="button"
                                    onClick={() => setScholarStatus(s.scholar_id, stamp.key)}
                                    disabled={disabled}
                                    title={stamp.label}
                                    aria-label={`Mark ${s.full_name} ${stamp.label}`}
                                    aria-pressed={active}
                                    className="flex items-center gap-1"
                                    style={{
                                      padding: '5px 8px', borderRadius: 8,
                                      border: `1.5px solid ${active ? stamp.color : BORDER}`,
                                      background: active ? stamp.color : 'transparent',
                                      color: active ? '#fff' : MUTED,
                                      ...body, fontSize: '0.66rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
                                      opacity: disabled ? 0.55 : 1,
                                    }}
                                  >
                                    {isSaving ? '…' : <>{stamp.icon} {stamp.short}</>}
                                  </button>
                                );
                              })}
                            </div>
                            {isAttendanceSaved && (
                              <span style={{ ...body, fontSize: '0.65rem', fontWeight: 700, color: SUCCESS, whiteSpace: 'nowrap' }}>
                                Attendance saved
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═════════ CHECK-OUT TAB ═════════ */}
          {subTab === 'checkout' && (
            <div id="panel-checkout" role="tabpanel" aria-labelledby="tab-checkout" className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 items-start">

              {/* LEFT — pick the duty, see the rules and the totals */}
              <div className="min-w-0" style={{ ...subCard, padding: 'clamp(14px, 3vw, 18px)' }}>
                <SectionHead icon={LogOut} title="Manual Check-Out" subtitle="Record when scholars leave after their duty." />
                <div style={{ marginTop: 14 }}>
                  <span style={fieldLabel}>Select duty</span>
                  {dutySelect(outDuty, loadOutScholars, 'Select duty for check-out', undefined, manualDuties)}
                </div>

                <div style={{ marginTop: 14, background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ ...mono, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', color: GOLD }}>HOW CHECK-OUT WORKS</p>
                  <ol style={{ ...body, fontSize: '0.76rem', color: INK, margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
                    <li>The scholar must already be checked in (Present or Late).</li>
                    <li>Check-out opens when the scheduled duty ends.</li>
                    <li>For a make-up duty, it opens one hour after the scheduled end.</li>
                    <li>If not manually checked out, it is recorded automatically 15 minutes after check-out opens, using the scheduled check-out time.</li>
                    <li>Manual check-out closes two hours after the scheduled duty end.</li>
                  </ol>
                </div>

                {selectedOutDuty && (
                  <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 9, ...body, fontSize: '0.76rem', fontWeight: 600,
                    border: `1px solid ${outIsLocked ? CLAY : outIsOpen ? SUCCESS : AMBER}55`, background: outIsLocked ? CLAY_BG : outIsOpen ? SUCCESS_BG : AMBER_BG, color: outIsLocked ? CLAY : outIsOpen ? SUCCESS : AMBER }}>
                    {outIsLocked ? <AlertCircle size={15} /> : outIsOpen ? <CheckCircle2 size={15} /> : <Clock size={15} />}
                    {outIsLocked
                      ? 'The manual check-out window is closed.'
                      : outIsOpen
                        ? `Check-out is open. Any remaining check-ins will be automatically checked out after 15 minutes.`
                      : `Check-out opens at ${outOpensAt !== null ? formatAttendanceTime(outOpensAt) : 'the end of the duty'}.`}
                  </div>
                )}

                {outLoading ? (
                  <div className="animate-pulse space-y-3" style={{ marginTop: 18 }}>
                    <div style={{ background: `${BORDER}88`, height: 40, borderRadius: 8 }} />
                    <div style={{ background: `${BORDER}88`, height: 60, borderRadius: 8 }} />
                  </div>
                ) : outCheckedIn.length > 0 && (
                  <div className="grid grid-cols-3 gap-2" style={{ marginTop: 16 }}>
                    {[
                      { label: 'Checked in',  count: outCheckedIn.length,                 color: SUCCESS },
                      { label: 'Checked out', count: outDoneCount,                        color: MAROON },
                      { label: 'Still inside', count: outCheckedIn.length - outDoneCount, color: AMBER },
                    ].map(c => (
                      <div key={c.label} className="text-center" style={{ background: `${c.color}12`, border: `1px solid ${c.color}30`, borderRadius: 8, padding: '10px 4px' }}>
                        <p style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: c.color }}>{c.count}</p>
                        <p style={{ ...body, fontSize: '0.66rem', fontWeight: 600, color: c.color, marginTop: 1 }}>{c.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {outFeedback && (
                  <p role="status" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, textAlign: 'center', marginTop: 12, color: outFeedback.tone === 'error' ? CLAY : SUCCESS }}>
                    {outFeedback.text}
                  </p>
                )}
              </div>

              {/* RIGHT — only scholars who are checked in appear here */}
              <div className="min-w-0" style={{ ...subCard, padding: 'clamp(14px, 3vw, 18px)' }}>
                <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-3">
                  <SectionHead icon={Users} title="Scholars to Check Out" subtitle="Scholars who are checked in for the selected duty" color={SUCCESS} />
                  {outDuty && outCheckedIn.length > 0 && (
                    <div className="flex items-center gap-2 w-full 2xl:w-auto">
                      <div className="flex items-center gap-1.5 flex-1 2xl:flex-none" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 12px' }}>
                        <Search size={13} style={{ color: MUTED, flexShrink: 0 }} />
                        <input
                          type="text"
                          value={outSearch}
                          onChange={e => setOutSearch(e.target.value)}
                          placeholder="Search scholar name or ID…"
                          aria-label="Search scholars to check out"
                          className="min-w-0 flex-1 2xl:w-52 2xl:flex-none"
                          style={{ border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.78rem', color: INK }}
                        />
                      </div>
                      <button type="button" onClick={reloadOutScholars} aria-label="Refresh check-out list" style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', lineHeight: 0, padding: 6 }}>
                        <RefreshCw size={15} className={outRefreshing ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  )}
                </div>

                {!outDuty ? (
                  <div className="text-center" style={{ background: '#fff', border: `1.5px dashed ${GOLD}`, borderRadius: 12, padding: '56px 20px', marginTop: 16 }}>
                    <LogOut size={26} style={{ margin: '0 auto 12px', color: BORDER }} />
                    <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: MUTED }}>Select a duty first</p>
                    <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>to see who can be checked out.</p>
                  </div>
                ) : outCheckedIn.length === 0 && !outLoading ? (
                  <div className="text-center" style={{ background: '#fff', border: `1.5px dashed ${GOLD}`, borderRadius: 12, padding: '56px 20px', marginTop: 16 }}>
                    <Users size={26} style={{ margin: '0 auto 12px', color: BORDER }} />
                    <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: MUTED }}>No one is checked in yet</p>
                    <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>Check scholars in first, by QR or in the Manual Check-In tab.</p>
                  </div>
                ) : (
                  <div style={{ marginTop: 14, maxHeight: 520, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: 12, background: '#fff' }}>
                    {outRows.length === 0 ? (
                      <div className="text-center" style={{ padding: '28px 16px' }}>
                        <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>No results for "{outSearch}"</p>
                      </div>
                    ) : outRows.map(s => {
                      const isMakeup = Number(s.is_makeup) === 1;
                      const opensAt = getDutyEndTimestamp(selectedOutDuty, isMakeup ? 1 : 0);
                      const lockAt = getDutyEndTimestamp(selectedOutDuty, 2);
                      const canCheckOut = currentTime > 0 && opensAt !== null && lockAt !== null
                        && currentTime >= opensAt && currentTime < lockAt;
                      const isOut = Boolean(s.check_out_at);
                      const busy = checkingOutScholar === s.scholar_id;
                      return (
                        <div key={s.scholar_id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2" style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
                          <div className="flex items-center gap-3 min-w-0 flex-1" style={{ minWidth: 200 }}>
                            <span style={{ width: 30, height: 30, borderRadius: '50%', background: isOut ? `${MAROON}12` : BG, color: isOut ? MAROON : MUTED, ...body, fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {initials(s.full_name)}
                            </span>
                            <div className="min-w-0">
                              <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }} className="truncate">{s.full_name}</p>
                              <p style={{ ...mono, fontSize: '0.64rem', color: MUTED }}>{s.scholar_id}{isMakeup ? ' · Make-up' : ''}</p>
                              <p style={{ ...mono, fontSize: '0.62rem', color: MUTED, marginTop: 2 }}>
                                In {formatAttendanceTime(s.marked_at)} · Out {formatAttendanceTime(s.check_out_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-end" style={{ marginLeft: 'auto' }}>
                            {isOut ? (
                              <span className="inline-flex items-center gap-1" style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: MAROON, background: `${MAROON}12`, borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                                <CheckCircle2 size={12} /> Checked out
                              </span>
                            ) : canCheckOut ? (
                              <button
                                type="button"
                                onClick={() => checkOutScholar(s.scholar_id)}
                                disabled={busy}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: MAROON, color: '#fff', ...body, fontSize: '0.72rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap' }}
                              >
                                <LogOut size={13} /> {busy ? 'Checking out…' : 'Check Out'}
                              </button>
                            ) : outIsLocked ? (
                              <span className="inline-flex items-center gap-1" title="The manual check-out window closed two hours after the scheduled duty end." style={{ ...mono, fontSize: '0.64rem', color: MUTED, whiteSpace: 'nowrap' }}>
                                <Clock size={12} /> Check-out locked
                              </span>
                            ) : null}
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

        <section className="mt-5 min-w-0" style={{ ...cardWrap }}>
          <div className="flex flex-wrap items-center gap-3" style={{ padding: 'clamp(14px, 3vw, 20px)' }}>
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: 42, height: 42, borderRadius: 12, background: `${CLAY}16`, color: CLAY }}>
              <AlertCircle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: MAROON }}>Make-up Duty Requests</h2>
              <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 3 }}>
                Absent attendance awaiting an admin-assigned make-up duty.
              </p>
            </div>
            <span style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: MAROON, background: `${MAROON}12`, borderRadius: 999, padding: '5px 10px' }}>
              {makeupSources.length} awaiting assignment
            </span>
            <button
              type="button"
              onClick={() => fetchMakeupRequestData(true)}
              aria-label="Refresh make-up duty requests"
              disabled={makeupRefreshing}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, border: `1px solid ${BORDER}`, borderRadius: 10, background: '#fff', color: MAROON, cursor: makeupRefreshing ? 'wait' : 'pointer' }}
            >
              <RefreshCw size={14} className={makeupRefreshing ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setMakeupOpen(open => !open)}
              aria-expanded={makeupOpen}
              aria-controls="attendance-makeup-panel"
              aria-label={makeupOpen ? 'Collapse make-up duty requests' : 'Expand make-up duty requests'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, border: 'none', background: 'transparent', color: MAROON, cursor: 'pointer' }}
            >
              <ChevronDown size={19} style={{ transform: makeupOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }} />
            </button>
          </div>
          {makeupOpen && (
            <div id="attendance-makeup-panel" role="region" aria-label="Make-up duty requests" style={{ borderTop: `1px solid ${BORDER}`, padding: 'clamp(14px, 3vw, 20px)' }}>
              {makeupLoading ? (
                <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>Loading make-up duty requests…</p>
              ) : makeupError ? (
                <p role="alert" style={{ ...body, fontSize: '0.8rem', color: CLAY }}>{makeupError}</p>
              ) : makeupSources.length === 0 ? (
                <p style={{ ...body, fontSize: '0.8rem', color: MUTED, textAlign: 'center', padding: '20px 12px', background: BG, borderRadius: 10 }}>
                  No absent scholars are awaiting a make-up duty assignment.
                </p>
              ) : (
                <>
                  <p className="mb-4" style={{ ...body, fontSize: '0.76rem', color: MUTED }}>
                    These absences were recorded for your assigned groups. Admin chooses and assigns the make-up duty.
                  </p>
                  <div className="overflow-x-auto" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, background: '#fff' }}>
                    <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th scope="col" style={{ ...body, fontSize: '0.68rem', textAlign: 'left', color: MUTED, padding: '10px 12px', background: BG }}>Scholar</th>
                          <th scope="col" style={{ ...body, fontSize: '0.68rem', textAlign: 'left', color: MUTED, padding: '10px 12px', background: BG }}>Missed Duty</th>
                          <th scope="col" style={{ ...body, fontSize: '0.68rem', textAlign: 'left', color: MUTED, padding: '10px 12px', background: BG }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {makeupSources.map(source => (
                          <tr key={`${source.scholar_id}-${source.source_duty_id}`}>
                            <td style={{ ...body, fontSize: '0.78rem', color: INK, padding: '11px 12px', borderTop: `1px solid ${BORDER}` }}>{source.scholar_name}</td>
                            <td style={{ ...body, fontSize: '0.78rem', color: INK, padding: '11px 12px', borderTop: `1px solid ${BORDER}` }}>{source.source_duty_title}</td>
                            <td style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: CLAY, padding: '11px 12px', borderTop: `1px solid ${BORDER}`, textTransform: 'capitalize' }}>{source.source_status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default StaffDutyAttendance;