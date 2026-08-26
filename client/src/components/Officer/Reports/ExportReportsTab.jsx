import {
  Filter, Users, FileText, Loader2, RefreshCw,
  BarChart2, FileSpreadsheet, ClipboardList, GraduationCap, Activity,
} from "lucide-react";
import { MAROON, PAPER, RULE, INK, CLAY, serif, sans } from "./ReportsHelpers";
import {
  SelectField, DateField, StatCard, Section,
  DutyTable, SubmissionsTable, RequirementsTable, ActivitiesTable,
} from "./ExportTables";

export default function ExportReportsTab({
  filters, setField, scholars, data, loading, fetched, error,
  onGenerate, onDownload,
  onDownloadPdf,
}) {
  const totalRecords = data.submissions.length + data.requirements.length;
  const documentTypeLabels = { "monthly-letter": "Monthly Letter", grades: "Grades", cor: "COR", other: "Other Documents" };
  const selectedDocumentType = documentTypeLabels[filters.report_type];
  const requirementGroups = filters.report_type === "all-requirements"
    ? ["Monthly Letter", "COR", "Grades", "Other Documents"].map(type => ({ type, rows: data.requirements.filter(row => row.type === type) }))
    : [];

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg px-4 py-3 flex items-center gap-2" style={{ background: `${CLAY}12`, border: `1px solid ${CLAY}45`, ...sans, fontSize: '0.78rem', color: CLAY }}>
          <BarChart2 size={15} /> {error}
        </div>
      )}

      <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${RULE}` }}>
        <div className="flex items-center gap-2 mb-4">
          <Filter size={13} style={{ color: MAROON }} />
          <span style={{ ...sans, fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a89890' }}>Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SelectField label="Scholar" icon={Users} value={filters.scholar_id} onChange={e => setField("scholar_id", e.target.value)}>
            <option value="">All Scholars</option>
            {scholars.map(s => <option key={s.id || s.scholar_id} value={s.scholar_id}>{s.full_name}</option>)}
          </SelectField>
          <DateField label="Month From" type="month" value={filters.date_from} onChange={e => setField("date_from", e.target.value)} />
          <DateField label="Month To" type="month" value={filters.date_to} onChange={e => setField("date_to", e.target.value)} />
          <SelectField label="Submission Type" icon={FileText} value={filters.report_type} onChange={e => setField("report_type", e.target.value)}>
            <option value="monthly-letter">Monthly Letter</option>
            <option value="grades">Grades</option>
            <option value="cor">COR</option>
            <option value="other">Other Documents</option>
            <option value="all-requirements">All Requirements</option>
          </SelectField>
        </div>
        <div className="mt-4 pt-4 flex justify-end" style={{ borderTop: `1px solid ${RULE}` }}>
          <button onClick={onGenerate} disabled={loading}
            className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, background: MAROON, color: '#fff', border: 'none', padding: '10px 22px', cursor: loading ? 'default' : 'pointer' }}>
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
              : <><RefreshCw size={15} /> Generate Report</>}
          </button>
        </div>
      </div>

      {fetched && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          <StatCard label="Submissions"  count={data.submissions.length}  icon={FileText}      color="text-[#7f2d3a]" bg="bg-white" border="border-[#e8dccb]" />
          <StatCard label="Requirements" count={data.requirements.length} icon={GraduationCap} color="text-[#b8863f]" bg="bg-white" border="border-[#e8dccb]" />
        </div>
      )}

      {fetched && (
        <div className="space-y-4">
          {selectedDocumentType && (
            <Section title={`${selectedDocumentType} Submissions`} count={data.submissions.length}>
              <SubmissionsTable rows={data.submissions} />
            </Section>
          )}
          {filters.report_type === "all-requirements" && (
            requirementGroups.map(group => (
              <Section key={group.type} title={group.type} count={group.rows.length}>
                <RequirementsTable rows={group.rows} />
              </Section>
            ))
          )}
          {totalRecords > 0 && (
            <div className="flex flex-wrap justify-end gap-2.5 pt-1">
              <button onClick={onDownload}
                className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-90"
                style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, background: MAROON, color: '#fff', border: 'none', padding: '10px 18px', cursor: 'pointer' }}>
                <FileSpreadsheet size={15} /> Export to Excel ({totalRecords} records)
              </button>
              <button onClick={onDownloadPdf}
                className="flex items-center gap-2 rounded-full transition-colors hover:bg-[#f6efe4]"
                style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, background: '#fff', color: MAROON, border: `1.5px solid ${MAROON}`, padding: '10px 18px', cursor: 'pointer' }}>
                <FileText size={15} /> Export PDF ({totalRecords} records)
              </button>
            </div>
          )}
        </div>
      )}

      {!fetched && !loading && !error && (
        <div className="rounded-xl py-20 text-center" style={{ background: '#fff', border: `1px dashed ${RULE}` }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: PAPER, border: `2px dashed ${MAROON}30` }}>
            <BarChart2 size={26} style={{ color: MAROON, opacity: 0.5 }} />
          </div>
          <p style={{ ...serif, fontSize: '1rem', fontWeight: 700, color: '#a89890' }}>No report generated yet</p>
          <p style={{ ...sans, fontSize: '0.78rem', color: '#c9b9b0', marginTop: 4 }}>Set your filters above and click <b>Generate Report</b></p>
        </div>
      )}
    </div>
  );
}