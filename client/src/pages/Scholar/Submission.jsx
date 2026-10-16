import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Upload, CheckCircle, XCircle, Send, Bookmark,
  ArrowLeft, Sparkles, FileText,
  User, History,
  Mail, GraduationCap, IdCard, Folder,
  CheckSquare, Square, Inbox, Search,
} from 'lucide-react';

import InfoField from '../../components/Scholar/SubmissionPage/InfoField';
import MediaUploader from '../../components/Scholar/SubmissionPage/MediaUploader';
import ConfirmModal from '../../components/Scholar/SubmissionPage/ConfirmModal';
import SubmittedView from '../../components/Scholar/SubmissionPage/SubmittedView';
import SubmissionHistory from '../../components/Scholar/SubmissionPage/SubmissionHistory';
import ScholarGrades from '../../components/Scholar/SubmissionPage/ScholarGrades';
import { CHECKLIST, LETTER_BODY_MAX, buildEval, calcInfoScore, calcMediaScore, classifyAcademicTone, classifyQualityScore, getRiskBg, getRiskBorder } from '../../utils/submissionScoring';
import { uploadResumableFile } from '../../utils/resumableUpload';

// ── Apple Scholar Portal design system (per redesign brief) ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const GOLD = '#B98B4E';
const SUCCESS = '#6B8F71';
const WARNING = '#B8863F';
const DANGER = '#C1666B';
const INK = '#241512';
const MUTED = '#8A7A68';
const SLATE = '#5c7487';
const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const API_BASE = 'http://localhost:5000/api/submission';

const asText = (value) => {
    if (value === null || typeof value === 'undefined') return '';
    return String(value).trim();
};

const authHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

const postWithRetry = async (url, formData) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await axios.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...authHeader() },
        timeout: 60_000,
      });
    } catch (error) {
      lastError = error;
      const shouldRetry = !error.response || error.response.status >= 500;
      if (!shouldRetry || attempt === 2) throw error;
      await wait(1000 * (attempt + 1));
    }
  }
  throw lastError;
};

const submissionTypes = [
  { id: 'monthly-report', label: 'Monthly Letter' },
  { id: 'grades', label: 'Grades' },
  { id: 'cor', label: 'COR' },
  { id: 'other', label: 'Other Documents' },
];

const TYPE_ICONS = {
  'monthly-report': Mail,
  'grades': GraduationCap,
  'cor': IdCard,
  'other': Folder,
};

const SUBMISSION_TYPE_TO_TAB = {
  letter: 'monthly-report',
  report_card: 'other',
  cor: 'cor',
  other: 'other',
};

const underlineField = {
  width: '100%', padding: '9px 2px', border: 'none', borderBottom: `1.5px solid ${BORDER}`,
  background: 'none', ...body, fontSize: '0.875rem', color: INK, outline: 'none',
};
const fieldLabel = { ...body, fontSize: '0.7rem', color: MUTED, display: 'block', marginBottom: 6, fontWeight: 600, letterSpacing: '0.03em' };

const outlineBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE, color: INK, ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' };
const filledBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', border: 'none', borderRadius: 12, background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, color: '#fff', ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' };

// A left-border alert strip, used consistently across the portal.
const AlertStrip = ({ color, children }) => (
  <div style={{ borderLeft: `3px solid ${color}`, background: `${color}0d`, borderRadius: '0 12px 12px 0', padding: '10px 14px', ...body, fontSize: '0.8rem', fontWeight: 600, color }}>
    {children}
  </div>
);

// Card-header pattern used throughout the redesigned portal: a gold
// eyebrow above a serif heading.
const CardHeader = ({ icon: Icon, eyebrow, title, right }) => (
  <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
    <div className="flex items-center gap-2.5">
      {Icon && (
        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, borderRadius: 9, background: `${PRIMARY}14` }}>
          <Icon size={14} style={{ color: PRIMARY }} />
        </span>
      )}
      <div>
        <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: GOLD }}>{eyebrow}</p>
        <h2 style={{ ...display, fontWeight: 600, color: INK, marginTop: 2 }} className="text-base sm:text-[1.05rem]">{title}</h2>
      </div>
    </div>
    {right}
  </div>
);

// Grade badge for the overall evaluated score.
const GradeStamp = ({ score, color, size = 'lg' }) => {
  const big = size === 'lg';
  return (
    <div
      className="flex flex-col items-center justify-center flex-shrink-0"
      style={{
        width: big ? 84 : 68, height: big ? 70 : 58,
        borderRadius: 16, color,
        background: `${color}12`, border: `1px solid ${color}33`,
      }}
    >
      <span style={{ ...body, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.06em' }}>GRADE</span>
      <span style={{ ...display, fontSize: big ? '1.6rem' : '1.3rem', fontWeight: 700, lineHeight: 1 }}>{score}</span>
      <span style={{ ...body, fontSize: '0.52rem', color, opacity: 0.8 }}>/ 100</span>
    </div>
  );
};

// Score bar with progress indicator
const ScoreBar = ({ score, weight, label }) => {
  const color = score >= 75 ? SUCCESS : score >= 50 ? WARNING : DANGER;
  return (
    <div className="rounded-xl px-3 py-2 mb-1.5" style={{ background: `${color}0f`, border: `1px solid ${color}30` }}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <span style={{ ...body, fontSize: '0.73rem', color: '#3f2f28', fontWeight: 500 }}>{label}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span style={{ ...body, fontSize: '0.62rem', color: MUTED }}>{weight} pts</span>
          <span style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color }}>{score}/100</span>
        </div>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 4, background: BORDER }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
};

