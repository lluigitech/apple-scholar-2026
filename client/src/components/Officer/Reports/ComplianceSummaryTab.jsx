import { Download, FileSpreadsheet, RefreshCw, Users, AlertCircle, Loader2, ClipboardList, CheckCircle2, Clock, XCircle, ShieldCheck, UserCheck } from "lucide-react";
import { MAROON } from "./ReportsHelpers";

// ── Design tokens — shared Apple Scholar brand system (unchanged) ──
const MAROON_DEEP = '#4f1620';
const BG = '#F6EFE4';
const CARD = '#fffdf8';
const RULE = '#e8dccb';
const INK = '#241512';
const MUTED = '#a89890';
const SAGE = '#6b8f71';
const AMBER = '#b8863f';
const CLAY = '#c1666b';

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

// Shared bento tile — same values as OfficerReports so every card matches.
const tile = {
  background: CARD,
  border: `1px solid ${RULE}`,
  borderRadius: 14,
  boxShadow: '0 8px 20px -16px rgba(36,21,18,0.35)',
};

const fieldLabel = { ...body, fontSize: '0.74rem', fontWeight: 500, color: '#7a6a62', display: 'block', marginBottom: 6 };
const boxField = {
  width: '100%', height: 42, padding: '0 12px',
  border: `1px solid ${RULE}`, borderRadius: 8, background: CARD,
  ...body, fontSize: '0.86rem', color: INK, outline: 'none',
};
const outlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px', border: `1px solid ${RULE}`, borderRadius: 8, background: CARD, color: MAROON_DEEP, ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' };
const filledBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, padding: '0 20px', border: 'none', borderRadius: 8, background: MAROON_DEEP, color: '#fffdf8', ...body, fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' };

