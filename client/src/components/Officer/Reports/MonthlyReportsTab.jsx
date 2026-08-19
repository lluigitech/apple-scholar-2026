import { RefreshCw, AlertCircle, FileText, Eye, Clock } from "lucide-react";
import { MAROON, MAROON_LIGHT, reportStatusBadge, staffActionBadge, scoreColor } from "./ReportsHelpers";

const STATUS_FILTERS = [
  { key: "all", label: "All", color: "#7f2d3a" },
  { key: "accepted", label: "Accepted", color: "#16a34a" },
  { key: "medium-risk", label: "Medium Risk", color: "#d97706" },
  { key: "high-risk", label: "High Risk", color: "#ef4444" },
];

const YEAR_LEVELS = ["All Year Levels", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "1st Year College", "2nd Year College", "3rd Year College", "4th Year College", "5th Year College"];

export default function MonthlyReportsTab({
  filteredReports, loading, error, counts, pendingStaff,
  statusFilter, setStatusFilter, onRefresh, onSelectReport,
  month, setMonth, yearLevel, setYearLevel,
}) {
  return (
    <div className="space-y-6">
      
      {/* ─── Status Filter Buttons ─── */}
      <div className="flex flex-wrap items-center gap-3">
        {STATUS_FILTERS.map(f => {
          const active = statusFilter === f.key;
          const count = counts[f.key] || 0;
          return (
            <button 
              key={f.key} 
              onClick={() => setStatusFilter(f.key)}
              className="flex items-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-bold transition-all"
              style={{
                background: active ? f.color : "#fff",
                color: active ? "#fff" : f.color,
                borderColor: f.color,
              }}
            >
              {f.label}
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-bold" style={{ background: active ? "rgba(255,255,255,0.2)" : "#f3f4f6", color: active ? "#fff" : "#6b7280" }}>
                {count}
              </span>
            </button>
          );
        })}
        <button 
          onClick={onRefresh}
          className="ml-auto flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ─── Filters ─── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-xs font-bold text-slate-600 uppercase">Month</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition hover:border-slate-400"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-bold text-slate-600 uppercase">Year Level</label>
          <select 
            value={yearLevel} 
            onChange={e => setYearLevel(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition hover:border-slate-400"
          >
            {YEAR_LEVELS.map(level => (
              <option key={level} value={level === "All Year Levels" ? "" : level}>
                {level}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button 
            onClick={onRefresh}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ─── Error Message ─── */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertCircle size={15} className="flex-shrink-0" /> {error}
        </div>
      )}

      {/* ─── Reports Table ─── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: MAROON_LIGHT }}>
                {["Scholar", "ID", "Course & School", "AI Score", "Status", "Action", "Submitted", "Review"].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MAROON }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array(8).fill(0).map((__, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="text-sm text-slate-500">No reports found.</p>
                  </td>
                </tr>
              ) : (
                filteredReports.map(report => {
                  const sysBadge = reportStatusBadge(report.status);
                  const SysIcon = sysBadge.Icon;
                  const sBadge = report.staffAction ? staffActionBadge(report.staffAction) : null;
                  const initials = report.scholarName?.split(" ").map(n => n[0]).join("").slice(0, 2) || "—";
                  
                  return (
                    <tr key={report.id} className="border-b border-slate-100 transition hover:bg-slate-50">
                      {/* Scholar Name */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: MAROON_LIGHT, color: MAROON }}>
                            {initials}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{report.scholarName}</p>
                            <p className="text-xs text-slate-500">{report.year}</p>
                          </div>
                        </div>
                      </td>
                      
                      {/* Student ID */}
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">{report.studentId}</td>
                      
                      {/* Course & School */}
                      <td className="px-4 py-4">
                        <p className="text-xs font-semibold text-slate-900">{report.course}</p>
                        <p className="text-xs text-slate-500">{report.school}</p>
                      </td>
                      
                      {/* AI Score */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full" style={{ width: `${report.qualityScore}%`, background: scoreColor(report.qualityScore) }} />
                          </div>
                          <span className="text-xs font-bold" style={{ color: scoreColor(report.qualityScore) }}>{report.qualityScore}</span>
                        </div>
                      </td>
                      
                      {/* System Status */}
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold" style={{ background: sysBadge.bg, color: sysBadge.color }}>
                          <SysIcon className="h-3 w-3" /> {sysBadge.label}
                        </div>
                      </td>
                      
                      {/* Staff Action */}
                      <td className="px-4 py-4">
                        {sBadge ? (
                          <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold" style={{ background: sBadge.bg, color: sBadge.color }}>
                            <sBadge.Icon className="h-3 w-3" /> {sBadge.label}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                            <Clock className="h-3 w-3" /> For Review
                          </div>
                        )}
                      </td>
                      
                      {/* Submitted */}
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{report.submittedAt}</td>
                      
                      {/* Review Button */}
                      <td className="px-4 py-4">
                        <button 
                          onClick={() => onSelectReport(report)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition hover:opacity-80"
                          style={{ background: MAROON_LIGHT, color: MAROON }}
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