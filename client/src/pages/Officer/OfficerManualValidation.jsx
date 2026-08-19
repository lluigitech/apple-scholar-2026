import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  Shield, Search, ChevronDown, ChevronUp, CheckCircle2, XCircle,
  Clock, FileText, GraduationCap, IdCard, Paperclip, ExternalLink, AlertTriangle,
} from 'lucide-react';

// Reusing your existing shared components instead of duplicating them
import FilePreviewModal from '../../components/Officer/ManualValidation/FilePreviewModal';
import ReviewModal from '../../components/Officer/ManualValidation/ReviewModal';
import { LetterDocumentCard } from '../../components/Officer/ManualValidation/CorrespondenceTab';
import { fileKind } from '../../utils/submissionHelpers';

const API = 'http://localhost:5000/api';
const MAROON = '#7f2d3a';

const authHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

// ────────────────────────────────────────────────────────────
// Year Level Normalization
// ────────────────────────────────────────────────────────────
const normalizeYearLevel = (value) => {
  if (!value) return '—';
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'grade 7' || normalized === 'grade_7' || normalized === 'g7') return 'Grade 7';
  if (normalized === 'grade 8' || normalized === 'grade_8' || normalized === 'g8') return 'Grade 8';
  if (normalized === 'grade 9' || normalized === 'grade_9' || normalized === 'g9') return 'Grade 9';
  if (normalized === 'grade 10' || normalized === 'grade_10' || normalized === 'g10') return 'Grade 10';
  if (normalized === 'grade 11' || normalized === 'grade_11' || normalized === 'g11') return 'Grade 11';
  if (normalized === 'grade 12' || normalized === 'grade_12' || normalized === 'g12') return 'Grade 12';
  if (normalized === '1st year college' || normalized === '1st year' || normalized === 'college_1' || normalized === 'college 1' || normalized === '1y') return '1st Year College';
  if (normalized === '2nd year college' || normalized === '2nd year' || normalized === 'college_2' || normalized === 'college 2' || normalized === '2y') return '2nd Year College';
  if (normalized === '3rd year college' || normalized === '3rd year' || normalized === 'college_3' || normalized === 'college 3' || normalized === '3y') return '3rd Year College';
  if (normalized === '4th year college' || normalized === '4th year' || normalized === 'college_4' || normalized === 'college 4' || normalized === '4y') return '4th Year College';
  if (normalized === '5th year college' || normalized === '5th year' || normalized === 'college_5' || normalized === 'college 5' || normalized === '5y') return '5th Year College';
  return value;
};

// ────────────────────────────────────────────────────────────
// Small shared bits
// ────────────────────────────────────────────────────────────

const StatusPill = ({ status }) => {
  const map = {
    approved: { label: 'Accepted', color: '#10b981', bg: '#f0fdf4' },
    rejected: { label: 'Rejected', color: '#ef4444', bg: '#fef2f2' },
    pending:  { label: 'Pending',  color: '#f59e0b', bg: '#fffbeb' },
    passed:   { label: 'Passed',   color: '#10b981', bg: '#f0fdf4' },
    failed:   { label: 'Failed',   color: '#ef4444', bg: '#fef2f2' },
  };
  const s = map[status] || map.pending;
  return (
    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
      style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
};

const QualityBadge = ({ score, status }) => {
  const color = status === 'accepted' ? '#10b981' : status === 'medium_risk' ? '#d97706' : '#ef4444';
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${color}18` }}>
      <span className="text-[11px] font-black" style={{ color }}>{score ?? 0}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>/100</span>
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title, count }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${MAROON}12` }}>
      <Icon size={12} style={{ color: MAROON }} />
    </div>
    <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">{title}</h4>
    <span className="text-[10px] font-bold text-slate-300">({count})</span>
  </div>
);

const EmptyRow = ({ label }) => (
  <div className="rounded-xl px-4 py-3 text-xs text-slate-400 italic" style={{ backgroundColor: '#f8f7f9' }}>
    No {label} submitted yet.
  </div>
);

