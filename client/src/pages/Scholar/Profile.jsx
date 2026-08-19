import { useState, useEffect } from 'react';
import axios from 'axios';
import useComplianceStatus from '../../hooks/useComplianceStatus';
import {
  User, BookOpen, Heart, FileText, TrendingUp,
  CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Pencil,
  ShieldCheck, RefreshCw,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$|\/$/g, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const SUBMISSION_API = `${API}/submission`;

// ── Token system ──────────────────────────────────────────
// Deep maroon carries authority/brand, gold is the "seal" accent.
// Cream isn't pure white — it's warm ivory so tinted panels read as
// intentional, not just "boxes with a background-color."
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';
const ROSE = '#F5E8EA';

const authHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const statusMap = {
  complied: { color: '#15803d', bg: '#EAF3EC', icon: CheckCircle, label: 'Complied' },
  pending: { color: '#92400e', bg: '#FBF0DE', icon: Clock, label: 'Pending' },
  missed: { color: '#991b1b', bg: '#FBE9E9', icon: XCircle, label: 'Missed' },
  passed: { color: '#15803d', bg: '#EAF3EC', icon: CheckCircle, label: 'Passed' },
  approved: { color: '#15803d', bg: '#EAF3EC', icon: CheckCircle, label: 'Approved' },
  rejected: { color: '#991b1b', bg: '#FBE9E9', icon: XCircle, label: 'Rejected' },
};

function StatusTag({ status }) {
  const key = status?.toLowerCase() || 'pending';
  const cfg = statusMap[key] || statusMap.pending;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function formatDate(value) {
  if (!value) return 'TBA';
  try {
    return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
}

const formatYearLevelLabel = (value) => {
  if (!value) return 'N/A';

  const normalized = String(value).trim().toLowerCase().replace(/_/g, ' ');
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

const ScholarProfile = () => {
  const userId = localStorage.getItem('id');
  const scholarId = localStorage.getItem('scholar_id');
  const { data: complianceData, loading: complianceLoading, error: complianceError, refetch: refreshCompliance } = useComplianceStatus();
  const [profile, setProfile] = useState(null);
  const [grades, setGrades] = useState([]);
  const [history, setHistory] = useState([]);
  const [duties, setDuties] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState('Academic');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const yearLevelOptions = [
    { value: 'grade_7', label: 'Grade 7' },
    { value: 'grade_8', label: 'Grade 8' },
    { value: 'grade_9', label: 'Grade 9' },
    { value: 'grade_10', label: 'Grade 10' },
    { value: 'grade_11', label: 'Grade 11' },
    { value: 'grade_12', label: 'Grade 12' },
    { value: 'college_1', label: '1st Year College' },
    { value: 'college_2', label: '2nd Year College' },
    { value: 'college_3', label: '3rd Year College' },
    { value: 'college_4', label: '4th Year College' },
    { value: 'college_5', label: '5th Year College' },
  ];

  const [form, setForm] = useState({
    fullName: '', email: '', age: '', phone: '', address: '', course: '', school: '', yearLevel: '',
  });

  useEffect(() => {
    const loadData = async () => {
      if (!userId || !scholarId) {
        setError('Scholar credentials missing. Please log in again.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [profileRes, historyRes, gradesRes, dutiesRes] = await Promise.allSettled([
          axios.get(`${API}/scholar/profile/${userId}`, { headers: authHeader() }),
          axios.get(`${SUBMISSION_API}/history/${scholarId}`, { headers: authHeader() }),
          axios.get(`${SUBMISSION_API}/grades/${scholarId}`, { headers: authHeader() }),
          axios.get(`${API}/scholar/my-duties`, { headers: authHeader() }),
        ]);
        if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
        if (historyRes.status === 'fulfilled') setHistory(historyRes.value.data || []);
        if (gradesRes.status === 'fulfilled') setGrades(gradesRes.value.data || []);
        if (dutiesRes.status === 'fulfilled') setDuties(dutiesRes.value.data || []);
      } catch (err) {
        console.error('Error loading scholar profile data', err);
        setError('Unable to load your profile right now. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [userId, scholarId]);

  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName: profile.full_name || '',
      email: profile.email || '',
      age: profile.age ?? '',
      phone: profile.phone || '',
      address: profile.address || '',
      course: profile.course || '',
      school: profile.school || '',
      yearLevel: profile.year_level || '',
    });
  }, [profile]);

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSaveProfile = async () => {
    setError('');
    setSaveMessage('');
    if (!form.fullName.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        age: form.age === '' ? null : Number(form.age),
        phone: form.phone.trim(),
        address: form.address.trim(),
        course: form.course.trim(),
        school: form.school.trim(),
        year_level: form.yearLevel.trim(),
      };
      const res = await axios.patch(`${API_BASE}/scholar/profile/${userId}`, payload, { headers: authHeader() });
      setProfile(res.data);
      localStorage.setItem('name', res.data.full_name || form.fullName.trim());
      localStorage.setItem('email', res.data.email || form.email.trim());
      setSaveMessage('Profile updated successfully.');
      setEditMode(false);
      setTimeout(() => setSaveMessage(''), 4000);
    } catch (err) {
      console.error('Error saving profile', err);
      setError(err.response?.data?.error || 'Unable to save profile data.');
    } finally {
      setSaving(false);
    }
  };

  const latestSubmission = history[0] || null;
  const serviceEntries = history
    .filter((item) => item.service_hours && parseFloat(item.service_hours) > 0)
    .map((item) => ({
      activity: item.service_activity || 'Community Service',
      hours: parseFloat(item.service_hours) || 0,
      date: formatDate(item.service_date),
    }));

  const totalServiceHours = serviceEntries.reduce((sum, item) => sum + item.hours, 0);
  const requiredHours = 32;
  const serviceProgress = Math.min(Math.round((totalServiceHours / requiredHours) * 100), 100);

  const gradeItems = grades.map((item) => ({
    semester: `${item.semester} ${item.academic_year}`,
    gwa: item.gwa,
    status: item.status || 'pending',
    units: Math.round(parseFloat(item.total_units) || 0),
  }));

  const academicItems = [
    {
      name: '1st Sem Grades (AY 2025-2026)',
      status: grades.some((g) => g.semester === '1st Sem' && g.academic_year === '2025-2026' && g.status === 'passed') ? 'passed' : 'pending',
      deadline: 'Jul 15, 2026',
    },
    { name: 'Enrollment Certificate', status: latestSubmission?.cor_path ? 'complied' : 'pending', deadline: 'Jun 1, 2026' },
    { name: 'Class Schedule', status: latestSubmission?.report_card_path ? 'complied' : 'pending', deadline: 'Jun 1, 2026' },
  ];

  const dutyItems = duties.slice(0, 3).map((duty) => ({
    name: duty.title || 'Duty Participation',
    status: duty.computed_status || 'pending',
    deadline: formatDate(duty.duty_date),
  }));

  const serviceItems = serviceEntries.slice(0, 3).map((entry) => ({ name: entry.activity, status: 'complied', deadline: entry.date }));

  const letterItems = history
    .filter((item) => item.submission_type === 'letter')
    .slice(0, 3)
    .map((item) => ({
      name: `Letter - ${formatDate(item.submitted_at)}`,
      status: item.status === 'approved' ? 'passed' : item.status === 'rejected' ? 'missed' : 'pending',
      deadline: formatDate(item.submitted_at),
    }));

  const requirements = [
    { category: 'Academic', accent: MAROON, bg: '#F5E8EA', icon: BookOpen, items: academicItems },
    { category: 'Attendance & Duty', accent: '#92400e', bg: '#FBF0DE', icon: Clock, items: dutyItems.length ? dutyItems : [{ name: 'No assigned duties yet', status: 'pending', deadline: 'TBA' }] },
    { category: 'Community Service', accent: '#15803d', bg: '#EAF3EC', icon: Heart, items: serviceItems.length ? serviceItems : [{ name: 'No service hours recorded yet', status: 'pending', deadline: 'TBA' }] },
    { category: 'Report Submissions', accent: GOLD, bg: '#F6EFE1', icon: FileText, items: letterItems.length ? letterItems : [{ name: 'No reports submitted yet', status: 'pending', deadline: 'TBA' }] },
  ];

  const categoryRate = (items) => {
    const done = items.filter((i) => ['complied', 'passed', 'approved'].includes(i.status)).length;
    return items.length ? done / items.length : 0;
  };

  const allRequirementItems = requirements.flatMap((cat) => cat.items);
  const compliedCount = allRequirementItems.filter((item) => ['complied', 'passed', 'approved'].includes(item.status)).length;
  const compliance = allRequirementItems.length > 0 ? Math.round((compliedCount / allRequirementItems.length) * 100) : 0;
  const pendingCount = allRequirementItems.filter((item) => item.status === 'pending').length;

  const sentimentHistory = history
    .filter((item) => item.sentiment_label)
    .slice(0, 3)
    .map((item) => ({
      month: item.submitted_at ? new Date(item.submitted_at).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }) : 'Unknown',
      label: item.sentiment_label || 'Neutral',
      score: item.sentiment_score || 0,
      color: item.sentiment_label === 'Positive' ? '#15803d' : item.sentiment_label === 'Negative' ? '#991b1b' : '#92400e',
      bg: item.sentiment_label === 'Positive' ? '#EAF3EC' : item.sentiment_label === 'Negative' ? '#FBE9E9' : '#FBF0DE',
      excerpt: item.letter_content ? item.letter_content.slice(0, 90) : 'No sentiment text available.',
    }));

  const displayName = profile?.full_name || localStorage.getItem('name') || 'Scholar';
  const displayEmail = profile?.email || localStorage.getItem('email') || 'you@example.com';
  const displayCourse = profile?.course || 'N/A';
  const displayYearLevel = formatYearLevelLabel(profile?.year_level);
  const displayId = profile?.scholar_id || localStorage.getItem('scholar_id') || 'N/A';
  const displayStatus = profile?.status || 'Active';

  // Recolored onto the shared ledger palette — Excellent/Good Standing share
  // the "on track" green, Low Risk reads as an amber caution note in gold,
  // Medium/High Risk escalate through amber to red. Same five tiers as
  // before, just mapped onto tokens used everywhere else on this page
  // instead of ad hoc Tailwind color classes.
  const getComplianceLabel = (value) => {
    if (value >= 90) return 'Excellent';
    if (value >= 80) return 'Good Standing';
    if (value >= 70) return 'Low Risk';
    if (value >= 50) return 'Medium Risk';
    return 'High Risk';
  };

  const getBadgeStyle = (value) => {
    if (value >= 90) return { color: '#15803d', bg: '#EAF3EC' };
    if (value >= 80) return { color: '#15803d', bg: '#EAF3EC' };
    if (value >= 70) return { color: '#8a6a3a', bg: '#F6EFE1' };
    if (value >= 50) return { color: '#92400e', bg: '#FBF0DE' };
    return { color: '#991b1b', bg: '#FBE9E9' };
  };

  const complianceScore = complianceData?.overall_compliance ?? null;
  const recoverableCredits = Number(complianceData?.recoverable_credits || 0);
  const complianceLabel = complianceScore !== null ? getComplianceLabel(complianceScore) : 'Loading...';
  const complianceBadge = complianceScore !== null ? getBadgeStyle(complianceScore) : { color: '#a89890', bg: '#f1ece8' };

  const serif = { fontFamily: "'Playfair Display', serif" };
  const sans = { fontFamily: "'DM Sans', sans-serif" };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8" style={{ background: IVORY, minHeight: '100vh' }}>
        <div className="animate-pulse space-y-6">
          <div className="h-32 rounded-2xl" style={{ background: 'linear-gradient(135deg, #e9d9dc, #f1e5e7)' }} />
          <div className="h-3 bg-slate-100 rounded" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...sans, background: IVORY, minHeight: '100vh' }}>

      {/* ── Hero band: gradient identity block ─────────────── */}
      <div
        className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16 sm:pb-20"
        style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
      >
        {/* subtle decorative mark — an apple silhouette, nodding to "Apple Scholar" */}
        <svg
          className="absolute -right-8 -top-10 w-52 h-52 sm:-right-6 sm:-top-8 sm:w-64 sm:h-64 opacity-[0.14] pointer-events-none"
          viewBox="0 0 200 200"
          fill="none"
        >
          <path
            d="M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z"
            fill={GOLD}
          />
          <path
            d="M100 62c2-16 10-30 22-38"
            stroke={GOLD}
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
        <div className="relative flex items-start justify-between gap-3 mb-6 sm:mb-8 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] mb-2" style={{ color: GOLD }}>
              Scholar Portal · Profile
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white" style={serif}>My Profile</h1>
          </div>
          <button
            onClick={() => {
              if (editMode) {
                setEditMode(false);
                setError('');
                setForm({
                  fullName: profile?.full_name || '', email: profile?.email || '', age: profile?.age ?? '', phone: profile?.phone || '',
                  address: profile?.address || '', course: profile?.course || '', school: profile?.school || '',
                  yearLevel: profile?.year_level || '',
                });
              } else {
                setEditMode(true);
              }
            }}
            className="mt-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-full transition-colors"
            style={{ color: MAROON_DEEP, background: editMode ? 'rgba(255,255,255,0.85)' : GOLD }}
          >
            <Pencil size={12} />
            {editMode ? 'Cancel editing' : 'Edit profile'}
          </button>
        </div>

        {saveMessage && (
          <p className="relative text-xs font-bold uppercase tracking-wider mb-4 px-3 py-2 rounded-lg inline-block" style={{ color: '#15803d', background: '#EAF3EC' }}>
            {saveMessage}
          </p>
        )}

        {/* ── Edit form ─────────────────────────────────────── */}
        {editMode && (
          <div className="relative mb-2 p-5 sm:p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              {[
                { key: 'fullName', label: 'Full Name' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'age', label: 'Age', type: 'number' },
                { key: 'phone', label: 'Phone' },
                { key: 'address', label: 'Address' },
                { key: 'course', label: 'Course' },
                { key: 'school', label: 'School' },
              ].map((f) => (
                <label key={f.key} className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#e9c9a8' }}>{f.label}</span>
                  <input
                    value={form[f.key]}
                    onChange={(e) => updateForm(f.key, e.target.value)}
                    type={f.type || 'text'}
                    className="w-full mt-1 pb-2 text-sm text-white border-b outline-none transition-colors bg-transparent"
                    style={{ borderColor: 'rgba(255,255,255,0.3)' }}
                    onFocus={(e) => (e.target.style.borderColor = GOLD)}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.3)')}
                  />
                </label>
              ))}

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#e9c9a8' }}>Year Level</span>
                <select
                  value={form.yearLevel || ''}
                  onChange={(e) => updateForm('yearLevel', e.target.value)}
                  className="w-full mt-1 pb-2 text-sm text-white border-b outline-none transition-colors bg-transparent"
                  style={{ borderColor: 'rgba(255,255,255,0.3)' }}
                  onFocus={(e) => (e.target.style.borderColor = GOLD)}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.3)')}
                >
                  <option value="" style={{ color: '#241512' }}>Select year level</option>
                  {yearLevelOptions.map((option) => (
                    <option key={option.value} value={option.value} style={{ color: '#241512' }}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {error && <p className="text-xs font-bold mt-5" style={{ color: '#ffb4b4' }}>{error}</p>}
            <button
              disabled={saving}
              onClick={handleSaveProfile}
              className="mt-6 px-6 py-2.5 text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-opacity rounded-full"
              style={{ background: GOLD, color: MAROON_DEEP }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}

        {!editMode && error && (
          <p className="relative text-xs font-bold mb-4 px-3 py-2 rounded-lg inline-block" style={{ color: '#ffb4b4', background: 'rgba(0,0,0,0.15)' }}>
            {error}
          </p>
        )}

        {/* ── Identity row ───────────────────────────────────── */}
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.1)', border: `2px solid ${GOLD}` }}
            >
              <User size={24} style={{ color: GOLD }} />
            </div>
            <div className="min-w-0 sm:hidden">
              <h2 className="text-lg font-bold text-white truncate" style={serif}>{displayName}</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8fe0b0' }}>● {displayStatus}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="hidden sm:flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-white truncate" style={serif}>{displayName}</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: '#8fe0b0' }}>● {displayStatus}</span>
            </div>
            <p className="text-xs mt-1 break-words" style={{ color: '#e9c9a8' }}>
              {displayId} &nbsp;·&nbsp; {displayYearLevel} &nbsp;·&nbsp; {displayCourse} &nbsp;·&nbsp; {profile?.school || 'University of the Philippines'}
            </p>
          </div>
          <div className="flex flex-row sm:flex-col flex-wrap gap-x-4 gap-y-0.5 text-xs sm:text-right min-w-0 sm:flex-shrink-0">
            <p className="truncate max-w-full" style={{ color: 'rgba(255,255,255,0.65)' }}>{displayEmail}</p>
            <p className="truncate max-w-full" style={{ color: 'rgba(255,255,255,0.65)' }}>{profile?.phone || 'No phone on file'}</p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:p-8 lg:pt-0">

        {/* ── Compliance Snapshot — recolored onto the ledger palette ── */}
        <div className="grid gap-5 mb-8 relative -mt-10 sm:-mt-12">
          <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 12px 30px -12px rgba(79,22,32,0.25)', borderTop: `2px solid ${GOLD}` }}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={13} style={{ color: MAROON }} />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: '#a56475' }}>Scholar Compliance Snapshot</p>
                </div>
                <h2 className="text-3xl font-bold" style={{ ...serif, color: INK }}>{complianceScore !== null ? `${Math.round(complianceScore)} Credits` : '—'}</h2>
                <p className="inline-flex items-center rounded-full px-3 py-1 mt-3 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: complianceBadge.color, background: complianceBadge.bg }}>
                  {complianceLabel}
                </p>
              </div>
              <div className="text-sm text-slate-500 max-w-xl">
                <p className="font-semibold" style={{ color: INK }}>Academic status:</p>
                <p>{complianceData?.academic_status || 'No academic score available yet.'}</p>
                <p className="mt-3">This shows your current compliance score and the top actions that can improve it.</p>
              </div>
            </div>

            <div className="mt-6 pt-5" style={{ borderTop: '1px solid #f0e6e0' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: '#a56475' }}>Active flags</p>
                  <p className="text-sm text-slate-500 mt-0.5">Keep track of what to address next.</p>
                </div>
                <button
                  type="button"
                  onClick={refreshCompliance}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors"
                  style={{ color: MAROON }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = MAROON_DEEP)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = MAROON)}
                >
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              <div className="mt-4 space-y-2.5">
                {complianceLoading ? (
                  <p className="text-sm text-slate-400">Loading compliance data…</p>
                ) : complianceError ? (
                  <p className="text-sm" style={{ color: '#991b1b' }}>Unable to load compliance status right now.</p>
                ) : complianceData?.flags?.length ? (
                  complianceData?.flags?.map((flag, index) => (
                    <div key={index} className="rounded-xl p-4" style={{ background: IVORY, border: '1px solid #f0e6e0' }}>
                      <p className="text-sm font-semibold" style={{ color: INK }}>{flag.type}</p>
                      <p className="mt-1 text-sm text-slate-500">{flag.description}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl p-4" style={{ background: '#EAF3EC' }}>
                    <p className="text-sm font-semibold" style={{ color: '#0e5c2c' }}>No current flags</p>
                    <p className="mt-1 text-sm" style={{ color: '#4c9d6a' }}>Your score is on track. Keep submitting on time and completing your service hours.</p>
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-xl p-4 text-sm" style={{ background: '#F6EFE1' }}>
                <p className="font-semibold" style={{ color: '#8a6a3a' }}>Recovery tip</p>
                <p className="mt-2" style={{ color: '#8a6a3a' }}>
                  {recoverableCredits > 0
                    ? `You currently have ${recoverableCredits.toFixed(2).replace(/\.00$/, '')} recoverable credit${recoverableCredits > 1 ? 's' : ''}. Completing one more service hour or submitting your next report early can offset deductions and raise your score.`
                    : 'Completing one more service hour or submitting your next report early can help raise your score and keep you in good standing.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-6" style={{ background: ROSE }}>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white/70">
                <BookOpen size={13} style={{ color: MAROON }} />
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: MAROON_DEEP }}>Academic Status</h3>
            </div>
            <p className="text-lg font-bold mb-1" style={{ ...serif, color: INK }}>{complianceData?.academic_status || 'No academic status yet'}</p>
            <p className="text-sm" style={{ color: '#a56475' }}>This is separate from your compliance score and reflects how your recent grades are performing.</p>
            {complianceData?.normalized_academic_score !== null && (
              <p className="mt-4 text-sm font-semibold" style={{ color: INK }}>Current normalized academic score: {complianceData?.normalized_academic_score}</p>
            )}
          </div>
        </div>

        {/* ── Compliance ledger meter ─────────────────────────── */}
        <div
          className="mb-8 sm:mb-10 p-5 sm:p-6 rounded-2xl bg-white"
          style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}
        >
          <div className="flex items-end justify-between mb-3 gap-2">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-400">Compliance Standing</p>
            <p className="text-xl sm:text-2xl font-bold flex-shrink-0" style={{ ...serif, color: MAROON }}>{compliance}<span className="text-sm"> Credits</span></p>
          </div>
          <div className="flex w-full h-2.5 rounded-full overflow-hidden gap-1">
            {requirements.map((cat) => {
              const rate = categoryRate(cat.items);
              return (
                <div key={cat.category} className="flex-1 rounded-full overflow-hidden" style={{ background: cat.bg }} title={cat.category}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(rate * 100)}%`, background: rate > 0 ? cat.accent : 'transparent' }} />
                </div>
              );
            })}
          </div>
          <div className="grid mt-2 gap-1" style={{ gridTemplateColumns: `repeat(${requirements.length}, minmax(0, 1fr))` }}>
            {requirements.map((cat) => (
              <span key={cat.category} className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center truncate px-0.5">
                {cat.category.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>

        {/* ── Quick figures row — tinted cards, not flat white ── */}
        <div className="grid grid-cols-3 gap-3 sm:gap-5 mb-8 sm:mb-10">
          <div className="min-w-0 rounded-2xl p-4 sm:p-5" style={{ background: '#F5E8EA' }}>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center mb-2 sm:mb-3 bg-white/70">
              <TrendingUp size={14} style={{ color: MAROON }} />
            </div>
            <p className="text-lg sm:text-2xl font-bold truncate" style={{ ...serif, color: MAROON }}>{compliance} Credits</p>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5 leading-tight" style={{ color: '#a56475' }}>Compliance Credits</p>
          </div>
          <div className="min-w-0 rounded-2xl p-4 sm:p-5" style={{ background: '#EAF3EC' }}>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center mb-2 sm:mb-3 bg-white/70">
              <Heart size={14} className="text-[#15803d]" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-[#15803d] truncate" style={serif}>{totalServiceHours}<span className="text-xs sm:text-sm opacity-60">/{requiredHours}</span></p>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5 leading-tight" style={{ color: '#4c9d6a' }}>Service Hours</p>
          </div>
          <div className="min-w-0 rounded-2xl p-4 sm:p-5" style={{ background: '#FBF0DE' }}>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center mb-2 sm:mb-3 bg-white/70">
              <AlertTriangle size={14} className="text-[#92400e]" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-[#92400e] truncate" style={serif}>{pendingCount}</p>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5 leading-tight" style={{ color: '#b9822f' }}>Pending Items</p>
          </div>
        </div>

        {/* ── Academic + Service, side by side, tinted panels ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 mb-8 sm:mb-10 min-w-0">
          <div className="rounded-2xl p-5 sm:p-6" style={{ background: '#F5E8EA' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white/70">
                <BookOpen size={13} style={{ color: MAROON }} />
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: MAROON_DEEP }}>Academic Record</h3>
            </div>
            {gradeItems.length === 0 ? (
              <p className="text-xs" style={{ color: '#a56475' }}>No grade records available yet.</p>
            ) : (
              <div className="space-y-2">
                {gradeItems.map((g, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-white/70">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: INK }}>{g.semester}</p>
                      <p className="text-[10px] text-slate-400">{g.units} units</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <span className="text-sm font-bold" style={{ color: MAROON }}>{g.gwa?.toFixed(2) ?? 'TBA'}</span>
                      <StatusTag status={g.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl p-5 sm:p-6" style={{ background: '#EAF3EC' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white/70">
                <Heart size={13} className="text-[#15803d]" />
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#0e5c2c' }}>Community Service</h3>
            </div>
            <div className="flex justify-between text-xs font-semibold mb-1.5" style={{ color: '#0e5c2c' }}>
              <span>{totalServiceHours} hrs completed</span>
              <span>{requiredHours} hrs required</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden mb-1.5 bg-white/70">
              <div className="h-full rounded-full transition-all" style={{ width: `${serviceProgress}%`, background: '#15803d' }} />
            </div>
            <p className="text-[10px] mb-3" style={{ color: '#4c9d6a' }}>{Math.max(requiredHours - totalServiceHours, 0)} hours remaining</p>
            {serviceEntries.length === 0 ? (
              <p className="text-xs" style={{ color: '#4c9d6a' }}>No service entries recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {serviceEntries.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-white/70">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: INK }}>{item.activity}</p>
                      <p className="text-[10px] text-slate-400">{item.date}</p>
                    </div>
                    <span className="text-sm font-bold text-[#15803d] flex-shrink-0">{item.hours} hrs</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Requirements tracker — accent-colored accordion ── */}
        <div className="rounded-2xl p-5 sm:p-6 mb-8 bg-white" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#F5E8EA' }}>
              <FileText size={13} style={{ color: MAROON }} />
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: INK }}>Requirements Compliance Tracker</h3>
          </div>
          <div className="space-y-2.5">
            {requirements.map((cat) => {
              const CatIcon = cat.icon;
              const isOpen = expandedCategory === cat.category;
              return (
                <div key={cat.category} className="rounded-xl overflow-hidden" style={{ background: cat.bg }}>
                  <button
                    onClick={() => setExpandedCategory(isOpen ? null : cat.category)}
                    className="w-full flex items-center justify-between gap-2 py-3 px-4 text-left"
                    style={{ borderLeft: `4px solid ${cat.accent}` }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CatIcon size={14} style={{ color: cat.accent }} className="flex-shrink-0" />
                      <span className="text-sm font-semibold truncate" style={{ color: INK }}>{cat.category}</span>
                      <span className="text-[10px] font-bold flex-shrink-0 px-2 py-0.5 rounded-full bg-white/70" style={{ color: cat.accent }}>
                        {cat.items.filter((item) => ['complied', 'passed', 'approved'].includes(item.status)).length}/{cat.items.length}
                      </span>
                    </div>
                    {isOpen ? <ChevronUp size={15} style={{ color: cat.accent }} className="flex-shrink-0" /> : <ChevronDown size={15} style={{ color: cat.accent }} className="flex-shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="pb-3 px-4 space-y-1.5">
                      {cat.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-white/70">
                          <div className="min-w-0">
                            <p className="text-sm truncate" style={{ color: INK }}>{item.name}</p>
                            <p className="text-[10px] text-slate-400">Deadline: {item.deadline}</p>
                          </div>
                          <StatusTag status={item.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sentiment history — colored left-border cards ──── */}
        <div className="rounded-2xl p-5 sm:p-6 pb-8 bg-white" style={{ boxShadow: '0 8px 24px -14px rgba(36,21,18,0.15)' }}>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#F5E8EA' }}>
              <FileText size={13} style={{ color: MAROON }} />
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: INK }}>Letter Sentiment History</h3>
          </div>
          {sentimentHistory.length === 0 ? (
            <p className="text-xs text-slate-400">No letter sentiment history is available yet.</p>
          ) : (
            <div className="space-y-2.5">
              {sentimentHistory.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-3 py-3 px-4 rounded-xl"
                  style={{ background: item.bg, borderLeft: `4px solid ${item.color}` }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold" style={{ color: INK }}>{item.month}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/70" style={{ color: item.color }}>{item.label}</span>
                    </div>
                    <p className="text-xs italic text-slate-500 break-words">"{item.excerpt}"</p>
                  </div>
                  <p className="text-lg font-bold flex-shrink-0" style={{ ...serif, color: item.color }}>{item.score}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScholarProfile;