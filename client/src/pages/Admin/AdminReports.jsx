import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ComplianceSummaryTab from '../../components/Admin/Reports/ComplianceSummaryTab';
import MonthlyReportsTab from '../../components/Admin/Reports/MonthlyReportsTab';
import AttendanceReportsTab from '../../components/Admin/Reports/AttendanceReportsTab';
import AdminReportDetail from '../../components/Admin/AdminReportDetail';
import { buildSummaryRows, currentPeriodLabel, downloadReportSummaryPdf } from '../../utils/reportPdfExport';

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
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
  { key: 'donor', label: 'Donor Impact Report' },
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
  const [donorRows, setDonorRows] = useState([]);
  const [donorLoading, setDonorLoading] = useState(false);
  const [donorError, setDonorError] = useState('');
  const [donorFetched, setDonorFetched] = useState(false);
  const [donorFilters, setDonorFilters] = useState({ date_from: '', date_to: '' });

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

  const fetchDonorReport = async () => {
    setDonorLoading(true);
    setDonorError('');
    try {
      const params = { type: 'donor' };
      if (donorFilters.date_from) params.date_from = donorFilters.date_from;
      if (donorFilters.date_to) params.date_to = donorFilters.date_to;
      const res = await axios.get(`${API}/export/preview`, { ...authHeaders(), params });
      setDonorRows(res.data?.data || []);
      setDonorFetched(true);
    } catch (err) {
      console.error(err);
      setDonorError('Failed to load donor impact data. Check your connection or login session.');
    } finally {
      setDonorLoading(false);
    }
  };

  const downloadDonorReport = async (format) => {
    try {
      const params = { type: 'donor' };
      if (donorFilters.date_from) params.date_from = donorFilters.date_from;
      if (donorFilters.date_to) params.date_to = donorFilters.date_to;
      const response = await axios.get(`${API}/export/${format}`, { ...authHeaders(), params, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `donor_impact_report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setDonorError(`Failed to export donor report as ${format.toUpperCase()}.`);
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

  const exportAdminPdf = async () => {
    try {
      const sourceRows = activeTab === 'attendance' ? attendanceData : complianceRows;
      const rows = buildSummaryRows(sourceRows, activeTab === 'attendance'
        ? row => row.status === 'present'
        : row => Number(row.completionRate) >= 100);
      await downloadReportSummaryPdf({
        role: 'admin',
        reportTitle: activeTab === 'attendance' ? 'Attendance Reports' : 'Compliance Summary',
        periodLabel: currentPeriodLabel(),
        rows,
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to generate the PDF report.');
    }
  };

  // ── useEffect hooks ──
  useEffect(() => {
    const initialize = async () => {
      if (activeTab === 'compliance' && !complianceFetched) await fetchCompliance();
    };
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const initialize = async () => {
      if (activeTab === 'donor' && !donorFetched) await fetchDonorReport();
    };
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const initialize = async () => {
      if (activeTab === 'monthly-reports') await fetchMonthlyReports();
    };
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, monthlyFilterMonth, monthlyFilterYearLevel]);

  useEffect(() => {
    const initialize = async () => {
      if (activeTab === 'attendance' && !attendanceFetched) await fetchAttendanceReports();
    };
    initialize();
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
                  if (tab.key === 'donor' && !donorFetched) fetchDonorReport();
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
                onGenerate={exportAdminPdf}
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
                onExportPdf={exportAdminPdf}
              />
            )}

            {activeTab === 'donor' && (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Donor Impact Report</h2>
                    <p className="mt-1 text-sm text-slate-500">Scholar progress, verified requirements, service participation, and documented impact.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => downloadDonorReport('excel')} className="rounded-xl bg-[#7f2d3a] px-4 py-2 text-sm font-semibold text-white">Export Excel</button>
                    <button type="button" onClick={() => downloadDonorReport('pdf')} className="rounded-xl border border-[#7f2d3a] px-4 py-2 text-sm font-semibold text-[#7f2d3a]">Export PDF</button>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4">
                  <label className="text-xs font-semibold text-slate-600">From<input type="date" value={donorFilters.date_from} onChange={e => setDonorFilters(current => ({ ...current, date_from: e.target.value }))} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-600">To<input type="date" value={donorFilters.date_to} onChange={e => setDonorFilters(current => ({ ...current, date_to: e.target.value }))} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                  <button type="button" onClick={fetchDonorReport} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">Apply Filters</button>
                </div>
                {donorError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{donorError}</p>}
                {donorLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading donor impact data...</p> : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                      <th className="p-3">Scholar</th><th className="p-3">Course</th><th className="p-3">Year</th><th className="p-3">GPA/GWA</th><th className="p-3">Reports</th><th className="p-3">Verified</th><th className="p-3">Requirements</th><th className="p-3">Duty Hours</th><th className="p-3">Activities</th><th className="p-3">Photos</th>
                    </tr></thead><tbody>{!donorRows.length && <tr><td colSpan="10" className="p-8 text-center text-slate-500">No donor report records found.</td></tr>}{donorRows.map(row => <tr key={`${row.scholar_id || row.scholar}-${row.year_level}`} className="border-t border-slate-100"><td className="p-3 font-semibold">{row.scholar || '—'}</td><td className="p-3">{row.course || '—'}</td><td className="p-3">{row.year_level || '—'}</td><td className="p-3">{row.gpa ?? '—'}</td><td className="p-3">{row.reports_submitted ?? 0}</td><td className="p-3">{row.reports_verified ?? 0}</td><td className="p-3">{row.requirements_verified ?? 0}/{row.requirements_submitted ?? 0}</td><td className="p-3">{row.total_duty_hours ?? 0}</td><td className="p-3">{row.activities_attended ?? 0}</td><td className="p-3">{row.activities_with_photos ?? 0}</td></tr>)}</tbody></table>
                  </div>
                )}
              </div>
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
