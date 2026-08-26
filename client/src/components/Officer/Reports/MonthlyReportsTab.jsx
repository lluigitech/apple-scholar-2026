import { RefreshCw, AlertCircle, FileText, Eye, Clock } from "lucide-react";
import { MAROON, ROSE, PAPER, RULE, INK, AMBER, SAGE, CLAY, serif, sans, mono, reportStatusBadge, staffActionBadge, scoreColor } from "./ReportsHelpers";

const STATUS_FILTERS = [
  { key: "all", label: "All", color: MAROON },
  { key: "accepted", label: "Quality Accepted", color: SAGE },
  { key: "medium-risk", label: "Quality Medium Risk", color: AMBER },
  { key: "high-risk", label: "Quality High Risk", color: CLAY },
];

export default function MonthlyReportsTab({
  filteredReports, loading, error, counts, pendingStaff,
  statusFilter, setStatusFilter, onRefresh, onSelectReport,
  month, setMonth, yearLevel, setYearLevel,
  assignedYearLevels = [],
}) {
  return (
    <div className="space-y-5">

      {/* ─── Status Filter Buttons ─── */}
      <div className="flex flex-wrap items-center gap-2.5">
        {STATUS_FILTERS.map(f => {
          const active = statusFilter === f.key;
          const count = counts[f.key] || 0;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className="flex items-center gap-2 rounded-full transition-colors"
              style={{
                ...sans, fontSize: '0.72rem', fontWeight: 700, padding: '7px 14px', cursor: 'pointer',
                background: active ? f.color : "#fff",
                color: active ? "#fff" : f.color,
                border: `1.5px solid ${f.color}`,
              }}
            >
              {f.label}
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1" style={{ background: active ? "rgba(255,255,255,0.25)" : PAPER, color: active ? "#fff" : "#8a7a70", fontSize: '0.62rem', fontWeight: 800 }}>
                {count}
              </span>
            </button>
          );
        })}
        <button
          onClick={onRefresh}
          className="ml-auto flex items-center gap-1.5 rounded-full transition-colors hover:bg-[#f6efe4]"
          style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${RULE}`, background: '#fff', color: '#6b6058', padding: '7px 14px', cursor: 'pointer' }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ─── Filters ─── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label style={{ ...sans, fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a56475', display: 'block', marginBottom: 8 }}>Report Month</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-full outline-none transition-colors"
            style={{ ...sans, fontSize: '0.85rem', color: INK, background: PAPER, border: `1px solid ${RULE}`, borderRadius: 10, padding: '9px 12px' }}
          />
        </div>
        <div>
          <label style={{ ...sans, fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a56475', display: 'block', marginBottom: 8 }}>Assigned Year Level</label>
          <select
            value={yearLevel}
            onChange={e => setYearLevel(e.target.value)}
            className="w-full outline-none transition-colors"
            style={{ ...sans, fontSize: '0.85rem', color: INK, background: PAPER, border: `1px solid ${RULE}`, borderRadius: 10, padding: '9px 12px', cursor: 'pointer' }}
          >
            {assignedYearLevels.map(level => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={onRefresh}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors hover:bg-[#f6efe4]"
            style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, border: `1px solid ${RULE}`, background: '#fff', color: '#6b6058', padding: '10px 0', cursor: 'pointer' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ─── Error Message ─── */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg" style={{ background: `${AMBER}12`, border: `1px solid ${AMBER}45`, padding: '10px 14px', ...sans, fontSize: '0.78rem', color: AMBER }}>
          <AlertCircle size={15} className="flex-shrink-0" /> {error}
        </div>
      )}

      {/* ─── Reports Table ─── */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: ROSE }}>
                {["Scholar", "ID", "Course & School", "AI Score", "Status", "Action", "Submitted", "Review"].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left" style={{ ...sans, fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: MAROON }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${RULE}` }}>
                    {Array(8).fill(0).map((__, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-2.5 w-4/5 animate-pulse rounded-full" style={{ background: PAPER }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <FileText className="mx-auto mb-3 h-9 w-9" style={{ color: '#e9d9dc' }} />
                    <p style={{ ...sans, fontSize: '0.82rem', color: '#a89890' }}>No reports found.</p>
                  </td>
                </tr>
              ) : (
                filteredReports.map(report => {
                  const sysBadge = reportStatusBadge(report.status);
                  const SysIcon = sysBadge.Icon;
                  const sBadge = report.staffAction ? staffActionBadge(report.staffAction) : null;
                  const StaffIcon = sBadge?.Icon;
                  const initials = report.scholarName?.split(" ").map(n => n[0]).join("").slice(0, 2) || "—";

                  return (
                    <tr key={report.id} className="transition-colors hover:bg-[#faf6ee]" style={{ borderTop: `1px solid ${RULE}` }}>
                      {/* Scholar Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: ROSE, color: MAROON, ...serif, fontSize: '0.7rem', fontWeight: 700 }}>
                            {initials}
                          </div>
                          <div>
                            <p style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: INK }}>{report.scholarName}</p>
                            <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890' }}>{report.year}</p>
                          </div>
                        </div>
                      </td>

                      {/* Student ID */}
                      <td className="whitespace-nowrap px-4 py-3.5" style={{ ...mono, fontSize: '0.72rem', color: '#6b6058' }}>{report.studentId}</td>

                      {/* Course & School */}
                      <td className="px-4 py-3.5">
                        <p style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, color: INK }}>{report.course}</p>
                        <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890' }}>{report.school}</p>
                      </td>

                      {/* AI Score */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full" style={{ background: RULE }}>
                            <div className="h-full" style={{ width: `${report.qualityScore}%`, background: scoreColor(report.qualityScore) }} />
                          </div>
                          <span style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, color: scoreColor(report.qualityScore) }}>{report.qualityScore}</span>
                        </div>
                      </td>

                      {/* System Status */}
                      <td className="px-4 py-3.5">
                        <div className="inline-flex items-center gap-1 rounded-full" style={{ background: sysBadge.bg, color: sysBadge.color, ...sans, fontSize: '0.66rem', fontWeight: 800, padding: '4px 10px' }}>
                          <SysIcon className="h-3 w-3" /> {sysBadge.label}
                        </div>
                      </td>

                      {/* Staff Action */}
                      <td className="px-4 py-3.5">
                        {sBadge && StaffIcon ? (
                          <div className="inline-flex items-center gap-1 rounded-full" style={{ background: sBadge.bg, color: sBadge.color, ...sans, fontSize: '0.66rem', fontWeight: 800, padding: '4px 10px' }}>
                            <StaffIcon className="h-3 w-3" /> {sBadge.label}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 rounded-full" style={{ background: `${AMBER}14`, border: `1px solid ${AMBER}40`, color: AMBER, ...sans, fontSize: '0.66rem', fontWeight: 800, padding: '4px 10px' }}>
                            <Clock className="h-3 w-3" /> For Review
                          </div>
                        )}
                      </td>

                      {/* Submitted */}
                      <td className="whitespace-nowrap px-4 py-3.5" style={{ ...mono, fontSize: '0.7rem', color: '#a89890' }}>{report.submittedAt}</td>

                      {/* Review Button */}
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => onSelectReport(report)}
                          className="inline-flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-85"
                          style={{ background: ROSE, color: MAROON, ...sans, fontSize: '0.7rem', fontWeight: 700, padding: '6px 12px', border: 'none', cursor: 'pointer' }}
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
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