// Accept/reject control used on every item across all 4 sections.
// Accept = instant action. Reject = opens the shared ReviewModal (via openReviewModal)
// so decision + feedback happen in the same modal UI as the rest of the app.
const ReviewControls = ({ item, onReview, onOpenReject, busy }) => {
  if (item.status === 'approved' || item.status === 'rejected') {
    return (
      <div className="flex items-center gap-2">
        <StatusPill status={item.status} />
        {item.status === 'rejected' && item.staff_comment && (
          <span className="text-[11px] text-slate-400 italic max-w-[220px] truncate" title={item.staff_comment}>
            "{item.staff_comment}"
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button disabled={busy}
        onClick={() => onReview(item, 'approved', '')}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-opacity hover:opacity-85 disabled:opacity-40"
        style={{ backgroundColor: '#10b981', color: '#fff' }}>
        <CheckCircle2 size={12} /> Accept
      </button>
      <button disabled={busy}
        onClick={() => onOpenReject(item)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-opacity hover:opacity-85 disabled:opacity-40"
        style={{ backgroundColor: '#fff', color: '#ef4444', border: '1.5px solid #fecaca' }}>
        <XCircle size={12} /> Reject
      </button>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// Item rows per section type
// ────────────────────────────────────────────────────────────

const LetterItem = ({ item, onReview, onOpenReject, busy, onPreview, onGeneratePdf, generatingPdfId }) => {
  const [open, setOpen] = useState(false);
  const backendRoot = API.replace(/\/api$/, '');
  const generatedPdfUrl = item.generated_pdf_path ? `${backendRoot}${item.generated_pdf_path}` : null;
  const generatedPdfSrc = generatedPdfUrl ? `${generatedPdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH` : null;

  return (
    <div className="rounded-xl border border-slate-100 p-4 mb-2 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <QualityBadge score={item.quality_score} status={item.quality_status} />
            <span className="text-[11px] text-slate-400">
              {new Date(item.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {item.sentiment_label && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {item.sentiment_label}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 leading-relaxed" style={{
            display: '-webkit-box',
            WebkitLineClamp: open ? 'unset' : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {item.letter_content || <span className="italic text-slate-300">No letter content.</span>}
          </p>
          {item.letter_content && item.letter_content.length > 120 && (
            <button onClick={() => setOpen(o => !o)}
              className="text-[10px] font-bold mt-1 uppercase tracking-wide" style={{ color: MAROON }}>
              {open ? 'Show less' : 'Read full letter'}
            </button>
          )}

          {item.generated_pdf_path ? (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-black">Generated PDF</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">Letter template preview available</p>
                </div>
                <button onClick={() => onPreview(item.generated_pdf_path, 'Generated PDF')}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: '#2563eb' }}>
                  <ExternalLink size={14} />
                  Open PDF
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">This PDF was generated automatically from the submitted letter and scholar profile.</p>
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-black">Generated PDF</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">No PDF generated yet</p>
                </div>
                <button onClick={() => onGeneratePdf(item.id)}
                  disabled={generatingPdfId === item.id}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: generatingPdfId === item.id ? '#94a3b8' : '#2563eb' }}>
                  {generatingPdfId === item.id ? 'Generating…' : 'Generate PDF'}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Generate the letter PDF now so officers can preview it instantly.</p>
            </div>
          )}

          {open ? (
            <div className="mt-4 space-y-4">
              {item.generated_pdf_path && (
                <button onClick={() => onPreview(item.generated_pdf_path, 'Generated PDF')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-opacity hover:opacity-85"
                  style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                  <ExternalLink size={14} />
                  View generated PDF
                </button>
              )}
              <LetterDocumentCard sub={item} />
            </div>
          ) : item.media?.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {/* NOTE: scholar's photo description/comment is intentionally NOT passed here
                  and NOT shown as a label — that field stays hidden from the officer side. */}
              {item.media.map((m, i) => (
                <button key={m.id} onClick={() => onPreview(m.file_path, 'Letter Photo')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-opacity hover:opacity-80"
                  style={{ backgroundColor: '#f8f7f9', border: '1px solid #ede9ee', color: '#6b7280' }}>
                  <Paperclip size={10} />
                  <span>Photo {item.media.length > 1 ? i + 1 : ''}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex-shrink-0">
          <ReviewControls item={item} onReview={onReview} onOpenReject={onOpenReject} busy={busy} />
        </div>
      </div>
    </div>
  );
};

const GradesItem = ({ item, onReview, onOpenReject, busy, onPreview }) => (
  <div className="rounded-xl border border-slate-100 p-4 mb-2 bg-white">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-xs font-black text-slate-700">{item.semester} · AY {item.academic_year}</span>
          <span className="text-[11px] font-bold" style={{ color: item.academic_status === 'passed' ? '#10b981' : '#ef4444' }}>
            GWA {item.gwa ?? '—'}
          </span>
          <StatusPill status={item.academic_status} />
        </div>
        <p className="text-[11px] text-slate-400 mb-2">{item.subjects.length} subject{item.subjects.length !== 1 ? 's' : ''} submitted</p>
        {item.proof_path && (
          <button onClick={() => onPreview(item.proof_path, `Grade Proof — ${item.semester} AY ${item.academic_year}`)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold w-fit transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#f8f7f9', border: '1px solid #ede9ee', color: '#6b7280' }}>
            <ExternalLink size={10} /> View proof photo
          </button>
        )}
      </div>
      <div className="flex-shrink-0">
        <ReviewControls item={item} onReview={onReview} onOpenReject={onOpenReject} busy={busy} />
      </div>
    </div>
  </div>
);

const FileItem = ({ item, label, path, onReview, onOpenReject, busy, onPreview }) => (
  <div className="rounded-xl border border-slate-100 p-4 mb-2 bg-white">
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-black text-slate-700">{label}</span>
          <span className="text-[11px] text-slate-400">
            {new Date(item.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        {path ? (
          <button onClick={() => onPreview(path, label)}
            className="flex items-center gap-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={{ color: MAROON }}>
            <ExternalLink size={11} /> View file
          </button>
        ) : item.media?.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-1">
            {item.media.map(m => (
              <button key={m.id} onClick={() => onPreview(m.file_path, label, m.description)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#f8f7f9', border: '1px solid #ede9ee', color: '#6b7280' }}>
                <Paperclip size={10} />
                <span className="max-w-[140px] truncate">{m.description || 'File'}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-slate-300 italic">No file attached</span>
        )}
      </div>
      <div className="flex-shrink-0">
        <ReviewControls item={item} onReview={onReview} onOpenReject={onOpenReject} busy={busy} />
      </div>
    </div>
  </div>
);

// ────────────────────────────────────────────────────────────
// Scholar card (one per scholar, expandable, all 4 sections inside)
// ────────────────────────────────────────────────────────────

const ScholarCard = ({ scholar, onReview, onOpenReject, busyId, onPreview, onGeneratePdf, generatingPdfId }) => {
  const [expanded, setExpanded] = useState(false);

  // ReviewModal expects modal.full_name / modal.scholar_id on the item itself,
  // so we merge scholar context into every item before it's handed to a child.
  // Grades items don't have their own `id` (they're stored per-subject-row),
  // so we tag them with is_grades + the composite key the parent needs to
  // route the review to the right endpoint.
  const withScholarMeta = (item, extra = {}) => ({
    ...item,
    full_name: scholar.full_name,
    scholar_id: scholar.scholar_id,
    ...extra,
  });

  const pendingCount = useMemo(() => {
    const all = [
      ...scholar.monthly_letters, ...scholar.report_cards,
      ...scholar.cors, ...scholar.other_documents,
    ];
    const gradesPending = scholar.grades.filter(g => (g.status || 'pending') === 'pending').length;
    return all.filter(x => x.status === 'pending' || !x.status).length + gradesPending;
  }, [scholar]);

  return (
    <div className="rounded-2xl border border-white shadow-sm bg-white mb-4 overflow-hidden">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
            style={{ backgroundColor: `${MAROON}12`, color: MAROON }}>
            {(scholar.full_name || scholar.scholar_id || '?').charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-sm font-black text-slate-800">{scholar.full_name || 'Unnamed Scholar'}</p>
            <p className="text-[11px] text-slate-400">{scholar.scholar_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide"
              style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
              {pendingCount} pending
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1" style={{ borderTop: '1px solid #f1f0f2' }}>

          <div className="mt-4">
            <SectionHeader icon={FileText} title="Monthly Letter" count={scholar.monthly_letters.length} />
            {scholar.monthly_letters.length === 0
              ? <EmptyRow label="monthly letter" />
              : scholar.monthly_letters.map(item => (
                  <LetterItem key={item.id} item={withScholarMeta(item)} onReview={onReview} onOpenReject={onOpenReject}
                    busy={busyId === item.id} onPreview={onPreview}
                    onGeneratePdf={onGeneratePdf} generatingPdfId={generatingPdfId} />
                ))}
          </div>

          <div className="mt-5">
            <SectionHeader icon={GraduationCap} title="Grades" count={scholar.grades.length} />
            {scholar.grades.length === 0
              ? <EmptyRow label="grades" />
              : scholar.grades.map((item, i) => (
                  <GradesItem key={i}
                    item={withScholarMeta(item, { is_grades: true })}
                    onReview={onReview} onOpenReject={onOpenReject}
                    busy={busyId === `grades-${scholar.scholar_id}-${item.semester}-${item.academic_year}`}
                    onPreview={onPreview} />
                ))}
          </div>

          <div className="mt-5">
            <SectionHeader icon={IdCard} title="Certificate of Registration" count={scholar.cors.length} />
            {scholar.cors.length === 0
              ? <EmptyRow label="COR" />
              : scholar.cors.map(item => (
                  <FileItem key={item.id} item={withScholarMeta(item)} label="COR" path={item.cor_path}
                    onReview={onReview} onOpenReject={onOpenReject} busy={busyId === item.id} onPreview={onPreview} />
                ))}
          </div>

          <div className="mt-5">
            <SectionHeader icon={Paperclip} title="Other Documents" count={scholar.other_documents.length} />
            {scholar.other_documents.length === 0
              ? <EmptyRow label="other documents" />
              : scholar.other_documents.map(item => (
                  <FileItem key={item.id} item={withScholarMeta(item)} label="Document" path={null}
                    onReview={onReview} onOpenReject={onOpenReject} busy={busyId === item.id} onPreview={onPreview} />
                ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────

const OfficerManualValidation = () => {
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  // Reject flow now goes through the shared ReviewModal (same pattern as OfficerManualValidation.jsx)
  const [modal, setModal] = useState(null);       // the item being reviewed
  const [decision, setDecision] = useState('rejected');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  // Shared in-page file preview (same component used by OfficerManualValidation.jsx)
  const [filePreview, setFilePreview] = useState(null); // { url, kind, label }
  const [generatingPdfId, setGeneratingPdfId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/submission/scholar-view`, { headers: authHeader() });
      setScholars(res.data);
    } catch (e) {
      console.error('Error fetching scholar view:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchData();
    })();
  }, [fetchData]);

  // Accept = instant, no modal needed. Branches to the grades-specific
  // endpoint when the item is a semester grades submission (no single `id`).
  const handleReview = async (item, status, staff_comment) => {
    const busyKey = item.is_grades
      ? `grades-${item.scholar_id}-${item.semester}-${item.academic_year}`
      : item.id;
    setBusyId(busyKey);
    try {
      if (item.is_grades) {
        await axios.put(`${API}/submission/grades/review`, {
          scholar_id: item.scholar_id,
          semester: item.semester,
          academic_year: item.academic_year,
          status,
          staff_comment,
        }, { headers: authHeader() });
      } else {
        await axios.put(`${API}/submission/review/${item.id}`, { status, staff_comment }, { headers: authHeader() });
      }
      await fetchData();
    } catch (e) {
      console.error('Review error:', e);
    } finally {
      setBusyId(null);
    }
  };

  // Reject = open the shared ReviewModal so feedback is entered there
  const handleOpenReject = (item) => {
    setModal(item);
    setDecision('rejected');
    setFeedback('');
  };

  const submitReview = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.is_grades) {
        await axios.put(`${API}/submission/grades/review`, {
          scholar_id: modal.scholar_id,
          semester: modal.semester,
          academic_year: modal.academic_year,
          status: decision,
          staff_comment: feedback,
        }, { headers: authHeader() });
      } else {
        await axios.put(`${API}/submission/review/${modal.id}`, {
          status: decision,
          staff_comment: feedback,
        }, { headers: authHeader() });
      }
      setModal(null);
      await fetchData();
    } catch (e) {
      console.error('Review error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async (submissionId) => {
    setGeneratingPdfId(submissionId);
    try {
      await axios.get(`${API}/submission/generate-pdf/${submissionId}`, { headers: authHeader() });
      await fetchData();
    } catch (e) {
      console.error('Error generating PDF:', e);
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const handlePreview = (path, label = 'File Preview', description = null) => {
    if (!path) return;
    const backendRoot = API.replace(/\/api$/, '');
    const normalized = path.startsWith('/') ? `${backendRoot}${path}` : path;
    const proxied = normalized.includes('res.cloudinary.com')
      ? `${API}/submission/preview?url=${encodeURIComponent(normalized)}`
      : normalized;
    setFilePreview({ url: proxied, kind: fileKind(normalized), label, description });
  }; 

  const filtered = scholars.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (s.full_name || '').toLowerCase().includes(q) || (s.scholar_id || '').toLowerCase().includes(q);
  });

  // Aggregate stats across every scholar's items (letters, grades, cors, other docs).
  // Negative Tone only ever applies to monthly letters (sentiment_label).
  const stats = useMemo(() => {
    let pending = 0, approved = 0, rejected = 0, negative = 0;
    scholars.forEach(s => {
      [s.monthly_letters, s.cors, s.other_documents].forEach(arr => {
        (arr || []).forEach(item => {
          if (item.status === 'approved') approved++;
          else if (item.status === 'rejected') rejected++;
          else pending++;
        });
      });
      (s.grades || []).forEach(g => {
        const st = g.status || 'pending';
        if (st === 'approved') approved++;
        else if (st === 'rejected') rejected++;
        else pending++;
      });
      (s.monthly_letters || []).forEach(l => {
        if (l.sentiment_label?.includes('Negative')) negative++;
      });
    });
    return { pending, approved, rejected, negative };
  }, [scholars]);

  return (
    <div className="min-h-screen p-5 sm:p-8" style={{ backgroundColor: '#f8f7f9', fontFamily: "'DM Sans', sans-serif" }}>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${MAROON}15` }}>
            <Shield size={14} style={{ color: MAROON }} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: MAROON }}>Officer Portal</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 leading-none mb-1"
          style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '-0.02em' }}>
          Submission Review
        </h1>
        <p className="text-sm text-slate-400">Validate scholar documents and review monthly letters.</p>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Pending Review', value: stats.pending,  color: '#f59e0b', bg: '#fffbeb', icon: Clock },
            { label: 'Approved',       value: stats.approved, color: '#10b981', bg: '#f0fdf4', icon: CheckCircle2 },
            { label: 'Rejected',       value: stats.rejected, color: '#ef4444', bg: '#fef2f2', icon: XCircle },
            { label: 'Negative Tone',  value: stats.negative, color: MAROON,    bg: '#fdf2f3', icon: AlertTriangle },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className="rounded-2xl p-5 border border-white shadow-sm" style={{ backgroundColor: bg }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                  <Icon size={15} style={{ color }} />
                </div>
              </div>
              <p className="text-4xl font-black" style={{ color, fontFamily: "'Playfair Display', serif" }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="relative mb-6 max-w-md">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search scholar name or ID..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Clock size={14} className="animate-spin" /> Loading scholars...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-sm text-slate-400">
          No scholars found.
        </div>
      ) : (
        filtered.map(scholar => (
          <ScholarCard key={scholar.scholar_id} scholar={scholar}
            onReview={handleReview} onOpenReject={handleOpenReject}
            busyId={busyId} onPreview={handlePreview}
            onGeneratePdf={handleGeneratePdf} generatingPdfId={generatingPdfId} />
        ))
      )}

      {/* REJECT / REVIEW MODAL - shared component, same one used by OfficerManualValidation.jsx */}
      <ReviewModal
        modal={modal}
        decision={decision}
        setDecision={setDecision}
        feedback={feedback}
        setFeedback={setFeedback}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={submitReview}
      />

      {/* IN-PAGE FILE PREVIEW - shared component, same one used across the Officer portal */}
      {filePreview && (
        <FilePreviewModal preview={filePreview} onClose={() => setFilePreview(null)} />
      )}
    </div>
  );
};

export default OfficerManualValidation;