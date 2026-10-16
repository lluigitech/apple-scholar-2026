import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Shield, Download, Search, Eye, FileText, Users, LogIn, LogOut, CheckCircle, XCircle, Upload, Activity,
  Clock, ChevronLeft, ChevronRight, AlertTriangle, Pencil, Plus,
} from 'lucide-react';
import { formatAdminDateTime } from '../../../utils/adminPreferences';
import AdminPageHeader from '../../../components/Admin/AdminPageHeader';

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

// ── Design tokens ──────────────────────────────────────────────
const BG           = '#F7F4EE';
const SURFACE      = '#FFFDF9';
const BORDER       = '#E7D8C7';
const PRIMARY      = '#6D2140';
const INK          = '#241512';
const MUTED        = '#8A7A68';
const BRONZE       = '#A9784E';
const SUCCESS      = '#6B8F71';
const WARNING      = '#C08A3E';
const DANGER       = '#A24A4A';
const RADIUS       = 16;
const PAGE_SIZE    = 10;
const PRIVACY_PAGE_SIZE = 50;

const serif = { fontFamily: "'Playfair Display', serif" };
const sans  = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const cardStyle = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: '0 1px 2px rgba(36,21,18,0.04)' };

const actionConfig = {
  login:    { icon: LogIn,       label: 'Login'    },
  logout:   { icon: LogOut,      label: 'Logout'   },
  view:     { icon: Eye,         label: 'View'     },
  submit:   { icon: Upload,      label: 'Submit'   },
  approve:  { icon: CheckCircle, label: 'Approve'  },
  reject:   { icon: XCircle,     label: 'Return'   },
  edit:     { icon: FileText,    label: 'Edit'     },
  update:   { icon: Pencil,      label: 'Update'   },
  create:   { icon: Plus,        label: 'Create'   },
  delete:   { icon: XCircle,     label: 'Delete'   },
  export:   { icon: Download,    label: 'Export'   },
  download: { icon: Download,    label: 'Download' },
};

const resultConfig = {
  success: { color: SUCCESS, label: 'Success' },
  failed:  { color: DANGER,  label: 'Failed'  },
  blocked: { color: WARNING, label: 'Blocked' },
  default: { color: MUTED,   label: 'Unknown' },
};

const roleStyles = {
  admin:   { color: PRIMARY,   label: 'Admin' },
  officer: { color: BRONZE,    label: 'Officer' },
  staff:   { color: SUCCESS,   label: 'Staff' },
  scholar: { color: '#7A6A58', label: 'Scholar' },
};

const ROLE_OPTIONS = [
  { value: 'all',     label: 'Everyone' },
  { value: 'staff',   label: 'Staff'    },
  { value: 'officer', label: 'Officer'  },
  { value: 'admin',   label: 'Admin'    },
];

const ACTIVITY_TYPES = [
  { value: 'all',     label: 'All Activity' },
  { value: 'system',  label: 'System Activity' },
  { value: 'privacy', label: 'Sensitive Data Access' },
];

const capitalize = (value) => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const formatPhilippineTime = (value) => {
  if (!value) return '';
  return formatAdminDateTime(value);
};

const titleCase = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (ch) => ch.toUpperCase())
  .trim();

// Privacy logs use their own status vocabulary; map it onto the shared Success / Failed / Blocked set.
const normalizeResult = (status) => {
  const value = String(status || '').toLowerCase();
  if (['success', 'allowed', 'ok', 'granted'].includes(value)) return 'success';
  if (['blocked', 'denied', 'forbidden', 'unauthorized', 'rejected'].includes(value)) return 'blocked';
  if (['failed', 'failure', 'error'].includes(value)) return 'failed';
  return resultConfig[value] ? value : 'default';
};

const pageList = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const sorted = [...new Set([1, total, current - 1, current, current + 1])].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push(`gap-${p}`); out.push(p); });
  return out;
};

// ── Small presentational pieces ────────────────────────────────
const IconBadge = ({ icon: Icon, size = 40, color = PRIMARY }) => (
  <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: size, height: size, background: `${color}12`, color }}>
    <Icon size={Math.round(size * 0.45)} />
  </span>
);

