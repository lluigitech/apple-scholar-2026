import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertCircle, ArrowRight, Bell, CalendarDays, CheckCircle2, CheckSquare, ChevronLeft, ChevronRight,
  Clock, FilterX, Info, Loader2, MapPin, MoreHorizontal, Plus, RefreshCw,
  Search, Send, Trash2, Users, X,
} from 'lucide-react';
import { formatAdminDate } from '../../utils/adminPreferences';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

const API = 'http://localhost:5000/api';
const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const PAGE_SIZE = 10;

// ── Apple Scholar Admin Portal design system (same tokens as Task Assignment) ──
const BG = '#F7F4EE';
const CARD = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const GOLD = '#A9784E';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const WARNING = '#C08A3E';
const DANGER = '#A24A4A';

const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };
const display = { fontFamily: "'Playfair Display', 'Lora', Georgia, serif" };
const input = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 9, background: '#FCFAF5', color: INK, fontSize: '0.86rem', outline: 'none', ...body };
const control = { ...input, width: 'auto', minWidth: 160, background: CARD, boxShadow: '0 1px 2px rgba(36,21,18,0.06)', cursor: 'pointer', padding: '9px 12px' };
const fieldLabel = { display: 'block', color: PRIMARY, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 6, ...body };
const cardShadow = '0 1px 2px rgba(36,21,18,0.04), 0 8px 24px -18px rgba(36,21,18,0.22)';
const bentoCard = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, boxShadow: cardShadow };

// Hover / focus states can't be expressed with inline styles.
const INTERACTIVE_CSS = `
.ad-kpi { transition: transform .18s ease, box-shadow .18s ease; }
.ad-kpi:hover { transform: translateY(-2px); box-shadow: 0 14px 28px -18px rgba(36,21,18,0.35); }
.ad-row:hover td { background: #FBF6EE; }
.ad-action:hover { background: rgba(109,33,64,0.08) !important; border-color: rgba(109,33,64,0.35) !important; color: #6D2140 !important; }
.ad-primary:hover:not(:disabled) { background: #4A1730 !important; }
.ad-ghost:hover:not(:disabled) { background: #F3EBDD !important; }
.ad-field:focus-within, select.ad-field:focus, input.ad-field:focus, textarea.ad-field:focus { border-color: #6D2140 !important; box-shadow: 0 0 0 3px rgba(109,33,64,0.12) !important; }
/* Filter toolbar: 2 columns on small screens, a fixed 3-column grid on desktop so rows line up. */
.ad-toolbar-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.ad-toolbar-grid > .ad-full { grid-column: 1 / -1; }
@media (min-width: 1000px) {
  .ad-toolbar-grid { grid-template-columns: minmax(0, 1fr) 180px 210px; }
  .ad-toolbar-grid > .ad-full { grid-column: auto; }
  .ad-toolbar-grid > .ad-date { grid-column: span 2; }
}
@media (prefers-reduced-motion: reduce) {
  .ad-kpi { transition: none; }
  .ad-kpi:hover { transform: none; }
}
`;

const EMPTY_FORM = { title: '', description: '', location: '', duty_date: '', time_start: '', time_end: '', group_ids: [] };

// ─── Pure helpers (presentation only) ───────────────────────────────────────

const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

const localDayKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// "YYYY-MM-DD" (or an ISO string starting with it) -> that calendar day; otherwise parse locally.
const dutyDayKey = (value) => {
  if (!value) return null;
  const text = String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : localDayKey(parsed);
};

const addDaysToDayKey = (value, days) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// Purely a UI status derived from duty_date. Nothing is stored or sent to the API.
const getDutyStatus = (duty) => {
  const key = dutyDayKey(duty.duty_date);
  if (!key) return 'unknown';
  const today = localDayKey(new Date());
  if (key === today) return 'today';
  return key > today ? 'upcoming' : 'past';
};

const formatTime = (value) => {
  if (!value) return '';
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value);
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const getInitials = (name) =>
  (name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '?';

const getGroupNames = (duty) =>
  (Array.isArray(duty.assigned_groups) ? duty.assigned_groups : []).map((group) => group.group_name).filter(Boolean);

// ─── Reusable local components ──────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, caption, footer, accent = PRIMARY, onClick }) => (
  <div
    className="ad-kpi"
    {...(onClick ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } } : {})}
    style={{ cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '18px 20px 16px', boxShadow: cardShadow }}>
    <div aria-hidden="true" style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `${accent}0f` }} />
    <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: `${accent}40` }} />
    <div className="flex items-center justify-center" style={{ position: 'relative', width: 42, height: 42, borderRadius: 12, background: `${accent}14`, border: `1px solid ${accent}26` }}>
      <Icon size={18} style={{ color: accent }} />
    </div>
    <p style={{ ...display, position: 'relative', fontSize: '2.1rem', lineHeight: 1.1, fontWeight: 700, color: INK, marginTop: 14 }}>{value}</p>
    <p style={{ ...body, position: 'relative', fontSize: '0.66rem', color: INK, marginTop: 6, letterSpacing: '0.06em', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
    <p style={{ ...body, position: 'relative', fontSize: '0.76rem', color: MUTED, marginTop: 3 }}>{caption}</p>
    {footer && (
      <div className="flex items-center gap-2" style={{ position: 'relative', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
        <span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: INK }}>{footer}</span>
      </div>
    )}
  </div>
);

const STATUS_STYLES = {
  upcoming: { label: 'Upcoming', bg: '#E4F1E6', color: SUCCESS },
  today:    { label: 'Today',    bg: '#F6E3E9', color: '#8E2E4E' },
  past:     { label: 'Past',     bg: '#EFE9DF', color: MUTED },
  unknown:  { label: 'No date',  bg: '#EFE9DF', color: MUTED },
};
const StatusBadge = ({ status }) => {
  const cfg = STATUS_STYLES[status] || STATUS_STYLES.unknown;
  return (
    <span className="inline-flex items-center gap-1.5" style={{ ...body, fontSize: '0.72rem', fontWeight: 600, padding: '4px 9px', borderRadius: 7, background: cfg.bg, color: cfg.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

const DateTimeCell = ({ duty }) => {
  const start = formatTime(duty.time_start);
  const end = formatTime(duty.time_end);
  let timeText = '';
  if (start && end) timeText = `${start} – ${end}`;
  else if (start) timeText = start;
  else if (end) timeText = `Until ${end}`;
  return (
    <div>
      <p className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>
        <CalendarDays size={13} style={{ color: GOLD, flexShrink: 0 }} />
        {duty.duty_date ? formatAdminDate(duty.duty_date) : 'No date'}
      </p>
      {timeText ? (
        <p className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 3, whiteSpace: 'nowrap' }}>
          <Clock size={12} style={{ color: GOLD, flexShrink: 0 }} />{timeText}
        </p>
      ) : (
        <p style={{ ...body, fontSize: '0.74rem', color: MUTED, fontStyle: 'italic', marginTop: 3 }}>Time not specified</p>
      )}
    </div>
  );
};

const LocationCell = ({ location }) => {
  if (!location) return <span style={{ ...body, fontSize: '0.76rem', color: MUTED, fontStyle: 'italic' }}>No location specified</span>;
  return (
    <span className="inline-flex items-center gap-1.5" style={{ ...body, fontSize: '0.8rem', color: INK, wordBreak: 'break-word' }}>
      <MapPin size={14} style={{ color: PRIMARY, flexShrink: 0 }} />{location}
    </span>
  );
};

const GroupChips = ({ names }) => {
  if (names.length === 0) return <span style={{ ...body, fontSize: '0.76rem', color: MUTED, fontStyle: 'italic' }}>No group assigned</span>;
  const shown = names.slice(0, 2);
  const extra = names.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5" title={names.join(', ')}>
      {shown.map((name) => (
        <span key={name} style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: PRIMARY_DARK, background: '#F3EBDD', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>{name}</span>
      ))}
      {extra > 0 && <span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: MUTED }}>+{extra} more</span>}
    </div>
  );
};

