// Monthly letter review queue and decision workflow.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail, CheckCircle2, XCircle, AlertTriangle, ChevronLeft, ChevronRight,
  Download, CheckSquare, Square, Search, FileText, Eye, X,
} from 'lucide-react';
import axios from 'axios';
import { formatYearLevelLabel } from '../../../utils/yearLevelLabels';
import { getOfficerDateRange, readOfficerWorkPreferences } from '../../../utils/officerWorkPreferences';
import { API_BASE as REPORTS_API_BASE, scoreColor } from './ReportsHelpers';
import { downloadReportSummaryPdf } from '../../../utils/reportPdfExport';

/* ───────── CONTRACT: i-match ito sa backend ─────────
 * GET  LIST_PATH?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD -> array ng rows (o { data: [...] })
 *   Mga field na binabasa (snake_case o camelCase): id, scholar_id|studentId, full_name|scholarName,
 *   year_level|year, course, school, submitted_at|submittedAt, quality_score|qualityScore,
 *   quality_status|status ('accepted'|'medium_risk'|'high_risk'), review_status|staff_action|staffAction
 *   ('pending'|'approved'|'returned'|'rejected'), staff_comment, letter_content, generated_pdf_path, content_breakdown
 *   (JSON/object: paragraph, academic, self_improvement, family, difficulty), sentiment_label, sentiment_score
 * POST ACTION_PATH(id) body: { action: 'approve' | 'return', comment }
 */
const LIST_PATH = '/officer/reports/monthly-submissions';
const ACTION_PATH = id => `/officer/reports/monthly-submissions/${encodeURIComponent(id)}/action`;
const LOG_PATH = '/export/google-sheets';

const API_BASE = REPORTS_API_BASE;
const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const letterFileName = letter => `Monthly_Letter_${String(letter.scholarName || 'Scholar').trim().replace(/[^\w-]+/g, '_')}_${letter.submittedRaw ? String(letter.submittedRaw).slice(0, 7) : 'report'}.pdf`;

