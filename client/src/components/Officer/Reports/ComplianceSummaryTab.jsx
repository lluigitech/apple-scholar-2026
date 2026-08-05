import { Download, RefreshCw, Users, AlertCircle, Loader2 } from "lucide-react";
import { MAROON, MAROON_LIGHT, riskBadge } from "./ReportsHelpers";

export default function ComplianceSummaryTab({
  rows, loading, error,
  genOptions, setGenOptions, genLoading, genError, onGenerate,
  onRefresh,
}) {
  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.2rem", fontWeight: 700, color: "#1a1a1a", marginBottom: 16 }}>Generate Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {[
            { key: "report_type", label: "Report Type", options: ["Compliance Summary", "Duty Attendance", "Task Completion", "Scholar Performance"] },
            { key: "period", label: "Period", options: ["Current Month", "Last Month", "Current Semester", "Academic Year 2026", "Custom Range"] },
            { key: "scholar_group", label: "Scholar Group", options: ["All Scholars", "Year Level 1", "Year Level 2", "Year Level 3", "Year Level 4", "At Risk Only"] },
          ].map(({ key, label, options }) => (
            <div key={key}>
              <label style={{ display: "block", marginBottom: 8, fontFamily: "'DM Sans',sans-serif", fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>{label}</label>
              <select value={genOptions[key]} onChange={e => setGenOptions(o => ({ ...o, [key]: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 outline-none"
                style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.9rem" }}>
                {options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
        {genError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-700 text-sm mb-4">
            <AlertCircle size={15} /> {genError}
          </div>
        )}
        <button onClick={onGenerate} disabled={genLoading}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 8, fontFamily: "'DM Sans',sans-serif", fontSize: "0.9rem", fontWeight: 600, background: MAROON, color: "#fff", border: "none", cursor: genLoading ? "not-allowed" : "pointer", opacity: genLoading ? 0.7 : 1 }}>
          {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {genLoading ? "Generating…" : "Download PDF Report"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.15rem", fontWeight: 700, color: "#1a1a1a" }}>Scholar Compliance Summary</h2>
          <button onClick={onRefresh}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontFamily: "'DM Sans',sans-serif", fontSize: "0.82rem", fontWeight: 600, color: "#374151", cursor: "pointer" }}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {error && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center gap-2 text-amber-700 text-sm">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: MAROON_LIGHT, borderBottom: "1px solid #f3d0d4" }}>
                {["Name", "Student ID", "Completion Rate", "Risk Status"].map(h => (
                  <th key={h} className="text-left px-6 py-3.5"
                    style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.78rem", fontWeight: 700, color: MAROON, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array(4).fill(0).map((__, j) => (
                      <td key={j} className="px-6 py-4"><div className="h-3 bg-slate-100 rounded-full animate-pulse w-4/5" /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "48px 24px", textAlign: "center" }}>
                    <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "#d1d5db" }} />
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.9rem", color: "#9ca3af" }}>No compliance data yet.</p>
                  </td>
                </tr>
              ) : (
                rows.map(s => {
                  const badge = riskBadge(s.riskStatus);
                  return (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.9rem", fontWeight: 600, color: "#1a1a1a" }}>{s.name}</td>
                      <td className="px-6 py-4" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.875rem", color: "#6b7280" }}>{s.studentId}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div style={{ width: 100, height: 6, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${s.completionRate}%`, background: s.completionRate >= 80 ? "#10b981" : s.completionRate >= 60 ? "#f59e0b" : "#ef4444", borderRadius: 99 }} />
                          </div>
                          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.875rem", fontWeight: 700, color: "#374151" }}>{s.completionRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span style={{ padding: "4px 12px", borderRadius: 99, fontFamily: "'DM Sans',sans-serif", fontSize: "0.75rem", fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
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