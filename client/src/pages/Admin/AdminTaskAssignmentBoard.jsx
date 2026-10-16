import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Calendar, ClipboardList, Clock3,
  Plus, RefreshCw, Users, UserX, X, Search, MoreHorizontal, ChevronLeft,
  ChevronRight, ChevronDown, FilterX,
} from 'lucide-react';
import { formatAdminDate } from '../../utils/adminPreferences';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

const normalizeApiBase = (url) => {
  const base = (url?.trim() || 'http://localhost:5000').replace(/\/+$/, '');
  return `${base.replace(/(?:\/api)+$/i, '')}/api`;
};
const API_BASE = normalizeApiBase(import.meta.env?.VITE_API_URL);
const LEVELS = [
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  'College 1', 'College 2', 'College 3', 'College 4', 'College 5',
];
const GRADE_LEVELS = LEVELS.slice(0, 6);
const COLLEGE_LEVELS = LEVELS.slice(6);
const TYPES = ['Monthly Report', 'Report Card', 'COR Upload'];
const PAGE_SIZE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_WINDOW_DAYS = 7;

// ── Apple Scholar Admin Portal design system (same tokens as Donor Reporting) ──
const colors = {
  primary: '#6D2140', dark: '#4A1730', gold: '#A9784E',
  bg: '#F7F4EE', surface: '#FFFDF9', border: '#E7D8C7',
  ink: '#241512', muted: '#8A7A68',
  success: '#6B8F71', warning: '#C08A3E', danger: '#A24A4A',
};
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };
const display = { fontFamily: "'Playfair Display', 'Lora', Georgia, serif" };
const input = { width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: 12, background: '#fff', color: colors.ink, fontSize: '0.86rem', outline: 'none', ...body };
const fieldLabel = { display: 'block', color: colors.primary, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 6, ...body };
const cardShadow = '0 1px 2px rgba(36,21,18,0.04), 0 8px 24px -18px rgba(36,21,18,0.22)';
const panel = { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16, boxShadow: cardShadow };

// Hover / focus states can't be expressed with inline styles.
const INTERACTIVE_CSS = `
.at-kpi { transition: transform .18s ease, box-shadow .18s ease; }
.at-kpi:hover { transform: translateY(-2px); box-shadow: 0 14px 28px -18px rgba(36,21,18,0.35); }
.at-row:hover td { background: #FBF7EE !important; }
.at-action:hover { background: rgba(109,33,64,0.08) !important; border-color: rgba(109,33,64,0.35) !important; color: #6D2140 !important; }
.at-primary:hover:not(:disabled) { background: #4A1730 !important; }
.at-ghost:hover:not(:disabled) { background: #F3EBDD !important; }
.at-field:focus-within, select.at-field:focus, input.at-field:focus, textarea.at-field:focus { border-color: #6D2140 !important; box-shadow: 0 0 0 3px rgba(109,33,64,0.12) !important; }
@media (prefers-reduced-motion: reduce) {
  .at-kpi { transition: none; }
  .at-kpi:hover { transform: none; }
}
`;

const getToken = () => localStorage.getItem('token');
const headers = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

const formatDueDate = (value) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatAdminDate(date, { month: 'short' });
};

const isOverdue = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date < new Date();
};

// Not overdue and due within the next UPCOMING_WINDOW_DAYS days.
const isUpcoming = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const diff = date.getTime() - Date.now();
  return diff >= 0 && diff <= UPCOMING_WINDOW_DAYS * DAY_MS;
};

const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