// Compact "label + select" control used in the filter toolbar.
const ChipSelect = ({ label, value, onChange, options, fill = false }) => (
  <label className="ad-field flex items-center gap-2" style={{ ...(fill ? { flex: 1, minWidth: 0 } : {}), height: 40, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0 8px 0 12px', boxShadow: '0 1px 2px rgba(36,21,18,0.06)', cursor: 'pointer' }}>
    <span style={{ ...body, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>{label}</span>
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ border: 'none', outline: 'none', background: 'transparent', color: INK, ...body, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', paddingRight: 2, ...(fill ? { flex: 1, minWidth: 0, width: '100%' } : { maxWidth: 160 }) }}
    >
      {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </label>
);

// Segmented status filter with live counts.
const SegmentedFilter = ({ label, value, onChange, options }) => (
  <div role="group" aria-label={label} className="inline-flex items-center" style={{ height: 40, padding: 3, gap: 2, background: '#EFE9DF', border: `1px solid ${BORDER}`, borderRadius: 10 }}>
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(opt.value)}
          className="flex items-center gap-1.5"
          style={{ height: 32, padding: '0 11px', border: 0, borderRadius: 8, background: active ? CARD : 'transparent', color: active ? PRIMARY : MUTED, boxShadow: active ? '0 1px 3px rgba(36,21,18,0.14)' : 'none', ...body, fontSize: '0.78rem', fontWeight: active ? 700 : 600, cursor: 'pointer', transition: 'background .15s ease, color .15s ease' }}
        >
          {opt.label}
          <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: active ? `${PRIMARY}14` : 'rgba(36,21,18,0.06)', color: active ? PRIMARY : MUTED }}>{opt.count}</span>
        </button>
      );
    })}
  </div>
);

const PanelHeader = ({ icon: Icon, eyebrow, title, subtitle, right, accent = PRIMARY, titleId }) => (
  <div className="flex items-start justify-between gap-3" style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, background: `${accent}0a` }}>
    <div className="flex items-start gap-3">
      <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, background: `${accent}18`, border: `1px solid ${accent}2b`, flexShrink: 0 }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div>
        {eyebrow && <p style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', color: GOLD }}>{eyebrow}</p>}
        <h2 id={titleId} style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: INK }}>{title}</h2>
        {subtitle && <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>{subtitle}</p>}
      </div>
    </div>
    {right}
  </div>
);

const Notice = ({ tone, icon: Icon, children }) => {
  const tones = {
    success: { bg: '#EAF6EC', color: SUCCESS },
    danger:  { bg: '#FBEFEE', color: DANGER },
    info:    { bg: '#F3EBDD', color: MUTED },
  };
  const cfg = tones[tone];
  return (
    <p className="flex items-center gap-2" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: 10, padding: '9px 12px', marginTop: 12 }}>
      {Icon && <Icon size={14} style={{ flexShrink: 0 }} />}{children}
    </p>
  );
};