export default function ComplianceSummaryTab({
  rows, loading, error,
  genOptions, setGenOptions, genLoading, genError, onGenerate,
  onRefresh, onExportExcel, scholars = [],
  assignedYearLevels = [],
}) {
  const isTaskCompletion = genOptions.report_type === "Task Completion";
  const isMonthlyReports = genOptions.report_type === "Monthly Letter";
  const totalScholars = rows.length;
  const submittedScholars = rows.filter(row => (isTaskCompletion ? row.completedTasks > 0 : row.submitted > 0)).length;
  const compliantScholars = rows.filter(row => (isTaskCompletion ? row.completionRate === 100 : isMonthlyReports ? row.approved > 0 && row.pending === 0 : row.submitted > 0)).length;
  const pendingScholars = Math.max(0, totalScholars - submittedScholars);
  const formatMonth = value => value
    ? new Date(`${value}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";
  const periodLabel = formatMonth(genOptions.period) || "Select a month or period";

  // Same figures as before — only the presentation changed (icons added).
  const tally = isTaskCompletion ? [
    { label: 'assigned tasks', value: rows.reduce((sum, row) => sum + row.assignedTasks, 0), color: INK, Icon: ClipboardList },
    { label: 'completed', value: rows.reduce((sum, row) => sum + row.completedTasks, 0), color: SAGE, Icon: CheckCircle2 },
    { label: 'missing', value: rows.reduce((sum, row) => sum + row.missingTasks, 0), color: CLAY, Icon: XCircle },
    { label: 'pending', value: rows.reduce((sum, row) => sum + row.pendingTasks, 0), color: AMBER, Icon: Clock },
  ] : [
    { label: 'scholars', value: totalScholars, color: INK, Icon: Users },
    { label: 'submitted', value: `${submittedScholars}/${totalScholars}`, color: SAGE, Icon: UserCheck },
    { label: 'not submitted', value: pendingScholars, color: AMBER, Icon: Clock },
    { label: isMonthlyReports ? 'compliant' : 'has submission', value: compliantScholars, color: MAROON, Icon: ShieldCheck },
  ];

  return (
    <div className="flex flex-col gap-4" style={{ minWidth: 0 }}>

      {/* ── Tile 1: KPI row (figures already computed from the loaded rows) ── */}
      {!loading && !error && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tally.map(({ label, value, color, Icon }) => (
            <div key={label} className="flex items-center gap-4" style={{ ...tile, padding: '16px 20px', minWidth: 0 }}>
              <span className="inline-flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 48, height: 48, background: `${color}1a` }}>
                <Icon size={22} strokeWidth={1.75} style={{ color }} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ ...display, fontSize: '1.6rem', fontWeight: 600, color: INK, lineHeight: 1.1 }}>{value}</p>
                <p style={{ ...body, fontSize: '0.82rem', color: '#7a6a62', marginTop: 3, textTransform: 'capitalize' }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tile 2: Report controls ── */}
      <div style={{ ...tile, padding: '16px 20px' }}>
        <div className="flex flex-wrap items-end gap-4">
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <label style={fieldLabel}>Submission Type</label>
            <select
              value={genOptions.report_type}
              onChange={e => setGenOptions(o => ({ ...o, report_type: e.target.value }))}
              className="w-full outline-none transition-colors"
              style={{ ...boxField, cursor: 'pointer' }}
            >
              {["Monthly Letter", "Report Cards", "Grades", "Report Cards & Grades", "COR", "Other Documents", "Task Completion"].map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <label style={fieldLabel}>Month / Period</label>
            <input
              type="month"
              value={genOptions.period}
              onChange={e => setGenOptions(o => ({ ...o, period: e.target.value }))}
              className="w-full outline-none transition-colors"
              style={boxField}
            />
          </div>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <label style={fieldLabel}>Assigned Year Level</label>
            <select
              value={genOptions.scholar_group}
              onChange={e => setGenOptions(o => ({ ...o, scholar_group: e.target.value, scholar_id: "" }))}
              className="w-full outline-none transition-colors"
              style={{ ...boxField, cursor: 'pointer' }}
            >
              <option value="All Scholars">All Assigned Year Levels</option>
              {assignedYearLevels.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <label style={fieldLabel}>Scholar</label>
            <select
              value={genOptions.scholar_id}
              onChange={e => setGenOptions(o => ({ ...o, scholar_id: e.target.value }))}
              className="w-full outline-none transition-colors"
              style={{ ...boxField, cursor: 'pointer' }}
            >
              <option value="">All Scholars</option>
              {scholars
                .filter(row => genOptions.scholar_group === "All Scholars" || row.year_level === genOptions.scholar_group)
                .map(scholar => <option key={scholar.studentId} value={scholar.studentId}>{scholar.name}</option>)}
            </select>
          </div>

          <button onClick={onGenerate} disabled={genLoading || !genOptions.period}
            className="w-full sm:w-auto"
            style={{ ...filledBtn, opacity: genLoading || !genOptions.period ? 0.6 : 1, cursor: genLoading || !genOptions.period ? 'default' : 'pointer' }}>
            {genLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            ) : (
              <><Download className="w-4 h-4" /> Download PDF Report</>
            )}
          </button>
          <button
            type="button"
            onClick={onExportExcel}
            disabled={loading || rows.length === 0 || !genOptions.period}
            className="w-full sm:w-auto"
            style={{ ...outlineBtn, justifyContent: 'center', opacity: loading || rows.length === 0 || !genOptions.period ? 0.6 : 1, cursor: loading || rows.length === 0 || !genOptions.period ? 'not-allowed' : 'pointer' }}
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
        </div>

        {genError && (
          <div className="mt-4 flex items-center gap-2" style={{ borderLeft: `3px solid ${AMBER}`, background: `${AMBER}0d`, padding: '10px 14px', borderRadius: 6, ...body, fontSize: '0.78rem', fontWeight: 600, color: AMBER }}>
            <AlertCircle size={15} className="flex-shrink-0" /> {genError}
          </div>
        )}
      </div>

      {/* ── Tile 3: Summary table ── */}
      <div style={{ ...tile, overflow: 'hidden' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${RULE}` }}>
          <div>
            <h2 style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: MAROON_DEEP, lineHeight: 1.2 }}>
              {isTaskCompletion ? "Task Completion Summary" : `${genOptions.report_type} Summary`}
            </h2>
            <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 3 }}>{periodLabel}</p>
          </div>
          <button onClick={onRefresh} style={outlineBtn}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {error && (
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderLeft: `3px solid ${AMBER}`, background: `${AMBER}0d`, borderBottom: `1px solid ${RULE}`, ...body, fontSize: '0.78rem', fontWeight: 600, color: AMBER }}>
            <AlertCircle size={15} className="flex-shrink-0" /> {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: '0.85rem', minWidth: 640 }}>
            <thead>
              <tr style={{ background: `${BG}b3`, borderBottom: `1px solid ${RULE}` }}>
                {(isTaskCompletion
                  ? ["Name", "Student ID", "Assigned", "Completed", "Missing", "Pending", "Completion Rate"]
                  : isMonthlyReports
                    ? ["Name", "Student ID", "Submission Status", "Officer Review", "Pending", "Approval Rate"]
                    : ["Name", "Student ID", "Submission Status", "Submitted Count", "Pending", "Submission Details"]
                ).map(h => (
                  <th key={h} className="px-5 py-3 text-left" style={{ ...body, color: '#6b5a52', fontSize: "0.74rem", fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${RULE}` }}>
                    {Array(6).fill(0).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-2.5 w-4/5 animate-pulse rounded-full" style={{ background: BG }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={isTaskCompletion ? 7 : 6} className="px-5 py-14 text-center">
                    <Users className="mx-auto mb-3 h-9 w-9" style={{ color: RULE }} />
                    <p style={{ ...body, fontSize: '0.82rem', color: MUTED }}>No compliance data yet.</p>
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={idx} className="transition-colors hover:bg-[#F6EFE4]" style={{ borderTop: `1px solid ${RULE}` }}>
                    <td className="px-5 py-3.5" style={{ ...body, fontWeight: 600, color: INK }}>{row.name}</td>
                    <td className="px-5 py-3.5" style={{ ...mono, fontSize: '0.74rem', color: MUTED }}>{row.studentId}</td>
                    <td className="px-5 py-3.5" style={{ ...mono, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: isTaskCompletion ? INK : (row.submitted > 0 ? SAGE : AMBER) }}>
                      {isTaskCompletion ? row.assignedTasks : (row.submitted > 0 ? `Submitted (${row.submitted})` : 'Not Submitted')}
                    </td>
                    <td className="px-5 py-3.5" style={{ ...mono, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: isTaskCompletion ? SAGE : (isMonthlyReports ? (row.approved > 0 ? SAGE : row.submitted > 0 ? AMBER : MUTED) : SAGE) }}>
                      {isTaskCompletion ? row.completedTasks : isMonthlyReports ? (row.approved > 0 ? `Approved (${row.approved})` : row.submitted > 0 ? 'Pending Review' : 'No Submission') : row.submitted}
                    </td>
                    {isTaskCompletion && <td className="px-5 py-3.5" style={{ ...mono, fontSize: '0.7rem', fontWeight: 700, color: row.missingTasks > 0 ? CLAY : MUTED }}>{row.missingTasks}</td>}
                    <td className="px-5 py-3.5" style={{ ...mono, fontSize: '0.78rem', fontWeight: 700, color: AMBER }}>{isTaskCompletion ? row.pendingTasks : row.pending}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {isMonthlyReports || isTaskCompletion ? (
                          <>
                            <div className="h-2 w-24 overflow-hidden rounded-full" style={{ background: RULE }}>
                              <div className="h-full rounded-full" style={{ width: `${row.completionRate}%`, background: row.completionRate >= 75 ? SAGE : row.completionRate >= 40 ? AMBER : CLAY }} />
                            </div>
                            <span style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, color: '#6b6058' }}>{row.completionRate}%</span>
                          </>
                        ) : (
                          <span style={{ ...mono, fontSize: '0.7rem', fontWeight: 700, color: row.submitted > 0 ? SAGE : AMBER }}>
                            {row.submitted > 0 ? `${row.submitted} submitted` : 'No submission'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}