const getInitials = (name) =>
  (name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '?';

// Only read "created by" metadata if the API already returns it.
const getCreatedBy = (task) => task.created_by_name || task.createdByName || null;

// ─── Reusable local components ──────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, caption, footer, accent = colors.primary }) => (
  <div className="at-kpi" style={{ position: 'relative', overflow: 'hidden', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '18px 20px 16px', boxShadow: cardShadow }}>
    <div aria-hidden="true" style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `${accent}0f` }} />
    <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: `${accent}40` }} />
    <div className="flex items-center justify-center" style={{ position: 'relative', width: 42, height: 42, borderRadius: 12, background: `${accent}14`, border: `1px solid ${accent}26` }}>
      <Icon size={18} style={{ color: accent }} />
    </div>
    <p style={{ ...display, position: 'relative', fontSize: '2.1rem', lineHeight: 1.1, fontWeight: 700, color: colors.ink, marginTop: 14 }}>{value}</p>
    <p style={{ ...body, position: 'relative', fontSize: '0.66rem', color: colors.ink, marginTop: 6, letterSpacing: '0.06em', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
    <p style={{ ...body, position: 'relative', fontSize: '0.76rem', color: colors.muted, marginTop: 3 }}>{caption}</p>
    {footer && (
      <div className="flex items-center gap-2" style={{ position: 'relative', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
        <span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: colors.ink }}>{footer}</span>
      </div>
    )}
  </div>
);

const TYPE_STYLES = {
  'Monthly Report': { bg: '#F6E3E9', color: '#8E2E4E' },
  'Report Card':     { bg: '#F3E6D2', color: '#8A6327' },
  'COR Upload':      { bg: '#E3EFE2', color: '#3F7A45' },
};
const TypeBadge = ({ type }) => {
  const cfg = TYPE_STYLES[type] || { bg: colors.bg, color: colors.muted };
  return (
    <span style={{ ...body, display: 'inline-block', fontSize: '0.72rem', fontWeight: 600, padding: '4px 9px', borderRadius: 7, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {type}
    </span>
  );
};

const StatusBadge = ({ overdue }) => (
  <span className="inline-flex items-center gap-1.5" style={{ ...body, fontSize: '0.72rem', fontWeight: 600, padding: '4px 9px', borderRadius: 7, background: overdue ? '#F7E6E4' : '#E4F1E6', color: overdue ? colors.danger : '#3F7A45' }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: overdue ? colors.danger : colors.success, flexShrink: 0 }} />
    {overdue ? 'Overdue' : 'Active'}
  </span>
);

const DueDateCell = ({ value, overdue }) => {
  if (!value) {
    return <span style={{ ...body, fontSize: '0.78rem', color: colors.muted, fontStyle: 'italic' }}>No due date</span>;
  }
  return (
    <div>
      <p style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: overdue ? colors.danger : colors.muted }}>
        {overdue ? 'Overdue' : 'Due'}
      </p>
      <p className="flex items-center gap-1.5" style={{ ...body, fontSize: '0.8rem', fontWeight: overdue ? 600 : 500, color: overdue ? colors.danger : colors.ink, marginTop: 2, whiteSpace: 'nowrap' }}>
        <Calendar size={13} style={{ flexShrink: 0, opacity: 0.85 }} />
        {formatDueDate(value)}
      </p>
    </div>
  );
};

// Year levels as compact chips: first two, then "+N more" (full list on hover).
const LevelChips = ({ items }) => {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) {
    return <span style={{ ...body, fontSize: '0.76rem', color: colors.muted, fontStyle: 'italic' }}>No year level assigned</span>;
  }
  const shown = list.slice(0, 2);
  const extra = list.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5" title={list.join(', ')}>
      {shown.map((level) => (
        <span key={level} style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: colors.dark, background: '#F3EBDD', border: `1px solid ${colors.border}`, borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>{level}</span>
      ))}
      {extra > 0 && <span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: colors.muted }}>+{extra} more</span>}
    </div>
  );
};

const Avatar = ({ name }) => (
  <span aria-hidden="true" className="inline-flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: '50%', background: `${colors.primary}14`, border: `1px solid ${colors.primary}2b`, color: colors.primary, ...body, fontSize: '0.64rem', fontWeight: 700, flexShrink: 0 }}>
    {getInitials(name)}
  </span>
);

const OfficerCell = ({ items }) => {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5" style={{ ...body, fontSize: '0.76rem', color: colors.muted, fontStyle: 'italic' }}>
        <UserX size={14} style={{ flexShrink: 0 }} /> No officer assigned
      </span>
    );
  }
  const extra = list.length - 1;
  return (
    <div className="flex items-center gap-2" title={list.join(', ')}>
      <Avatar name={list[0]} />
      <div style={{ minWidth: 0 }}>
        <p style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: colors.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{list[0]}</p>
        {extra > 0 && <p style={{ ...body, fontSize: '0.7rem', color: colors.muted, marginTop: 1 }}>+{extra} more</p>}
      </div>
    </div>
  );
};

