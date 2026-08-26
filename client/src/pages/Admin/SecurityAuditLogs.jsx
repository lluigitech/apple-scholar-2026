import { useEffect, useState } from 'react';
import axios from 'axios';
import { Shield, Download, Search, Eye, Lock, FileText, Users, LogIn, LogOut, CheckCircle, XCircle, Upload } from 'lucide-react';

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const actionConfig = {
  login:   { icon: LogIn,       color: '#1d4ed8', bg: '#eff6ff', label: 'Login'   },
  logout:  { icon: LogOut,      color: '#6b7280', bg: '#f9fafb', label: 'Logout'  },
  view:    { icon: Eye,         color: '#6b7280', bg: '#f9fafb', label: 'View'    },
  submit:  { icon: Upload,      color: '#7c3aed', bg: '#f5f3ff', label: 'Submit'  },
  approve: { icon: CheckCircle, color: '#15803d', bg: '#dcfce7', label: 'Approve' },
  reject:  { icon: XCircle,     color: '#991b1b', bg: '#fee2e2', label: 'Return'  },
  edit:    { icon: FileText,    color: '#854d0e', bg: '#fef9c3', label: 'Edit'    },
  delete:  { icon: XCircle,     color: '#991b1b', bg: '#fee2e2', label: 'Delete'  },
  export:  { icon: Download,    color: '#0369a1', bg: '#e0f2fe', label: 'Export'  },
};

const resultConfig = {
  success: { color: '#15803d', bg: '#dcfce7', label: 'Success' },
  failed:  { color: '#991b1b', bg: '#fee2e2', label: 'Failed'  },
  blocked: { color: '#7c2d12', bg: '#ffedd5', label: 'Blocked' },
  default: { color: '#6b7280', bg: '#f3f4f6', label: 'Unknown' },
};

const roleColors = {
  staff:   '#1d4ed8',
  officer: '#f59e0b',
  admin:   '#7c3aed',
};

const capitalize = (value) => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const formatPhilippineTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
};

const SecurityAuditLogs = () => {
  const [auditData, setAuditData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');

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

  const filtered = auditData.filter(entry => {
    const searchMatch = search === '' || [entry.userName, entry.userId, entry.resource, entry.details].some(f => (f || '').toLowerCase().includes(search.toLowerCase()));
    const roleMatch = roleFilter === 'all' || entry.role === roleFilter;
    const actionMatch = actionFilter === 'all' || entry.action === actionFilter;
    const resultMatch = resultFilter === 'all' || entry.result === resultFilter;
    return searchMatch && roleMatch && actionMatch && resultMatch;
  });

  const exportCSV = () => {
    const rows = [['Timestamp', 'User ID', 'User', 'Role', 'Action', 'Resource', 'Details', 'IP', 'Result']];
    filtered.forEach(e => rows.push([e.timestampText || e.timestamp, e.userId || '', e.userName, e.role, e.action, e.resource, e.details, e.ip, e.result]));
    const csv = rows.map(r => r.map(f => `"${f}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    axios.post(`${API}/export/google-sheets`, { log_only: true, module: 'Audit Log', report_resource: 'Audit Trail', spreadsheet_title: `Audit Log Export ${new Date().toISOString().slice(0,10)}`, details: `audit_log_${new Date().toISOString().slice(0, 10)}.csv` }, getAuthHeaders()).catch(() => {});
  };

  const failures = auditData.filter(e => e.result !== 'success').length;
  const successCount = auditData.filter(e => e.result === 'success').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', fontWeight: 700, color: '#1a1a1a' }}>
            Audit Log
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', color: '#6b7280' }}>
            System activity trail — data privacy & compliance record
          </p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
          <Download className="w-4 h-4" /> Export Audit Log
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <Shield className="w-8 h-8" style={{ color: '#802B36' }} />
          <div>
            <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>Total Entries</p>
            <p className="text-xl font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>{loading ? '…' : auditData.length}</p>
          </div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 shadow-sm p-4 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-green-600" />
          <div>
            <p className="text-xs text-green-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>Successful</p>
            <p className="text-xl font-bold text-green-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>{successCount}</p>
          </div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 shadow-sm p-4 flex items-center gap-3">
          <XCircle className="w-8 h-8 text-red-600" />
          <div>
            <p className="text-xs text-red-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>Failed/Blocked</p>
            <p className="text-xl font-bold text-red-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>{failures}</p>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 shadow-sm p-4 flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <p className="text-xs text-blue-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>Active Users</p>
            <p className="text-xl font-bold text-blue-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {new Set(auditData.filter(e => e.userId !== 'UNKNOWN').map(e => e.userId)).size}
            </p>
          </div>
        </div>
      </div>

      {/* Data Privacy Note */}
      <div className="flex items-start gap-2 p-3 rounded-lg mb-5 border" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
        <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
        <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1e40af' }}>
          This audit log is maintained in compliance with the Data Privacy Act of 2012 (Republic Act 10173). All personal data access is logged and retained for 3 years. Unauthorized access attempts are automatically flagged and blocked.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, ID, resource..."
              className="w-full text-sm pl-9 pr-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-400"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none"
            style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
            <option value="all">All Roles</option>
            <option value="staff">Staff</option>
            <option value="officer">Officer</option>
            <option value="admin">Admin</option>
          </select>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none"
            style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
            <option value="all">All Actions</option>
            {Object.entries(actionConfig).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select value={resultFilter} onChange={e => setResultFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none"
            style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>
            <option value="all">All Results</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        <p className="text-xs mt-2" style={{ fontFamily: "'DM Sans', sans-serif", color: '#9ca3af' }}>
          Showing {filtered.length} of {auditData.length} entries
        </p>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                {['Timestamp', 'User', 'Role', 'Action', 'Resource', 'Details', 'Result'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const ac = actionConfig[entry.action] || actionConfig.view;
                const rc = resultConfig[entry.result] || resultConfig.default;
                const AIcon = ac.icon;
                return (
                  <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>{entry.timestampText}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>{entry.userName}</p>
                      <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#9ca3af' }}>{entry.ip}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: roleColors[entry.role] || '#6b7280', fontFamily: "'DM Sans', sans-serif" }}>
                        {capitalize(entry.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit" style={{ backgroundColor: ac.bg, color: ac.color, fontFamily: "'DM Sans', sans-serif" }}>
                        <AIcon className="w-3 h-3" /> {ac.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[150px] truncate" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }} title={entry.resource}>{entry.resource}</td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }} title={entry.details}>{entry.details}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: rc.bg, color: rc.color, fontFamily: "'DM Sans', sans-serif" }}>
                        {rc.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {filtered.map((entry) => {
            const ac = actionConfig[entry.action] || actionConfig.view;
            const rc = resultConfig[entry.result] || resultConfig.default;
            const AIcon = ac.icon;
            return (
              <div key={entry.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>{entry.userName}</p>
                    <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#9ca3af' }}>{entry.timestampText}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: rc.bg, color: rc.color, fontFamily: "'DM Sans', sans-serif" }}>{rc.label}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: roleColors[entry.role], fontFamily: "'DM Sans', sans-serif" }}>{entry.role}</span>
                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: ac.bg, color: ac.color, fontFamily: "'DM Sans', sans-serif" }}>
                    <AIcon className="w-3 h-3" /> {ac.label}
                  </span>
                </div>
                <p className="text-xs font-medium mb-0.5" style={{ fontFamily: "'DM Sans', sans-serif", color: '#374151' }}>{entry.resource}</p>
                <p className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>{entry.details}</p>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-10">
            <Shield className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#6b7280' }}>No entries match the current filter</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityAuditLogs;