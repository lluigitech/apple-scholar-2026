import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ComplianceSummaryTab from '../../components/Admin/Reports/ComplianceSummaryTab';
import MonthlyReportsTab from '../../components/Admin/Reports/MonthlyReportsTab';
import AttendanceReportsTab from '../../components/Admin/Reports/AttendanceReportsTab';
import AdminReportDetail from '../../components/Admin/AdminReportDetail';

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const MAROON = '#802B36';
const MAROON_LIGHT = '#F5E8EA';

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

const downloadCSV = (filename, rows) => {
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const tabItems = [
  { key: 'compliance', label: 'Compliance Summary' },
  { key: 'monthly-reports', label: 'Monthly Reports' },
  { key: 'attendance', label: 'Attendance Reports' },
];

export default function AdminReports() {
  const [activeTab, setActiveTab] = useState('compliance');

  // ── Compliance Summary tab state ──
  const [complianceRows, setComplianceRows] = useState([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState('');
  const [complianceFetched, setComplianceFetched] = useState(false);

  // ── Monthly Reports tab state ──
  const [statusFilter, setStatusFilter] = useState('all');
  const [reports, setReports] = useState([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState('');
  const [monthlyFetched, setMonthlyFetched] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [monthlyFilterMonth, setMonthlyFilterMonth] = useState('');
  const [monthlyFilterYearLevel, setMonthlyFilterYearLevel] = useState('');

  // ── Attendance Reports tab state ──
  const [attendanceData, setAttendanceData] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceFetched, setAttendanceFetched] = useState(false);
  const [attendanceFilters, setAttendanceFilters] = useState({ date_from: '', date_to: '', status: 'all' });

  // ── Fetch Functions ──
  const fetchCompliance = async () => {
    setComplianceLoading(true);
    setComplianceError('');
    try {
      const res = await axios.get(`${API}/admin/reports/compliance-summary`, authHeaders());
      setComplianceRows(res.data || []);
      setComplianceFetched(true);
    } catch (err) {
      console.error(err);
      setComplianceError(
        err.response?.status === 404
          ? 'Missing backend route: /admin/reports/compliance-summary'
          : 'Failed to load compliance summary. Check your connection or login session.'
      );
    } finally {
      setComplianceLoading(false);
    }
  };

  const fetchMonthlyReports = async () => {
    setMonthlyLoading(true);
    setMonthlyError('');
    try {
      const params = {};
      if (monthlyFilterMonth) params.month = monthlyFilterMonth;
      if (monthlyFilterYearLevel) params.year_level = monthlyFilterYearLevel;

      const res = await axios.get(`${API}/admin/reports/monthly-submissions`, {
        ...authHeaders(),
        params,
      });
      setReports(res.data || []);
      setMonthlyFetched(true);
    } catch (err) {
      console.error(err);
      setMonthlyError(
        err.response?.status === 404
          ? 'Missing backend route: /admin/reports/monthly-submissions'
          : 'Failed to load monthly reports. Check your connection or login session.'
      );
    } finally {
      setMonthlyLoading(false);
    }
  };

  const fetchAttendanceReports = async () => {
    setAttendanceLoading(true);
    setAttendanceError('');
    try {
      const params = {};
      if (attendanceFilters.date_from) params.date_from = attendanceFilters.date_from;
      if (attendanceFilters.date_to) params.date_to = attendanceFilters.date_to;
      if (attendanceFilters.status !== 'all') params.status = attendanceFilters.status;

      const res = await axios.get(`${API}/staff/reports/duty-attendance`, {
        ...authHeaders(),
        params,
      });
      setAttendanceData(res.data || []);
      setAttendanceFetched(true);
    } catch (err) {
      console.error(err);
      setAttendanceError(
        err.response?.status === 404
          ? 'Missing backend route: /staff/reports/duty-attendance'
          : 'Failed to load attendance records. Check your connection or login session.'
      );
    } finally {
      setAttendanceLoading(false);
    }
  };

  const exportAttendanceCSV = (data) => {
    const rows = [['Scholar', 'Scholar ID', 'Year Level', 'Duty', 'Date', 'Location', 'Status', 'Method', 'Marked At']];
    data.forEach(a =>
      rows.push([
        a.scholar || '—',
        a.scholar_id || '—',
        a.year_level || '—',
        a.duty || '—',
        a.date || a.marked_at?.split('T')[0] || '—',
        a.location || '—',
        a.status || '—',
        a.method || '—',
        a.marked_at ? new Date(a.marked_at).toLocaleString('en-PH') : '—',
      ])
    );
    downloadCSV(`duty_attendance_${new Date().toISOString().slice(0, 10)}.csv`, rows);

    // Log audit event
    axios.post(
      `${API}/export`,
      {
        log_only: true,
        module: 'Attendance Report',
        report_resource: 'Staff Attendance',
        spreadsheet_title: 'Staff Attendance Export',
        details: `Exported ${data.length} attendance records`,
      },
      authHeaders()
    ).catch(err => console.warn('Audit log failed:', err));
  };

  // ── useEffect hooks ──
  useEffect(() => {
    if (activeTab === 'compliance' && !complianceFetched) {
      fetchCompliance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'monthly-reports') {
      fetchMonthlyReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, monthlyFilterMonth, monthlyFilterYearLevel]);

  useEffect(() => {
    if (activeTab === 'attendance' && !attendanceFetched) {
      fetchAttendanceReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Computed values ──
  const filteredMonthly = useMemo(
    () =>
      statusFilter === 'all' ? reports : reports.filter(report => report.status === statusFilter),
    [reports, statusFilter]
  );

  const monthlyCounts = useMemo(
    () => ({
      all: reports.length,
      accepted: reports.filter(r => r.status === 'accepted').length,
      'medium-risk': reports.filter(r => r.status === 'medium-risk').length,
      'high-risk': reports.filter(r => r.status === 'high-risk').length,
    }),
    [reports]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                Admin Reports
              </p>
              <h1 className="text-3xl font-black text-slate-900">Dashboard & Analytics</h1>
              <p className="max-w-2xl text-sm text-slate-500">
                Monitor scholar compliance, review monthly submissions, and track staff attendance
                from the admin dashboard.
              </p>
            </div>
            <div className="rounded-3xl bg-[#7f2d3a]/10 px-4 py-3 inline-flex items-center gap-3 text-sm font-semibold text-[#7f2d3a]">
              <span className="inline-flex h-3 w-3 rounded-full bg-[#7f2d3a]" /> Live backend data
            </div>
          </div>
        </header>

        {/* Tab Section */}
        <section className="rounded-[2rem] bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap gap-2 bg-slate-100 p-4 sm:p-5">
            {tabItems.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === 'attendance' && !attendanceFetched) {
                    fetchAttendanceReports();
                  }
                }}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? 'bg-white text-[#7f2d3a] shadow-sm'
                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {tab.key === 'monthly-reports' && monthlyFetched && (
                  <span className="ml-2 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#fef2f2] px-2 text-[0.65rem] font-bold text-red-600">
                    {monthlyCounts.all}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'compliance' && (
              <ComplianceSummaryTab
                rows={complianceRows}
                loading={complianceLoading}
                error={complianceError}
                onRefresh={fetchCompliance}
              />
            )}

            {activeTab === 'monthly-reports' && (
              <MonthlyReportsTab
                filteredReports={filteredMonthly}
                loading={monthlyLoading}
                error={monthlyError}
                counts={monthlyCounts}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                month={monthlyFilterMonth}
                setMonth={setMonthlyFilterMonth}
                yearLevel={monthlyFilterYearLevel}
                setYearLevel={setMonthlyFilterYearLevel}
                onRefresh={fetchMonthlyReports}
                onSelectReport={setSelectedReport}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceReportsTab
                data={attendanceData}
                loading={attendanceLoading}
                error={attendanceError}
                filters={attendanceFilters}
                setFilters={setAttendanceFilters}
                onFetch={fetchAttendanceReports}
                onExport={exportAttendanceCSV}
              />
            )}
          </div>
        </section>

        {/* Report Detail Modal */}
        {selectedReport && (
          <AdminReportDetail
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </div>
    </div>
  );
}
