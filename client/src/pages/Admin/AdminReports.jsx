import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ComplianceSummaryTab from '../../components/Admin/Reports/ComplianceSummaryTab';
import MonthlyReportsTab from '../../components/Admin/Reports/MonthlyReportsTab';
import AttendanceReportsTab from '../../components/Admin/Reports/AttendanceReportsTab';
import AdminReportDetail from '../../components/Admin/Reports/AdminReportDetail';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';
import { formatAdminDateTime } from '../../utils/adminPreferences';
import { buildSummaryRows, currentPeriodLabel, monthPeriodLabel, downloadReportSummaryPdf } from '../../utils/reportPdfExport';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

// ── Design tokens — "Apple Scholar Executive" system ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E5D8CA';
const PRIMARY = '#6D2140';
const BRONZE = '#A9784E';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER = '#A24A4A';
const RADIUS = 16;

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const surfaceCard = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  boxShadow: '0 1px 2px rgba(36,21,18,0.04)',
};

const normalizeReportStatus = (status) => status === 'approved' ? 'accepted' : status;

// eslint-disable-next-line no-unused-vars
const dateFieldStyle = {
  ...body,
  fontSize: '0.88rem',
  color: INK,
  background: BG,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  outline: 'none',
  padding: '10px 12px',
  width: '100%',
};

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

// ── Icons (inline, stroke-based) ──
const svgBase = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' };
const Icon = {
  Shield: (p) => (<svg width="18" height="18" {...svgBase} {...p}><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" /></svg>),
  Users: (p) => (
    <svg width="18" height="18" {...svgBase} {...p}>
      <circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16.5 4.3c1.6.4 2.8 1.9 2.8 3.6 0 1.7-1.2 3.2-2.8 3.6M21.5 20c0-3-2-5.3-4.8-5.9" />
    </svg>
  ),
  Check: (p) => (<svg width="18" height="18" {...svgBase} {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></svg>),
  Clock: (p) => (<svg width="18" height="18" {...svgBase} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>),
  Alert: (p) => (<svg width="18" height="18" {...svgBase} {...p}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18h.01" /></svg>),
  Chevron: (p) => (<svg width="16" height="16" {...svgBase} strokeWidth="2" {...p}><path d="M9 5l7 7-7 7" /></svg>),
  FileText: (p) => (
    <svg width="18" height="18" {...svgBase} {...p}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h6M9 9h2" />
    </svg>
  ),
  Crest: (p) => (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" {...p}>
      <path d="M17 2l12 5v9c0 8-6 13.5-12 16-6-2.5-12-8-12-16V7l12-5z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M17 9l3.5 7H13.5L17 9z" fill="currentColor" opacity="0.85" />
    </svg>
  ),
};

const tabItems = [
  { key: 'monthly-reports', label: 'Compliance Reports', sub: 'All requirements and document submissions', icon: Icon.FileText },
  { key: 'compliance', label: 'Compliance Summary', sub: 'Review scholar compliance status', icon: Icon.Shield },
  { key: 'attendance', label: 'Attendance Reports', sub: 'Attendance and participation records', icon: Icon.Users },
];

// ---------------------------------------------------------------------------
// Presentational pieces (UI-only — no data logic lives here)
// ---------------------------------------------------------------------------

const KPICard = ({ icon: IconEl, label, value, helper, accent }) => (
  <div style={{ ...surfaceCard, padding: '0.9rem 1.15rem', display: 'flex', alignItems: 'center', gap: 14 }}>
    <div
      style={{
        width: 44, height: 44, flexShrink: 0, borderRadius: '50%', background: `${accent}1f`, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <IconEl width={20} height={20} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }}>{label}</div>
      <div style={{ ...display, fontSize: '1.7rem', color: PRIMARY, lineHeight: 1.15, fontWeight: 600 }}>{value}</div>
      {helper && (
        <div style={{ ...body, fontSize: '0.78rem', color: MUTED, display: 'flex', alignItems: 'center', gap: 6 }}>
          {helper.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />}
          {helper.text}
        </div>
      )}
    </div>
  </div>
);

const KPISkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} style={{ ...surfaceCard, padding: '1.1rem 1.35rem', display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#EFE3D4' }} />
        <div>
          <div style={{ height: 10, width: 90, borderRadius: 8, background: '#EFE3D4' }} />
          <div style={{ height: 24, width: 56, borderRadius: 8, background: '#EFE3D4', marginTop: 8 }} />
        </div>
      </div>
    ))}
  </div>
);