// Compact progress-overview card (replaces the old flat StatCard trio)
const ProgressCard = ({ eyebrow, title, children }) => (
  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 18px' }}>
    <p style={{ ...body, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.05em', color: GOLD, marginBottom: 4 }}>{eyebrow}</p>
    <p style={{ ...display, fontSize: '1rem', fontWeight: 600, color: INK, marginBottom: 10 }}>{title}</p>
    {children}
  </div>
);

const MiniBar = ({ pct, color }) => (
  <div className="rounded-full overflow-hidden" style={{ height: 6, background: BORDER }}>
    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
  </div>
);

// Large circular completion ring used in the sticky panel
const CompletionRing = ({ pct, color }) => {
  const size = 84;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color: INK }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
};

// 4-step workflow navigation for the Monthly Letter flow. Steps 1–3 are
// sections of the single existing editor view (there is no separate
// state per section today) so clicking them scrolls to that section.
// Step 4 reuses the existing handleEvaluate() function exactly as the
// old "Evaluate Report" button did — no new business logic.
const WorkflowSteps = ({ steps, onStepClick }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
    {steps.map((step, i) => (
      <button
        key={step.key}
        onClick={() => onStepClick(step)}
        disabled={step.disabled}
        className="text-left"
        style={{
          padding: '12px 14px', borderRadius: 14, cursor: step.disabled ? 'not-allowed' : 'pointer',
          border: `1px solid ${step.active ? PRIMARY : BORDER}`,
          background: step.active ? PRIMARY : SURFACE,
          opacity: step.disabled ? 0.55 : 1,
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 20, height: 20, borderRadius: '50%', ...body, fontSize: '0.62rem', fontWeight: 700,
              background: step.completed ? SUCCESS : step.active ? 'rgba(255,255,255,0.2)' : BG,
              color: step.completed || step.active ? '#fff' : MUTED,
            }}
          >
            {step.completed ? <CheckCircle size={12} /> : i + 1}
          </span>
          <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: step.active ? '#EBD9E0' : MUTED, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Step {i + 1}
          </span>
        </div>
        <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: step.active ? '#fff' : INK }}>{step.title}</p>
      </button>
    ))}
  </div>
);

// Key used to cache the scholar's own info fields locally, so they don't
// have to be retyped every time (e.g. after a rejection/resubmit).
const scholarInfoStorageKey = (scholarId) => `scholar_info_cache_${scholarId}`;
const scholarDraftStorageKey = (scholarId) => `scholar_submission_draft_${scholarId}`;

const formatYearLevelLabel = (value) => {
  if (!value) return '';
  const normalized = String(value).trim().toLowerCase().replace(/_/g, ' ');
  if (!normalized) return '';

  const aliasMap = {
    'grade 7': 'Grade 7',
    'grade 8': 'Grade 8',
    'grade 9': 'Grade 9',
    'grade 10': 'Grade 10',
    'grade 11': 'Grade 11',
    'grade 12': 'Grade 12',
    'college 1': '1st Year College',
    'college 2': '2nd Year College',
    'college 3': '3rd Year College',
    'college 4': '4th Year College',
    'college 5': '5th Year College',
    '1st year college': '1st Year College',
    '2nd year college': '2nd Year College',
    '3rd year college': '3rd Year College',
    '4th year college': '4th Year College',
    '5th year college': '5th Year College',
  };

  return aliasMap[normalized] || value;
};