const KpiCard = ({ icon, label, value, hint, color }) => (
  <div className="flex items-center gap-3 min-w-0" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px' }}>
    <IconBadge icon={icon} color={color} />
    <div className="min-w-0">
      <p style={{ ...sans, fontSize: '0.74rem', fontWeight: 600, color: INK }}>{label}</p>
      <p style={{ ...serif, fontSize: '1.45rem', fontWeight: 600, color: INK, lineHeight: 1.15 }}>{value}</p>
      <p className="truncate" style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>{hint}</p>
    </div>
  </div>
);

const StatusPill = ({ result }) => {
  const rc = resultConfig[result] || resultConfig.default;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap" style={{
      ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.02em',
      background: `${rc.color}14`, color: rc.color, border: `1px solid ${rc.color}35`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: rc.color }} />
      {rc.label}
    </span>
  );
};

const RoleBadge = ({ role }) => {
  const style = roleStyles[role];
  const color = style?.color || MUTED;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full whitespace-nowrap" style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, background: `${color}14`, color, border: `1px solid ${color}30` }}>
      {style?.label || capitalize(role) || '—'}
    </span>
  );
};

const FilterSelect = ({ label, value, onChange, children }) => (
  <label className="block min-w-0" style={{ ...sans, fontSize: '0.66rem', fontWeight: 600, color: MUTED }}>
    {label}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="outline-none w-full"
      style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, border: `1px solid ${BORDER}`, borderRadius: 12, height: 40, padding: '0 12px', color: INK, background: '#fff', cursor: 'pointer', marginTop: 4 }}
    >
      {children}
    </select>
  </label>
);

const SkeletonBlock = ({ className = '', style }) => (
  <div className={`animate-pulse rounded-xl ${className}`} style={{ background: '#EFE6D8', ...style }} />
);

const LoadingSkeleton = () => (
  <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading security audit">
    <div className="flex items-center gap-3">
      <SkeletonBlock style={{ width: 56, height: 56, borderRadius: 16 }} />
      <div className="flex-1">
        <SkeletonBlock style={{ height: 24, width: 200 }} />
        <SkeletonBlock style={{ height: 12, width: '55%', marginTop: 10 }} />
      </div>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] gap-4">
      <div style={{ ...cardStyle, padding: 16 }}>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} style={{ height: 88 }} />)}
        </div>
      </div>
      <div style={{ ...cardStyle, padding: 16 }}><SkeletonBlock style={{ height: 88 }} /></div>
    </div>
    <div style={{ ...cardStyle, padding: 20 }}>
      <SkeletonBlock style={{ height: 44, width: '45%' }} />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" style={{ marginTop: 16 }}>
        {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} style={{ height: 40 }} />)}
      </div>
      <div style={{ marginTop: 16 }}>
        {Array.from({ length: 8 }).map((_, i) => <SkeletonBlock key={i} style={{ height: 36, marginBottom: 8 }} />)}
      </div>
    </div>
  </div>
);