const EmptyState = ({ onCreate }) => (
  <div className="flex flex-col items-center justify-center text-center" style={{ padding: '56px 20px' }}>
    <div className="flex items-center justify-center" style={{ width: 60, height: 60, borderRadius: '50%', background: `${PRIMARY}12`, border: `1px solid ${PRIMARY}20`, marginBottom: 16 }}>
      <CalendarDays size={24} style={{ color: PRIMARY }} />
    </div>
    <p style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: INK }}>No duty assignments yet</p>
    <p style={{ ...body, fontSize: '0.82rem', color: MUTED, marginTop: 6, maxWidth: 360 }}>Create a duty assignment to begin scheduling scholar service activities.</p>
    <button type="button" onClick={onCreate} className="ad-primary flex items-center gap-2" style={{ marginTop: 18, border: 0, background: PRIMARY, color: '#fff', borderRadius: 10, padding: '10px 18px', ...body, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 18px -10px rgba(109,33,64,0.6)' }}>
      <Plus size={14} /> Create Duty
    </button>
  </div>
);

const SkeletonRows = () => (
  <>
    {Array.from({ length: 6 }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: 7 }).map((__, c) => (
          <td key={c} style={{ padding: '18px 16px' }}>
            <div className="animate-pulse" style={{ height: 12, borderRadius: 6, background: `${BORDER}99`, width: c === 1 ? '80%' : '60%' }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
    <span aria-hidden="true" style={{ width: 3, height: 13, borderRadius: 2, background: PRIMARY }} />
    <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PRIMARY }}>{children}</p>
  </div>
);

const GroupOption = ({ group, checked, onToggle }) => (
  <label className="flex items-center gap-2" style={{ ...body, fontSize: '0.78rem', fontWeight: checked ? 600 : 500, color: checked ? PRIMARY : MUTED, border: `1px solid ${checked ? PRIMARY : BORDER}`, background: checked ? 'rgba(109,33,64,0.08)' : CARD, borderRadius: 9, padding: '9px 10px', cursor: 'pointer', transition: 'background .15s ease, border-color .15s ease' }}>
    <input type="checkbox" checked={checked} onChange={() => onToggle(group.id)} style={{ accentColor: PRIMARY }} />
    {group.group_name}
  </label>
);

const Dialog = ({ onClose, labelledBy, accent = PRIMARY, maxWidth = 560, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" style={{ background: 'rgba(36,21,18,0.45)' }} onClick={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => e.stopPropagation()}
      className="w-full overflow-y-auto"
      style={{ maxWidth, maxHeight: '90vh', background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${accent}`, borderRadius: 18, boxShadow: '0 24px 60px -20px rgba(36,21,18,0.45)' }}
    >
      {children}
    </div>
  </div>
);

const CloseButton = ({ onClick }) => (
  <button type="button" onClick={onClick} aria-label="Close" className="ad-action" style={{ border: `1px solid ${BORDER}`, background: CARD, color: MUTED, borderRadius: 9, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
    <X size={16} />
  </button>
);

// ─── Main component ─────────────────────────────────────────────────────────

const AdminDutyAssignment = () => {
  const [duties, setDuties] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [makeupCandidates, setMakeupCandidates] = useState([]);
  const [selectedMakeup, setSelectedMakeup] = useState('');
  const [makeupDutyId, setMakeupDutyId] = useState('');
  const [makeupReason, setMakeupReason] = useState('');
  const [makeupMessage, setMakeupMessage] = useState('');
  const [makeupError, setMakeupError] = useState('');
  const [approvingMakeup, setApprovingMakeup] = useState(false);
  const [notifyDutyId, setNotifyDutyId] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyError, setNotifyError] = useState('');
  const [activeDialog, setActiveDialog] = useState(null); // 'notify' | 'makeup' | null

  // UI-only state: row-actions menu, "last updated", client-side filters and pagination.
  const [menu, setMenu] = useState(null); // { duty, top, right }
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [dutiesResponse, groupsResponse] = await Promise.all([
        axios.get(`${API}/duties`, authHeaders()),
        axios.get(`${API}/staff/groups`, authHeaders()),
      ]);
      const enriched = await Promise.all((dutiesResponse.data || []).map(async (duty) => {
        try {
          const groupsResponseForDuty = await axios.get(`${API}/staff/duties/${duty.id}/groups`, authHeaders());
          return { ...duty, assigned_groups: groupsResponseForDuty.data || [] };
        } catch {
          return { ...duty, assigned_groups: [] };
        }
      }));
      setDuties(enriched);
      setGroups(groupsResponse.data || []);
      const makeupResponse = await axios.get(`${API}/staff/duties/makeup-candidates`, authHeaders());
      setMakeupCandidates(makeupResponse.data || []);
      setLastUpdated(new Date());
      setNow(Date.now());
    } catch (loadError) {
      setError(loadError.response?.data?.error || 'Unable to load duty assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Keeps the "Last updated" label fresh.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Close any open dialog with Escape and lock background scroll while one is open.
  const anyDialogOpen = showCreate || activeDialog !== null;
  useEffect(() => {
    if (!anyDialogOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { setShowCreate(false); setActiveDialog(null); }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [anyDialogOpen]);

  // The row-actions dropdown is positioned from its button, so close it if the page moves.
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  const openDialog = (name) => {
    if (name === 'notify') { setNotifyMessage(''); setNotifyError(''); }
    if (name === 'makeup') {
      setMakeupMessage('');
      setMakeupError('');
      setSelectedMakeup('');
      setMakeupDutyId('');
      setMakeupReason('');
    }
    setActiveDialog(name);
  };
  const closeDialog = () => setActiveDialog(null);

  const toggleGroup = (id) => setForm((current) => ({
    ...current,
    group_ids: current.group_ids.includes(id) ? current.group_ids.filter((item) => item !== id) : [...current.group_ids, id],
  }));

  const createDuty = async (event) => {
    event.preventDefault();
    if (!form.title || !form.duty_date || !form.group_ids.length) {
      setError('Enter a title, date, and at least one group.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await axios.post(`${API}/duties`, form, authHeaders());
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await fetchData();
    } catch (saveError) {
      setError(saveError.response?.data?.error || 'Unable to create duty.');
    } finally {
      setSaving(false);
    }
  };

  const deleteDuty = async (duty) => {
    if (!window.confirm(`Delete duty "${duty.title}"?`)) return;
    try {
      await axios.delete(`${API}/duties/${duty.id}`, authHeaders());
      fetchData();
    } catch (deleteError) {
      setError(deleteError.response?.data?.error || 'Unable to delete duty.');
    }
  };

  const handleNotifyDuty = async () => {
    if (!notifyDutyId) {
      setNotifyError('Select a duty first.');
      return;
    }
    setNotifying(true);
    setNotifyMessage('');
    setNotifyError('');
    try {
      const response = await axios.post(`${API}/staff/duties/${notifyDutyId}/notify`, {}, authHeaders());
      setNotifyMessage(`Notifications sent to ${response.data?.sent_count ?? 0} assigned scholar(s).`);
    } catch (notifyRequestError) {
      setNotifyError(notifyRequestError.response?.data?.error || 'Failed to send duty notifications.');
    } finally {
      setNotifying(false);
    }
  };

  const handleApproveMakeup = async () => {
    const candidate = selectedMakeup === '' ? undefined : makeupCandidates[Number(selectedMakeup)];
    if (!candidate || !makeupDutyId) return setMakeupError('Select an absent scholar and the next makeup duty.');
    setMakeupError('');
    setMakeupMessage('');
    setApprovingMakeup(true);
    const makeupDuty = duties.find(duty => String(duty.id) === String(makeupDutyId));
    try {
      await axios.post(`${API}/staff/duties/makeup-permissions`, {
        scholar_id: candidate.scholar_id,
        source_duty_id: candidate.source_duty_id,
        makeup_duty_id: makeupDutyId,
        reason: makeupReason,
      }, authHeaders());
      setMakeupMessage(`${candidate.scholar_name} assigned to ${makeupDuty?.title || 'the selected makeup duty'}.`);
      setMakeupReason('');
      setSelectedMakeup('');
      setMakeupDutyId('');
      await fetchData();
    } catch (approveError) {
      setMakeupError(approveError.response?.data?.error || 'Failed to approve makeup duty.');
    } finally {
      setApprovingMakeup(false);
    }
  };

  // ── Derived values (all from already-loaded data) ──
  const todayKey = localDayKey(new Date());
  const upcomingCount = duties.filter((duty) => { const key = dutyDayKey(duty.duty_date); return key && key >= todayKey; }).length;
  const uniqueAssignedGroups = [...new Set(duties.flatMap(getGroupNames))];
  const selectedNotifyDuty = duties.find((duty) => String(duty.id) === String(notifyDutyId));
  const selectedCandidate = selectedMakeup === '' ? null : makeupCandidates[Number(selectedMakeup)] || null;
  const selectedSourceDate = dutyDayKey(selectedCandidate?.source_duty_date);
  const latestMakeupDate = addDaysToDayKey(selectedSourceDate, 14);
  const todayDayKey = localDayKey(new Date());
  const availableMakeupDuties = selectedCandidate
    ? duties.filter((duty) => {
      const date = dutyDayKey(duty.duty_date);
      return date && date > todayDayKey && date > selectedSourceDate && date <= latestMakeupDate && String(duty.status).toLowerCase() !== 'cancelled';
    })
    : [];
  const hasPendingMakeup = makeupCandidates.length > 0;
  const pastCount = duties.filter((duty) => getDutyStatus(duty) === 'past').length;
  const groupFilterOptions = [...new Set(groups.map((group) => group.group_name).filter(Boolean))];

  const filteredDuties = useMemo(() => {
    const q = search.trim().toLowerCase();
    return duties.filter((duty) => {
      const names = getGroupNames(duty);
      const matchesSearch = !q
        || (duty.title || '').toLowerCase().includes(q)
        || (duty.description || '').toLowerCase().includes(q)
        || (duty.location || '').toLowerCase().includes(q)
        || names.some((name) => name.toLowerCase().includes(q));
      const status = getDutyStatus(duty);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'upcoming' && (status === 'upcoming' || status === 'today'))
        || (statusFilter === 'past' && status === 'past');
      const matchesGroup = groupFilter === 'all' || names.includes(groupFilter);
      const key = dutyDayKey(duty.duty_date);
      const matchesFrom = !dateFrom || (key && key >= dateFrom);
      const matchesTo = !dateTo || (key && key <= dateTo);
      return matchesSearch && matchesStatus && matchesGroup && matchesFrom && matchesTo;
    });
  }, [duties, search, statusFilter, groupFilter, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [search, statusFilter, groupFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredDuties.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedDuties = filteredDuties.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtersActive = search !== '' || statusFilter !== 'all' || groupFilter !== 'all' || dateFrom !== '' || dateTo !== '';

  const clearFilters = () => {
    setSearch(''); setStatusFilter('all'); setGroupFilter('all'); setDateFrom(''); setDateTo('');
  };

  const updatedLabel = (() => {
    if (!lastUpdated) return 'Updating…';
    const minutes = Math.floor((now - lastUpdated.getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    return lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  })();

  const columns = ['#', 'Duty', 'Date & Time', 'Location', 'Assigned Groups', 'Status', 'Actions'];

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8" style={{ background: BG, ...body }}>
      <style>{INTERACTIVE_CSS}</style>

        <AdminPageHeader
          title="Duty Assignment"
          description="Create and organize scholar duty schedules, assign groups, and manage duty-related actions."
          actions={
            <div className="flex items-center gap-4 flex-wrap">
            <div style={{ textAlign: 'right', paddingRight: 16, borderRight: `1px solid ${BORDER}` }}>
              <p style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Last updated</p>
              <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK, marginTop: 2 }}>{updatedLabel}</p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button type="button" onClick={fetchData} title="Refresh duties" className="ad-ghost flex items-center gap-2"
                style={{ border: `1px solid ${BORDER}`, background: CARD, color: INK, borderRadius: 10, padding: '9px 14px', ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(36,21,18,0.06)' }}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button type="button" onClick={() => setShowCreate(true)} className="ad-primary flex items-center gap-2"
                style={{ border: 0, background: PRIMARY, color: '#fff', borderRadius: 10, padding: '10px 18px', ...body, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 18px -10px rgba(109,33,64,0.65)' }}>
                <Plus size={15} /> Create Duty
              </button>
              </div>
            </div>
            }
          />

        {error && !showCreate && (
          <div className="flex items-center gap-2" role="alert" style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 10, background: '#FBEFEE', border: `1px solid ${DANGER}33`, color: DANGER, ...body, fontSize: '0.82rem', fontWeight: 600 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
          <KpiCard icon={CalendarDays} label="Total Duties" value={duties.length} accent={PRIMARY}
            caption="All created duty assignments" footer={pluralize(duties.length, 'duty', 'duties')} />
          <KpiCard icon={Clock} label="Upcoming Duties" value={upcomingCount} accent={WARNING}
            caption="Scheduled from today onwards" footer={`${upcomingCount} upcoming`} />
          <KpiCard icon={Users} label="Assigned Groups" value={uniqueAssignedGroups.length} accent={SUCCESS}
            caption="Unique groups across all duties" footer={pluralize(uniqueAssignedGroups.length, 'group')} />
          <KpiCard onClick={() => openDialog('makeup')} icon={AlertCircle} label="Makeup Assignments" value={makeupCandidates.length} accent={GOLD}
            caption="Awaiting assignment" footer={`${makeupCandidates.length} waiting`} />
        </div>

        {/* ── Filter toolbar ── */}
        <div style={{ ...bentoCard, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 16px' }}>
            <div className="ad-toolbar-grid">

              {/* Row 1, col 1: search */}
              <div className="ad-full ad-field flex items-center gap-2" style={{ height: 40, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0 12px', boxShadow: '0 1px 2px rgba(36,21,18,0.06)' }}>
                <Search size={15} style={{ color: MUTED, flexShrink: 0 }} />
                <input
                  type="text"
                  aria-label="Search duties"
                  placeholder="Search duties, location, or group..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.84rem', color: INK }}
                />
                {search && (
                  <button type="button" aria-label="Clear search" onClick={() => setSearch('')} style={{ border: 0, background: 'none', color: MUTED, cursor: 'pointer', display: 'flex', padding: 2 }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Row 1, col 2: notify */}
              <button type="button" onClick={() => openDialog('notify')} className="ad-ghost flex items-center justify-center gap-2"
                style={{ height: 40, width: '100%', border: `1px solid ${BORDER}`, background: CARD, color: INK, borderRadius: 10, padding: '0 12px', ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(36,21,18,0.06)', whiteSpace: 'nowrap' }}>
                <Bell size={14} style={{ color: PRIMARY }} /> Notify Scholars
              </button>

              {/* Row 1, col 3: makeup */}
              <button type="button" onClick={() => openDialog('makeup')} className="ad-ghost flex items-center justify-center gap-2"
                style={{ height: 40, width: '100%', border: `1px solid ${hasPendingMakeup ? `${WARNING}66` : BORDER}`, background: hasPendingMakeup ? `${WARNING}0f` : CARD, color: INK, borderRadius: 10, padding: '0 12px', ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(36,21,18,0.06)', whiteSpace: 'nowrap' }}>
                <CheckSquare size={14} style={{ color: hasPendingMakeup ? WARNING : MUTED }} /> Makeup Approvals
                <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hasPendingMakeup ? WARNING : '#EFE9DF', color: hasPendingMakeup ? '#fff' : MUTED, fontSize: '0.68rem', fontWeight: 700 }}>{makeupCandidates.length}</span>
              </button>

              {/* Row 2, col 1: status + group (group stretches so the right edge lines up with the search field) */}
              <div className="ad-full flex flex-wrap items-center gap-3">
                <SegmentedFilter
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'All', count: duties.length },
                    { value: 'upcoming', label: 'Upcoming', count: upcomingCount },
                    { value: 'past', label: 'Past', count: pastCount },
                  ]}
                />
                <ChipSelect
                  fill
                  label="Group"
                  value={groupFilter}
                  onChange={setGroupFilter}
                  options={[{ value: 'all', label: 'All Groups' }, ...groupFilterOptions.map((name) => ({ value: name, label: name }))]}
                />
              </div>

              {/* Row 2, cols 2-3: date range (spans exactly under the two buttons) */}
              <div className="ad-full ad-date ad-field flex items-center gap-2" style={{ height: 40, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0 12px', boxShadow: '0 1px 2px rgba(36,21,18,0.06)' }}>
                <CalendarDays size={14} style={{ color: MUTED, flexShrink: 0 }} />
                <span style={{ ...body, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Date</span>
                <input type="date" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.8rem', fontWeight: 600, color: INK }} />
                <ArrowRight size={13} style={{ color: MUTED, flexShrink: 0 }} />
                <input type="date" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.8rem', fontWeight: 600, color: INK }} />
              </div>
            </div>
          </div>

          {/* Footer: result count on the left, clear + refresh on the right */}
          <div className="flex flex-wrap items-center justify-between gap-3" style={{ padding: '9px 16px', borderTop: `1px solid ${BORDER}`, background: BG }}>
            <p style={{ ...body, fontSize: '0.74rem', color: MUTED }}>
              Showing{' '}
              <strong style={{ color: INK }}>
                {filteredDuties.length === 0 ? 0 : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredDuties.length)}`}
              </strong>{' '}
              of <strong style={{ color: INK }}>{duties.length}</strong> {duties.length === 1 ? 'duty' : 'duties'}
            </p>
            <div className="flex items-center gap-2">
              {filtersActive && (
                <button type="button" onClick={clearFilters} className="ad-ghost flex items-center gap-1.5"
                  style={{ height: 30, border: `1px dashed ${MUTED}88`, background: 'none', color: PRIMARY, borderRadius: 8, padding: '0 10px', ...body, fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <FilterX size={12} /> Clear filters
                </button>
              )}
              <button type="button" onClick={fetchData} title="Refresh duties" className="ad-ghost flex items-center gap-1.5"
                style={{ height: 30, border: `1px solid ${BORDER}`, background: CARD, color: INK, borderRadius: 8, padding: '0 10px', ...body, fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <RefreshCw size={12} className={loading ? 'animate-spin' : undefined} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Duty assignments table ── */}
        <div style={{ ...bentoCard, overflow: 'hidden', marginBottom: 16 }}>
          <div className="flex items-center justify-between gap-3" style={{ padding: '18px 20px', borderBottom: `1px solid ${BORDER}` }}>
            <div>
              <h2 style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color: INK }}>Duty Assignments</h2>
              <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>Manage schedules, assigned groups, and duty locations.</p>
            </div>
            <span style={{ ...body, fontSize: '0.74rem', fontWeight: 700, color: PRIMARY, background: `${PRIMARY}0f`, border: `1px solid ${PRIMARY}22`, borderRadius: 8, padding: '5px 10px', whiteSpace: 'nowrap' }}>
              {filtersActive ? `${filteredDuties.length} of ${duties.length} duties` : pluralize(duties.length, 'duty', 'duties')}
            </span>
          </div>

          {!loading && filteredDuties.length === 0 ? (
            duties.length === 0
              ? <EmptyState onCreate={() => setShowCreate(true)} />
              : (
                <div className="flex flex-col items-center justify-center text-center" style={{ padding: '48px 20px' }}>
                  <p style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: INK }}>No duties match your filters</p>
                  <button type="button" onClick={clearFilters} style={{ marginTop: 10, border: 'none', background: 'none', color: PRIMARY, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Clear filters</button>
                </div>
              )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 940 }}>
                <thead>
                  <tr style={{ background: BG }}>
                    {columns.map((col) => (
                      <th key={col} style={{ textAlign: 'left', padding: '11px 16px', ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', color: MUTED, textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1px solid ${BORDER}` }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? <SkeletonRows /> : paginatedDuties.map((duty, idx) => {
                    const rowNumber = (currentPage - 1) * PAGE_SIZE + idx + 1;
                    const cell = { padding: '16px', verticalAlign: 'middle', borderTop: idx === 0 ? 'none' : `1px solid ${BORDER}`, transition: 'background .15s ease' };
                    return (
                      <tr key={duty.id} className="ad-row">
                        <td style={{ ...cell, ...body, fontSize: '0.78rem', fontWeight: 600, color: MUTED }}>{rowNumber}</td>
                        <td style={{ ...cell, maxWidth: 280 }}>
                          <p style={{ ...body, fontSize: '0.88rem', fontWeight: 650, color: INK, wordBreak: 'break-word', lineHeight: 1.3 }}>{duty.title}</p>
                          {duty.description && (
                            <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 3, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{duty.description}</p>
                          )}
                        </td>
                        <td style={cell}><DateTimeCell duty={duty} /></td>
                        <td style={{ ...cell, maxWidth: 200 }}><LocationCell location={duty.location} /></td>
                        <td style={{ ...cell, maxWidth: 240 }}><GroupChips names={getGroupNames(duty)} /></td>
                        <td style={cell}><StatusBadge status={getDutyStatus(duty)} /></td>
                        <td style={cell}>
                          <button
                            type="button"
                            className="ad-action"
                            aria-label={`Actions for ${duty.title}`}
                            aria-haspopup="menu"
                            aria-expanded={menu?.duty.id === duty.id}
                            title="Duty actions"
                            onClick={(e) => {
                              if (menu?.duty.id === duty.id) { setMenu(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenu({ duty, top: rect.bottom + 6, right: window.innerWidth - rect.right });
                            }}
                            style={{ border: `1px solid ${BORDER}`, background: CARD, color: INK, borderRadius: 9, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background .15s ease, border-color .15s ease' }}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ── */}
          {!loading && filteredDuties.length > PAGE_SIZE && (
            <div className="flex items-center justify-between flex-wrap gap-3" style={{ padding: '14px 20px', borderTop: `1px solid ${BORDER}` }}>
              <p style={{ ...body, fontSize: '0.78rem', color: MUTED }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredDuties.length)} of {filteredDuties.length} duties
              </p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="flex items-center gap-1" style={{ border: `1px solid ${BORDER}`, background: CARD, color: INK, borderRadius: 8, padding: '6px 10px', ...body, fontSize: '0.78rem', fontWeight: 600, cursor: currentPage === 1 ? 'default' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
                  <ChevronLeft size={13} /> Previous
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const n = i + 1;
                  const active = n === currentPage;
                  return (
                    <button key={n} type="button" onClick={() => setPage(n)}
                      style={{ border: `1px solid ${active ? PRIMARY : BORDER}`, background: active ? PRIMARY : CARD, color: active ? '#fff' : INK, borderRadius: 8, width: 30, height: 30, ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                      {n}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="flex items-center gap-1" style={{ border: `1px solid ${BORDER}`, background: CARD, color: INK, borderRadius: 8, padding: '6px 10px', ...body, fontSize: '0.78rem', fontWeight: 600, cursor: currentPage === totalPages ? 'default' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      {/* ── Row actions dropdown (fixed so the scrolling table never clips it) ── */}
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
          <div role="menu" className="fixed z-20" style={{ top: menu.top, right: menu.right, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: '0 12px 28px -14px rgba(36,21,18,0.4)', minWidth: 150, overflow: 'hidden' }}>
            <button
              type="button"
              role="menuitem"
              onClick={() => { const target = menu.duty; setMenu(null); deleteDuty(target); }}
              className="ad-ghost flex items-center gap-2 w-full text-left"
              style={{ padding: '10px 14px', border: 'none', background: 'none', color: DANGER, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              <Trash2 size={14} /> Delete Duty
            </button>
          </div>
        </>
      )}

      {/* ── Notify Scholars dialog ── */}
      {activeDialog === 'notify' && (
        <Dialog onClose={closeDialog} labelledBy="notify-dialog-title" accent={PRIMARY}>
          <PanelHeader
            icon={Bell}
            accent={PRIMARY}
            titleId="notify-dialog-title"
            eyebrow="SCHOLAR REMINDERS"
            title="Notify Assigned Scholars"
            subtitle="Send a duty reminder to scholars assigned to the selected duty."
            right={<CloseButton onClick={closeDialog} />}
          />
          <div style={{ padding: '16px 20px 20px' }}>
            <label htmlFor="notify-duty" style={fieldLabel}>SELECT DUTY *</label>
            <select id="notify-duty" className="ad-field" value={notifyDutyId} onChange={(event) => setNotifyDutyId(event.target.value)} style={{ ...input, cursor: 'pointer', background: CARD }}>
              <option value="">Select a duty...</option>
              {duties.map((duty) => <option key={`notify-${duty.id}`} value={duty.id}>{duty.title} - {formatAdminDate(duty.duty_date, { month: 'short' })}</option>)}
            </select>

            {selectedNotifyDuty ? (
              <div style={{ marginTop: 12, border: `1px solid ${BORDER}`, background: '#FCFAF5', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ ...body, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: GOLD }}>REMINDER PREVIEW</p>
                <p style={{ ...body, fontSize: '0.88rem', fontWeight: 650, color: INK, marginTop: 3, wordBreak: 'break-word' }}>{selectedNotifyDuty.title}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-3" style={{ marginTop: 10 }}>
                  <DateTimeCell duty={selectedNotifyDuty} />
                  <LocationCell location={selectedNotifyDuty.location} />
                </div>
                <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${BORDER}` }}>
                  <Users size={13} style={{ color: GOLD, flexShrink: 0 }} />
                  <span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: MUTED }}>Assigned groups:</span>
                  <GroupChips names={getGroupNames(selectedNotifyDuty)} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2" style={{ marginTop: 12, border: `1px dashed ${BORDER}`, borderRadius: 12, padding: '14px', ...body, fontSize: '0.78rem', color: MUTED }}>
                <CalendarDays size={15} style={{ flexShrink: 0 }} /> Select a duty to preview its schedule and assigned groups.
              </div>
            )}

            <Notice tone="info" icon={Info}>Notifications will be sent to all scholars assigned to the selected duty.</Notice>
            {notifyMessage && <Notice tone="success" icon={CheckCircle2}>{notifyMessage}</Notice>}
            {notifyError && <Notice tone="danger" icon={AlertCircle}>{notifyError}</Notice>}

            <div className="flex justify-end gap-2" style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
              <button type="button" onClick={closeDialog} className="ad-ghost" style={{ padding: '10px 16px', border: `1px solid ${BORDER}`, borderRadius: 10, background: CARD, color: PRIMARY, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Close</button>
              <button type="button" onClick={handleNotifyDuty} disabled={notifying} className="ad-primary flex items-center justify-center gap-2"
                style={{ padding: '10px 18px', border: 0, borderRadius: 10, background: PRIMARY, color: '#fff', ...body, fontSize: '0.8rem', fontWeight: 700, cursor: notifying ? 'default' : 'pointer', opacity: notifying ? 0.75 : 1, boxShadow: '0 8px 18px -10px rgba(109,33,64,0.65)' }}>
                {notifying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {notifying ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ── Makeup approval dialog ── */}
      {activeDialog === 'makeup' && (
        <Dialog onClose={closeDialog} labelledBy="makeup-dialog-title" accent={hasPendingMakeup ? WARNING : SUCCESS}>
          <PanelHeader
            icon={Users}
            accent={hasPendingMakeup ? WARNING : SUCCESS}
            titleId="makeup-dialog-title"
            eyebrow="MAKEUP ASSIGNMENT"
            title="Makeup Duty Assignment"
            subtitle="Choose the next duty for each absent or excused scholar."
            right={
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5" style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: hasPendingMakeup ? WARNING : SUCCESS, background: hasPendingMakeup ? `${WARNING}16` : `${SUCCESS}14`, border: `1px solid ${hasPendingMakeup ? WARNING : SUCCESS}33`, borderRadius: 8, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: hasPendingMakeup ? WARNING : SUCCESS }} />
                  {makeupCandidates.length} awaiting
                </span>
                <CloseButton onClick={closeDialog} />
              </div>
            }
          />
          <div style={{ padding: '16px 20px 20px' }}>
            {hasPendingMakeup ? (
              <div>
                <label htmlFor="makeup-candidate" style={fieldLabel}>ABSENT SCHOLAR *</label>
                <select id="makeup-candidate" className="ad-field" value={selectedMakeup} onChange={(event) => {
                  const nextIndex = event.target.value;
                  setSelectedMakeup(nextIndex);
                  setMakeupDutyId('');
                  setMakeupError('');
                }} style={{ ...input, cursor: 'pointer', background: CARD }}>
                  <option value="">Select a candidate...</option>
                  {makeupCandidates.map((candidate, index) => (
                    <option key={`${candidate.scholar_id}-${candidate.source_duty_id}`} value={index}>
                      {candidate.scholar_name} - {candidate.source_status} on {candidate.source_duty_title}
                    </option>
                  ))}
                </select>

                {selectedCandidate ? (
                  <div style={{ marginTop: 12, border: `1px solid ${BORDER}`, background: '#FCFAF5', borderRadius: 12, padding: '12px 14px' }}>
                    <div className="flex items-center gap-2.5">
                      <span aria-hidden="true" className="inline-flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: '50%', background: `${PRIMARY}14`, border: `1px solid ${PRIMARY}2b`, color: PRIMARY, ...body, fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>
                        {getInitials(selectedCandidate.scholar_name)}
                      </span>
                      <p style={{ ...body, fontSize: '0.88rem', fontWeight: 650, color: INK, flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{selectedCandidate.scholar_name}</p>
                      {selectedCandidate.source_status && (
                        <span style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: DANGER, background: '#F7E6E4', borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{selectedCandidate.source_status}</span>
                      )}
                    </div>
                    <div className="flex items-stretch gap-2" style={{ marginTop: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ ...body, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', color: MUTED }}>MISSED DUTY</p>
                        <p style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK, marginTop: 2, wordBreak: 'break-word' }}>{selectedCandidate.source_duty_title}</p>
                      </div>
                      <ArrowRight size={16} style={{ color: GOLD, alignSelf: 'center', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label htmlFor="makeup-target-duty" style={{ ...body, display: 'block', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', color: MUTED }}>ASSIGN NEXT DUTY *</label>
                        <select id="makeup-target-duty" className="ad-field" value={makeupDutyId} onChange={(event) => setMakeupDutyId(event.target.value)} style={{ ...input, marginTop: 5, cursor: 'pointer', background: CARD, fontSize: '0.76rem' }}>
                          <option value="">Select next duty...</option>
                          {availableMakeupDuties.map((duty) => (
                            <option key={duty.id} value={duty.id}>
                              {duty.title} — {new Date(`${dutyDayKey(duty.duty_date)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </option>
                          ))}
                        </select>
                        {availableMakeupDuties.length === 0 && (
                          <p style={{ ...body, fontSize: '0.68rem', color: DANGER, marginTop: 4 }}>No non-cancelled duty is scheduled within 14 days after this missed duty.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2" style={{ marginTop: 12, border: `1px dashed ${BORDER}`, borderRadius: 12, padding: '14px', ...body, fontSize: '0.78rem', color: MUTED }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} /> Select a candidate to review the missed and makeup duty.
                  </div>
                )}

                <label htmlFor="makeup-reason" style={{ ...fieldLabel, marginTop: 14 }}>REASON (OPTIONAL)</label>
                <textarea id="makeup-reason" className="ad-field" rows="2" value={makeupReason} onChange={(event) => setMakeupReason(event.target.value)} placeholder="Optional assignment note..." style={{ ...input, resize: 'vertical' }} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center" style={{ padding: '22px 12px 14px' }}>
                <div className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: '50%', background: `${SUCCESS}14`, border: `1px solid ${SUCCESS}2b`, marginBottom: 10 }}>
                  <CheckCircle2 size={20} style={{ color: SUCCESS }} />
                </div>
                  <p style={{ ...display, fontSize: '0.98rem', fontWeight: 700, color: INK }}>You&apos;re all caught up</p>
                  <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4, maxWidth: 320 }}>No absent or excused scholars are waiting for a makeup-duty assignment.</p>
              </div>
            )}
            {makeupMessage && <Notice tone="success" icon={CheckCircle2}>{makeupMessage}</Notice>}
            {makeupError && <Notice tone="danger" icon={AlertCircle}>{makeupError}</Notice>}

            <div className="flex justify-end gap-2" style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
              <button type="button" onClick={closeDialog} className="ad-ghost" style={{ padding: '10px 16px', border: `1px solid ${BORDER}`, borderRadius: 10, background: CARD, color: PRIMARY, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Close</button>
              {hasPendingMakeup && (
                <button type="button" onClick={handleApproveMakeup} disabled={approvingMakeup || !selectedCandidate || !makeupDutyId} className="ad-primary flex items-center justify-center gap-2"
                style={{ padding: '10px 18px', border: 0, borderRadius: 10, background: PRIMARY, color: '#fff', ...body, fontSize: '0.8rem', fontWeight: 700, cursor: approvingMakeup || !selectedCandidate || !makeupDutyId ? 'not-allowed' : 'pointer', opacity: approvingMakeup || !selectedCandidate || !makeupDutyId ? 0.55 : 1, boxShadow: '0 8px 18px -10px rgba(109,33,64,0.65)' }}>
                {approvingMakeup ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />} Assign Makeup Duty
                </button>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {/* ── Create Duty modal (centered) ── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          style={{ background: 'rgba(36,21,18,0.45)' }}
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={createDuty}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-duty-title"
            className="w-full overflow-y-auto"
            style={{ maxWidth: 620, maxHeight: '90vh', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, boxShadow: '0 24px 60px -20px rgba(36,21,18,0.45)', padding: 0, display: 'flex', flexDirection: 'column' }}
          >
            <div className="flex items-start justify-between gap-4" style={{ padding: '22px 26px 18px', borderBottom: `1px solid ${BORDER}`, borderTop: `3px solid ${PRIMARY}`, borderRadius: '18px 18px 0 0' }}>
              <div>
                <h2 id="create-duty-title" style={{ ...display, fontSize: '1.35rem', fontWeight: 700, color: INK }}>Create Duty Assignment</h2>
                <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>Set up a duty schedule and assign it to one or more groups.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="Close" className="ad-action" style={{ border: `1px solid ${BORDER}`, background: CARD, color: MUTED, borderRadius: 9, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 26px', flex: 1 }}>
              {error && (
                <div className="flex items-center gap-2" role="alert" style={{ marginBottom: 16, padding: '10px 13px', borderRadius: 9, background: '#FBEFEE', border: `1px solid ${DANGER}33`, color: DANGER, ...body, fontSize: '0.78rem', fontWeight: 600 }}>
                  <AlertCircle size={13} style={{ flexShrink: 0 }} /> {error}
                </div>
              )}

              {/* DUTY DETAILS */}
              <SectionLabel>Duty Details</SectionLabel>
              <div className="space-y-4">
                <div>
                  <label htmlFor="duty-title" style={fieldLabel}>DUTY TITLE *</label>
                  <input id="duty-title" className="ad-field" required placeholder="Enter duty title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} style={input} />
                </div>
                <div>
                  <label htmlFor="duty-description" style={fieldLabel}>DESCRIPTION</label>
                  <textarea id="duty-description" className="ad-field" rows="3" placeholder="Enter duty description (optional)" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} style={{ ...input, resize: 'vertical' }} />
                </div>
              </div>

              <div style={{ height: 1, background: BORDER, margin: '22px 0' }} />

              {/* SCHEDULE */}
              <SectionLabel>Schedule</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="duty-date" style={fieldLabel}>DUTY DATE *</label>
                  <input id="duty-date" className="ad-field" required type="date" value={form.duty_date} onChange={(event) => setForm({ ...form, duty_date: event.target.value })} style={input} />
                </div>
                <div>
                  <label htmlFor="duty-start" style={fieldLabel}>START TIME</label>
                  <input id="duty-start" className="ad-field" type="time" value={form.time_start} onChange={(event) => setForm({ ...form, time_start: event.target.value })} style={input} />
                </div>
                <div>
                  <label htmlFor="duty-end" style={fieldLabel}>END TIME</label>
                  <input id="duty-end" className="ad-field" type="time" value={form.time_end} onChange={(event) => setForm({ ...form, time_end: event.target.value })} style={input} />
                </div>
              </div>

              <div style={{ height: 1, background: BORDER, margin: '22px 0' }} />

              {/* LOCATION */}
              <SectionLabel>Location</SectionLabel>
              <div>
                <label htmlFor="duty-location" style={fieldLabel}>LOCATION</label>
                <input id="duty-location" className="ad-field" placeholder="Enter duty location (optional)" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} style={input} />
              </div>

              <div style={{ height: 1, background: BORDER, margin: '22px 0' }} />

              {/* ASSIGNMENT */}
              <SectionLabel>Assignment</SectionLabel>
              <label style={fieldLabel}>ASSIGN TO GROUPS *</label>
              {groups.length === 0 ? (
                <p style={{ ...body, fontSize: '0.78rem', color: MUTED, fontStyle: 'italic' }}>No groups available yet. Create groups in Team Assignments first.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {groups.map((group) => (
                    <GroupOption key={group.id} group={group} checked={form.group_ids.includes(group.id)} onToggle={toggleGroup} />
                  ))}
                </div>
              )}
              <div className="flex justify-end" style={{ marginTop: 12 }}>
                <span style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: form.group_ids.length > 0 ? PRIMARY : MUTED, background: form.group_ids.length > 0 ? `${PRIMARY}0f` : BG, border: `1px solid ${form.group_ids.length > 0 ? `${PRIMARY}2b` : BORDER}`, borderRadius: 8, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                  Selected: {pluralize(form.group_ids.length, 'group')}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2" style={{ padding: '16px 26px', borderTop: `1px solid ${BORDER}`, background: BG, borderRadius: '0 0 18px 18px', position: 'sticky', bottom: 0 }}>
              <button type="button" onClick={() => setShowCreate(false)} className="ad-ghost" style={{ padding: '10px 16px', border: `1px solid ${BORDER}`, borderRadius: 10, background: CARD, color: PRIMARY, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} className="ad-primary" style={{ padding: '10px 20px', border: 0, borderRadius: 10, background: PRIMARY, color: '#fff', ...body, fontSize: '0.8rem', fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.75 : 1, boxShadow: '0 8px 18px -10px rgba(109,33,64,0.65)' }}>
                {saving ? 'Creating...' : 'Create Duty'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminDutyAssignment;