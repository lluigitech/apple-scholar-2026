import {
  Filter, Users, FileText, Loader2, RefreshCw,
  BarChart2, FileSpreadsheet, ClipboardList, GraduationCap, Activity,
} from "lucide-react";
import { MAROON } from "./ReportsHelpers";
import {
  SelectField, DateField, StatCard, Section,
  DutyTable, SubmissionsTable, RequirementsTable, ActivitiesTable,
} from "./ExportTables";

export default function ExportReportsTab({
  filters, setField, scholars, data, loading, fetched, error,
  onGenerate, onDownload,
}) {
  const totalRecords = data.duty_attendance.length + data.submissions.length + data.requirements.length + data.activities.length;

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
          <BarChart2 size={15} /> {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} style={{ color: MAROON }} />
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SelectField label="Scholar" icon={Users} value={filters.scholar_id} onChange={e => setField("scholar_id", e.target.value)}>
            <option value="">All Scholars</option>
            {scholars.map(s => <option key={s.id || s.scholar_id} value={s.scholar_id}>{s.full_name}</option>)}
          </SelectField>
          <DateField label="Date From" value={filters.date_from} onChange={e => setField("date_from", e.target.value)} />
          <DateField label="Date To"   value={filters.date_to}   onChange={e => setField("date_to",   e.target.value)} />
          <SelectField label="Report Type" icon={FileText} value={filters.report_type} onChange={e => setField("report_type", e.target.value)}>
            <option value="all">All Reports</option>
            <option value="duty_attendance">Duty Attendance</option>
            <option value="submissions">Submissions</option>
            <option value="requirements">Requirements (COR/Grades/Card)</option>
            <option value="activities">Activity Participation</option>
          </SelectField>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
          <button onClick={onGenerate} disabled={loading}
            className="flex items-center gap-2 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: MAROON }}>
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
              : <><RefreshCw size={15} /> Generate Report</>}
          </button>
        </div>
      </div>

      {fetched && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Duty Records"  count={data.duty_attendance.length} icon={ClipboardList}  color="text-blue-600"    bg="bg-blue-50"    border="border-blue-100" />
          <StatCard label="Submissions"   count={data.submissions.length}     icon={FileText}       color="text-violet-600"  bg="bg-violet-50"  border="border-violet-100" />
          <StatCard label="Requirements"  count={data.requirements.length}    icon={GraduationCap}  color="text-amber-600"   bg="bg-amber-50"   border="border-amber-100" />
          <StatCard label="Activities"    count={data.activities.length}      icon={Activity}       color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-100" />
        </div>
      )}

      {fetched && (
        <div className="space-y-4">
          {(filters.report_type === "all" || filters.report_type === "duty_attendance") && (
            <Section title="Duty Attendance" count={data.duty_attendance.length}>
              <DutyTable rows={data.duty_attendance} />
            </Section>
          )}
          {(filters.report_type === "all" || filters.report_type === "submissions") && (
            <Section title="Monthly Report Submissions" count={data.submissions.length}>
              <SubmissionsTable rows={data.submissions} />
            </Section>
          )}
          {(filters.report_type === "all" || filters.report_type === "requirements") && (
            <Section title="Requirements (COR / Grades / Card)" count={data.requirements.length}>
              <RequirementsTable rows={data.requirements} />
            </Section>
          )}
          {(filters.report_type === "all" || filters.report_type === "activities") && (
            <Section title="Activity Participation" count={data.activities.length}>
              <ActivitiesTable rows={data.activities} />
            </Section>
          )}
          {totalRecords > 0 && (
            <div className="flex justify-end pt-1">
              <button onClick={onDownload}
                className="flex items-center gap-2 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
                style={{ background: MAROON }}>
                <FileSpreadsheet size={15} /> Export to Excel ({totalRecords} records)
              </button>
            </div>
          )}
        </div>
      )}

      {!fetched && !loading && !error && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-20 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "#fcf8f8", border: `2px dashed ${MAROON}30` }}>
            <BarChart2 size={28} style={{ color: MAROON }} className="opacity-40" />
          </div>
          <p className="font-bold text-slate-400 text-sm">No report generated yet</p>
          <p className="text-slate-300 text-xs mt-1">Set your filters above and click <span className="font-bold">Generate Report</span></p>
        </div>
      )}
    </div>
  );
}