const getLetterPdfBlob = async letter => {
  if (letter.pdfUrl) {
    const url = new URL(letter.pdfUrl, `${API_BASE}/`);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported letter PDF URL.');
    const apiOrigin = new URL(API_BASE).origin;
    const response = await axios.get(url.href, {
      ...(url.origin === apiOrigin ? authConfig() : {}),
      responseType: 'blob',
    });
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    const contentType = blob.type.toLowerCase().split(';', 1)[0].trim();
    if (contentType && !['application/pdf', 'application/octet-stream'].includes(contentType)) {
      throw new Error('The letter file is not a PDF.');
    }
    return new Blob([blob], { type: 'application/pdf' });
  }

  if (!letter.fullText) throw new Error('Letter content is not available.');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 56;
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(79, 22, 32);
  doc.text('Monthly Progress Letter', margin, margin);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${letter.scholarName} | ${letter.scholarId} | ${letter.yearLevel} | Submitted ${letter.submittedDate}`, margin, margin + 18);
  doc.setDrawColor(222, 208, 190);
  doc.line(margin, margin + 30, width - margin, margin + 30);
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(36, 21, 18);
  let y = margin + 58;
  for (const line of doc.splitTextToSize(letter.fullText, width - 2 * margin)) {
    if (y > height - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 18;
  }
  return doc.output('blob');
};

// ── Officer design tokens ──
const MAROON = '#6D2140', MAROON_DEEP = '#4f1620', GOLD = '#b98b4e', BG = '#F6EFE4', CARD = '#fffdf8';
const RULE = '#e8dccb', INK = '#241512', MUTED = '#a89890', SAGE = '#3F8A55', AMBER = '#b8863f', CLAY = '#C1666B';
const display = { fontFamily: "'Lora', Georgia, serif" };
const body = { fontFamily: "'Work Sans', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace" };
const tile = { background: CARD, border: `1px solid ${RULE}`, borderRadius: 14, boxShadow: '0 8px 20px -16px rgba(36,21,18,0.35)' };
const fieldLabel = { ...body, display: 'block', fontSize: '0.72rem', fontWeight: 500, color: '#7a6a62', marginBottom: 5 };
const boxField = { height: 40, padding: '0 10px', border: `1px solid ${RULE}`, borderRadius: 8, background: CARD, ...body, fontSize: '0.84rem', color: INK, outline: 'none', minWidth: 140 };
const outlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px', border: `1px solid ${RULE}`, borderRadius: 8, background: CARD, color: MAROON_DEEP, ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' };
const filledBtn = c => ({ ...outlineBtn, justifyContent: 'center', background: c, color: '#fff', border: 'none' });

// ── Config ──
const sentimentCfg = {
  positive: { color: SAGE, label: 'Positive' },
  neutral: { color: AMBER, label: 'Neutral' },
  negative: { color: CLAY, label: 'Negative' },
};
const qualityCfg = {
  accepted: { color: SAGE, label: 'Quality Accepted' },
  medium_risk: { color: AMBER, label: 'Quality Medium Risk' },
  high_risk: { color: CLAY, label: 'Quality High Risk' },
};
const RUBRIC = [
  { key: 'paragraph', label: 'Paragraph Structure', max: 7 },
  { key: 'academic', label: 'Academic Updates', max: 21 },
  { key: 'self_improvement', label: 'Self-Improvement', max: 14 },
  { key: 'family', label: 'Family Situation', max: 7 },
  { key: 'difficulty', label: 'Socio-Economic Difficulty', max: 21 },
];

// ── Adapter (isang lugar para sa response shape) ──
const pick = (row, ...keys) => { for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k]; return undefined; };
const normReview = v => {
  const s = String(v || '').toLowerCase();
  if (s === 'approved') return 'approved';
  if (['returned', 'rejected', 'needs_revision', 'revision'].includes(s)) return 'returned';
  return 'pending';
};
const normQuality = v => {
  const s = String(v || '').toLowerCase().replace(/-/g, '_');
  return qualityCfg[s] ? s : null; // walang imbento
};
const formatDate = v => (v ? new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const wordCountOf = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const getSentiment = (label, score) => {
  const l = String(label || '').toLowerCase();
  const n = score === undefined || score === null || score === '' ? null : Number(score);
  const s100 = n === null || Number.isNaN(n) ? null : (n >= -1 && n <= 1 ? Math.round((n + 1) * 50) : Math.round(Math.max(0, Math.min(100, n))));
  const sentiment = ['positive', 'negative', 'neutral'].includes(l) ? l
    : s100 === null ? null : s100 >= 70 ? 'positive' : s100 < 40 ? 'negative' : 'neutral';
  return { sentiment, score: s100 };
};

const mapRow = row => {
  const fullText = pick(row, 'letter_content', 'letterContent') || '';
  let cb = pick(row, 'content_breakdown', 'contentBreakdown');
  try { if (typeof cb === 'string') cb = JSON.parse(cb); } catch { cb = null; }
  const rubric = cb && typeof cb === 'object' ? RUBRIC.map(r => ({ label: r.label, max: r.max, score: Number(cb[r.key] ?? 0) })) : [];
  const q = pick(row, 'quality_score', 'qualityScore');
  const score = q === undefined ? null : Number(q);
  const { sentiment, score: sScore } = getSentiment(pick(row, 'sentiment_label', 'sentimentLabel'), pick(row, 'sentiment_score', 'sentimentScore'));
  const quality = normQuality(pick(row, 'quality_status', 'qualityStatus', 'status'));
  const yl = pick(row, 'year_level', 'year');
  return {
    id: row.id, // totoong ID ng submission
    scholarId: pick(row, 'scholar_id', 'studentId', 'student_id') || '—',
    scholarName: pick(row, 'full_name', 'scholarName') || 'Unknown scholar',
    yearLevel: yl ? formatYearLevelLabel(yl) : '—',
    course: row.course || '', school: row.school || '',
    submittedRaw: pick(row, 'submitted_at', 'submittedAt'),
    submittedDate: formatDate(pick(row, 'submitted_at', 'submittedAt')),
    type: 'Monthly Progress Report',
    score, quality, sentiment, sentimentScore: sScore,
    sentimentKeywords: Array.isArray(row.sentiment_keywords) ? row.sentiment_keywords : [],
    pdfUrl: pick(row, 'letter_pdf_url', 'letterPdfUrl', 'generated_pdf_path', 'generatedPdfPath', 'letter_file_url', 'file_url') || null,
    review: normReview(pick(row, 'review_status', 'staff_action', 'staffAction')),
    comment: pick(row, 'staff_comment', 'staffComment') || null,
    fullText, excerpt: fullText.slice(0, 240), wordCount: wordCountOf(fullText), rubric,
    bodyScore: rubric.reduce((s, r) => s + r.score, 0),
    checklist: [
      { label: 'Letter body provided', met: wordCountOf(fullText) > 0 },
      { label: 'Minimum word count (300+)', met: wordCountOf(fullText) >= 300 },
      { label: 'Quality evaluation available', met: score !== null },
    ],
    riskFlag: sentiment === 'negative' || quality === 'high_risk',
  };
};

// ── Small shared UI ──
const AlertStrip = ({ color, children, action }) => (
  <div className="flex items-center justify-between gap-3" style={{ ...tile, borderLeft: `3px solid ${color}`, background: `${color}0d`, padding: '11px 16px', ...body, fontSize: '0.8rem', fontWeight: 600, color }} role="alert">
    <span className="flex items-center gap-2"><AlertTriangle size={14} style={{ flexShrink: 0 }} />{children}</span>{action}
  </div>
);
const Pill = ({ color, children }) => (<span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: `${color}16`, color, whiteSpace: 'nowrap' }}>{children}</span>);
const MetricCard = ({ label, children, accent = MAROON }) => (
  <div style={{ background: BG, border: `1px solid ${RULE}`, borderRadius: 12, padding: '14px 16px' }}>
    <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', color: accent, marginBottom: 10 }}>{label}</p>{children}
  </div>
);
const SentimentGauge = ({ score, color }) => (
  <div>
    <div className="relative" style={{ height: 14, marginBottom: 2 }}>
      <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-full" style={{ height: 6, background: RULE }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <div className="absolute" style={{ left: `calc(${score}% - 5px)`, bottom: 4, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `6px solid ${color}` }} />
    </div>
    <div className="flex justify-between" style={{ ...body, fontSize: '0.62rem', color: MUTED }}><span>0</span><span>50</span><span>100</span></div>
  </div>
);

function PdfPages({ blob }) {
  const hostRef = useRef(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    let pdf = null;
    const renderTasks = [];

    const renderPdf = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (cancelled) {
          if (typeof pdf.destroy === 'function') await pdf.destroy();
          return;
        }
        const host = hostRef.current;
        if (!host) return;
        host.replaceChildren();

        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, host.clientWidth - 20);
        for (let number = 1; number <= pdf.numPages; number += 1) {
          const page = await pdf.getPage(number);
          if (cancelled) return;
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(width / baseViewport.width, 1.6);
          const viewport = page.getViewport({ scale: scale * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.cssText = `width:${viewport.width / dpr}px;height:${viewport.height / dpr}px;display:block;margin:0 auto 14px;background:#fff;border:1px solid ${RULE};border-radius:4px;box-shadow:0 6px 16px -10px rgba(36,21,18,0.45)`;
          host.appendChild(canvas);
          const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
          renderTasks.push(task);
          await task.promise;
        }
        if (!cancelled) setState('ready');
      } catch (renderError) {
        if (!cancelled) {
          console.error('Could not render monthly letter PDF:', renderError);
          setState('error');
        }
      }
    };

    renderPdf();
    return () => {
      cancelled = true;
      renderTasks.forEach(task => task.cancel());
      if (typeof pdf?.destroy === 'function') void pdf.destroy();
    };
  }, [blob]);

  return (
    <div className="mlr-pdf-scroll" style={{ position: 'relative', overflowY: 'auto', background: '#EFE6D8', borderTop: `1px solid ${RULE}`, padding: 10 }}>
      <div ref={hostRef} />
      {state === 'loading' && <p style={{ ...body, fontSize: '0.8rem', color: MUTED, textAlign: 'center', padding: '24px 0' }}>Rendering letter…</p>}
      {state === 'error' && <p style={{ ...body, fontSize: '0.8rem', color: CLAY, textAlign: 'center', padding: '24px 0' }}>Could not display the PDF.</p>}
    </div>
  );
}