const toolbarLabel = { ...body, display: 'block', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted, marginBottom: 5 };

const FilterGroup = ({ label, value, onChange, options }) => (
  <div className="min-w-0">
    <label style={toolbarLabel}>{label}</label>
    <div className="relative">
      <select
        aria-label={label}
        className="at-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...input, width: '100%', height: 42, padding: '0 34px 0 12px', borderRadius: 11, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', fontWeight: value === 'all' ? 500 : 600, color: value === 'all' ? colors.muted : colors.ink }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown size={15} aria-hidden="true" style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: colors.muted, pointerEvents: 'none' }} />
    </div>
  </div>
);

const FilterChip = ({ children, onRemove }) => (
  <span className="inline-flex items-center gap-1.5" style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: colors.primary, background: `${colors.primary}0d`, border: `1px solid ${colors.primary}26`, borderRadius: 999, padding: '3px 6px 3px 10px' }}>
    {children}
    <button type="button" onClick={onRemove} aria-label={`Remove filter ${children}`} className="at-action flex items-center justify-center" style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer', padding: 0 }}>
      <X size={11} />
    </button>
  </span>
);

const EmptyState = ({ onCreate }) => (
  <div className="flex flex-col items-center justify-center text-center" style={{ padding: '56px 20px' }}>
    <div className="flex items-center justify-center" style={{ width: 60, height: 60, borderRadius: '50%', background: `${colors.primary}12`, border: `1px solid ${colors.primary}20`, marginBottom: 16 }}>
      <ClipboardList size={24} style={{ color: colors.primary }} />
    </div>
    <p style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: colors.ink }}>No task assignments yet</p>
    <p style={{ ...body, fontSize: '0.82rem', color: colors.muted, marginTop: 6, maxWidth: 340 }}>Create a task to begin distributing requirements to officers.</p>
    <button type="button" onClick={onCreate} className="at-primary flex items-center gap-2" style={{ marginTop: 18, border: 0, background: colors.primary, color: '#fff', borderRadius: 10, padding: '10px 18px', ...body, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 18px -10px rgba(109,33,64,0.6)' }}>
      <Plus size={14} /> Create Task
    </button>
  </div>
);

const SkeletonRows = () => (
  <>
    {Array.from({ length: 6 }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: 8 }).map((__, c) => (
          <td key={c} style={{ padding: '18px 16px', background: colors.surface }}>
            <div className="animate-pulse" style={{ height: 12, borderRadius: 6, background: `${colors.border}99`, width: c === 1 ? '80%' : '60%' }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-2" style={{ marginBottom: 12, background: `${colors.primary}08`, borderRadius: 7, padding: '6px 10px' }}>
    <span aria-hidden="true" style={{ width: 3, height: 13, borderRadius: 2, background: colors.primary }} />
    <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.primary }}>{children}</p>
  </div>
);

const LevelOption = ({ level, checked, onToggle }) => (
  <label className="flex items-center gap-2" style={{ ...body, fontSize: '0.78rem', fontWeight: checked ? 600 : 500, color: checked ? colors.primary : colors.ink, border: `1px solid ${checked ? colors.primary : colors.border}`, background: checked ? 'rgba(109,33,64,0.08)' : colors.surface, borderRadius: 9, padding: '9px 10px', cursor: 'pointer', transition: 'background .15s ease, border-color .15s ease' }}>
    <input type="checkbox" checked={checked} onChange={() => onToggle(level)} style={{ accentColor: colors.primary }} />
    {level}
  </label>
);

// ─── Main component ─────────────────────────────────────────────────────────

const AdminTaskAssignmentBoard = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [menu, setMenu] = useState(null); // { task, top, right } for the row-actions dropdown
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [form, setForm] = useState({ title: '', type: TYPES[0], dueDate: '', recurring: 'None', instructions: '', targetYearLevels: [] });

  // UI-only: client-side filters + pagination over the already-loaded
  // `tasks` array. None of this touches the API or task data shape.
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [page, setPage] = useState(1);

  const pendingTasks = tasks.filter((task) => !isOverdue(task.due_date));
  const overdueTasks = tasks.filter((task) => isOverdue(task.due_date));
  const upcomingTasks = tasks.filter((task) => isUpcoming(task.due_date));
  const assignedLevels = [...new Set(tasks.flatMap((task) => Array.isArray(task.target_year_levels) ? task.target_year_levels : []))];

  const loadTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/tasks`, { headers: headers() });
      if (!response.ok) throw new Error('Unable to load tasks');
      setTasks(await response.json());
      setLastUpdated(new Date());
      setNow(Date.now());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTasks(); }, []);

  // Keeps the "Last updated" label fresh.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Close the modal with the Escape key, and lock background scroll while open.
  useEffect(() => {
    if (!showCreate) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') setShowCreate(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [showCreate]);

  // The row-actions dropdown is positioned from the button, so close it if the page moves.
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

  const toggleLevel = (level) => {
    setForm((current) => ({
      ...current,
      targetYearLevels: current.targetYearLevels.includes(level)
        ? current.targetYearLevels.filter((item) => item !== level)
        : [...current.targetYearLevels, level],
    }));
  };

  const createTask = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.targetYearLevels.length) {
      setError('Enter a task title and select at least one year level.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ...form, title: form.title.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create task');
      setForm({ title: '', type: TYPES[0], dueDate: '', recurring: 'None', instructions: '', targetYearLevels: [] });
      setShowCreate(false);
      await loadTasks();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (task) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    const response = await fetch(`${API_BASE}/tasks/${task.id}`, { method: 'DELETE', headers: headers() });
    if (response.ok) loadTasks();
    else setError('Unable to delete task.');
  };

  // ── Client-side filtering (UI-only, over the loaded `tasks` array) ──
  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const officers = Array.isArray(task.assigned_officer_names) ? task.assigned_officer_names : [];
      const matchesSearch = !q
        || (task.title || '').toLowerCase().includes(q)
        || (task.type || '').toLowerCase().includes(q)
        || officers.some((name) => (name || '').toLowerCase().includes(q));
      const matchesType = typeFilter === 'all' || task.type === typeFilter;
      const overdue = isOverdue(task.due_date);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'overdue' ? overdue : !overdue);
      const levels = Array.isArray(task.target_year_levels) ? task.target_year_levels : [];
      const matchesLevel = levelFilter === 'all' || levels.includes(levelFilter);
      return matchesSearch && matchesType && matchesStatus && matchesLevel;
    });
  }, [tasks, search, typeFilter, statusFilter, levelFilter]);

  useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter, levelFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtersActive = search !== '' || typeFilter !== 'all' || statusFilter !== 'all' || levelFilter !== 'all';

  const clearFilters = () => {
    setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setLevelFilter('all');
  };

  const updatedLabel = (() => {
    if (!lastUpdated) return 'Updating…';
    const minutes = Math.floor((now - lastUpdated.getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    return lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  })();

  const overdueCaption = tasks.length === 0 || overdueTasks.length === 0
    ? 'No tasks past due'
    : overdueTasks.length === tasks.length ? 'All current tasks are past due' : 'Past the deadline';

  const columns = ['#', 'Task', 'Requirement', 'Due Date', 'Assigned Year Levels', 'Assigned Officers', 'Status', 'Actions'];

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8" style={{ background: colors.bg, ...body }}>
      <style>{INTERACTIVE_CSS}</style>

        <AdminPageHeader
          title="Task Assignment"
          description="Create tasks, distribute requirements by year level, and monitor officer assignments."
          actions={
            <div className="flex items-center gap-4 flex-wrap">
            <div style={{ textAlign: 'right', paddingRight: 16, borderRight: `1px solid ${colors.border}` }}>
              <p style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted }}>Last updated</p>
              <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: colors.ink, marginTop: 2 }}>{updatedLabel}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={loadTasks} title="Refresh tasks" className="at-ghost flex items-center gap-2"
                style={{ border: `1px solid ${colors.border}`, background: colors.surface, color: colors.ink, borderRadius: 10, padding: '9px 14px', ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(36,21,18,0.06)' }}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button type="button" onClick={() => setShowCreate(true)} className="at-primary flex items-center gap-2"
                style={{ border: 0, background: colors.primary, color: '#fff', borderRadius: 10, padding: '10px 18px', ...body, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 18px -10px rgba(109,33,64,0.65)' }}>
                <Plus size={15} /> Create Task
              </button>
              </div>
            </div>
            }
          />

        {error && !showCreate && (
          <div role="alert" className="flex items-center gap-2" style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 10, background: '#FBEFEE', color: colors.danger, ...body, fontSize: '0.82rem', fontWeight: 600 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
          <KpiCard
            icon={ClipboardList} label="Total Tasks" value={tasks.length} accent={colors.primary}
            caption="All created assignments"
            footer={pluralize(tasks.length, 'assignment')}
          />
          <KpiCard
            icon={Clock3} label="Active Tasks" value={pendingTasks.length} accent={colors.success}
            caption={pendingTasks.length > 0 ? 'Currently ongoing' : 'No ongoing tasks'}
            footer={`${upcomingTasks.length} due within ${UPCOMING_WINDOW_DAYS} days`}
          />
          <KpiCard
            icon={AlertTriangle} label="Overdue Tasks" value={overdueTasks.length} accent={colors.danger}
            caption={overdueCaption}
            footer={`${overdueTasks.length} of ${pluralize(tasks.length, 'task')}`}
          />
          <KpiCard
            icon={Users} label="Assigned Year Levels" value={assignedLevels.length} accent={colors.gold}
            caption={assignedLevels.length > 0 ? 'Across all assignments' : 'No active year-level assignments'}
            footer={`${assignedLevels.length} of ${LEVELS.length} year levels`}
          />
        </div>

        {/* ── Filter / search panel ── */}
        <div style={{ ...panel, padding: 0, marginBottom: 16 }}>
          <div style={{ padding: '16px 18px' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))] gap-3 items-end">
              <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                <label htmlFor="task-search" style={toolbarLabel}>Search</label>
                <div className="at-field flex items-center gap-2" style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 11, padding: '0 12px', height: 42 }}>
                  <Search size={15} style={{ color: colors.muted, flexShrink: 0 }} />
                  <input
                    id="task-search"
                    type="text"
                    placeholder="Search tasks, type, or officer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.84rem', color: colors.ink }}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="at-action flex items-center justify-center" style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'transparent', color: colors.muted, cursor: 'pointer', padding: 0 }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
              <FilterGroup
                label="Requirement Type"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[{ value: 'all', label: 'All Types' }, ...TYPES.map((t) => ({ value: t, label: t }))]}
              />
              <FilterGroup
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[{ value: 'all', label: 'All Statuses' }, { value: 'active', label: 'Active' }, { value: 'overdue', label: 'Overdue' }]}
              />
              <FilterGroup
                label="Year Level"
                value={levelFilter}
                onChange={setLevelFilter}
                options={[{ value: 'all', label: 'All Year Levels' }, ...LEVELS.map((l) => ({ value: l, label: l }))]}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3" style={{ padding: '10px 18px', borderTop: `1px solid ${colors.border}`, background: colors.bg, borderRadius: '0 0 16px 16px' }}>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <p style={{ ...body, fontSize: '0.76rem', color: colors.muted }}>
                Showing <strong style={{ color: colors.ink }}>{filteredTasks.length}</strong> of <strong style={{ color: colors.ink }}>{tasks.length}</strong> {tasks.length === 1 ? 'task' : 'tasks'}
              </p>
              {typeFilter !== 'all' && <FilterChip onRemove={() => setTypeFilter('all')}>{typeFilter}</FilterChip>}
              {statusFilter !== 'all' && <FilterChip onRemove={() => setStatusFilter('all')}>{statusFilter === 'overdue' ? 'Overdue' : 'Active'}</FilterChip>}
              {levelFilter !== 'all' && <FilterChip onRemove={() => setLevelFilter('all')}>{levelFilter}</FilterChip>}
            </div>
            <div className="flex items-center gap-2">
              {filtersActive && (
                <button type="button" onClick={clearFilters} className="at-ghost flex items-center gap-1.5"
                  style={{ border: `1px solid ${colors.border}`, background: colors.surface, color: colors.primary, borderRadius: 9, padding: '7px 12px', ...body, fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}>
                  <FilterX size={13} /> Clear Filters
                </button>
              )}
              <button type="button" onClick={loadTasks} className="at-ghost flex items-center gap-1.5"
                style={{ border: `1px solid ${colors.border}`, background: colors.surface, color: colors.ink, borderRadius: 9, padding: '7px 12px', ...body, fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Task Assignments panel ── */}
        <div style={{ ...panel, overflow: 'hidden' }}>
          <div className="flex items-center justify-between gap-3" style={{ padding: '18px 20px', borderBottom: `1px solid ${colors.border}` }}>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" style={{ width: 3, height: 34, borderRadius: 2, background: colors.primary, flexShrink: 0 }} />
              <div>
                <h2 style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color: colors.ink }}>Task Assignments</h2>
                <p style={{ ...body, fontSize: '0.78rem', color: colors.muted, marginTop: 2 }}>Manage and monitor all task assignments.</p>
              </div>
            </div>
            <span style={{ ...body, fontSize: '0.74rem', fontWeight: 700, color: colors.primary, background: `${colors.primary}0f`, border: `1px solid ${colors.primary}22`, borderRadius: 8, padding: '5px 10px', whiteSpace: 'nowrap' }}>
              {filtersActive ? `${filteredTasks.length} of ${tasks.length} tasks` : pluralize(tasks.length, 'task')}
            </span>
          </div>

          {!loading && filteredTasks.length === 0 ? (
            tasks.length === 0
              ? <EmptyState onCreate={() => setShowCreate(true)} />
              : (
                <div className="flex flex-col items-center justify-center text-center" style={{ padding: '48px 20px' }}>
                  <p style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: colors.ink }}>No tasks match your filters</p>
                  <button type="button" onClick={clearFilters} style={{ marginTop: 10, border: 'none', background: 'none', color: colors.primary, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Clear filters</button>
                </div>
              )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 980 }}>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col} style={{ textAlign: 'left', padding: '11px 16px', background: '#F6EFE4', ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', color: colors.muted, textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1px solid ${colors.border}` }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? <SkeletonRows /> : paginatedTasks.map((task, idx) => {
                    const overdue = isOverdue(task.due_date);
                    const rowNumber = (currentPage - 1) * PAGE_SIZE + idx + 1;
                    const officers = Array.isArray(task.assigned_officer_names) ? task.assigned_officer_names : [];
                    const levels = Array.isArray(task.target_year_levels) ? task.target_year_levels : [];
                    const createdBy = getCreatedBy(task);
                    const cell = { padding: '16px', verticalAlign: 'middle', background: colors.surface, borderTop: idx === 0 ? 'none' : `1px solid ${colors.border}`, transition: 'background .15s ease' };
                    return (
                      <tr key={task.id} className="at-row">
                        <td style={{ ...cell, ...body, fontSize: '0.78rem', fontWeight: 600, color: colors.muted }}>{rowNumber}</td>
                        <td style={{ ...cell, maxWidth: 260 }}>
                          <p style={{ ...body, fontSize: '0.88rem', fontWeight: 650, color: colors.ink, wordBreak: 'break-word', lineHeight: 1.3 }}>{task.title}</p>
                          {createdBy && <p style={{ ...body, fontSize: '0.72rem', color: colors.muted, marginTop: 3 }}>Created by {createdBy}</p>}
                        </td>
                        <td style={cell}><TypeBadge type={task.type} /></td>
                        <td style={cell}><DueDateCell value={task.due_date} overdue={overdue} /></td>
                        <td style={{ ...cell, maxWidth: 230 }}><LevelChips items={levels} /></td>
                        <td style={{ ...cell, maxWidth: 220 }}><OfficerCell items={officers} /></td>
                        <td style={cell}><StatusBadge overdue={overdue} /></td>
                        <td style={cell}>
                          <button
                            type="button"
                            className="at-action"
                            aria-label={`Actions for ${task.title}`}
                            aria-haspopup="menu"
                            aria-expanded={menu?.task.id === task.id}
                            onClick={(e) => {
                              if (menu?.task.id === task.id) { setMenu(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenu({ task, top: rect.bottom + 6, right: window.innerWidth - rect.right });
                            }}
                            title="Task actions"
                            style={{ border: `1px solid ${colors.border}`, background: colors.surface, color: colors.ink, borderRadius: 9, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background .15s ease, border-color .15s ease' }}
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
          {!loading && filteredTasks.length > PAGE_SIZE && (
            <div className="flex items-center justify-between flex-wrap gap-3" style={{ padding: '14px 20px', borderTop: `1px solid ${colors.border}` }}>
              <p style={{ ...body, fontSize: '0.78rem', color: colors.muted }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredTasks.length)} of {filteredTasks.length} tasks
              </p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="flex items-center gap-1" style={{ border: `1px solid ${colors.border}`, background: colors.surface, color: colors.ink, borderRadius: 8, padding: '6px 10px', ...body, fontSize: '0.78rem', fontWeight: 600, cursor: currentPage === 1 ? 'default' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
                  <ChevronLeft size={13} /> Previous
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const n = i + 1;
                  const active = n === currentPage;
                  return (
                    <button key={n} type="button" onClick={() => setPage(n)} aria-current={active ? 'page' : undefined}
                      style={{ border: `1px solid ${active ? colors.primary : colors.border}`, background: active ? colors.primary : colors.surface, color: active ? '#fff' : colors.ink, borderRadius: 8, width: 30, height: 30, ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                      {n}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="flex items-center gap-1" style={{ border: `1px solid ${colors.border}`, background: colors.surface, color: colors.ink, borderRadius: 8, padding: '6px 10px', ...body, fontSize: '0.78rem', fontWeight: 600, cursor: currentPage === totalPages ? 'default' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>
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
          <div role="menu" className="fixed z-20" style={{ top: menu.top, right: menu.right, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, boxShadow: '0 12px 28px -14px rgba(36,21,18,0.4)', minWidth: 150, overflow: 'hidden' }}>
            <button
              type="button"
              role="menuitem"
              onClick={() => { const target = menu.task; setMenu(null); deleteTask(target); }}
              className="at-ghost w-full text-left"
              style={{ padding: '10px 14px', border: 'none', background: 'none', color: colors.danger, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Delete Task
            </button>
          </div>
        </>
      )}

      {/* ── Create Task modal — centered on screen, scrolls inside itself ── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          style={{ background: 'rgba(36,21,18,0.45)' }}
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={createTask}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-task-title"
            className="w-full overflow-y-auto"
            style={{
              position: 'relative',
              maxWidth: 620,
              maxHeight: '90vh',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 18,
              boxShadow: '0 24px 60px -20px rgba(36,21,18,0.45)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Very faint Apple Scholar accents — decorative only */}
            <div aria-hidden="true" style={{ position: 'absolute', top: 0, right: 0, width: 260, height: 200, pointerEvents: 'none', background: 'radial-gradient(circle at 100% 0%, rgba(109,33,64,0.10) 0%, rgba(214,160,175,0.07) 38%, transparent 70%)', borderTopRightRadius: 18 }} />
            <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: colors.primary, borderTopLeftRadius: 18, borderTopRightRadius: 18 }} />

            <div className="flex items-start justify-between gap-4" style={{ position: 'relative', padding: '24px 26px 18px', borderBottom: `1px solid ${colors.border}` }}>
              <div>
                <h2 id="create-task-title" style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: colors.ink }}>Create Task Assignment</h2>
                <p style={{ ...body, fontSize: '0.8rem', color: colors.muted, marginTop: 4 }}>Set up a new task and distribute it to specific year levels.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="Close" className="at-action" style={{ border: `1px solid ${colors.border}`, background: colors.surface, color: colors.muted, borderRadius: 9, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ position: 'relative', padding: '20px 26px', flex: 1 }}>
              {error && (
                <div role="alert" className="flex items-center gap-2" style={{ marginBottom: 16, padding: '10px 13px', borderRadius: 9, background: '#FBEFEE', color: colors.danger, ...body, fontSize: '0.78rem', fontWeight: 600 }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} /> {error}
                </div>
              )}

              {/* TASK DETAILS */}
              <SectionLabel>Task Details</SectionLabel>
              <div className="space-y-4">
                <div>
                  <label htmlFor="task-title" style={fieldLabel}>TASK TITLE *</label>
                  <input id="task-title" className="at-field" required placeholder="Enter task title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} style={input} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="task-type" style={fieldLabel}>REQUIREMENT TYPE *</label>
                    <select id="task-type" className="at-field" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} style={{ ...input, cursor: 'pointer' }}>
                      {TYPES.map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="task-due-date" style={fieldLabel}>DUE DATE / DEADLINE *</label>
                    <input id="task-due-date" className="at-field" type="date" required value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} style={input} />
                    <p style={{ color: colors.muted, fontSize: '0.7rem', marginTop: 5, ...body }}>The task moves to overdue after this date.</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="task-recurring" style={fieldLabel}>RECURRING</label>
                  <select id="task-recurring" className="at-field" value={form.recurring} onChange={(event) => setForm({ ...form, recurring: event.target.value })} style={{ ...input, cursor: 'pointer' }}>
                    <option>None</option><option>Monthly</option><option>Quarterly</option><option>Semestral</option><option>Annual</option>
                  </select>
                  <p style={{ color: colors.muted, fontSize: '0.7rem', marginTop: 5, ...body }}>Set if this task should automatically repeat.</p>
                </div>
              </div>

              <div style={{ height: 1, background: colors.border, margin: '22px 0' }} />

              {/* ASSIGNMENT */}
              <SectionLabel>Assignment</SectionLabel>
              <label style={fieldLabel}>DISTRIBUTE TO YEAR LEVELS *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" style={{ marginBottom: 8 }}>
                {GRADE_LEVELS.map((level) => (
                  <LevelOption key={level} level={level} checked={form.targetYearLevels.includes(level)} onToggle={toggleLevel} />
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COLLEGE_LEVELS.map((level) => (
                  <LevelOption key={level} level={level} checked={form.targetYearLevels.includes(level)} onToggle={toggleLevel} />
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginTop: 12 }}>
                <p style={{ color: colors.muted, fontSize: '0.7rem', maxWidth: 340, ...body }}>Each selected level is automatically routed to the officers configured in Team Assignments.</p>
                <span style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: form.targetYearLevels.length > 0 ? colors.primary : colors.muted, background: form.targetYearLevels.length > 0 ? `${colors.primary}0f` : colors.bg, border: `1px solid ${form.targetYearLevels.length > 0 ? `${colors.primary}2b` : colors.border}`, borderRadius: 8, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                  Selected: {pluralize(form.targetYearLevels.length, 'year level')}
                </span>
              </div>

              <div style={{ height: 1, background: colors.border, margin: '22px 0' }} />

              {/* INSTRUCTIONS */}
              <SectionLabel>Instructions</SectionLabel>
              <div>
                <label htmlFor="task-instructions" style={fieldLabel}>INSTRUCTIONS</label>
                <textarea id="task-instructions" className="at-field" rows="4" placeholder="Add detailed instructions for the assigned officers..." value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} style={{ ...input, resize: 'vertical' }} />
                <p style={{ color: colors.muted, fontSize: '0.7rem', marginTop: 5, ...body }}>Provide clear guidelines for the assigned officers.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2" style={{ position: 'sticky', bottom: 0, padding: '16px 26px', borderTop: `1px solid ${colors.border}`, background: colors.bg, borderRadius: '0 0 18px 18px' }}>
              <button type="button" onClick={() => setShowCreate(false)} className="at-ghost" style={{ padding: '10px 16px', border: `1px solid ${colors.border}`, borderRadius: 10, background: colors.surface, color: colors.primary, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} className="at-primary" style={{ padding: '10px 20px', border: 0, borderRadius: 10, background: colors.primary, color: '#fff', ...body, fontSize: '0.8rem', fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.75 : 1, boxShadow: '0 8px 18px -10px rgba(109,33,64,0.65)' }}>
                {saving ? 'Creating assignment…' : 'Create and Assign'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminTaskAssignmentBoard;