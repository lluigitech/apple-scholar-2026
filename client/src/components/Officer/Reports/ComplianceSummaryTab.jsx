import { Download, RefreshCw, Users, AlertCircle, Loader2 } from "lucide-react";
import { MAROON, ROSE, PAPER, RULE, INK, AMBER, serif, sans, mono } from "./ReportsHelpers";

export default function ComplianceSummaryTab({
  rows, loading, error,
  genOptions, setGenOptions, genLoading, genError, onGenerate,
  onRefresh,
  assignedYearLevels = [],
}) {
  const isTaskCompletion = genOptions.report_type === "Task Completion";
  const isMonthlyReports = genOptions.report_type === "Monthly Letter";
  const totalScholars = rows.length;
  const submittedScholars = rows.filter(row => (isTaskCompletion ? row.completedTasks > 0 : row.submitted > 0)).length;
  const compliantScholars = rows.filter(row => (isTaskCompletion ? row.completionRate === 100 : isMonthlyReports ? row.approved > 0 && row.pending === 0 : row.submitted > 0)).length;
  const pendingScholars = Math.max(0, totalScholars - submittedScholars);
  const periodLabel = /^\d{4}-\d{2}$/.test(genOptions.period)
    ? new Date(`${genOptions.period}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : genOptions.period === "Current Month"
    ? new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : genOptions.period === "Last Month"
      ? (() => { const date = new Date(); date.setMonth(date.getMonth() - 1); return date.toLocaleDateString("en-US", { month: "long", year: "numeric" }); })()
      : genOptions.period;
  return (
    <div className="space-y-5">
      {/* Generate Report Section */}
      <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
        <h2 style={{ ...serif, fontSize: '1.15rem', fontWeight: 700, color: INK, marginBottom: 16 }}>Generate Report</h2>

        <div className="grid grid-cols-1 gap-4 mb-5 md:grid-cols-3">
          {[
            { key: "report_type", label: "Submission Type", options: ["Monthly Letter", "Grades", "COR", "Other Documents"] },
            { key: "period", label: "Report Month", type: "month" },
            { key: "scholar_group", label: "Assigned Year Level", options: assignedYearLevels },
          ].map(({ key, label, options, type }) => (
            <div key={key}>
              <label style={{ ...sans, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a56475', display: 'block', marginBottom: 8 }}>{label}</label>
              {type === "month" ? (
                <input
                  type="month"
                  value={genOptions[key]}
                  onChange={e => setGenOptions(o => ({ ...o, [key]: e.target.value }))}
                  className="w-full outline-none transition-colors"
                  style={{ ...sans, fontSize: '0.85rem', color: INK, background: PAPER, border: `1px solid ${RULE}`, borderRadius: 10, padding: '10px 12px' }}
                />
              ) : (
                <select
                  value={genOptions[key]}
                  onChange={e => setGenOptions(o => ({ ...o, [key]: e.target.value }))}
                  className="w-full outline-none transition-colors"
                  style={{ ...sans, fontSize: '0.85rem', color: INK, background: PAPER, border: `1px solid ${RULE}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
                >
                  {options.map(o => (
                    <option key={o} value={key === "scholar_group" ? o : undefined}>{o}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        {genError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg" style={{ background: `${AMBER}12`, border: `1px solid ${AMBER}45`, padding: '10px 14px', ...sans, fontSize: '0.78rem', color: AMBER }}>
            <AlertCircle size={15} className="flex-shrink-0" /> {genError}
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={genLoading}
          className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, background: MAROON, color: '#fff', border: 'none', padding: '10px 20px', cursor: genLoading ? 'default' : 'pointer' }}
        >
          {genLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
          ) : (
            <><Download className="w-4 h-4" /> Download PDF Report</>
          )}
        </button>
      </div>

      {/* Compliance Summary Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ background: PAPER, borderBottom: `1px solid ${RULE}` }}>
          <div>
            <h2 style={{ ...serif, fontSize: '1.05rem', fontWeight: 700, color: INK }}>{isTaskCompletion ? "Task Completion Summary" : `${genOptions.report_type} Summary`}</h2>
            <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890', marginTop: 2 }}>{periodLabel}</p>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-full transition-colors hover:bg-[#f6efe4]"
            style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${RULE}`, background: '#fff', color: '#6b6058', padding: '7px 14px', cursor: 'pointer' }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {error && (
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: `${AMBER}0f`, borderBottom: `1px solid ${AMBER}40`, ...sans, fontSize: '0.78rem', color: AMBER }}>
            <AlertCircle size={15} className="flex-shrink-0" /> {error}
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="grid grid-cols-2 gap-3 border-b px-5 py-4 sm:grid-cols-4" style={{ borderColor: RULE, background: '#fff' }}>
            {[
              { label: 'Scholars', value: totalScholars, color: INK },
              { label: 'Submitted', value: `${submittedScholars}/${totalScholars}`, color: '#6b8f71' },
              { label: 'Not Submitted', value: pendingScholars, color: '#b8863f' },
              { label: isMonthlyReports || isTaskCompletion ? 'Compliant' : 'Has Submission', value: compliantScholars, color: MAROON },
            ].map(stat => (
              <div key={stat.label} className="rounded-lg px-3 py-2" style={{ background: PAPER, border: `1px solid ${RULE}` }}>
                <p style={{ ...sans, fontSize: '0.62rem', fontWeight: 800, color: '#a89890', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</p>
                <p style={{ ...serif, fontSize: '1.2rem', fontWeight: 700, color: stat.color, marginTop: 2 }}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: ROSE }}>
                {(isTaskCompletion ? ["Name", "Student ID", "Assigned", "Completed", "Pending", "Completion Rate"] : isMonthlyReports ? ["Name", "Student ID", "Submission Status", "Officer Review", "Pending", "Approval Rate"] : ["Name", "Student ID", "Submission Status", "Submitted Count", "Pending", "Submission Details"]).map(h => (
                  <th key={h} className="px-5 py-3 text-left" style={{ ...sans, color: MAROON, fontSize: "0.66rem", fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
                        <div className="h-2.5 w-4/5 animate-pulse rounded-full" style={{ background: PAPER }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <Users className="mx-auto mb-3 h-9 w-9" style={{ color: '#e9d9dc' }} />
                    <p style={{ ...sans, fontSize: '0.82rem', color: '#a89890' }}>No compliance data yet.</p>
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  return (
                    <tr key={idx} className="transition-colors hover:bg-[#faf6ee]" style={{ borderTop: `1px solid ${RULE}` }}>
                      <td className="px-5 py-3.5" style={{ ...sans, fontWeight: 700, color: INK }}>{row.name}</td>
                      <td className="px-5 py-3.5" style={{ ...mono, fontSize: '0.78rem', color: '#6b6058' }}>{row.studentId}</td>
                      <td className="px-5 py-3.5" style={{ ...sans, fontSize: '0.72rem', fontWeight: 800, color: isTaskCompletion ? INK : (row.submitted > 0 ? '#6b8f71' : '#b8863f') }}>{isTaskCompletion ? row.assignedTasks : (row.submitted > 0 ? `Submitted (${row.submitted})` : 'Not Submitted')}</td>
                      <td className="px-5 py-3.5" style={{ ...sans, fontSize: '0.72rem', fontWeight: 800, color: isTaskCompletion ? '#6b8f71' : (isMonthlyReports ? (row.approved > 0 ? '#6b8f71' : row.submitted > 0 ? '#b8863f' : '#a89890') : '#6b8f71') }}>{isTaskCompletion ? row.completedTasks : isMonthlyReports ? (row.approved > 0 ? `Approved (${row.approved})` : row.submitted > 0 ? 'Pending Review' : 'No Submission') : row.submitted}</td>
                      <td className="px-5 py-3.5" style={{ ...mono, color: '#b8863f' }}>{isTaskCompletion ? row.pendingTasks : row.pending}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {isMonthlyReports || isTaskCompletion ? <>
                            <div className="h-2 w-24 overflow-hidden rounded-full" style={{ background: RULE }}>
                              <div className="h-full rounded-full" style={{ width: `${row.completionRate}%`, background: '#6b8f71' }} />
                            </div>
                            <span style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, color: '#6b6058' }}>{row.completionRate}%</span>
                          </> : <span style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: row.submitted > 0 ? '#6b8f71' : '#b8863f' }}>{row.submitted > 0 ? `${row.submitted} submitted` : 'No submission'}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}