const ModuleSelector = ({ activeTab, onSelect }) => (
  <div className="grid gap-3 md:grid-cols-3">
    {tabItems.map((tab) => {
      const active = tab.key === activeTab;
      const TabIcon = tab.icon;
      return (
        <button
          key={tab.key}
          type="button"
          onClick={() => onSelect(tab.key)}
          aria-pressed={active}
          style={{
            ...surfaceCard,
            textAlign: 'left',
            padding: '0.95rem 1.1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: active ? PRIMARY : SURFACE,
            border: `1px solid ${active ? PRIMARY : BORDER}`,
            transition: 'background 0.15s ease, border-color 0.15s ease',
          }}
        >
          <div
            style={{
              width: 46, height: 46, flexShrink: 0, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? 'rgba(255,255,255,0.16)' : `${PRIMARY}0f`,
              color: active ? '#fff' : PRIMARY,
            }}
          >
            <TabIcon width={22} height={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: active ? '#fff' : INK }}>{tab.label}</div>
            <div style={{ ...body, fontSize: '0.78rem', color: active ? '#EBD9E0' : MUTED, marginTop: 3 }}>{tab.sub}</div>
          </div>
          <div
            style={{
              width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? '#fff' : `${PRIMARY}0f`,
              color: PRIMARY,
            }}
          >
            <Icon.Chevron />
          </div>
        </button>
      );
    })}
  </div>
);