const SecurityAuditLogs = ({ embedded = false }) => {
  const [auditData, setAuditData] = useState([]);
  const [privacyLogs, setPrivacyLogs] = useState([]);
  const [privacyLogsPage, setPrivacyLogsPage] = useState(1);
  const [privacyLogsTotal, setPrivacyLogsTotal] = useState(0);
  const [privacyLogsError, setPrivacyLogsError] = useState('');
  const [privacyLoadingMore, setPrivacyLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activityType, setActivityType] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchAudit = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await axios.get(`${API}/export/preview`, {
          ...getAuthHeaders(),
          params: { type: 'audit' },
        });

        if (res.data?.success && Array.isArray(res.data.data)) {
          setAuditData(res.data.data.map((entry) => ({
            id: entry.id || `${entry.timestamp || new Date().toISOString()}-${entry.action || 'view'}-${entry.performed_by || entry.user_id || 'unknown'}`,
            userId: entry.user_id || entry.userId || entry.performed_by || 'UNKNOWN',
            userName: entry.performed_by || entry.userName || entry.user_name || 'Unknown',
            timestamp: entry.timestamp || entry.created_at || new Date().toISOString(),
            timestampText: formatPhilippineTime(entry.timestamp || entry.created_at || new Date().toISOString()),
            role: (entry.role || 'admin').toString().toLowerCase(),
            action: (entry.action || 'view').toString().toLowerCase(),
            resource: entry.module || entry.resource || 'Audit',
            details: entry.details || '',
            ip: entry.ip_address || entry.ip || '',
            result: (entry.result || 'success').toString().toLowerCase(),
          })));
        } else {
          setError('Unable to load audit log data.');
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch audit data.');
      } finally {
        setLoading(false);
      }
    };

    fetchAudit();
  }, []);

  // Sensitive-data access logs stay server-paginated: the first page loads up front,
  // more pages are appended only when the administrator asks for them.
  useEffect(() => {
    let mounted = true;
    if (privacyLogsPage > 1) setPrivacyLoadingMore(true);
    axios.get(`${API}/admin/privacy/logs`, {
      ...getAuthHeaders(),
      params: { page: privacyLogsPage, pageSize: PRIVACY_PAGE_SIZE },
    }).then(({ data }) => {
      if (!mounted) return;
      const rows = data.data || [];
      setPrivacyLogs((current) => {
        if (privacyLogsPage === 1) return rows;
        const seen = new Set(current.map((row) => row.id));
        return [...current, ...rows.filter((row) => !seen.has(row.id))];
      });
      setPrivacyLogsTotal(data.total || 0);
      setPrivacyLogsError('');
    }).catch((err) => {
      if (!mounted) return;
      console.error('Failed to load privacy access logs:', err);
      setPrivacyLogsError(err.response?.data?.error || 'Sensitive-data access logs unavailable.');
    }).finally(() => {
      if (mounted) setPrivacyLoadingMore(false);
    });
    return () => { mounted = false; };
  }, [privacyLogsPage]);

  // One display model for both sources (presentation only — the sources stay separate).
  const unified = useMemo(() => {
    const system = auditData.map((entry) => ({
      key: `system-${entry.id}`,
      activityType: 'system',
      timestamp: entry.timestamp,
      timestampText: entry.timestampText,
      userId: entry.userId === 'UNKNOWN' ? '' : entry.userId,
      userName: entry.userName,
      role: entry.role,
      action: entry.action,
      resource: entry.resource,
      resourceId: '',
      details: entry.details,
      ip: entry.ip,
      result: entry.result,
    }));
    const privacy = privacyLogs.map((entry) => ({
      key: `privacy-${entry.id}`,
      activityType: 'privacy',
      timestamp: entry.created_at,
      timestampText: formatPhilippineTime(entry.created_at),
      userId: entry.user_id ? String(entry.user_id) : '',
      userName: entry.user_name || entry.userName || '',
      role: (entry.user_role || '').toString().toLowerCase(),
      action: (entry.action || 'view').toString().toLowerCase(),
      resource: titleCase(entry.resource_type) || 'Protected record',
      resourceId: entry.resource_id ? String(entry.resource_id) : '',
      details: '',
      ip: entry.ip_address || '',
      result: normalizeResult(entry.status),
    }));
    const time = (value) => {
      const t = new Date(value).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    return [...system, ...privacy].sort((a, b) => time(b.timestamp) - time(a.timestamp));
  }, [auditData, privacyLogs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return unified.filter((entry) => {
      const searchMatch = !term || [entry.userName, entry.userId, entry.resource, entry.resourceId, entry.details].some((f) => (f || '').toLowerCase().includes(term));
      const typeMatch = activityType === 'all' || entry.activityType === activityType;
      const roleMatch = roleFilter === 'all' || entry.role === roleFilter;
      const actionMatch = actionFilter === 'all' || entry.action === actionFilter;
      const resultMatch = resultFilter === 'all' || entry.result === resultFilter;
      return searchMatch && typeMatch && roleMatch && actionMatch && resultMatch;
    });
  }, [unified, search, activityType, roleFilter, actionFilter, resultFilter]);

  useEffect(() => { setPage(1); }, [search, activityType, roleFilter, actionFilter, resultFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const exportCSV = () => {
    const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [['Timestamp', 'Activity Type', 'User ID', 'User', 'Role', 'Action', 'Resource', 'Resource ID', 'Details', 'IP', 'Result']];
    filtered.forEach((e) => rows.push([
      e.timestampText || e.timestamp, e.activityType === 'privacy' ? 'Sensitive Data Access' : 'System Activity',
      e.userId, e.userName, e.role, e.action, e.resource, e.resourceId, e.details, e.ip, e.result,
    ]));
    const csv = rows.map((r) => r.map(quote).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    axios.post(`${API}/export/google-sheets`, { log_only: true, module: 'Audit Log', report_resource: 'Audit Trail', spreadsheet_title: `Audit Log Export ${new Date().toISOString().slice(0,10)}`, details: `audit_log_${new Date().toISOString().slice(0, 10)}.csv` }, getAuthHeaders()).catch(() => {});
  };

  const failures = auditData.filter((e) => e.result !== 'success').length;
  const successCount = auditData.filter((e) => e.result === 'success').length;
  const activeUsers = new Set(auditData.filter((e) => e.userId !== 'UNKNOWN').map((e) => e.userId)).size;

  const lastUpdatedText = useMemo(() => {
    if (!auditData.length) return '—';
    const latest = auditData.reduce((a, b) => (new Date(b.timestamp) > new Date(a.timestamp) ? b : a));
    return latest.timestampText || '—';
  }, [auditData]);

  const hasMorePrivacy = privacyLogs.length < privacyLogsTotal;
  const th = { ...sans, fontSize: '0.72rem', fontWeight: 700, color: INK, textAlign: 'left', padding: '11px 14px', whiteSpace: 'nowrap', background: BG, borderBottom: `1px solid ${BORDER}` };
  const td = { ...sans, fontSize: '0.8rem', color: INK, padding: '10px 14px', verticalAlign: 'middle', borderBottom: `1px solid ${BORDER}66` };

  if (loading) {
    return (
      <div className={embedded ? 'w-full' : 'w-full px-4 sm:px-6 lg:px-8'}>
        {!embedded && (
          <AdminPageHeader
            title="Security Audit"
            description="Review system activity, administrator actions, and protected scholar-data access."
          />
        )}
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className={embedded ? 'w-full' : 'w-full px-4 sm:px-6 lg:px-8'} style={sans}>
      {!embedded && (
        <AdminPageHeader
          title="Security Audit"
          description="Review system activity, administrator actions, and protected scholar-data access."
        />
      )}
      <div className="flex flex-col gap-4 w-full">

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: `${DANGER}0F`, border: `1px solid ${DANGER}35` }}>
          <AlertTriangle size={15} style={{ color: DANGER, flexShrink: 0 }} />
          <span style={{ ...sans, fontSize: '0.8rem', color: DANGER }}>Audit data unavailable. {error}</span>
        </div>
      )}

      {/* ── Security overview + Audit logging ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] gap-4 items-stretch">
        <section style={{ ...cardStyle, padding: 16 }} aria-labelledby="security-overview-title">
          <h2 id="security-overview-title" style={{ ...serif, fontSize: '1rem', fontWeight: 600, color: INK, marginBottom: 12 }}>Security Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard icon={Activity}    label="Total Events"      value={auditData.length} hint="All recorded events"            color={PRIMARY} />
            <KpiCard icon={CheckCircle} label="Successful Events" value={successCount}     hint="Allowed actions"                color={SUCCESS} />
            <KpiCard icon={XCircle}     label="Failed / Blocked"  value={failures}         hint="Denied or blocked actions"      color={DANGER} />
            <KpiCard icon={Users}       label="Active Users"      value={activeUsers}      hint="Unique users in this period"    color={BRONZE} />
          </div>
        </section>

        <section style={{ ...cardStyle, padding: 16 }} aria-labelledby="audit-logging-title" className="flex">
          <div className="flex items-start gap-3 min-w-0" style={{ background: `${PRIMARY}06`, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, width: '100%' }}>
            <IconBadge icon={Shield} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="audit-logging-title" style={{ ...serif, fontSize: '1rem', fontWeight: 600, color: INK }}>Audit Logging</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full" style={{ ...sans, fontSize: '0.64rem', fontWeight: 700, color: error ? DANGER : SUCCESS, background: `${error ? DANGER : SUCCESS}14`, border: `1px solid ${error ? DANGER : SUCCESS}30` }}>
                  {error ? 'Status unavailable' : 'Logging Active'}
                </span>
              </div>
              <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 4, lineHeight: 1.55 }}>
                Authentication, system activity, and protected scholar-data access events are recorded for administrative review.
              </p>
              <p className="flex items-center gap-1.5" style={{ ...sans, fontSize: '0.7rem', color: MUTED, marginTop: 8 }}>
                <Clock size={12} aria-hidden="true" /> Last updated · {lastUpdatedText}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ── Unified Audit Activity ── */}
      <section style={{ ...cardStyle, padding: 20 }} aria-labelledby="audit-activity-title">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ marginBottom: 16 }}>
          <div className="flex items-center gap-3 min-w-0">
            <IconBadge icon={FileText} size={44} />
            <div className="min-w-0">
              <h2 id="audit-activity-title" style={{ ...serif, fontSize: '1.2rem', fontWeight: 600, color: INK }}>Audit Activity</h2>
              <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>System activity, administrator actions, and scholar-data access are recorded for security review.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center justify-center gap-2 w-full sm:w-auto transition-opacity hover:opacity-90"
            style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, background: PRIMARY, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        {privacyLogsError && (
          <div role="alert" className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: `${WARNING}12`, border: `1px solid ${WARNING}35`, marginBottom: 12 }}>
            <AlertTriangle size={14} style={{ color: WARNING, flexShrink: 0 }} />
            <span style={{ ...sans, fontSize: '0.78rem', color: INK }}>Sensitive-data access logs unavailable. {privacyLogsError !== 'Sensitive-data access logs unavailable.' ? privacyLogsError : ''}</span>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-3 items-end" style={{ marginBottom: 14 }}>
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity…"
              aria-label="Search activity"
              className="w-full outline-none"
              style={{ ...sans, fontSize: '0.82rem', color: INK, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, height: 40, padding: '0 14px 0 38px' }}
              onFocus={(e) => { e.target.style.border = `1px solid ${PRIMARY}`; e.target.style.boxShadow = `0 0 0 3px ${PRIMARY}1A`; }}
              onBlur={(e) => { e.target.style.border = `1px solid ${BORDER}`; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <FilterSelect label="Activity Type" value={activityType} onChange={setActivityType}>
            {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </FilterSelect>
          <FilterSelect label="Role" value={roleFilter} onChange={setRoleFilter}>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </FilterSelect>
          <FilterSelect label="Action" value={actionFilter} onChange={setActionFilter}>
            <option value="all">All Actions</option>
            {Object.entries(actionConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </FilterSelect>
          <FilterSelect label="Result" value={resultFilter} onChange={setResultFilter}>
            <option value="all">All Results</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="blocked">Blocked</option>
          </FilterSelect>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center" style={{ padding: '2.5rem 1rem', border: `1px dashed ${BORDER}`, borderRadius: 14 }}>
            <Shield size={30} className="mx-auto mb-2" style={{ color: `${BRONZE}70` }} />
            <p style={{ ...sans, fontSize: '0.9rem', fontWeight: 600, color: INK }}>No activity found</p>
            <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 3 }}>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto" style={{ border: `1px solid ${BORDER}`, borderRadius: 14 }}>
              <table className="w-full" style={{ minWidth: 880, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Time', 'User', 'Role', 'Activity', 'Resource', 'Result', 'IP Address'].map((h) => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((entry) => {
                    const ac = actionConfig[entry.action] || { icon: Activity, label: capitalize(entry.action) || 'Activity' };
                    const AIcon = ac.icon;
                    return (
                      <tr key={entry.key}>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{entry.timestampText || '—'}</td>
                        <td style={td}>
                          <p style={{ fontWeight: 600 }}>{entry.userName || 'Unknown User'}</p>
                          <p style={{ fontSize: '0.7rem', color: MUTED }}>{entry.userId || '—'}</p>
                        </td>
                        <td style={td}><RoleBadge role={entry.role} /></td>
                        <td style={td}>
                          <div className="flex items-center gap-2">
                            <AIcon size={16} style={{ color: PRIMARY, flexShrink: 0 }} />
                            <div>
                              <p style={{ fontWeight: 600 }}>{ac.label}</p>
                              <p style={{ fontSize: '0.66rem', color: MUTED }}>{entry.activityType === 'privacy' ? 'Sensitive Data' : 'System'}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, maxWidth: 260 }}>
                          <p className="truncate" title={entry.resource}>{entry.resource || '—'}</p>
                          {(entry.resourceId || entry.details) && (
                            <p className="truncate" title={entry.resourceId || entry.details} style={{ fontSize: '0.7rem', color: MUTED }}>{entry.resourceId || entry.details}</p>
                          )}
                        </td>
                        <td style={td}><StatusPill result={entry.result} /></td>
                        <td style={{ ...td, color: MUTED, whiteSpace: 'nowrap' }}>{entry.ip || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: 14 }}>
              <span style={{ ...sans, fontSize: '0.8rem', color: MUTED }}>
                Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length} event{filtered.length === 1 ? '' : 's'}
              </span>
              <nav className="flex items-center gap-1.5" aria-label="Pagination">
                <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}
                  className="flex items-center gap-1"
                  style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, height: 34, padding: '0 12px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: INK, opacity: currentPage === 1 ? 0.45 : 1, cursor: currentPage === 1 ? 'default' : 'pointer' }}>
                  <ChevronLeft size={14} /> Previous
                </button>
                {pageList(currentPage, totalPages).map((p) => (typeof p === 'string' ? (
                  <span key={p} style={{ ...sans, color: MUTED, padding: '0 4px' }}>…</span>
                ) : (
                  <button key={p} type="button" onClick={() => setPage(p)} aria-current={p === currentPage ? 'page' : undefined}
                    style={{ ...sans, minWidth: 34, height: 34, borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${p === currentPage ? PRIMARY : 'transparent'}`, background: p === currentPage ? PRIMARY : 'transparent', color: p === currentPage ? '#fff' : INK }}>
                    {p}
                  </button>
                )))}
                <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}
                  className="flex items-center gap-1"
                  style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, height: 34, padding: '0 12px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: INK, opacity: currentPage === totalPages ? 0.45 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer' }}>
                  Next <ChevronRight size={14} />
                </button>
              </nav>
            </div>
          </>
        )}

        {/* Sensitive-data logs are loaded in batches; offer the next batch instead of fetching everything */}
        {hasMorePrivacy && activityType !== 'system' && !privacyLogsError && (
          <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
            <span style={{ ...sans, fontSize: '0.76rem', color: MUTED }}>
              {privacyLogs.length} of {privacyLogsTotal} sensitive-data access events loaded.
            </span>
            <button
              type="button"
              onClick={() => setPrivacyLogsPage((p) => p + 1)}
              disabled={privacyLoadingMore}
              className="w-full sm:w-auto"
              style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, minHeight: 36, padding: '7px 14px', borderRadius: 10, border: `1px solid ${PRIMARY}`, background: 'transparent', color: PRIMARY, cursor: privacyLoadingMore ? 'wait' : 'pointer', opacity: privacyLoadingMore ? 0.6 : 1 }}
            >
              {privacyLoadingMore ? 'Loading…' : 'Load more access events'}
            </button>
          </div>
        )}
      </section>
      </div>
    </div>
  );
};

export default SecurityAuditLogs;