import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import {
  Upload, CheckCircle, Send, Bookmark,
  ArrowLeft, Sparkles, FileText,
  ChevronRight, AlertCircle, User, History,
  Mail, GraduationCap, IdCard, Folder,
} from 'lucide-react';

import InfoField from '../../components/Scholar/SubmissionPage/InfoField';
import MediaUploader from '../../components/Scholar/SubmissionPage/MediaUploader';
import ConfirmModal from '../../components/Scholar/SubmissionPage/ConfirmModal';
import SubmittedView from '../../components/Scholar/SubmissionPage/SubmittedView';
import SubmissionHistory from '../../components/Scholar/SubmissionPage/SubmissionHistory';
import ScoreRing from "../../components/Shared/ScoreRing";
import ScholarGrades from '../../components/Scholar/SubmissionPage/ScholarGrades';
import { CHECKLIST, buildEval, calcMediaScore, getRiskBg, getRiskBorder } from '../../utils/submissionScoring';

// ── Token system — shared with ScholarProfile / DutyParticipation / RequirementsChecklist ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';
const ROSE = '#F5E8EA';

const API_BASE = 'http://localhost:5000/api/submission';

const authHeader = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
};

const submissionTypes = [
  { id: 'monthly-report', label: 'Monthly Report' },
  { id: 'grades', label: 'Grades' },
  { id: 'cor', label: 'COR Upload' },
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

// Score bar with progress indicator
const ScoreBar = ({ score, weight, label }) => {
  const color = score >= 75 ? '#15803d' : score >= 50 ? '#92400e' : '#991b1b';
  const bgColor = score >= 75 ? '#EAF3EC' : score >= 50 ? '#FBF0DE' : '#FBE9E9';
  return (
    <div className="rounded-lg px-3 py-2 mb-1.5" style={{ background: bgColor, border: `1px solid ${color}30` }}>
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.73rem', color: '#374151', fontWeight: 500 }}>{label}</span>
        <div className="flex items-center gap-1.5">
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.65rem', color: '#9ca3af' }}>{weight}%</span>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.73rem', fontWeight: 700, color }}>{score}/100</span>
        </div>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 4, background: '#e5e7eb' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
};

// Key used to cache the scholar's own info fields locally, so they don't
// have to be retyped every time (e.g. after a rejection/resubmit).
const scholarInfoStorageKey = (scholarId) => `scholar_info_cache_${scholarId}`;

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
    date: new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
  });
  const [body, setBody] = useState('');
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

  const scholarId = localStorage.getItem('scholar_id');
  const updateInfo = (key) => (val) => setInfo(prev => ({ ...prev, [key]: val }));
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  const hasContent = info.name.trim().length > 0 && body.trim().length > 20;

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
      const letterText = [
        `Name: ${info.name}`, `Age: ${info.age}`, `Year Level: ${info.year}`,
        `Course: ${info.course}`, `School: ${info.school}`, `Date: ${info.date}`,
        '', 'Dear Kalinga,', body, '', 'Your scholar,', info.name,
      ].join('\n');

      const res = await axios.post(`${API_BASE}/evaluate-ml`, {
        letter_text: letterText,
        media_count: media.length,
        captions_complete: media.length > 0 && media.every(m => m.description?.trim().length > 3),
        has_date: info.date.trim().length > 0,
      }, { headers: authHeader(), timeout: 10000 });

      const ml = res.data;
      const checklist = CHECKLIST.map(item => ({ item, passed: item.check(info, body, media) }));
      setEvalResult({ ...ml, checklist, source: ml.source || 'naive_bayes' });

    } catch (err) {
      console.warn('ML service unavailable, falling back to rule-based scoring:', err.message);
      setEvalResult({ ...buildEval(info, body, media), source: 'rule_based' });
    } finally {
      setEvaluating(false);
      setView('evaluation');
    }
  };

  const handleNewSubmission = () => {
    setInfo(prev => ({ ...prev, date: new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) }));
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
      formData.append('letter_content', body);
      formData.append('name', info.name || '');
      formData.append('age', info.age || '');
      formData.append('year', info.year || '');
      formData.append('course', info.course || '');
      formData.append('school', info.school || '');
      formData.append('sentiment_score', evalResult.sentimentScore);
      formData.append('sentiment_label', evalResult.sentimentLabel);
      formData.append('quality_score', evalResult.overallScore);
      formData.append('quality_status', evalResult.qualityStatus);
      formData.append('service_activity', ''); formData.append('service_hours', ''); formData.append('service_date', '');
      const descriptions = media.map(m => m.description || '');
      formData.append('media_descriptions', JSON.stringify(descriptions));
      media.forEach(m => formData.append('media', m.file));
      await axios.post(`${API_BASE}/submit`, formData, { headers: { 'Content-Type': 'multipart/form-data', ...authHeader() } });
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
      if (selectedType === 'report-card') formData.append('report_card', docFile);
      if (selectedType === 'cor') formData.append('cor', docFile);
      if (selectedType === 'other') { formData.append('media', docFile); formData.append('media_descriptions', JSON.stringify(['Other Document'])); }
      await axios.post(`${API_BASE}/submit`, formData, { headers: { 'Content-Type': 'multipart/form-data', ...authHeader() } });
      setDocSuccess('Document submitted successfully! Forwarded to admin/office for review.');
      setDocFile(null); setResubmitNotice('');
    } catch (err) {
      setDocError(err.response?.data?.error || 'Something went wrong while uploading. Please try again.');
    } finally { setDocUploading(false); }
  };

  const docTypeLabel = selectedType === 'report-card' ? 'Report Card / Grade per Semester'
    : selectedType === 'cor' ? 'Certificate of Registration (COR)' : 'Other Document';

  const serif = { fontFamily: "'Playfair Display', serif" };
  const sans = { fontFamily: "'DM Sans', sans-serif" };

  return (
    <div style={{ ...sans, background: IVORY, minHeight: '100vh' }}>

      {/* ── Hero band ─────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-14 sm:pb-16"
        style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
      >
        <svg
          className="absolute -right-8 -top-10 w-52 h-52 sm:-right-6 sm:-top-8 sm:w-64 sm:h-64 opacity-[0.14] pointer-events-none"
          viewBox="0 0 200 200"
          fill="none"
        >
          <path
            d="M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z"
            fill={GOLD}
          />
          <path d="M100 62c2-16 10-30 22-38" stroke={GOLD} strokeWidth="6" strokeLinecap="round" />
        </svg>

        <p className="relative text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] mb-2" style={{ color: GOLD }}>
          Scholar Portal
        </p>
        <h1 className="relative text-2xl sm:text-3xl md:text-4xl font-bold text-white" style={serif}>Submissions</h1>
        <p className="relative text-xs mt-2 max-w-md" style={{ color: '#e9c9a8' }}>
          Submit your requirements · AI quality analysis · track officer feedback
        </p>
      </div>

      <div className="px-4 sm:px-6 lg:p-8 lg:pt-0">

        {/* ── Correspondence tabs — folded like a folder tab, floats over the hero ── */}
        <div className="relative -mt-8 sm:-mt-10 mb-6 sm:mb-8 flex gap-1 bg-white rounded-2xl p-1.5 w-fit" style={{ boxShadow: '0 12px 30px -12px rgba(79,22,32,0.25)' }}>
          <button onClick={() => setTab('submit')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: tab === 'submit' ? MAROON : 'transparent', color: tab === 'submit' ? '#fff' : '#6b6058' }}>
            <Upload className="w-4 h-4" /> New Submission
          </button>
          <button onClick={() => setTab('history')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: tab === 'history' ? MAROON : 'transparent', color: tab === 'history' ? '#fff' : '#6b6058' }}>
            <History className="w-4 h-4" /> My History
          </button>
        </div>

        {tab === 'history' && <SubmissionHistory history={history} loading={historyLoading} error={historyError} onResubmit={handleResubmit} />}

        {tab === 'submit' && <>
          {resubmitNotice && (
            <div className="mb-4 rounded-xl p-3.5 flex items-start gap-2" style={{ background: '#FBE9E9', border: '1px solid #f3c6c6' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#991b1b' }} />
              <p style={{ ...sans, fontSize: '0.8rem', color: '#991b1b' }}>{resubmitNotice}</p>
            </div>
          )}

          <div className="mb-6">
            <label className="block mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a56475' }}>Submission Type</label>
            <div className="flex flex-wrap gap-x-8 gap-y-2 border-b" style={{ borderColor: '#e9dfd8' }}>
              {submissionTypes.map(type => {
                const Icon = TYPE_ICONS[type.id] || FileText;
                const active = selectedType === type.id;
                return (
                  <button key={type.id} onClick={() => { setSelectedType(type.id); setView('editor'); setEvalResult(null); setDocFile(null); setDocError(''); setDocSuccess(''); setResubmitNotice(''); }}
                    className="flex items-center gap-2 pb-3 text-sm font-semibold transition-colors"
                    style={{ color: active ? MAROON : '#a89890', borderBottom: active ? `2px solid ${MAROON}` : '2px solid transparent', marginBottom: -1 }}>
                    <Icon className="w-4 h-4" style={{ color: active ? GOLD : '#c9b9b0' }} />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedType === 'monthly-report' && <>
            {view === 'editor' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-5">
                  <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)', borderTop: `2px solid ${GOLD}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: MAROON }}><User className="w-3 h-3" style={{ color: '#fff' }} /></div>
                      <h2 style={{ ...serif, fontSize: '1.05rem', fontWeight: 700, color: INK }}>Scholar Information</h2>
                    </div>
                    <p style={{ ...sans, fontSize: '0.77rem', color: '#9ca3af', marginBottom: 22 }}>This will appear in the official letter header</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                      <div className="sm:col-span-2"><InfoField label="Full Name" value={info.name} onChange={updateInfo('name')} placeholder="e.g. Juan Dela Cruz" /></div>
                      <InfoField label="Age" value={info.age} onChange={updateInfo('age')} placeholder="e.g. 20" type="number" />
                      <InfoField label="Year Level" value={info.year} onChange={updateInfo('year')} placeholder="e.g. 2nd Year" />
                      <InfoField label="Course" value={info.course} onChange={updateInfo('course')} placeholder="e.g. BS Computer Science" />
                      <InfoField label="School" value={info.school} onChange={updateInfo('school')} placeholder="e.g. University of the Philippines" />
                      <div className="sm:col-span-2">
                        <label style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: '#a56475', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date <span style={{ color: MAROON }}>*</span></label>
                        <input type="date" value={(() => { try { return new Date(info.date).toISOString().split('T')[0]; } catch { return ''; } })()}
                          onChange={e => { const d = new Date(e.target.value); updateInfo('date')(d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })); }}
                          className="w-full pb-2 outline-none transition-colors bg-transparent"
                          style={{ ...sans, fontSize: '0.9rem', color: INK, borderBottom: '1.5px solid #e9dfd8' }}
                          onFocus={e => (e.target.style.borderBottom = `1.5px solid ${MAROON}`)} onBlur={e => (e.target.style.borderBottom = '1.5px solid #e9dfd8')} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)', borderTop: `2px solid ${GOLD}` }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: MAROON }}><FileText className="w-3 h-3" style={{ color: '#fff' }} /></div>
                        <h2 style={{ ...serif, fontSize: '1.05rem', fontWeight: 700, color: INK }}>Monthly Report Letter</h2>
                      </div>
                      <span style={{ ...sans, fontSize: '0.75rem', color: wordCount >= 150 ? '#15803d' : '#9ca3af', fontWeight: 600 }}>{wordCount} / 150+ words</span>
                    </div>
                    <p style={{ ...sans, fontSize: '0.77rem', color: '#9ca3af', marginBottom: 16 }}>Write your letter addressed to "Dear Kalinga," - share your activities, challenges, and plans this month.</p>
                    <div className="rounded-lg px-4 py-2.5 mb-3" style={{ background: IVORY, border: '1px solid #e9dfd8' }}>
                      <span style={{ ...sans, fontSize: '0.87rem', color: '#9ca3af', fontStyle: 'italic' }}>Dear Kalinga,</span>
                    </div>
                    <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
                      placeholder={`Write your monthly report here. Share what you accomplished this month, any challenges you faced, and your plans for next month.\n\nExample:\nI am writing to update you on my progress for this month...`}
                      className="w-full p-4 rounded-lg border outline-none resize-none transition-all"
                      style={{ ...sans, fontSize: '0.88rem', lineHeight: 1.75, color: INK, borderColor: '#e9dfd8' }}
                      onFocus={e => (e.target.style.borderColor = MAROON)} onBlur={e => (e.target.style.borderColor = '#e9dfd8')} />
                    <div className="rounded-lg px-4 py-2.5 mt-3" style={{ background: IVORY, border: '1px solid #e9dfd8' }}>
                      <p style={{ ...sans, fontSize: '0.87rem', color: '#9ca3af', fontStyle: 'italic' }}>Your scholar,</p>
                      <p style={{ ...sans, fontSize: '0.87rem', fontWeight: 600, color: info.name ? INK : '#d1d5db', marginTop: 2 }}>{info.name || 'Your Name'}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)', borderTop: `2px solid ${GOLD}` }}><MediaUploader media={media} onChange={setMedia} /></div>
                </div>

                <div>
                  <div className="bg-white rounded-2xl p-5 sticky top-6" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
                    <h3 style={{ ...serif, fontSize: '1rem', fontWeight: 700, color: INK, marginBottom: 16 }}>Completion Checklist</h3>
                    <div className="relative mb-5">
                      {/* connecting spine — turns the checklist into one continuous manifest instead of loose rows */}
                      <div className="absolute left-[7px] top-1 bottom-1 w-px" style={{ background: '#ecdfe1' }} />
                      <div className="space-y-3.5">
                        {CHECKLIST.map(item => {
                          const passed = item.check(info, body, media);
                          return (
                            <div key={item.id} className="relative flex items-start gap-3 pl-0.5">
                              <span
                                className="relative z-10 w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center"
                                style={passed ? { background: MAROON } : { background: '#fff', border: '1.5px solid #d8c9c2' }}
                              >
                                {passed && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </span>
                              <span style={{ ...sans, fontSize: '0.79rem', color: passed ? INK : '#a89890', lineHeight: 1.4 }}>{item.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg p-3 mb-4" style={{ background: ROSE, border: `1px solid #e9c9d2` }}>
                      <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: MAROON, marginBottom: 6 }}>Quality Thresholds</p>
                      {[
                        { range: '90 – 100', label: 'Excellent ✓', color: '#15803d' },
                        { range: '75 – 89', label: 'Good ✓', color: '#15803d' },
                        { range: '50 – 74', label: 'Needs Improvement ⚠', color: '#92400e' },
                        { range: '0 – 49', label: 'Non-Compliant ✗', color: '#991b1b' },
                      ].map(t => (
                        <div key={t.range} className="flex justify-between">
                          <span style={{ ...sans, fontSize: '0.75rem', color: '#6b7280' }}>{t.range}</span>
                          <span style={{ ...sans, fontSize: '0.75rem', fontWeight: 600, color: t.color }}>{t.label}</span>
                        </div>
                      ))}
                    </div>

                    {!scholarId && (
                      <div className="rounded-lg p-3 mb-4 flex items-start gap-2" style={{ background: '#FBE9E9', border: '1px solid #f3c6c6' }}>
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#991b1b' }} />
                        <p style={{ ...sans, fontSize: '0.74rem', color: '#991b1b' }}>No scholar account detected. Please log out and log back in.</p>
                      </div>
                    )}

                    <div className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2" style={{ background: '#F6EFE1', border: `1px solid ${GOLD}55` }}>
                      <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: GOLD }} />
                      <span style={{ ...sans, fontSize: '0.72rem', color: '#8a6a3a' }}>Powered by Naive Bayes ML · rule-based fallback if offline</span>
                    </div>

                    <button disabled={!hasContent || evaluating} onClick={handleEvaluate}
                      className="w-full py-3 rounded-full flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
                      style={{ ...sans, fontSize: '0.9rem', fontWeight: 600, background: MAROON, color: '#fff', border: 'none', cursor: (hasContent && !evaluating) ? 'pointer' : 'not-allowed' }}>
                      <Sparkles className="w-4 h-4" />
                      {evaluating ? 'Evaluating...' : 'Evaluate Report'}
                      {!evaluating && <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view === 'evaluation' && evalResult && (
              <div>
                <button onClick={() => setView('editor')} className="flex items-center gap-1 mb-4 transition-opacity hover:opacity-70"
                  style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, color: MAROON, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Editor
                </button>

                <div className="rounded-t-2xl px-5 py-4 flex items-start gap-3" style={{ background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                    <circle cx="14" cy="14" r="13" stroke={GOLD} strokeWidth="1.8" />
                    <path d="M8 9h12M8 13.5h8M8 18h10" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="21" cy="19" r="4" fill={GOLD} />
                    <path d="M19.5 19l1 1 2-2" stroke={MAROON_DEEP} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <h3 style={{ ...serif, fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: 3 }}>Intelligent Correspondence Evaluation</h3>
                    <p style={{ ...sans, fontSize: '0.78rem', color: '#e9c9a8' }}>
                      {evalResult.source === 'naive_bayes' ? 'Naive Bayes ML Classification · Apple Scholar System' : 'Rule-Based Scoring (ML offline) · Apple Scholar System'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between px-5 py-2.5" style={{ background: '#fff', border: '1px solid #f0e6e0', borderTop: 'none' }}>
                  <span style={{ ...sans, fontSize: '0.8rem', color: '#6b7280' }}>Monthly Report — {info.name || 'Scholar'} · {info.date}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setView('editor')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
                      style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, border: '1px solid #d8c9c2', background: '#fff', color: '#6b6058', cursor: 'pointer' }}>
                      <Bookmark className="w-3 h-3" /> Save Draft
                    </button>
                    <button onClick={() => { setSubmitError(''); setShowConfirm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
                      style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, border: 'none', background: MAROON, color: '#fff', cursor: 'pointer' }}>
                      <Send className="w-3 h-3" /> Submit Application
                    </button>
                  </div>
                </div>

                <div className="grid rounded-b-2xl overflow-hidden" style={{ gridTemplateColumns: '1fr 340px', border: '1px solid #f0e6e0', borderTop: 'none' }}>
                  {/* Left — Letter Preview */}
                  <div className="p-6 bg-white overflow-y-auto" style={{ maxHeight: 620, borderRight: '1px solid #f5eee9' }}>
                    <div className="text-center mb-5 pb-4" style={{ borderBottom: `1px solid ${GOLD}55` }}>
                      <p style={{ ...serif, fontSize: '0.9rem', fontWeight: 700, color: MAROON }}>Kalinga at Pag-ibig Foundation Inc.</p>
                      <p style={{ ...sans, fontSize: '0.77rem', color: '#9ca3af' }}>Apple Scholars · Rodriguez, Rizal</p>
                    </div>
                    <div className="mb-5 space-y-1">
                      {[['Name', info.name], ['Age', info.age ? `${info.age} years old` : ''], ['Year', info.year], ['Course', info.course], ['School', info.school], ['Date', info.date]].map(([l, v]) => v ? (
                        <div key={l} className="flex gap-2">
                          <span style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: '#374151', minWidth: 52 }}>{l}:</span>
                          <span style={{ ...sans, fontSize: '0.8rem', color: '#6b7280' }}>{v}</span>
                        </div>
                      ) : null)}
                    </div>
                    <p style={{ ...sans, fontSize: '0.87rem', lineHeight: 1.8, color: '#374151', marginBottom: 14 }}>Dear Kalinga,</p>
                    {body.split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                      <p key={i} style={{ ...sans, fontSize: '0.87rem', lineHeight: 1.78, color: '#374151', marginBottom: 12, textIndent: '1.5rem' }}>{para.trim()}</p>
                    ))}
                    <p style={{ ...sans, fontSize: '0.87rem', color: '#374151', marginTop: 20, marginBottom: 2 }}>Your scholar,</p>
                    <p style={{ ...sans, fontSize: '0.87rem', fontWeight: 700, color: INK }}>{info.name}</p>
                    {media.length > 0 && (
                      <div className="mt-5 pt-4" style={{ borderTop: '1px solid #f5eee9' }}>
                        <p style={{ ...sans, fontSize: '0.75rem', fontWeight: 700, color: MAROON, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Documentation ({media.length} photo{media.length > 1 ? 's' : ''})
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {media.map((item) => (
                            <div key={item.id}>
                              <div className="rounded-lg overflow-hidden" style={{ height: 70 }}>
                                <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                              <p style={{ ...sans, fontSize: '0.67rem', color: '#9ca3af', marginTop: 3, textAlign: 'center', fontStyle: 'italic' }}>
                                {item.description ? `(${item.description.substring(0, 35)}${item.description.length > 35 ? '…' : ''})` : '(no description)'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p style={{ ...sans, fontSize: '0.72rem', color: '#d1d5db', marginTop: 16 }}>Words: {wordCount} · Page 1 / Apple Scholar</p>
                  </div>

                  {/* Right — Scores Panel */}
                  <div className="p-4 overflow-y-auto" style={{ background: IVORY, maxHeight: 620 }}>

                    {/* Overall Score */}
                    <div className="rounded-xl p-4 mb-4 flex items-center gap-3" style={{ background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}>
                      <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
                        <ScoreRing score={evalResult.overallScore} size={64} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{evalResult.overallScore}</span>
                        </div>
                      </div>
                      <div>
                        <p style={{ ...sans, fontSize: '0.67rem', fontWeight: 600, color: '#e9c9a8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Evaluated Grade</p>
                        <p style={{ ...serif, fontSize: '1.4rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                          {evalResult.overallScore}<span style={{ fontSize: '0.85rem' }}>/100</span>
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full"
                          style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, background: evalResult.riskColor + '30', color: evalResult.riskColor }}>
                          {evalResult.riskLabel}
                        </span>
                      </div>
                    </div>

                    {/* Report + Media summary */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        { label: 'Report Score', value: evalResult.reportScore, sub: '75% weight' },
                        { label: 'Media Score', value: evalResult.mediaScore, sub: '25% weight' },
                      ].map(s => (
                        <div key={s.label} className="rounded-lg p-3 text-center bg-white" style={{ border: '1px solid #f0e6e0' }}>
                          <p style={{ ...sans, fontSize: '0.65rem', color: '#9ca3af', marginBottom: 1 }}>{s.label}</p>
                          <p style={{ ...serif, fontSize: '1.2rem', fontWeight: 700, color: s.value >= 75 ? '#15803d' : s.value >= 50 ? '#92400e' : '#991b1b' }}>{s.value}</p>
                          <p style={{ ...sans, fontSize: '0.62rem', color: '#d1d5db' }}>{s.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* Rubric Breakdown — ML mode */}
                    {evalResult.source === 'naive_bayes' && evalResult.rubric && (
                      <>
                        <div className="mb-3">
                          <p style={{ ...sans, fontSize: '0.67rem', fontWeight: 700, color: MAROON, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                            Scholar Information (5%)
                          </p>
                          <ScoreBar score={evalResult.rubric.date.score} weight={5} label="Date Format" />
                        </div>

                        <div className="mb-3">
                          <p style={{ ...sans, fontSize: '0.67rem', fontWeight: 700, color: MAROON, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                            Body of Letter (70%)
                          </p>
                          <ScoreBar score={evalResult.rubric.paragraph.score}        weight={14}  label="Paragraph Structure" />
                          <ScoreBar score={evalResult.rubric.academic.score}         weight={14}  label="Academic Updates" />
                          <ScoreBar score={evalResult.rubric.self_improvement.score} weight={14}  label="Self-Improvement" />
                          <ScoreBar score={evalResult.rubric.family.score}           weight={14}  label="Family Situation" />
                          <ScoreBar score={evalResult.rubric.difficulty.score}       weight={14}  label="Socio-Economic" />
                        </div>

                        <div className="mb-3">
                          <p style={{ ...sans, fontSize: '0.67rem', fontWeight: 700, color: MAROON, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                            Documentation with Caption (25%)
                          </p>
                          <ScoreBar score={evalResult.rubric.picture.score} weight={12.5} label="Document / Picture" />
                          <ScoreBar score={evalResult.rubric.caption.score} weight={12.5} label="Captions" />
                        </div>
                      </>
                    )}

                    {/* Structure Validator — rule-based fallback */}
                    {evalResult.source === 'rule_based' && (
                      <>
                        <p style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Structure Validator</p>
                        <div className="space-y-1.5 mb-4">
                          {evalResult.checklist.map(({ item, passed }) => (
                            <div key={item.id} className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                              style={passed ? { background: '#EAF3EC', border: '1px solid #bbf7d0' } : { background: '#FBE9E9', border: '1px solid #f3c6c6' }}>
                              {passed ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#15803d' }} /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#991b1b' }} />}
                              <span style={{ ...sans, fontSize: '0.74rem', fontWeight: 500, color: passed ? '#15803d' : '#991b1b' }}>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <div style={{ height: 1, background: '#f0e6e0', margin: '10px 0' }} />

                    {/* Tone */}
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Academic Tone</span>
                      <span style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: evalResult.toneColor }}>{evalResult.toneLabel}</span>
                    </div>
                    <p style={{ ...sans, fontSize: '0.73rem', color: '#6b7280', lineHeight: 1.5, fontStyle: 'italic', marginBottom: 10 }}>
                      {evalResult.overallScore >= 75 ? '"Professional and well-structured letter."'
                        : evalResult.overallScore >= 50 ? '"Decent tone; needs more detail or formal language."'
                        : '"Letter needs significant improvement before submission."'}
                    </p>

                    {!evalResult.accepted && (
                      <div className="rounded-lg p-3 mb-3" style={{ background: getRiskBg(evalResult.riskLevel), border: `1px solid ${getRiskBorder(evalResult.riskLevel)}` }}>
                        <p style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: evalResult.riskColor, marginBottom: 3 }}>
                          {evalResult.riskLevel === 'medium' ? 'Needs Improvement' : 'Non-Compliant — Will Not Be Accepted'}
                        </p>
                        <p style={{ ...sans, fontSize: '0.73rem', color: '#6b7280', lineHeight: 1.5 }}>
                          {evalResult.riskLevel === 'medium'
                            ? 'Score must reach 75+ to be accepted. Improve your letter content and attach photos.'
                            : 'Score is too low. Please improve your report before submitting.'}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold"
                        style={{ background: evalResult.source === 'naive_bayes' ? '#F6EFE1' : '#f5f0ed', color: evalResult.source === 'naive_bayes' ? GOLD : '#6b7280' }}>
                        {evalResult.source === 'naive_bayes' ? 'Naive Bayes ML' : 'Rule-Based'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'submitted' && <SubmittedView info={info} body={body} media={media} onNew={handleNewSubmission} />}
            {showConfirm && evalResult && (
              <ConfirmModal ev={evalResult} submitting={submitting} submitError={submitError}
                onCancel={() => setShowConfirm(false)} onConfirm={handleConfirmSubmit} />
            )}
          </>}

          {selectedType === 'grades' && <ScholarGrades />}

          {selectedType !== 'monthly-report' && selectedType !== 'grades' && (
            <div className="bg-white rounded-2xl p-8" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
              <div className="max-w-2xl mx-auto">
                {docSuccess ? (
                  <div className="rounded-xl p-6 flex items-center gap-3" style={{ background: '#EAF3EC', border: '1px solid #bbf7d0' }}>
                    <CheckCircle className="w-6 h-6 flex-shrink-0" style={{ color: '#15803d' }} />
                    <div>
                      <p style={{ ...sans, fontSize: '0.9rem', fontWeight: 700, color: '#15803d' }}>{docSuccess}</p>
                      <button onClick={() => setDocSuccess('')} className="text-xs mt-2 underline"
                        style={{ color: MAROON, ...sans, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upload another document</button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl p-12 text-center" style={{ border: `2px dashed ${GOLD}88`, background: IVORY }}>
                    <Upload className="w-16 h-16 mx-auto mb-4" style={{ color: MAROON }} />
                    <h3 className="mb-2" style={{ ...serif, fontSize: '1.25rem', fontWeight: 700, color: INK }}>Upload Your {docTypeLabel}</h3>
                    <p className="mb-4" style={{ ...sans, fontSize: '0.9rem', color: '#6b7280' }}>{docFile ? docFile.name : 'Drag and drop or click to browse'}</p>
                    <input id="doc-upload-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={e => setDocFile(e.target.files?.[0] || null)} />
                    <button onClick={() => document.getElementById('doc-upload-input').click()} className="px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
                      style={{ ...sans, fontSize: '0.95rem', fontWeight: 600, backgroundColor: '#fff', color: MAROON, border: `1.5px solid ${MAROON}`, cursor: 'pointer' }}>
                      Browse Files
                    </button>
                    {docFile && (
                      <button onClick={handleDocUpload} disabled={docUploading || !scholarId} className="block mx-auto mt-4 px-6 py-3 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                        style={{ ...sans, fontSize: '0.95rem', fontWeight: 600, backgroundColor: MAROON, color: '#ffffff', border: 'none', cursor: docUploading ? 'not-allowed' : 'pointer' }}>
                        {docUploading ? 'Uploading...' : `Submit ${docTypeLabel}`}
                      </button>
                    )}
                    {docError && <p className="mt-4 text-xs" style={{ ...sans, color: '#991b1b' }}>{docError}</p>}
                    <p className="mt-4 text-xs" style={{ ...sans, color: '#9ca3af' }}>Supported formats: PDF, JPG, PNG (Max 10MB)</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>}
      </div>
    </div>
  );
}

export default Submission;