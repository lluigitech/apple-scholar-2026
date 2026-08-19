import { Download, RefreshCw, Users, AlertCircle, Loader2 } from "lucide-react";
import { MAROON, MAROON_LIGHT, riskBadge } from "./ReportsHelpers";

export default function ComplianceSummaryTab({
  rows, loading, error,
  genOptions, setGenOptions, genLoading, genError, onGenerate,
  onRefresh,
}) {
  return (
    <div className="space-y-6">
      {/* Generate Report Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-5 text-xl font-bold text-slate-900">Generate Report</h2>
        
        <div className="grid grid-cols-1 gap-4 mb-5 md:grid-cols-3">
          {[
            { key: "report_type", label: "Report Type", options: ["Compliance Summary", "Duty Attendance", "Task Completion", "Scholar Performance"] },
            { key: "period", label: "Period", options: ["Current Month", "Last Month", "Current Semester", "Academic Year 2026", "Custom Range"] },
            { key: "scholar_group", label: "Scholar Group", options: ["All Scholars", "Year Level 1", "Year Level 2", "Year Level 3", "Year Level 4", "At Risk Only"] },
          ].map(({ key, label, options }) => (
            <div key={key}>
              <label className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>
              <select 
                value={genOptions[key]} 
                onChange={e => setGenOptions(o => ({ ...o, [key]: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm outline-none transition hover:border-slate-400"
              >
                {options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        {genError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertCircle size={15} className="flex-shrink-0" /> {genError}
          </div>
        )}

        <button 
          onClick={onGenerate} 
          disabled={genLoading}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: genLoading ? "#9ca3af" : MAROON }}
        >
          {genLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
          ) : (
            <><Download className="w-4 h-4" /> Download PDF Report</>
          )}
        </button>
      </div>

      {/* Compliance Summary Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Scholar Compliance Summary</h2>
          <button 
            onClick={onRefresh}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {error && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 flex items-center gap-2 text-sm text-amber-700">
            <AlertCircle size={15} className="flex-shrink-0" /> {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: MAROON_LIGHT }}>
                {["Name", "Student ID", "Completion Rate", "Risk Status"].map(h => (
                  <th key={h} className="px-6 py-3.5 text-left font-bold uppercase tracking-wide" style={{ color: MAROON, fontSize: "0.75rem" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array(4).fill(0).map((__, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="text-sm text-slate-500">No compliance data yet.</p>
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const badge = riskBadge(row.riskStatus);
                  return (
                    <tr key={idx} className="border-b border-slate-100 transition hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                      <td className="px-6 py-4 text-slate-600">{row.studentId}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full bg-emerald-500" style={{ width: `${row.completionRate}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-700">{row.completionRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" style={{ background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
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