function Submission() {
  const [tab, setTab] = useState('submit');
  const [selectedType, setSelectedType] = useState('monthly-report');
  const [view, setView] = useState('editor');
  const [showConfirm, setShowConfirm] = useState(false);
  const [evalResult, setEvalResult] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const userId = localStorage.getItem('id');

  const [info, setInfo] = useState({
    name: '', age: '', year: '', course: '', school: '',
    date: '',
  });
  const [body_, setBody] = useState('');
  const [media, setMedia] = useState([]);

  const [docFile, setDocFile] = useState(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState('');
  const [docSuccess, setDocSuccess] = useState('');
  const [resubmitNotice, setResubmitNotice] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // UI-only: search/status filter over the already-fetched history list,
  // applied only to what's passed into <SubmissionHistory/> — no new
  // fetches, no change to fetchHistory or its data shape.
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');

  const scholarId = localStorage.getItem('scholar_id');
  const updateInfo = (key) => (val) => setInfo(prev => ({ ...prev, [key]: val }));
  const wordCount = body_.trim().split(/\s+/).filter(Boolean).length;
  const hasContent = info.name.trim().length > 0 && body_.trim().length > 20;
  const datePresent = asText(info.date).length > 0;
  const liveEval = evalResult || {
    overallScore: 0,
    reportScore: 0,
    mediaScore: 0,
    infoScore: 0,
    riskColor: MUTED,
  };

  // ---- Presentation-only refs for the workflow-step scroll targets ----
  const infoSectionRef = useRef(null);
  const letterSectionRef = useRef(null);
  const mediaSectionRef = useRef(null);
  const scrollToSection = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    if (!scholarId) return;
    try {
      const draft = JSON.parse(localStorage.getItem(scholarDraftStorageKey(scholarId)) || 'null');
      if (!draft) return;
      if (draft.info) setInfo(prev => ({ ...prev, ...draft.info }));
      if (typeof draft.body === 'string') setBody(draft.body);
      if (draft.selectedType) setSelectedType(draft.selectedType);
    } catch (err) {
      console.warn('Could not restore submission draft', err);
    }
  }, [scholarId]);

  useEffect(() => {
    if (!scholarId) return;
    try {
      localStorage.setItem(scholarDraftStorageKey(scholarId), JSON.stringify({
        info: { name: info.name, age: info.age, year: info.year, course: info.course, school: info.school },
        body: body_,
        selectedType,
        savedAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.warn('Could not save submission draft', err);
    }
  }, [scholarId, info.name, info.age, info.year, info.course, info.school, body_, selectedType]);

  useEffect(() => {
    const applyProfileInfo = (profile) => {
      if (!profile) return;
      const nextInfo = {
        name: profile.full_name || '',
        age: profile.age || '',
        year: formatYearLevelLabel(profile.year_level),
        course: profile.course || '',
        school: profile.school || '',
      };
      setInfo(prev => ({ ...prev, ...nextInfo }));
      if (scholarId) {
        localStorage.setItem(scholarInfoStorageKey(scholarId), JSON.stringify(nextInfo));
      }
    };

    if (!scholarId) return;

    try {
      const cached = localStorage.getItem(scholarInfoStorageKey(scholarId));
      if (cached) {
        const parsed = JSON.parse(cached);
        setInfo(prev => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.warn('Could not load cached scholar info', err);
    }

    if (!userId) return;

    axios.get(`http://localhost:5000/api/scholar/profile/${userId}`, { headers: authHeader() })
      .then(({ data }) => applyProfileInfo(data))
      .catch(() => {
        // Keep cached profile if the live profile fetch fails.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholarId, userId]);

  // Keep the cache in sync as the scholar edits their info fields.
  useEffect(() => {
    if (!scholarId) return;
    const { name, age, year, course, school } = info;
    if (!name && !age && !year && !course && !school) return;
    try {
      localStorage.setItem(scholarInfoStorageKey(scholarId), JSON.stringify({ name, age, year, course, school }));
    } catch (err) {
      console.warn('Could not cache scholar info', err);
    }
  }, [info.name, info.age, info.year, info.course, info.school, scholarId]);

  const fetchHistory = useCallback(async () => {
    if (!scholarId) return;
    try {
      setHistoryLoading(true); setHistoryError('');
      const res = await axios.get(`${API_BASE}/history/${scholarId}`, { headers: authHeader() });
      setHistory(res.data);
    } catch (err) {
      setHistoryError('Could not load your submission history. Please try again later.');
    } finally { setHistoryLoading(false); }
  }, [scholarId]);

  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab, fetchHistory]);

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const fallbackEval = buildEval(info, body_, media);
      const fallbackChecklist = CHECKLIST.map(item => ({ item, passed: item.check(info, body_, media) }));
      let evalScore = { ...fallbackEval, checklist: fallbackChecklist, source: 'rule_based' };

      try {
        const scoreResponse = await axios.post(`${API_BASE}/score`, {
          letter_content: body_,
        }, {
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          timeout: 10000,
        });

        if (scoreResponse?.data?.flagged) {
          const flaggedResult = {
            ...fallbackEval,
            reportScore: 0,
            mediaScore: 0,
            infoScore: 0,
            overallScore: 0,
            source: 'flagged',
            flagged: true,
            flagReason: scoreResponse.data.flag_reason || 'This submission does not appear to be a valid letter.',
            riskColor: DANGER,
            riskLabel: 'Invalid Letter',
            checklist: fallbackChecklist,
          };
          console.warn('[letter-score-debug] frontend flagged path selected:', flaggedResult.flagReason);
          setEvalResult(flaggedResult);
          setEvaluating(false);
          setView('evaluation');
          return;
        }

        if (scoreResponse?.data?.fallback) {
          console.log('[letter-score-debug] frontend rule-based fallback path selected.');
          setEvalResult({ ...fallbackEval, checklist: fallbackChecklist, source: 'rule_based' });
          setEvaluating(false);
          setView('evaluation');
          return;
        }

        const bodyScore = Number(scoreResponse?.data?.body_score);
        if (Number.isFinite(bodyScore)) {
          const reportScore = Math.min(Math.max(bodyScore, 0), LETTER_BODY_MAX);
          const mediaScore = calcMediaScore(media);
          const infoScore = calcInfoScore(info);
          const overallScore = Math.min(reportScore + mediaScore + infoScore, 100);
          console.log('[letter-score-debug] frontend Flask normal path selected:', {
            apiScoreIgnoredForBodyScore: scoreResponse?.data?.score,
            bodyScoreFromBreakdown: bodyScore,
            reportScoreOutOf70: reportScore,
            overallScoreOutOf100: overallScore,
          });
          const quality = classifyQualityScore(overallScore);
          const tone = scoreResponse?.data?.academic_tone
            ? { toneLabel: scoreResponse.data.academic_tone, toneColor: scoreResponse.data.academic_tone === 'Formal' ? SUCCESS : scoreResponse.data.academic_tone === 'Moderate' ? WARNING : DANGER }
            : classifyAcademicTone(body_);

          evalScore = {
            ...fallbackEval,
            reportScore,
            mediaScore,
            infoScore,
            overallScore,
            source: 'naive_bayes',
            ...quality,
            ...tone,
            qualityLabel: quality.riskLabel,
            breakdown: scoreResponse?.data?.breakdown || { date: 5, body: 49, attachments: 20, caption: 13 },
          };
        }
      } catch (scoreErr) {
        console.warn('Model score route unavailable; using rule-based fallback.', scoreErr?.message || scoreErr);
      }

      setEvalResult(evalScore);
    } catch (err) {
      const fallbackEval = buildEval(info, body_, media);
      const fallbackChecklist = CHECKLIST.map(item => ({ item, passed: item.check(info, body_, media) }));
      setEvalResult({ ...fallbackEval, checklist: fallbackChecklist, source: 'rule_based' });
    } finally {
      setEvaluating(false);
      setView('evaluation');
    }
  };

  const handleNewSubmission = () => {
    setInfo(prev => ({ ...prev, date: '' }));
    setBody(''); setMedia([]); setEvalResult(null); setView('editor'); setSubmitError(''); setResubmitNotice('');
  };

  const handleResubmit = (item) => {
    const nextType = SUBMISSION_TYPE_TO_TAB[item.submission_type] || 'monthly-report';
    setSelectedType(nextType);
    setSubmitError(''); setDocError(''); setDocSuccess(''); setDocFile(null);

    const reason = item.staff_comment?.trim();

    if (item.submission_type === 'letter') {
      setBody(item.letter_content || ''); setEvalResult(null); setView('editor');
      setResubmitNotice(
        reason
          ? `Returned by your officer: "${reason}" — please fix the part above in your letter below, then evaluate and resubmit.`
          : 'This was returned for correction. Please review and fix your letter below, then resubmit.'
      );
    } else {
      setResubmitNotice(
        reason
          ? `Returned by your officer: "${reason}" — please re-upload the corrected file below.`
          : 'This was returned for correction. Please re-upload the corrected file below.'
      );
    }
    setTab('submit'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmSubmit = async () => {
    if (!scholarId) { setSubmitError('No scholar account found. Please log in again.'); return; }
    setSubmitting(true); setSubmitError('');
    try {
      const formData = new FormData();
      formData.append('letter_content', body_);
      formData.append('name', info.name || '');
      formData.append('age', info.age || '');
      formData.append('year', info.year || '');
      formData.append('course', info.course || '');
      formData.append('school', info.school || '');
      formData.append('quality_score', evalResult.overallScore);
      formData.append('quality_status', evalResult.qualityStatus);
      formData.append('service_activity', ''); formData.append('service_hours', ''); formData.append('service_date', '');
      const descriptions = media.map(m => m.description || '');
      formData.append('media_descriptions', JSON.stringify(descriptions));
      const resumableUploads = [];
      for (const item of media) {
        resumableUploads.push(await uploadResumableFile(item.file, 'media'));
      }
      formData.append('resumable_uploads', JSON.stringify(resumableUploads));
      await postWithRetry(`${API_BASE}/submit`, formData);
      setShowConfirm(false); setView('submitted');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Something went wrong while submitting. Please try again.');
    } finally { setSubmitting(false); }
  };

  const handleDocUpload = async () => {
    if (!docFile || !scholarId) return;
    setDocUploading(true); setDocError(''); setDocSuccess('');
    try {
      const formData = new FormData();
      formData.append('letter_content', ''); formData.append('quality_score', 0); formData.append('quality_status', 'pending');
      const fieldname = selectedType === 'report-card' ? 'report_card' : selectedType === 'cor' ? 'cor' : 'media';
      const uploadId = await uploadResumableFile(docFile, fieldname);
      formData.append('resumable_uploads', JSON.stringify([uploadId]));
      if (selectedType === 'other') formData.append('media_descriptions', JSON.stringify(['Other Document']));
      await postWithRetry(`${API_BASE}/submit`, formData);
      setDocSuccess('Document submitted successfully! Forwarded to admin/office for review.');
      setDocFile(null); setResubmitNotice('');
    } catch (err) {
      setDocError(err.response?.data?.error || 'Something went wrong while uploading. Please try again.');
    } finally { setDocUploading(false); }
  };

  const docTypeLabel = selectedType === 'report-card' ? 'Report Card / Grade per Semester'
    : selectedType === 'cor' ? 'Certificate of Registration (COR)' : 'Other Document';

  // ── Quick stats — derived from existing state only, no new calculations ──
  const totalSubmissions = history.length;
  const acceptedCount = history.filter((h) => (h.status === 'approved' || h.quality_status === 'approved')).length;
  const pendingReviewCount = Math.max(totalSubmissions - acceptedCount, 0);
  const checklistPassedCount = CHECKLIST.filter((item) => item.check(info, body_, media)).length;

  // ── History filter — UI-only, over the already-fetched `history` array ──
  const filteredHistory = history.filter((item) => {
    const status = String(item.status || item.quality_status || '').toLowerCase();
    const matchesStatus = historyStatusFilter === 'all' || status === historyStatusFilter;
    if (!matchesStatus) return false;
    if (!historySearch.trim()) return true;
    const haystack = `${item.submission_type || ''} ${item.letter_content || ''} ${item.staff_comment || ''}`.toLowerCase();
    return haystack.includes(historySearch.trim().toLowerCase());
  });

  // ---- Presentation-only derived values for the new hierarchy ----
  const overallCompletionPct = CHECKLIST.length ? (checklistPassedCount / CHECKLIST.length) * 100 : 0;

  const infoComplete = Boolean(info.name && info.year && info.course && info.school);
  const letterComplete = wordCount >= 150;
  const mediaComplete = media.length > 0;
  const automatedReviewComplete = view === 'evaluation' || view === 'submitted';

  const workflowSteps = [
    {
      key: 'info', title: 'Scholar Information', completed: infoComplete,
      active: !infoComplete && view === 'editor',
      onClick: () => scrollToSection(infoSectionRef),
    },
    {
      key: 'letter', title: 'Monthly Letter', completed: letterComplete,
      active: infoComplete && !letterComplete && view === 'editor',
      onClick: () => scrollToSection(letterSectionRef),
    },
    {
      key: 'media', title: 'Documentation', completed: mediaComplete,
      active: infoComplete && letterComplete && !mediaComplete && view === 'editor',
      onClick: () => scrollToSection(mediaSectionRef),
    },
    {
      key: 'automated-review', title: 'Automated Review', completed: automatedReviewComplete,
      active: view === 'evaluation',
      disabled: !hasContent || evaluating,
      onClick: () => { if (hasContent) handleEvaluate(); },
    },
  ];

  return (
    <div style={{ ...body, background: BG, minHeight: '100vh' }}>
      <div className="w-full px-4 sm:px-6 lg:p-8">

        {/* ── 1. Scholar header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '20px 24px', marginBottom: 18 }}>
          <div>
            <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: GOLD }}>SCHOLAR PORTAL</p>
            <h1 style={{ ...display, fontSize: '1.7rem', fontWeight: 600, color: INK, marginTop: 4 }}>Submissions</h1>
            <p style={{ ...body, fontSize: '0.84rem', color: MUTED, marginTop: 6, maxWidth: 480 }}>
              Submit your monthly requirements with AI quality analysis and officer feedback.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY, background: `${PRIMARY}12`, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 16px' }}>
              1st Semester, AY 2026–2027
            </span>
            <button
              onClick={() => setTab(tab === 'history' ? 'submit' : 'history')}
              className="flex items-center gap-1.5"
              style={{
                ...body, fontSize: '0.76rem', fontWeight: 600, borderRadius: 999, padding: '8px 14px', cursor: 'pointer',
                border: `1px solid ${tab === 'history' ? PRIMARY : BORDER}`,
                background: tab === 'history' ? PRIMARY : SURFACE,
                color: tab === 'history' ? '#fff' : INK,
              }}
            >
              <History size={13} /> My History
            </button>
          </div>
        </div>

        {tab === 'submit' && <>
          {/* ── 2. Workspace hero ── */}
          <div
            className="relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, borderRadius: RADIUS, padding: '24px 26px', marginBottom: 18 }}
          >
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="min-w-0" style={{ maxWidth: 480 }}>
                <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: '#E7D8C7' }}>FEATURED REMINDER</p>
                <h3 style={{ ...display, fontSize: '1.3rem', fontWeight: 600, color: '#fff', marginTop: 6 }}>
                  {resubmitNotice ? 'A submission needs your attention' : 'Keep your requirements up to date'}
                </h3>
                <p style={{ ...body, fontSize: '0.82rem', color: '#F3E9DD', marginTop: 8, lineHeight: 1.6 }}>
                  {resubmitNotice || 'Submit your Monthly Letter every month, and your Grades and COR every semester.'}
                </p>

              </div>
              <button
                onClick={() => { setSelectedType('monthly-report'); setView('editor'); }}
                className="flex-shrink-0 transition-opacity hover:opacity-90"
                style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: PRIMARY, background: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', cursor: 'pointer' }}
              >
                Start Submission
              </button>
            </div>
          </div>

            {/* Compliance type selector for the submission workflows outside Monthly Letter. */}
          <div className="mb-5">
            <p style={fieldLabel}>COMPLIANCE TYPE</p>
            <div className="flex flex-wrap items-center gap-2">
              {submissionTypes.map(type => {
                const Icon = TYPE_ICONS[type.id] || FileText;
                const active = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => { setSelectedType(type.id); setView('editor'); setEvalResult(null); setDocFile(null); setDocError(''); setDocSuccess(''); setResubmitNotice(''); }}
                    className="flex items-center gap-2"
                    style={{
                      padding: '8px 14px', borderRadius: 999,
                      border: `1px solid ${active ? PRIMARY : BORDER}`,
                      background: active ? PRIMARY : SURFACE,
                      color: active ? '#fff' : INK,
                      ...body, fontSize: '0.76rem', fontWeight: 600,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <Icon size={13} />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedType === 'monthly-report' && view === 'editor' && <>
            {/* ── 3. Workflow navigation (Monthly Letter only) ── */}
            <div className="mb-5">
              <WorkflowSteps steps={workflowSteps} onStepClick={(s) => !s.disabled && s.onClick()} />
            </div>

          </>}

          {resubmitNotice && selectedType === 'monthly-report' && view === 'editor' && (
            <div className="mb-5"><AlertStrip color={DANGER}>{resubmitNotice}</AlertStrip></div>
          )}
          {resubmitNotice && selectedType !== 'monthly-report' && (
            <div className="mb-5"><AlertStrip color={DANGER}>{resubmitNotice}</AlertStrip></div>
          )}

          {selectedType === 'monthly-report' && <>
            {view === 'editor' && (
              // ── 5. Main workspace: 70/30 layout ──
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 space-y-4">
                  <div ref={infoSectionRef} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }} className="p-4 sm:p-[22px]">
                    <CardHeader icon={User} eyebrow="STEP 1" title="Scholar Information" />
                    <p style={{ ...body, fontSize: '0.77rem', color: MUTED, marginBottom: 20, marginTop: 8 }}>This will appear in the official letter header.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                      <div className="sm:col-span-2"><InfoField label="Full Name" value={info.name} onChange={updateInfo('name')} placeholder="e.g. Juan Dela Cruz" /></div>
                      <InfoField label="Age" value={info.age} onChange={updateInfo('age')} placeholder="e.g. 20" type="number" />
                      <InfoField label="Year Level" value={info.year} onChange={updateInfo('year')} placeholder="e.g. 2nd Year" />
                      <InfoField label="Course" value={info.course} onChange={updateInfo('course')} placeholder="e.g. BS Computer Science" />
                      <InfoField label="School" value={info.school} onChange={updateInfo('school')} placeholder="e.g. University of the Philippines" />
                      <div className="sm:col-span-2">
                        <label style={fieldLabel}>DATE <span style={{ color: PRIMARY }}>*</span></label>
                        <input type="date" value={(() => { try { return new Date(info.date).toISOString().split('T')[0]; } catch { return ''; } })()}
                          onChange={e => { const d = new Date(e.target.value); updateInfo('date')(d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })); }}
                          className="w-full outline-none transition-colors bg-transparent"
                          style={underlineField}
                          onFocus={e => (e.target.style.borderBottom = `1.5px solid ${PRIMARY}`)} onBlur={e => (e.target.style.borderBottom = `1.5px solid ${BORDER}`)} />
                      </div>
                    </div>
                  </div>

                  <div ref={letterSectionRef} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }} className="p-4 sm:p-[22px]">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <CardHeader icon={FileText} eyebrow="STEP 2" title="Monthly Letter" />
                      <span style={{ ...body, fontSize: '0.7rem', color: wordCount >= 150 ? SUCCESS : MUTED, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{wordCount} / 150+ words</span>
                    </div>
                    <p style={{ ...body, fontSize: '0.77rem', color: MUTED, marginBottom: 14, marginTop: 8 }}>Write your letter addressed to "Dear Kalinga," - share your activities, challenges, and plans this month.</p>
                    <div className="rounded-xl px-3 sm:px-4 py-2.5 mb-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                      <span style={{ ...body, fontSize: '0.87rem', color: MUTED, fontStyle: 'italic' }}>Dear Kalinga,</span>
                    </div>
                    <textarea value={body_} onChange={e => setBody(e.target.value)} rows={12}
                      placeholder={`Write your monthly report here. Share what you accomplished this month, any challenges you faced, and your plans for next month.\n\nExample:\nI am writing to update you on my progress for this month...`}
                      className="w-full p-3 sm:p-4 rounded-xl border outline-none resize-none transition-all"
                      style={{ ...body, fontSize: '0.88rem', lineHeight: 1.75, color: INK, borderColor: BORDER }}
                      onFocus={e => (e.target.style.borderColor = PRIMARY)} onBlur={e => (e.target.style.borderColor = BORDER)} />
                    <div className="rounded-xl px-3 sm:px-4 py-2.5 mt-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                      <p style={{ ...body, fontSize: '0.87rem', color: MUTED, fontStyle: 'italic' }}>Your scholar,</p>
                      <p style={{ ...body, fontSize: '0.87rem', fontWeight: 600, color: info.name ? INK : '#d1d5db', marginTop: 2 }}>{info.name || 'Your Name'}</p>
                    </div>
                  </div>

                  <div ref={mediaSectionRef} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }} className="p-4 sm:p-[22px]">
                    <CardHeader icon={Upload} eyebrow="STEP 3" title="Documentation" />
                    <p style={{ ...body, fontSize: '0.77rem', color: MUTED, marginTop: 8, marginBottom: 14 }}>Attach photos that document your activities this month.</p>
                    <MediaUploader media={media} onChange={setMedia} />
                  </div>
                </div>

                {/* ── Right — sticky live progress panel ── */}
                <div>
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }} className="lg:sticky lg:top-6 p-4 sm:p-5">

                    <div className="flex items-center gap-4 mb-5">
                      <CompletionRing pct={overallCompletionPct} color={PRIMARY} />
                      <div>
                        <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.04em', color: GOLD }}>COMPLETION</p>
                        <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>{checklistPassedCount} of {CHECKLIST.length} items ready</p>
                      </div>
                    </div>

                    <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: PRIMARY, marginBottom: 12 }}>CHECKLIST</p>
                    <div className="space-y-2.5 mb-5">
                      {CHECKLIST.map(item => {
                        const passed = item.check(info, body_, media);
                        return (
                          <div key={item.id} className="flex items-center gap-2.5">
                            {passed ? <CheckSquare size={14} style={{ color: SUCCESS, flexShrink: 0 }} /> : <Square size={14} style={{ color: BORDER, flexShrink: 0 }} />}
                            <span style={{ ...body, fontSize: '0.79rem', color: passed ? INK : MUTED, lineHeight: 1.4 }}>{item.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-xl p-3 mb-4" style={{ background: `${PRIMARY}08`, border: `1px solid ${PRIMARY}22` }}>
                      <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.04em', color: PRIMARY, marginBottom: 8 }}>AUTOMATED REVIEW</p>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ ...body, fontSize: '0.74rem', color: MUTED }}>Predicted score</span>
                        <span style={{ ...body, fontSize: '0.78rem', fontWeight: 700, color: datePresent ? liveEval.riskColor : MUTED }}>
                          {datePresent ? liveEval.overallScore : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ ...body, fontSize: '0.74rem', color: MUTED }}>Risk</span>
                        <span style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: datePresent ? liveEval.riskColor : MUTED }}>
                          {datePresent && evalResult ? evalResult.riskLabel : 'Not yet evaluated'}
                        </span>
                      </div>
                      <p style={{ ...body, fontSize: '0.66rem', color: MUTED, marginTop: 8, fontStyle: 'italic' }}>This is only a preview — run Automated Review for the full breakdown.</p>
                    </div>

                    {!scholarId && (
                      <div className="mb-4"><AlertStrip color={DANGER}>No scholar account detected. Please log out and log back in.</AlertStrip></div>
                    )}

                    <button disabled={!hasContent || evaluating} onClick={handleEvaluate}
                      className="w-full flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
                      style={{ ...filledBtn, width: '100%', padding: '11px 0', fontSize: '0.85rem', cursor: (hasContent && !evaluating) ? 'pointer' : 'not-allowed' }}>
                      <Sparkles size={14} />
                      {evaluating ? 'Running review…' : 'Run Automated Review'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view === 'evaluation' && evalResult && (
              // ── 6. Automated Review — dedicated step ──
              <div>
                <button onClick={() => setView('editor')} className="flex items-center gap-1 mb-4 transition-opacity hover:opacity-70"
                  style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <ArrowLeft size={14} /> Back to Editor
                </button>

                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '18px 18px 0 0', borderBottom: 'none' }} className="p-4 sm:p-[18px_22px]">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', color: GOLD }}>STEP 4 · AUTOMATED REVIEW</p>
                      <h3 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK, marginTop: 2 }}>Correspondence Evaluation</h3>
                      <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 3 }}>{info.name || 'Scholar'} · {info.date}</p>
                    </div>
                    <span style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: evalResult.flagged ? DANGER : evalResult.source === 'naive_bayes' ? GOLD : SLATE, background: `${evalResult.flagged ? DANGER : evalResult.source === 'naive_bayes' ? GOLD : SLATE}14`, padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                      {evalResult.flagged ? 'Invalid Letter' : evalResult.source === 'naive_bayes' ? 'Naive Bayes ML' : 'Rule-Based'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 px-4 sm:px-5 py-3" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `1px solid ${BG}` }}>
                  <button onClick={() => setView('editor')} className="flex-1 sm:flex-initial" style={outlineBtn}><Bookmark size={13} /> Save Draft</button>
                  <button onClick={() => { setSubmitError(''); setShowConfirm(true); }} className="flex-1 sm:flex-initial" style={filledBtn}><Send size={13} /> Submit Report</button>
                </div>

                {evalResult.flagged && (
                  <div className="px-4 sm:px-5 py-3" style={{ background: `${DANGER}12`, border: `1px solid ${DANGER}44`, borderTop: 'none', color: DANGER }}>
                    <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Letter rejected for evaluation</p>
                    <p style={{ ...body, fontSize: '0.8rem', marginTop: 3 }}>{evalResult.flagReason}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] rounded-b-2xl" style={{ border: `1px solid ${BORDER}`, borderTop: 'none', overflow: 'hidden' }}>
                  {/* Left — Letter Preview */}
                  <div className="p-4 sm:p-6 overflow-y-auto lg:max-h-[620px] border-b lg:border-b-0 lg:border-r" style={{ background: SURFACE, borderColor: BORDER }}>
                    <div className="text-center mb-5 pb-4" style={{ borderBottom: `1px solid ${GOLD}55` }}>
                      <p style={{ ...display, fontSize: '0.9rem', fontWeight: 700, color: PRIMARY }}>Kalinga at Pag-ibig Foundation Inc.</p>
                      <p style={{ ...body, fontSize: '0.72rem', color: MUTED }}>Apple Scholars · Rodriguez, Rizal</p>
                    </div>
                    <div className="mb-5 space-y-1">
                      {[['Name', info.name], ['Age', info.age ? `${info.age} years old` : ''], ['Year', info.year], ['Course', info.course], ['School', info.school], ['Date', info.date]].map(([l, v]) => v ? (
                        <div key={l} className="flex gap-2">
                          <span style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: '#3f2f28', minWidth: 52, flexShrink: 0 }}>{l}:</span>
                          <span style={{ ...body, fontSize: '0.8rem', color: MUTED }}>{v}</span>
                        </div>
                      ) : null)}
                    </div>
                    <p style={{ ...body, fontSize: '0.87rem', lineHeight: 1.8, color: '#3f2f28', marginBottom: 14 }}>Dear Kalinga,</p>
                    {body_.split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                      <p key={i} style={{ ...body, fontSize: '0.87rem', lineHeight: 1.78, color: '#3f2f28', marginBottom: 12, textIndent: '1.5rem' }}>{para.trim()}</p>
                    ))}
                    <p style={{ ...body, fontSize: '0.87rem', color: '#3f2f28', marginTop: 20, marginBottom: 2 }}>Your scholar,</p>
                    <p style={{ ...body, fontSize: '0.87rem', fontWeight: 700, color: INK }}>{info.name}</p>
                    {media.length > 0 && (
                      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                        <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, color: PRIMARY, marginBottom: 8, letterSpacing: '0.03em' }}>
                          DOCUMENTATION ({media.length} PHOTO{media.length > 1 ? 'S' : ''})
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {media.map((item) => (
                            <div key={item.id}>
                              <div className="rounded-lg overflow-hidden" style={{ height: 70 }}>
                                <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                              <p style={{ ...body, fontSize: '0.67rem', color: MUTED, marginTop: 3, textAlign: 'center', fontStyle: 'italic' }}>
                                {item.description ? `(${item.description.substring(0, 35)}${item.description.length > 35 ? '…' : ''})` : '(no description)'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p style={{ ...body, fontSize: '0.7rem', color: '#c6b8ae', marginTop: 16 }}>Words: {wordCount} · Page 1 / Apple Scholar</p>
                  </div>

                  {/* Right — Scores Panel */}
                  <div className="p-3 sm:p-4 overflow-y-auto lg:max-h-[620px]" style={{ background: BG }}>

                    <div className="rounded-xl p-3 sm:p-4 mb-4 flex items-center gap-3 flex-wrap" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                      <GradeStamp score={evalResult.overallScore} color={evalResult.riskColor} />
                      <div className="min-w-0">
                        <p style={{ ...body, fontSize: '0.62rem', fontWeight: 700, color: MUTED, letterSpacing: '0.04em', marginBottom: 4 }}>EVALUATED GRADE</p>
                        <span className="inline-block px-2.5 py-1 rounded-full"
                          style={{ ...body, fontSize: '0.68rem', fontWeight: 700, background: `${evalResult.riskColor}18`, color: evalResult.riskColor }}>
                          {evalResult.riskLabel}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { label: 'Letter Body', value: evalResult.reportScore, sub: '70 pts' },
                        { label: 'Documentation', value: evalResult.mediaScore, sub: '20 pts' },
                        { label: 'Info', value: evalResult.infoScore || 0, sub: '10 pts' },
                      ].map(s => {
                        const c = s.value >= 75 ? SUCCESS : s.value >= 50 ? WARNING : DANGER;
                        return (
                          <div key={s.label} className="rounded-xl p-2 sm:p-3 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                            <p style={{ ...body, fontSize: '0.58rem', color: MUTED, marginBottom: 2 }} className="truncate">{s.label}</p>
                            <p style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: c }}>{s.value}</p>
                            <p style={{ ...body, fontSize: '0.58rem', color: '#c6b8ae' }}>{s.sub}</p>
                          </div>
                        );
                      })}
                    </div>

                    {evalResult.source === 'naive_bayes' && evalResult.rubric && (
                      <>
                        <div className="mb-3">
                          <p style={{ ...body, fontSize: '0.64rem', fontWeight: 700, color: PRIMARY, letterSpacing: '0.05em', marginBottom: 6 }}>INFO (10 pts)</p>
                          <ScoreBar score={evalResult.rubric.date.score} weight={10} label="Date Format" />
                        </div>

                        <div className="mb-3">
                          <p style={{ ...body, fontSize: '0.64rem', fontWeight: 700, color: PRIMARY, letterSpacing: '0.05em', marginBottom: 6 }}>LETTER BODY (70 pts)</p>
                          <ScoreBar score={evalResult.rubric.paragraph.score}        weight={14}  label="Paragraph Structure" />
                          <ScoreBar score={evalResult.rubric.academic.score}         weight={14}  label="Academic Updates" />
                          <ScoreBar score={evalResult.rubric.self_improvement.score} weight={14}  label="Self-Improvement" />
                          <ScoreBar score={evalResult.rubric.family.score}           weight={14}  label="Family Situation" />
                          <ScoreBar score={evalResult.rubric.difficulty.score}       weight={14}  label="Socio-Economic" />
                        </div>

                        <div className="mb-3">
                          <p style={{ ...body, fontSize: '0.64rem', fontWeight: 700, color: PRIMARY, letterSpacing: '0.05em', marginBottom: 6 }}>DOCUMENTATION (20 pts)</p>
                          <ScoreBar score={evalResult.rubric.picture.score} weight={15} label="Document / Picture" />
                          <ScoreBar score={evalResult.rubric.caption.score} weight={5} label="Captions" />
                        </div>
                      </>
                    )}

                    {evalResult.source === 'rule_based' && (
                      <>
                        <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: '#3f2f28', letterSpacing: '0.04em', marginBottom: 8 }}>MISSING REQUIREMENTS</p>
                        <div className="space-y-1.5 mb-4">
                          {evalResult.checklist.map(({ item, passed }) => (
                            <div key={item.id} className="flex items-center gap-2 rounded-lg px-2.5 sm:px-3 py-1.5"
                              style={{ background: passed ? `${SUCCESS}14` : `${DANGER}14`, border: `1px solid ${passed ? SUCCESS : DANGER}33` }}>
                              {passed ? <CheckCircle size={13} style={{ color: SUCCESS, flexShrink: 0 }} /> : <XCircle size={13} style={{ color: DANGER, flexShrink: 0 }} />}
                              <span style={{ ...body, fontSize: '0.74rem', fontWeight: 500, color: passed ? SUCCESS : DANGER }}>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <div style={{ height: 1, background: BORDER, margin: '10px 0' }} />

                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: '#3f2f28' }}>Academic Tone</span>
                      <span style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: evalResult.toneColor }}>{evalResult.toneLabel}</span>
                    </div>
                    <p style={{ ...body, fontSize: '0.73rem', color: MUTED, lineHeight: 1.5, fontStyle: 'italic', marginBottom: 10 }}>
                      {evalResult.overallScore >= 90 ? '"Professional and well-structured letter."'
                        : evalResult.overallScore >= 75 ? '"Good overall quality and structure."'
                        : evalResult.overallScore >= 50 ? '"Decent tone; needs more detail or formal language."'
                        : '"Letter needs significant improvement before submission."'}
                    </p>

                    {!evalResult.accepted && (
                      <div className="rounded-xl p-3 mb-3" style={{ background: getRiskBg(evalResult.riskLevel), border: `1px solid ${getRiskBorder(evalResult.riskLevel)}` }}>
                        <p style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: evalResult.riskColor, marginBottom: 3 }}>
                          {evalResult.riskLevel === 'medium' ? 'Needs Improvement' : 'Non-Compliant — Will Not Be Accepted'}
                        </p>
                        <p style={{ ...body, fontSize: '0.73rem', color: MUTED, lineHeight: 1.5 }}>
                          {evalResult.riskLevel === 'medium'
                            ? 'Score must reach 75+ to be accepted. Improve your letter content and attach photos.'
                            : 'Score is too low. Please improve your report before submitting.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {view === 'submitted' && <SubmittedView info={info} body={body_} media={media} onNew={handleNewSubmission} />}
            {showConfirm && evalResult && (
              <ConfirmModal ev={evalResult} submitting={submitting} submitError={submitError}
                onCancel={() => setShowConfirm(false)} onConfirm={handleConfirmSubmit} />
            )}
          </>}

          {selectedType === 'grades' && <ScholarGrades />}

          {selectedType !== 'monthly-report' && selectedType !== 'grades' && (
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }} className="p-4 sm:p-7">
              <div className="max-w-2xl mx-auto">
                {docSuccess ? (
                  <div className="rounded-xl p-4 sm:p-5 flex items-start sm:items-center gap-3" style={{ background: `${SUCCESS}0f`, border: `1px solid ${SUCCESS}33` }}>
                    <CheckCircle size={22} style={{ color: SUCCESS, flexShrink: 0 }} />
                    <div>
                      <p style={{ ...body, fontSize: '0.9rem', fontWeight: 700, color: SUCCESS }}>{docSuccess}</p>
                      <button onClick={() => setDocSuccess('')} className="text-xs mt-2 underline"
                        style={{ color: PRIMARY, ...body, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upload another document</button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl p-6 sm:p-12 text-center" style={{ border: `1.5px dashed ${GOLD}88`, background: BG }}>
                    <Inbox size={38} style={{ margin: '0 auto 14px', color: PRIMARY }} />
                    <h3 className="mb-2" style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>Upload Your {docTypeLabel}</h3>
                    <p className="mb-4" style={{ ...body, fontSize: '0.85rem', color: MUTED }}>{docFile ? docFile.name : 'Drag and drop or click to browse'}</p>
                    <input id="doc-upload-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={e => setDocFile(e.target.files?.[0] || null)} />
                    <button onClick={() => document.getElementById('doc-upload-input').click()} style={{ ...outlineBtn, display: 'inline-flex', border: `1.5px solid ${PRIMARY}`, color: PRIMARY }}>
                      Browse Files
                    </button>
                    {docFile && (
                      <button onClick={handleDocUpload} disabled={docUploading || !scholarId} className="block mx-auto mt-4 disabled:opacity-50"
                        style={{ ...filledBtn, display: 'inline-flex', cursor: docUploading ? 'not-allowed' : 'pointer' }}>
                        {docUploading ? 'Uploading…' : `Submit ${docTypeLabel}`}
                      </button>
                    )}
                    {docError && <p className="mt-4" style={{ ...body, fontSize: '0.78rem', color: DANGER }}>{docError}</p>}
                    <p className="mt-4" style={{ ...body, fontSize: '0.7rem', color: MUTED }}>Supported formats: PDF, JPG, PNG (Max 10MB)</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>}

        {tab === 'history' && (
          // ── 7. Submission history ──
          <>
            {/* Restyled quick stats for the history tab (existing values only) */}
            <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 18 }}>
              <ProgressCard eyebrow="RECORDS" title="Total Submissions">
                <span style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: PRIMARY }}>{totalSubmissions}</span>
              </ProgressCard>
              <ProgressCard eyebrow="STATUS" title="Accepted">
                <span style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: SUCCESS }}>{acceptedCount}</span>
              </ProgressCard>
              <ProgressCard eyebrow="STATUS" title="Pending / Review">
                <span style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: WARNING }}>{pendingReviewCount}</span>
              </ProgressCard>
            </div>

            {/* Floating filter toolbar */}
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '12px 16px', marginBottom: 18 }}>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <Search size={15} style={{ color: MUTED }} />
                  <input
                    type="text"
                    placeholder="Search your submissions"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    style={{ width: '100%', border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.82rem', color: INK }}
                  />
                </div>
                <div className="flex items-center gap-2" style={{ borderLeft: `1px solid ${BORDER}`, paddingLeft: 14 }}>
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                    style={{ border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.8rem', fontWeight: 500, color: INK, cursor: 'pointer' }}
                  >
                    <option value="all">All statuses</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Registry: existing SubmissionHistory component, container restyled only */}
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 22, marginBottom: 24 }}>
              <SubmissionHistory history={filteredHistory} loading={historyLoading} error={historyError} onResubmit={handleResubmit} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Submission;