export default function AdminReports() {
  const [activeTab, setActiveTab] = useState('monthly-reports');

  const [complianceRows, setComplianceRows] = useState([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState('');
  const [complianceFetched, setComplianceFetched] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [reports, setReports] = useState([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [monthlyFilterMonth, setMonthlyFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyFilterYearLevel, setMonthlyFilterYearLevel] = useState('');

  const [attendanceData, setAttendanceData] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceFetched, setAttendanceFetched] = useState(false);
  const [attendanceFilters, setAttendanceFilters] = useState({
    month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    status: 'all',
  });

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
    } catch (err) {
      console.error(err);
      setMonthlyError(
        err.response?.status === 404
          ? 'Missing backend route: /admin/reports/monthly-submissions'
          : 'Failed to load compliance reports. Check your connection or login session.'
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
      if (attendanceFilters.month) params.month = attendanceFilters.month;
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
    const rows = [['Scholar', 'Scholar ID', 'Group', 'Assigned Staff', 'Duty', 'Date', 'Location', 'Status', 'Method', 'Marked At']];
    data.forEach(a =>
      rows.push([
        a.scholar || '—',
        a.scholar_id || '—',
        a.group_name || 'Unassigned',
        a.assigned_staff || 'Unassigned',
        a.duty || '—',
        a.date || a.marked_at?.split('T')[0] || '—',
        a.location || '—',
        a.status || '—',
        a.method || '—',
        a.marked_at ? formatAdminDateTime(a.marked_at) : '—',
      ])
    );
    downloadCSV(`duty_attendance_${new Date().toISOString().slice(0, 10)}.csv`, rows);

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

  const exportAdminPdf = async (displayedRows) => {
    try {
      const sourceRows = activeTab === 'attendance' ? (displayedRows || attendanceData) : complianceRows;
      const rows = activeTab === 'attendance'
        ? sourceRows.map(row => ({
          scholarName: row.scholar,
          studentId: row.scholar_id,
          groupName: row.group_name,
          assignedStaff: row.assigned_staff,
          duty: row.duty,
          attendanceDate: row.date || row.duty_date,
          attendanceTime: row.marked_at,
          attendanceStatus: row.status,
        }))
        : buildSummaryRows(sourceRows, row => Number(row.completionRate) >= 100);
      await downloadReportSummaryPdf({
        role: 'admin',
        reportTitle: activeTab === 'attendance' ? 'Attendance Reports' : 'Compliance Summary',
        reportType: activeTab === 'attendance' ? 'Attendance Reports' : 'Compliance Summary',
        periodLabel: activeTab === 'attendance' ? monthPeriodLabel(attendanceFilters.month) : currentPeriodLabel(),
        rows,
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to generate the PDF report.');
    }
  };

  useEffect(() => {
    if ((activeTab === 'compliance' || activeTab === 'monthly-reports') && !complianceFetched) fetchCompliance();
  }, [activeTab, complianceFetched]);

  useEffect(() => {
    if (activeTab === 'monthly-reports') fetchMonthlyReports();
  }, [activeTab, monthlyFilterMonth, monthlyFilterYearLevel]);

  useEffect(() => {
    if (activeTab === 'attendance' && !attendanceFetched) fetchAttendanceReports();
  }, [activeTab, attendanceFetched]);

  useEffect(() => {
    const applyRefreshedReports = (event) => {
      const refreshed = event.detail || {};
      if (Array.isArray(refreshed.compliance)) {
        setComplianceRows(refreshed.compliance);
        setComplianceFetched(true);
        setComplianceError('');
      }
      if (Array.isArray(refreshed.submissions)) {
        setReports(refreshed.submissions);
        setMonthlyError('');
      }
    };
    window.addEventListener('admin-refresh-reports', applyRefreshedReports);
    return () => window.removeEventListener('admin-refresh-reports', applyRefreshedReports);
  }, []);

  const filteredMonthly = useMemo(
    () => (statusFilter === 'all' ? reports : reports.filter(report => normalizeReportStatus(report.status) === statusFilter)),
    [reports, statusFilter]
  );

  const monthlyCounts = useMemo(() => {
    const counts = { all: reports.length, accepted: 0, 'medium-risk': 0, 'high-risk': 0 };
    reports.forEach(report => {
      const status = normalizeReportStatus(report.status);
      if (status && counts[status] !== undefined) counts[status] += 1;
    });
    return counts;
  }, [reports]);

  // ---- Presentation-only derived values ----

  const anyLoading = complianceLoading || monthlyLoading || attendanceLoading;
  const pct = (n, total) => (total > 0 ? `${Math.round((n / total) * 100)}% of total` : '0% of total');

  const kpis = useMemo(() => {
    if (activeTab === 'monthly-reports') {
      const total = reports.length;

      // Scholars who submitted in the selected month (a scholar may have more than one record).
      const submittedKeys = new Set(
        reports.map(r => r.userId || r.user_id || r.scholar_id || r.studentId || r.scholarName).filter(Boolean)
      );

      // Registry = every scholar from the compliance summary, narrowed by year level when the rows carry one.
      let registry = complianceRows;
      let registryKnown = complianceFetched;
      if (monthlyFilterYearLevel) {
        const hasYear = complianceRows.some(row => row.year || row.yearLevel || row.year_level);
        if (hasYear) {
          registry = complianceRows.filter(
            row => formatYearLevelLabel(row.year || row.yearLevel || row.year_level) === formatYearLevelLabel(monthlyFilterYearLevel)
          );
        } else {
          registryKnown = false;
        }
      }

      // "Not submitted" only makes sense for one specific month.
      const canCompute = registryKnown && Boolean(monthlyFilterMonth);
      const notSubmitted = canCompute ? Math.max(0, registry.length - submittedKeys.size) : null;
      const rate = canCompute && registry.length > 0
        ? Math.min(100, Math.round((submittedKeys.size / registry.length) * 100))
        : null;
      const hint = !monthlyFilterMonth ? 'Select a month' : 'Loading scholar list…';

      return [
        { key: 'total', icon: Icon.FileText, label: 'Total Submissions', value: total, helper: { text: 'Across all requirements' }, accent: PRIMARY },
        { key: 'approved', icon: Icon.Check, label: 'Accepted', value: monthlyCounts.accepted, helper: { text: pct(monthlyCounts.accepted, total), dot: true }, accent: SUCCESS },
        {
          key: 'not-submitted', icon: Icon.Alert, label: 'Not Submitted',
          value: notSubmitted ?? '—',
          helper: { text: canCompute ? 'Scholars with no submission' : hint, dot: canCompute },
          accent: DANGER,
        },
        {
          key: 'rate', icon: Icon.Users, label: 'Submission Rate',
          value: rate === null ? '—' : `${rate}%`,
          helper: { text: canCompute ? `${submittedKeys.size} of ${registry.length} scholars` : hint },
          accent: WARNING,
        },
      ];
    }

    if (activeTab === 'compliance') {
      const riskCounts = complianceRows.reduce((counts, row) => {
        const risk = row.riskStatus || 'low';
        counts[risk] = (counts[risk] || 0) + 1;
        return counts;
      }, { low: 0, medium: 0, high: 0 });
      const total = complianceRows.length;
      return [
        { key: 'scholars', icon: Icon.Users, label: 'Total Scholars', value: total, helper: { text: 'Compliance registry' }, accent: PRIMARY },
        { key: 'low', icon: Icon.Check, label: 'Low Risk', value: riskCounts.low, helper: { text: pct(riskCounts.low, total), dot: true }, accent: SUCCESS },
        { key: 'medium', icon: Icon.Clock, label: 'Medium Risk', value: riskCounts.medium, helper: { text: pct(riskCounts.medium, total), dot: true }, accent: WARNING },
        { key: 'high', icon: Icon.Alert, label: 'High Risk', value: riskCounts.high, helper: { text: pct(riskCounts.high, total), dot: true }, accent: DANGER },
      ];
    }

    const attendanceCounts = attendanceData.reduce((counts, record) => {
      const status = record.status || 'excused';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, { present: 0, absent: 0, excused: 0 });
    const total = attendanceData.length;
    return [
      { key: 'records', icon: Icon.Users, label: 'Attendance Records', value: total, helper: { text: 'For selected month' }, accent: PRIMARY },
      { key: 'present', icon: Icon.Check, label: 'Present', value: attendanceCounts.present, helper: { text: pct(attendanceCounts.present, total), dot: true }, accent: SUCCESS },
      { key: 'absent', icon: Icon.Alert, label: 'Absent', value: attendanceCounts.absent, helper: { text: pct(attendanceCounts.absent, total), dot: true }, accent: DANGER },
      { key: 'excused', icon: Icon.Clock, label: 'Excused', value: attendanceCounts.excused, helper: { text: pct(attendanceCounts.excused, total), dot: true }, accent: WARNING },
    ];
  }, [activeTab, reports, monthlyCounts, complianceRows, complianceFetched, monthlyFilterMonth, monthlyFilterYearLevel, attendanceData]);

  return (
    <div className="min-h-screen w-full" style={{ background: BG, color: INK }}>
      <div className="w-full px-4 sm:px-6 lg:px-8">

        <AdminPageHeader
          title="System Reports"
          description="Review scholar compliance submissions, compliance status, and attendance records in one place."
          className="mb-6"
        />

        {/* ── 2. Module switcher ── */}
        <div className="mb-4">
          <ModuleSelector activeTab={activeTab} onSelect={setActiveTab} />
        </div>

        {/* ── 3. Lightweight status counters ── */}
        {anyLoading && reports.length === 0 && attendanceData.length === 0 && complianceRows.length === 0 ? (
          <KPISkeleton />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
            {kpis.map((kpi) => (
              <KPICard key={kpi.key} icon={kpi.icon} label={kpi.label} value={kpi.value} helper={kpi.helper} accent={kpi.accent} />
            ))}
          </div>
        )}

        {/* ── 4. Active module content (filters + table live in the tab components) ── */}
        <div style={{ marginBottom: 24 }}>
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
        </div>

        {/* Footer branding */}
        <div className="flex items-center gap-4 justify-center mt-9 mb-4">
          <span style={{ flex: 1, height: 1, background: BORDER, maxWidth: 240 }} />
          <div className="flex items-center gap-2.5 flex-shrink-0" style={{ color: BRONZE }}>
            <Icon.Crest style={{ width: 24, height: 24 }} />
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ ...display, fontSize: '0.88rem', fontWeight: 700, color: INK }}>Apple Scholar Foundation</div>
              <div style={{ ...body, fontSize: '0.7rem', color: MUTED }}>Empowering scholars. Building futures.</div>
            </div>
          </div>
          <span style={{ flex: 1, height: 1, background: BORDER, maxWidth: 240 }} />
        </div>
      </div>

      {selectedReport && (
        <AdminReportDetail report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </div>
  );
}