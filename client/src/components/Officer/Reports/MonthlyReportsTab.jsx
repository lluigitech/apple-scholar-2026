import { RefreshCw, AlertCircle, FileText, Eye, Clock } from "lucide-react";
import { MAROON, MAROON_LIGHT, reportStatusBadge, staffActionBadge, scoreColor } from "./ReportsHelpers";

export default function MonthlyReportsTab({
  filteredReports, loading, error, counts, pendingStaff,
  statusFilter, setStatusFilter, onRefresh, onSelectReport,
  month, setMonth, yearLevel, setYearLevel,
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {[
          { key: "all", label: "All", count: counts.all },
          { key: "accepted", label: "Accepted", count: counts.accepted },
          { key: "medium-risk", label: "Medium Risk", count: counts["medium-risk"] },
          { key: "high-risk", label: "High Risk", count: counts["high-risk"] },
        ].map(f => {
          const active = statusFilter === f.key;
          const cols = { all: MAROON, accepted: "#16a34a", "medium-risk": "#d97706", "high-risk": "#ef4444" };
          return (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 99, fontFamily: "'DM Sans',sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", background: active ? cols[f.key] : "#fff", color: active ? "#fff" : cols[f.key], border: `1.5px solid ${active ? cols[f.key] : "#e5e7eb"}` }}>
              {f.label}
              <span style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, background: active ? "rgba(255,255,255,0.25)" : "#f3f4f6", color: active ? "#fff" : "#6b7280" }}>{f.count}</span>
            </button>
          );
        })}
        <button onClick={onRefresh}
          className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-2">Filter by Month</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-2">Filter by Year Level</label>
          <select value={yearLevel} onChange={e => setYearLevel(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm outline-none">
            <option value="">All Year Levels</option>
            <option value="Grade 7">Grade 7</option>
            <option value="Grade 8">Grade 8</option>
            <option value="Grade 9">Grade 9</option>
            <option value="Grade 10">Grade 10</option>
            <option value="Grade 11">Grade 11</option>
            <option value="Grade 12">Grade 12</option>
            <option value="1st Year College">1st Year College</option>
            <option value="2nd Year College">2nd Year College</option>
            <option value="3rd Year College">3rd Year College</option>
            <option value="4th Year College">4th Year College</option>
            <option value="5th Year College">5th Year College</option>
          </select>
        </div>
        <div className="flex items-end justify-end">
          <button onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors w-full">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-700 text-sm mb-4">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: MAROON_LIGHT, borderBottom: "1px solid #f3d0d4" }}>
                {["Scholar", "Student ID", "Course & School", "AI Score", "System Status", "Staff Action", "Submitted", "Review"].map(h => (
                  <th key={h} className="text-left px-5 py-3.5"
                    style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.72rem", fontWeight: 700, color: MAROON, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array(8).fill(0).map((__, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-3 bg-slate-100 rounded-full animate-pulse w-4/5" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "48px 24px", textAlign: "center" }}>
                    <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: "#d1d5db" }} />
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.9rem", color: "#9ca3af" }}>No reports found.</p>
                  </td>
                </tr>
              ) : (
                filteredReports.map(report => {
                  const sysBadge = reportStatusBadge(report.status);
                  const SysIcon = sysBadge.Icon;
                  const sBadge = report.staffAction ? staffActionBadge(report.staffAction) : null;
                  return (
                    <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: MAROON_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.68rem", fontWeight: 700, color: MAROON }}>{report.scholarName?.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                          </div>
                          <div>
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.875rem", fontWeight: 600, color: "#1a1a1a" }}>{report.scholarName}</p>
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.73rem", color: "#9ca3af" }}>{report.year}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.8rem", color: "#6b7280", whiteSpace: "nowrap" }}>{report.studentId}</td>
                      <td className="px-5 py-4">
                        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>{report.course}</p>
                        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.72rem", color: "#9ca3af" }}>{report.school}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 48, height: 5, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${report.qualityScore}%`, background: scoreColor(report.qualityScore), borderRadius: 99 }} />
                          </div>
                          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.82rem", fontWeight: 700, color: scoreColor(report.qualityScore) }}>{report.qualityScore}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 99, background: sysBadge.bg, width: "fit-content" }}>
                          <SysIcon className="w-3 h-3" style={{ color: sysBadge.color }} />
                          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", fontWeight: 700, color: sysBadge.color }}>{sysBadge.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {sBadge ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 99, background: sBadge.bg, width: "fit-content" }}>
                            <sBadge.Icon className="w-3 h-3" style={{ color: sBadge.color }} />
                            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", fontWeight: 700, color: sBadge.color }}>{sBadge.label}</span>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 99, background: "#fef9ee", border: "1px solid #fde68a", width: "fit-content" }}>
                            <Clock className="w-3 h-3" style={{ color: "#d97706" }} />
                            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#d97706" }}>For Review</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.76rem", color: "#9ca3af", whiteSpace: "nowrap" }}>{report.submittedAt}</td>
                      <td className="px-5 py-4">
                        <button onClick={() => onSelectReport(report)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, fontFamily: "'DM Sans',sans-serif", fontSize: "0.78rem", fontWeight: 600, background: MAROON_LIGHT, color: MAROON, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                          <Eye className="w-3.5 h-3.5" /> Review
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
    </>
  );
}