// ── Isang centered Review modal ──
function ReviewModal({ letter, onClose, onDecide, initialMode = null }) {
  const [comment, setComment] = useState(letter.comment || '');
  const [mode, setMode] = useState(initialMode);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState('');
  const [pdfBlob, setPdfBlob] = useState(null);
  const [showPdf, setShowPdf] = useState(false);
  const sc = letter.sentiment ? sentimentCfg[letter.sentiment] : null;
  const qColor = letter.score === null ? MUTED : scoreColor(letter.score);
  const reasonMissing = mode === 'return' && !comment.trim();
  const canDecide = letter.review === 'pending';
  const reviewPill = { pending: [AMBER, 'Pending Review'], approved: [SAGE, 'Approved'], returned: [CLAY, 'Returned'] }[letter.review];

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const togglePdf = async () => {
    if (pdfBusy) return;
    if (showPdf) {
      setShowPdf(false);
      return;
    }
    if (pdfBlob) {
      setShowPdf(true);
      return;
    }
    setPdfBusy(true);
    setPdfErr('');
    try {
      const blob = await getLetterPdfBlob(letter);
      setPdfBlob(blob);
      setShowPdf(true);
    } catch (pdfError) {
      console.error('Could not prepare monthly letter PDF:', pdfError);
      setPdfErr('Could not load the letter PDF. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  const submit = async () => {
    if (!mode || reasonMissing || submitting) return;
    setSubmitting(true); setErr('');
    try { await onDecide(letter.id, mode, comment.trim()); onClose(); }
    catch (e) { setErr(e.response?.data?.error || e.response?.data?.message || 'Could not save the review decision.'); setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" style={{ background: 'rgba(36,21,18,0.55)' }} onClick={() => !submitting && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="mlr-title" onClick={e => e.stopPropagation()} className="mlr-modal flex w-full flex-col"
        style={{ background: CARD, border: `1px solid ${RULE}`, boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)', overflow: 'hidden' }}>
        <div className="flex flex-shrink-0 items-start justify-between gap-3" style={{ padding: '14px 16px', borderBottom: `1px solid ${RULE}` }}>
          <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11" style={{ background: `${MAROON}12`, color: MAROON, ...display, fontWeight: 700 }}>
              {letter.scholarName.split(/\s+/).map(name => name[0]).join('').slice(0, 2).toUpperCase()}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', color: GOLD }}>SUBMISSION DETAILS</p>
              <h2 id="mlr-title" style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color: INK, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{letter.scholarName}</h2>
              <p style={{ ...mono, fontSize: '0.68rem', color: MUTED, overflowWrap: 'anywhere' }}>{letter.scholarId} · {letter.yearLevel} · Submitted {letter.submittedDate}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 sm:hidden">
                {letter.riskFlag && <Pill color={CLAY}>Risk Flag</Pill>}
                <Pill color={reviewPill[0]}>{reviewPill[1]}</Pill>
              </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="hidden sm:flex items-center gap-2">
              {letter.riskFlag && <Pill color={CLAY}>Risk Flag</Pill>}
              <Pill color={reviewPill[0]}>{reviewPill[1]}</Pill>
            </span>
            <button onClick={onClose} disabled={submitting} aria-label="Close review" style={{ ...outlineBtn, padding: 0, width: 38, justifyContent: 'center' }}><X size={16} /></button>
          </div>
        </div>

        <div className="space-y-5 overflow-y-auto p-4 sm:space-y-6 sm:p-6" style={{ flex: 1 }}>
          <div>
            <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', color: GOLD, marginBottom: 10 }}>LETTER</p>
            {letter.fullText || letter.pdfUrl ? (
              <div style={{ border: `1px solid ${RULE}`, borderRadius: 12, background: BG, overflow: 'hidden' }}>
                <div className="flex flex-wrap items-center gap-4" style={{ padding: '14px 16px' }}>
                  <span className="flex h-12 w-10 flex-shrink-0 flex-col items-center justify-center rounded-md" style={{ background: CARD, border: `1px solid ${RULE}`, color: CLAY }}>
                    <FileText size={18} />
                    <span style={{ ...mono, fontSize: '0.5rem', fontWeight: 700, marginTop: 2 }}>PDF</span>
                  </span>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <p style={{ ...body, fontSize: '0.84rem', fontWeight: 600, color: INK, overflowWrap: 'anywhere' }}>{letterFileName(letter)}</p>
                    <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>{letter.wordCount} words · Monthly Progress Report</p>
                  </div>
                  <button onClick={togglePdf} disabled={pdfBusy} className="mlr-btn w-full sm:w-auto"
                    style={{ ...(showPdf ? outlineBtn : filledBtn(MAROON)), justifyContent: 'center', opacity: pdfBusy ? 0.6 : 1 }}>
                    {showPdf ? <X size={14} /> : <Eye size={14} />}
                    {pdfBusy ? 'Loading…' : showPdf ? 'Close Letter' : 'Open Letter'}
                  </button>
                </div>
                {showPdf && pdfBlob && <PdfPages blob={pdfBlob} />}
              </div>
            ) : <p style={{ ...body, fontSize: '0.84rem', color: MUTED }}>Letter content is not available.</p>}
            {pdfErr && <div className="mt-3"><AlertStrip color={CLAY}>{pdfErr}</AlertStrip></div>}
          </div>

          <div>
            <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', color: GOLD, marginBottom: 10 }}>AI EVALUATION</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Quality Score', letter.score === null ? '—' : `${letter.score}%`, letter.rubric.length ? `${letter.bodyScore} / 70 rubric points` : 'No rubric data', qColor],
                ['Sentiment', sc ? sc.label : '—', sc && letter.sentimentScore !== null ? `${letter.sentimentScore} / 100` : 'No sentiment data', sc?.color || MUTED],
                ['Word Count', letter.wordCount, 'words', INK],
              ].map(([label, value, sub, color], index) => (
                <div key={label} className={index === 2 ? 'col-span-2 sm:col-span-1' : ''} style={{ background: BG, border: `1px solid ${RULE}`, borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', color: MUTED, textTransform: 'uppercase' }}>{label}</p>
                  <p style={{ ...display, fontSize: '1.45rem', fontWeight: 700, color, lineHeight: 1.2, marginTop: 4 }}>{value}</p>
                  <p style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>{sub}</p>
                </div>
              ))}
            </div>

            {sc && letter.sentimentScore !== null && (
              <div className="mt-3" style={{ border: `1px solid ${RULE}`, borderRadius: 12, padding: '12px 16px' }}>
                <SentimentGauge score={letter.sentimentScore} color={sc.color} />
                <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 8 }}>Overall: <strong style={{ color: sc.color }}>{sc.label}</strong></p>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <MetricCard label="RUBRIC BREAKDOWN">
                {letter.rubric.length ? <div className="space-y-3">
                  {letter.rubric.map(item => {
                    const percentage = item.max ? Math.min(100, (item.score / item.max) * 100) : 0;
                    const color = percentage >= 80 ? SAGE : percentage >= 50 ? AMBER : CLAY;
                    return <div key={item.label}>
                      <div className="flex items-center justify-between gap-3" style={{ marginBottom: 4 }}>
                        <span style={{ ...body, fontSize: '0.76rem', color: '#3f2f28' }}>{item.label}</span>
                        <span style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, color: INK }}>{item.score}/{item.max}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: RULE, overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', background: color }} />
                      </div>
                    </div>;
                  })}
                </div> : <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>No rubric data.</p>}
              </MetricCard>
              <div className="space-y-3">
                <MetricCard label="COMPLETENESS">
                  <div className="space-y-2">
                    {letter.checklist.map(item => (
                      <div key={item.label} className="flex items-center gap-2">
                        {item.met ? <CheckSquare size={13} style={{ color: SAGE, flexShrink: 0 }} /> : <Square size={13} style={{ color: CLAY, flexShrink: 0 }} />}
                        <span style={{ ...body, fontSize: '0.78rem', color: item.met ? '#3f2f28' : CLAY }}>{item.label}</span>
                      </div>))}
                  </div>
                </MetricCard>
                {letter.sentimentKeywords.length > 0 && (
                  <MetricCard label="KEYWORDS">
                    <div className="flex flex-wrap gap-1.5">
                      {letter.sentimentKeywords.map((keyword, index) => {
                        const word = typeof keyword === 'string' ? keyword : keyword.word;
                        const type = typeof keyword === 'string' ? '' : keyword.type;
                        const color = type === 'positive' ? SAGE : type === 'negative' ? CLAY : MUTED;
                        return <span key={index} style={{ ...body, fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: `${color}14`, color }}>{word}</span>;
                      })}
                    </div>
                  </MetricCard>)}
              </div>
            </div>
          </div>

          {letter.comment && letter.review !== 'pending' || (letter.comment && !mode)
            ? <AlertStrip color={AMBER}>Previous officer feedback: {letter.comment}</AlertStrip> : null}
        </div>
        {canDecide && (
          <div className="flex-shrink-0" style={{ borderTop: `1px solid ${RULE}`, padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: CARD }}>
            {!mode ? (
              <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <p style={{ ...body, fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.06em', color: INK }}>OFFICER DECISION</p>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button onClick={() => setMode('return')} style={{ ...filledBtn(CLAY), justifyContent: 'center' }}><XCircle size={14} /> Return for Revision</button>
                  <button onClick={() => setMode('approve')} style={{ ...filledBtn(SAGE), justifyContent: 'center' }}><CheckCircle2 size={14} /> Approve</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="mlr-comment" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: mode === 'approve' ? SAGE : CLAY }}>
                  {mode === 'approve' ? 'Approval note (optional)' : 'Reason for returning (required)'}
                </label>
                <textarea id="mlr-comment" value={comment} onChange={event => setComment(event.target.value)} rows={3} autoFocus className="w-full resize-none outline-none"
                  placeholder={mode === 'approve' ? 'Optional approval note...' : 'Explain what needs to be revised...'}
                  style={{ ...body, fontSize: '0.88rem', padding: '12px 14px', borderRadius: 12, border: `1px solid ${reasonMissing ? `${CLAY}88` : RULE}`, background: BG, color: INK }} />
                {reasonMissing && <p style={{ ...body, fontSize: '0.74rem', color: CLAY }}>A reason is required before returning this letter.</p>}
                {err && <AlertStrip color={CLAY}>{err}</AlertStrip>}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                  <button onClick={() => { setMode(null); setErr(''); }} disabled={submitting} style={{ ...outlineBtn, justifyContent: 'center' }}>Cancel</button>
                  <button onClick={submit} disabled={reasonMissing || submitting} style={{ ...filledBtn(mode === 'approve' ? SAGE : CLAY), opacity: reasonMissing || submitting ? 0.5 : 1, cursor: reasonMissing || submitting ? 'not-allowed' : 'pointer' }}>
                    {submitting ? 'Saving…' : `Confirm ${mode === 'approve' ? 'Approval' : 'Return'}`}
                  </button>
                </div>
              </div>)}
          </div>)}
      </div>
    </div>
  );
}

// ── CSV helpers ──
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

const DEFAULT_FILTERS = { search: '', yearLevel: 'all', sentiment: 'all' };
// ── Main ──
export default function MonthlyLetterReview({ assignedYearLevels = [], assignedYearLevelsLoading = false }) {
  const [workPreferences] = useState(readOfficerWorkPreferences);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('6m');
  const [month, setMonth] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const pageSize = workPreferences.pageSize;
  const [selectedId, setSelectedId] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true); setError('');
    try {
      const dateRange = month ? { month } : getOfficerDateRange(period);
      const res = await axios.get(`${API_BASE}${LIST_PATH}`, { ...authConfig(), params: dateRange });
      if (id !== reqId.current) return; // stale response
      const list = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.submissions || [];
      setRows(list.map(mapRow));
    } catch (e) {
      if (id === reqId.current) setError(e.response?.data?.error || 'Could not load monthly letter submissions.');
    } finally { if (id === reqId.current) setLoading(false); }
  }, [month, period]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, value) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };
  const yearLevelOptions = useMemo(() => {
    const src = assignedYearLevels.map(formatYearLevelLabel);
    return [...new Set(src)].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [assignedYearLevels]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter(r =>
      (!q || r.scholarName.toLowerCase().includes(q) || String(r.scholarId).toLowerCase().includes(q)) &&
      (filters.yearLevel === 'all' || r.yearLevel === filters.yearLevel) &&
      (filters.sentiment === 'all' || r.sentiment === filters.sentiment));
  }, [rows, filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const pendingCount = rows.filter(r => r.review === 'pending').length;
  const selected = rows.find(r => r.id === selectedId) || null;

  // Isang decision workflow; ang modal ang nagpapakita ng error kapag nag-throw.
  const handleDecide = async (id, action, comment) => {
    await axios.post(`${API_BASE}${ACTION_PATH(id)}`, { action, comment: comment || null }, authConfig());
    setRows(list => list.map(r => r.id === id
      ? { ...r, review: action === 'approve' ? 'approved' : 'returned', comment: comment || null } : r));
    load(); // i-sync sa server (counts, filters, pagination)
  };

  const exportCSV = () => {
    const header = ['Scholar ID', 'Scholar Name', 'Submission Type', 'Submission Date', 'Completeness/Quality Score', 'Sentiment', 'Sentiment Score'];
    const data = filtered.map(r => [r.scholarId, r.scholarName, r.type, r.submittedDate,
      r.score === null ? '' : `${r.score}%`, r.sentiment || '', r.sentimentScore === null ? '' : `${r.sentimentScore}/100`]);
    const csv = [header, ...data].map(row => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'monthly_letter_review.csv'; a.click(); URL.revokeObjectURL(url);
    axios.post(`${API_BASE}${LOG_PATH}`, { log_only: true, module: 'Monthly Letter Review', report_resource: 'Monthly Letter Review Export', spreadsheet_title: 'Monthly Letter Review Export', details: 'monthly_letter_review.csv' }, authConfig()).catch(() => {}); // best-effort
  };

  const exportPDF = async () => {
    setGeneratingPdf(true);
    setError('');
    try {
      await downloadReportSummaryPdf({
        role: 'officer',
        reportTitle: 'Monthly Letter Review',
        reportType: 'Monthly Letter Review',
        periodLabel: { '1m': 'Last month', '3m': 'Last 3 months', '6m': 'Last 6 months' }[period],
        rows: filtered.map(row => ({
          scholarName: row.scholarName,
          studentId: row.scholarId,
          yearLevel: row.yearLevel,
          qualityScore: row.score,
          sentiment: row.sentiment,
          submittedAt: row.submittedRaw,
        })),
      });
    } catch (exportError) {
      console.error('Could not export monthly letter review PDF:', exportError);
      setError(exportError.response?.data?.message || 'Unable to export the monthly letter PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const columns = ['Scholar', 'Scholar ID', 'AI Quality Score', 'Sentiment', 'Submitted', 'Actions'];
  const Select = ({ id, label, value, onChange, options, disabled = false }) => (
    <div><label htmlFor={id} style={fieldLabel}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={{ ...boxField, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1 }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
  );

  return (
    <div className="flex flex-col gap-4" style={{ minWidth: 0, ...body }}>
      <style>{`
        .mlr-btn:hover{background:${BG}}
        .mlr-btn:focus-visible,.mlr-field:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}
        .mlr-table{width:100%;min-width:0;table-layout:fixed}
        .mlr-table .mlr-col-scholar{width:19%}
        .mlr-table .mlr-col-id{width:17%}
        .mlr-table .mlr-col-score{width:13%}
        .mlr-table .mlr-col-sentiment{width:13%}
        .mlr-table .mlr-col-submitted{width:16%}
        .mlr-table .mlr-col-actions{width:22%}
        .mlr-table.mlr-compact th,.mlr-table.mlr-compact td{padding:8px 10px!important}
        .mlr-modal{max-width:860px;max-height:90vh;max-height:90dvh;border-radius:16px}
        .mlr-pdf-scroll{max-height:520px}
        @media(max-width:639px){
          .mlr-filters select,.mlr-filters input[type=month]{width:100%!important;min-width:0!important}
          .mlr-modal{max-height:94vh;max-height:94dvh;border-radius:18px 18px 0 0}
          .mlr-pdf-scroll{max-height:62vh;max-height:62dvh}
        }
      `}</style>

      <div style={{ ...tile, padding: '14px 18px', borderLeft: `3px solid ${GOLD}` }}>
        <div className="mlr-filters grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div className="col-span-2 sm:col-span-1" style={{ flex: '1 1 200px', minWidth: 180 }}>
            <label htmlFor="mlr-search" style={fieldLabel}>Search</label>
            <div className="flex items-center gap-2" style={{ ...boxField, minWidth: 0 }}>
              <Search size={14} style={{ color: MUTED, flexShrink: 0 }} />
              <input id="mlr-search" className="mlr-field" value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Scholar name or ID"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.84rem', color: INK }} />
            </div>
          </div>
          <div><label htmlFor="mlr-period" style={fieldLabel}>Reporting Period</label>
            <select id="mlr-period" className="mlr-field" value={period} onChange={e => { setPeriod(e.target.value); setPage(1); }} style={boxField}>
              <option value="1m">Last month</option>
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
            </select></div>
            <div>
              <label htmlFor="mlr-month" style={fieldLabel}>Filter by Month</label>
              <div className="flex items-center gap-2">
                <input id="mlr-month" className="mlr-field" type="month" value={month} onChange={e => { setMonth(e.target.value); setPage(1); }} style={{ ...boxField, flex: 1, minWidth: 0 }} />
                {month && <button type="button" onClick={() => { setMonth(''); setPage(1); }} style={{ ...body, border: 'none', background: 'none', color: MAROON, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>}
              </div>
            </div>
            <Select id="mlr-year" label="Assigned Year Level" value={filters.yearLevel} onChange={v => setFilter('yearLevel', v)} disabled={assignedYearLevelsLoading || yearLevelOptions.length === 0} options={[[ 'all', assignedYearLevelsLoading ? 'Loading assigned year levels...' : yearLevelOptions.length ? 'All Assigned Year Levels' : 'No Assigned Year Levels' ], ...yearLevelOptions.map(y => [y, y])]} />
          <Select id="mlr-sent" label="Sentiment" value={filters.sentiment} onChange={v => setFilter('sentiment', v)} options={[['all', 'All'], ['positive', 'Positive'], ['neutral', 'Neutral'], ['negative', 'Negative']]} />
          <div className="col-span-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:ml-auto">
            <button onClick={exportPDF} disabled={generatingPdf || filtered.length === 0} style={{ ...outlineBtn, justifyContent: 'center', opacity: generatingPdf || filtered.length === 0 ? 0.5 : 1, cursor: generatingPdf || filtered.length === 0 ? 'not-allowed' : 'pointer' }}>
              <FileText size={14} /> {generatingPdf ? 'Generating…' : 'Download PDF'}
            </button>
            <button onClick={exportCSV} disabled={filtered.length === 0} style={{ ...filledBtn(MAROON), opacity: filtered.length ? 1 : 0.5 }}><Download size={14} /> Export CSV</button>
          </div>
        </div>
        {!loading && <p style={{ fontSize: '0.74rem', color: MUTED, marginTop: 10 }}>
          {filtered.length} matching {filtered.length === 1 ? 'letter' : 'letters'}
          {month && ' for the selected month'}
        </p>}
      </div>

      {error && <AlertStrip color={CLAY} action={<button onClick={load} style={{ ...body, fontSize: '0.74rem', fontWeight: 700, color: CLAY, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>}>{error}</AlertStrip>}

      <div style={{ ...tile, overflow: 'hidden' }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${RULE}` }}>
          <Mail size={20} strokeWidth={1.75} style={{ color: MAROON_DEEP }} />
          <div>
            <h2 style={{ ...display, fontSize: '1.15rem', fontWeight: 600, color: MAROON_DEEP, lineHeight: 1.2 }}>Monthly Letter Review</h2>
            <p style={{ fontSize: '0.78rem', color: MUTED, marginTop: 3 }}>Review monthly letters from your assigned scholars.
              {!loading && !error && pendingCount > 0 && <span style={{ color: AMBER, fontWeight: 600 }}> {pendingCount} awaiting review.</span>}</p>
          </div>
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="px-4 py-14 text-center"><FileText className="mx-auto mb-3 h-9 w-9" style={{ color: RULE }} />
            <p style={{ fontSize: '0.82rem', color: MUTED }}>No letters found.</p></div>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className={`mlr-table${workPreferences.density === 'compact' ? ' mlr-compact' : ''}`} style={{ borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead><tr style={{ background: `${BG}b3`, borderBottom: `1px solid ${RULE}` }}>
                {columns.map((c, i) => <th key={i} scope="col" className={`mlr-col-${['scholar', 'id', 'score', 'sentiment', 'submitted', 'actions'][i]} px-4 py-3 ${i === 5 ? 'text-center' : 'text-left'}`} style={{ fontSize: '0.74rem', fontWeight: 600, color: '#6b5a52', overflowWrap: 'anywhere' }}>{c}</th>)}
              </tr></thead>
              <tbody>
                {loading ? Array.from({ length: 5 }).map((_, r) => (
                  <tr key={r} style={{ borderTop: `1px solid ${RULE}` }}>{columns.map((__, c) => <td key={c} className={`mlr-col-${['scholar', 'id', 'score', 'sentiment', 'submitted', 'actions'][c]} px-4 py-4`}><div className="h-2.5 w-4/5 animate-pulse rounded-full" style={{ background: BG }} /></td>)}</tr>
                )) : paged.map(r => {
                  const sc = r.sentiment ? sentimentCfg[r.sentiment] : null;
                  const color = r.score === null ? MUTED : scoreColor(r.score);
                  const initials = r.scholarName.split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-[#F6EFE4]" style={{ borderTop: `1px solid ${RULE}` }}>
                      <td className="mlr-col-scholar px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${MAROON}12`, color: MAROON, ...display, fontSize: '0.74rem', fontWeight: 700 }}>{initials}</span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: INK }}>{r.scholarName}{r.riskFlag && <span title="Risk flag" style={{ marginLeft: 6, color: CLAY }}><AlertTriangle size={11} style={{ display: 'inline' }} /></span>}</p>
                            <p style={{ fontSize: '0.72rem', color: MUTED }}>{r.yearLevel}</p>
                          </div>
                        </div>
                      </td>
                      <td className="mlr-col-id px-4 py-3" style={{ ...mono, fontSize: '0.74rem', color: '#6b6058', overflowWrap: 'anywhere' }}>{r.scholarId}</td>
                      <td className="mlr-col-score px-4 py-3">{r.score === null ? <span style={{ color: MUTED }}>—</span> : (
                        <div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: RULE }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, r.score))}%`, background: color }} /></div>
                          <span style={{ ...mono, fontSize: '0.74rem', fontWeight: 700, color }}>{r.score}</span></div>)}</td>
                      <td className="mlr-col-sentiment px-4 py-3">{sc ? <Pill color={sc.color}>{sc.label}</Pill> : <span style={{ color: MUTED }}>—</span>}</td>
                      <td className="mlr-col-submitted px-4 py-3" style={{ fontSize: '0.76rem', color: '#7a6a62', overflowWrap: 'anywhere' }}>{r.submittedDate}</td>
                      <td className="mlr-col-actions px-4 py-3" style={{ textAlign: 'center' }}>
                        <div className="flex flex-col items-center gap-1.5">
                          {r.review === 'pending' && (
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={() => { setSelectedId(r.id); setSelectedAction('approve'); }} aria-label={`Approve letter from ${r.scholarName}`} style={{ ...filledBtn(SAGE), height: 30, padding: '0 9px', fontSize: '0.7rem' }}>
                                <CheckCircle2 size={12} /> Approve
                              </button>
                              <button type="button" onClick={() => { setSelectedId(r.id); setSelectedAction('return'); }} aria-label={`Return letter from ${r.scholarName}`} style={{ ...filledBtn(CLAY), height: 30, padding: '0 9px', fontSize: '0.7rem' }}>
                                <XCircle size={12} /> Return
                              </button>
                            </div>
                          )}
                          <button type="button" className="mlr-btn" onClick={() => { setSelectedId(r.id); setSelectedAction(null); }} aria-label={`View letter from ${r.scholarName}`} style={{ ...outlineBtn, height: 32 }}>
                            <Eye size={13} /> View
                          </button>
                        </div>
                      </td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>
          <div className="md:hidden">
            {loading ? Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="px-4 py-4" style={{ borderTop: `1px solid ${RULE}` }}>
                <div className="h-3 w-1/2 animate-pulse rounded-full" style={{ background: BG }} />
                <div className="mt-3 h-2.5 w-3/4 animate-pulse rounded-full" style={{ background: BG }} />
              </div>
            )) : paged.map(row => {
              const sentiment = row.sentiment ? sentimentCfg[row.sentiment] : null;
              const scoreColorValue = row.score === null ? MUTED : scoreColor(row.score);
              const initials = row.scholarName.split(/\s+/).map(name => name[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={row.id} className="px-4 py-4" style={{ borderTop: `1px solid ${RULE}` }}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${MAROON}12`, color: MAROON, ...display, fontSize: '0.78rem', fontWeight: 700 }}>{initials}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.88rem', fontWeight: 600, color: INK, overflowWrap: 'anywhere' }}>
                        {row.scholarName}{row.riskFlag && <span title="Risk flag" style={{ marginLeft: 6, color: CLAY }}><AlertTriangle size={12} style={{ display: 'inline' }} /></span>}
                      </p>
                      <p style={{ ...mono, fontSize: '0.7rem', color: MUTED, overflowWrap: 'anywhere' }}>{row.scholarId} · {row.yearLevel}</p>
                    </div>
                    {sentiment && <Pill color={sentiment.color}>{sentiment.label}</Pill>}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    {row.score === null ? <span style={{ fontSize: '0.74rem', color: MUTED }}>No quality score</span> : (
                      <div className="flex flex-1 items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: RULE, maxWidth: 140 }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, row.score))}%`, background: scoreColorValue }} />
                        </div>
                        <span style={{ ...mono, fontSize: '0.74rem', fontWeight: 700, color: scoreColorValue }}>{row.score}</span>
                      </div>)}
                    <span style={{ fontSize: '0.74rem', color: '#7a6a62', whiteSpace: 'nowrap' }}>{row.submittedDate}</span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {row.review === 'pending' && (<>
                      <button type="button" onClick={() => { setSelectedId(row.id); setSelectedAction('approve'); }} aria-label={`Approve letter from ${row.scholarName}`} style={{ ...filledBtn(SAGE), justifyContent: 'center', minHeight: 38 }}>
                        <CheckCircle2 size={13} /> Approve
                      </button>
                      <button type="button" onClick={() => { setSelectedId(row.id); setSelectedAction('return'); }} aria-label={`Return letter from ${row.scholarName}`} style={{ ...filledBtn(CLAY), justifyContent: 'center', minHeight: 38 }}>
                        <XCircle size={13} /> Return
                      </button>
                    </>)}
                    <button type="button" className="mlr-btn" onClick={() => { setSelectedId(row.id); setSelectedAction(null); }} aria-label={`View letter from ${row.scholarName}`} style={{ ...outlineBtn, justifyContent: 'center', minHeight: 38, gridColumn: row.review === 'pending' ? '1 / -1' : undefined }}>
                      <Eye size={13} /> View
                    </button>
                  </div>
                </div>);
            })}
          </div>
          </>
        )}

        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: `1px solid ${RULE}` }}>
            <p style={{ fontSize: '0.76rem', color: MUTED }}>Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} of {filtered.length} letters</p>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} aria-label="Previous page" style={{ ...outlineBtn, height: 32, padding: '0 9px', opacity: safePage <= 1 ? 0.45 : 1 }}><ChevronLeft size={15} /></button>
              <span style={{ fontSize: '0.74rem', color: INK, minWidth: 76, textAlign: 'center' }}>Page {safePage} of {pageCount}</span>
              <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount} aria-label="Next page" style={{ ...outlineBtn, height: 32, padding: '0 9px', opacity: safePage >= pageCount ? 0.45 : 1 }}><ChevronRight size={15} /></button>
            </div>
          </div>)}
      </div>

      {selected && <ReviewModal
        key={`${selected.id}-${selectedAction || 'view'}`}
        letter={selected}
        initialMode={selectedAction}
        onClose={() => { setSelectedId(null); setSelectedAction(null); }}
        onDecide={handleDecide}
      />}
    </div>
  );
}