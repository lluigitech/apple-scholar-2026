import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import useComplianceStatus from '../../hooks/useComplianceStatus';
import {
  User, BookOpen, Heart, FileText, TrendingUp,
  CheckCircle2, XCircle, Clock3, AlertTriangle, Pencil,
  ShieldCheck, RefreshCw, Search, ChevronRight,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$|\/$/g, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const SUBMISSION_API = `${API}/submission`;

// ── Scholar Portal design system ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER = '#C0473F';
const INK = '#241512';
const MUTED = '#8A7A68';
const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const authHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const statusMap = {
  complied: { color: SUCCESS, icon: CheckCircle2, label: 'Complied' },
  pending: { color: WARNING, icon: Clock3, label: 'Pending' },
  missed: { color: DANGER, icon: XCircle, label: 'Missed' },
  passed: { color: SUCCESS, icon: CheckCircle2, label: 'Passed' },
  approved: { color: SUCCESS, icon: CheckCircle2, label: 'Approved' },
  rejected: { color: DANGER, icon: XCircle, label: 'Rejected' },
};

function StatusTag({ status }) {
  const key = status?.toLowerCase() || 'pending';
  const cfg = statusMap[key] || statusMap.pending;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 flex-shrink-0"
      style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: cfg.color, background: `${cfg.color}14`, borderRadius: 999, padding: '3px 10px' }}
    >
      <Icon size={12} />
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
    'grade 7': 'Grade 7', 'grade 8': 'Grade 8', 'grade 9': 'Grade 9', 'grade 10': 'Grade 10',
    'grade 11': 'Grade 11', 'grade 12': 'Grade 12',
    'college 1': '1st Year College', 'college 2': '2nd Year College', 'college 3': '3rd Year College',
    'college 4': '4th Year College', 'college 5': '5th Year College',
    '1st year college': '1st Year College', '2nd year college': '2nd Year College',
    '3rd year college': '3rd Year College', '4th year college': '4th Year College', '5th year college': '5th Year College',
  };
  return aliasMap[normalized] || value;
};

// Semi-circle gauge, reused at hero scale.
function GaugeDial({ score, color, size = 168 }) {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  return (
    <svg viewBox="0 0 200 112" style={{ width: size, height: size * 0.56 }}>
      <path d="M18,100 A82,82 0 0 1 182,100" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="16" strokeLinecap="round" pathLength="100" />
      <path
        d="M18,100 A82,82 0 0 1 182,100" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
        pathLength="100" strokeDasharray={`${pct} 100`} style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

const QuickStat = ({ icon: Icon, label, value, accent = PRIMARY }) => (
  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 18px 16px' }}>
    <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: `${accent}14` }}>
      <Icon size={15} style={{ color: accent }} />
    </div>
    <p style={{ ...display, fontSize: '1.3rem', fontWeight: 600, color: accent, marginTop: 12 }} className="truncate">{value}</p>
    <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 3 }} className="leading-tight">{label}</p>
  </div>
);

const CATEGORY_META = {
  Academic: { icon: BookOpen, accent: PRIMARY },
  'Attendance & Duty': { icon: Clock3, accent: WARNING },
  'Community Service': { icon: Heart, accent: SUCCESS },
  'Report Submissions': { icon: FileText, accent: BRONZE },
};

function RegistryCard({ item, expanded, onToggle }) {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.Academic;
  const Icon = meta.icon;
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '18px 20px' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 11, background: `${meta.accent}14`, marginTop: 1 }}>
            <Icon size={16} style={{ color: meta.accent }} />
          </span>
          <div className="min-w-0">
            <p style={{ ...body, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', color: meta.accent }}>{item.category}</p>
            <h3 style={{ ...display, fontSize: '1.02rem', fontWeight: 600, color: INK, marginTop: 2 }} className="truncate">{item.title}</h3>
            <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 3 }} className="break-words">{item.description}</p>
            {expanded && (
              <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${BORDER}` }}>
                {item.detail || 'No additional details for this entry.'}
              </p>
            )}
          </div>
        </div>
        <StatusTag status={item.status} />
      </div>
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${BG}` }}>
        <span style={{ ...body, fontSize: '0.74rem', color: MUTED }}>{item.date}</span>
        <button
          onClick={onToggle}
          className="flex items-center gap-1 transition-opacity hover:opacity-70"
          style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {expanded ? 'Hide' : 'View'} <ChevronRight size={13} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }} />
        </button>
      </div>
    </div>
  );
}

const ScholarProfile = () => {
  const userId = localStorage.getItem('id');
  const scholarId = localStorage.getItem('scholar_id');
  const { data: complianceData, loading: complianceLoading, error: complianceError, refetch: refreshCompliance } = useComplianceStatus();
  const [profile, setProfile] = useState(null);
  const [grades, setGrades] = useState([]);
  const [history, setHistory] = useState([]);
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Registry filter/search state (new — drives the Registry Cards list only)
  const [registrySearch, setRegistrySearch] = useState('');
  const [registryCategory, setRegistryCategory] = useState('all');
  const [registryStatus, setRegistryStatus] = useState('all');
  const [expandedCardKey, setExpandedCardKey] = useState(null);

  const registryRef = useRef(null);

  const yearLevelOptions = [
    { value: 'grade_7', label: 'Grade 7' }, { value: 'grade_8', label: 'Grade 8' },
    { value: 'grade_9', label: 'Grade 9' }, { value: 'grade_10', label: 'Grade 10' },
    { value: 'grade_11', label: 'Grade 11' }, { value: 'grade_12', label: 'Grade 12' },
    { value: 'college_1', label: '1st Year College' }, { value: 'college_2', label: '2nd Year College' },
    { value: 'college_3', label: '3rd Year College' }, { value: 'college_4', label: '4th Year College' },
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

  const dutyItems = duties.map((duty) => ({
    name: duty.title || 'Duty Participation',
    status: duty.computed_status || 'pending',
    deadline: formatDate(duty.duty_date),
  }));

  const letterItems = history
    .filter((item) => item.submission_type === 'letter')
    .map((item) => ({
      name: `Letter — ${formatDate(item.submitted_at)}`,
      status: item.status === 'approved' ? 'passed' : item.status === 'rejected' ? 'missed' : 'pending',
      deadline: formatDate(item.submitted_at),
      sentiment: item.sentiment_label || null,
      excerpt: item.letter_content ? item.letter_content.slice(0, 120) : null,
    }));

  const requirements = [
    { category: 'Academic', accent: PRIMARY, icon: BookOpen, items: academicItems },
    { category: 'Attendance & Duty', accent: WARNING, icon: Clock3, items: dutyItems.length ? dutyItems : [{ name: 'No assigned duties yet', status: 'pending', deadline: 'TBA' }] },
    { category: 'Community Service', accent: SUCCESS, icon: Heart, items: serviceEntries.length ? serviceEntries.map((e) => ({ name: e.activity, status: 'complied', deadline: e.date })) : [{ name: 'No service hours recorded yet', status: 'pending', deadline: 'TBA' }] },
    { category: 'Report Submissions', accent: BRONZE, icon: FileText, items: letterItems.length ? letterItems : [{ name: 'No reports submitted yet', status: 'pending', deadline: 'TBA' }] },
  ];

  const categoryRate = (items) => {
    const done = items.filter((i) => ['complied', 'passed', 'approved'].includes(i.status)).length;
    return items.length ? done / items.length : 0;
  };

  const allRequirementItems = requirements.flatMap((cat) => cat.items);
  const compliedCount = allRequirementItems.filter((item) => ['complied', 'passed', 'approved'].includes(item.status)).length;
  const compliance = allRequirementItems.length > 0 ? Math.round((compliedCount / allRequirementItems.length) * 100) : 0;
  const pendingCount = allRequirementItems.filter((item) => item.status === 'pending').length;

  const displayName = profile?.full_name || localStorage.getItem('name') || 'Scholar';
  const displayEmail = profile?.email || localStorage.getItem('email') || 'you@example.com';
  const displayCourse = profile?.course || 'N/A';
  const displayYearLevel = formatYearLevelLabel(profile?.year_level);
  const displayId = profile?.scholar_id || localStorage.getItem('scholar_id') || 'N/A';
  const displayStatus = profile?.status || 'Active';

  const getComplianceLabel = (value) => {
    if (value >= 90) return 'Excellent';
    if (value >= 80) return 'Good Standing';
    if (value >= 70) return 'Low Risk';
    if (value >= 50) return 'Medium Risk';
    return 'High Risk';
  };
  const getBadgeColor = (value) => {
    if (value >= 80) return SUCCESS;
    if (value >= 70) return BRONZE;
    if (value >= 50) return WARNING;
    return DANGER;
  };

  const complianceScore = complianceData?.overall_compliance ?? null;
  const recoverableCredits = Number(complianceData?.recoverable_credits || 0);
  const bonusPoints = Number(complianceData?.total_bonus_points || 0);
  const complianceLabel = complianceScore !== null ? getComplianceLabel(complianceScore) : 'Loading...';
  const complianceColor = complianceScore !== null ? getBadgeColor(complianceScore) : MUTED;
  const pointHistory = [
    ...(bonusPoints > 0 ? [{ label: 'Bonus points earned', value: `+${bonusPoints}`, note: 'Service and maintenance bonuses' }] : []),
    ...(recoverableCredits > 0 ? [{ label: 'Recoverable credits', value: `+${recoverableCredits}`, note: 'Potential growth points' }] : []),
    ...(complianceScore !== null ? [{ label: 'Current total', value: `${Math.round(complianceScore)}`, note: 'Overall compliance points' }] : []),
  ];

  // ── Registry: every requirement item flattened into one filterable,
  //    searchable list of cards (replaces the old table/accordion views). ──
  const registryItems = useMemo(() => {
    const flattened = [];

    gradeItems.forEach((g, i) => flattened.push({
      key: `grade-${i}`, category: 'Academic', title: g.semester,
      description: `${g.units} units · GWA ${g.gwa?.toFixed ? g.gwa.toFixed(2) : g.gwa ?? 'TBA'}`,
      date: '', status: g.status, detail: 'Grade record for this semester.',
    }));

    academicItems.forEach((item, i) => flattened.push({
      key: `academic-${i}`, category: 'Academic', title: item.name,
      description: 'Academic requirement', date: `Deadline: ${item.deadline}`, status: item.status,
      detail: 'Part of your academic compliance checklist.',
    }));

    dutyItems.forEach((item, i) => flattened.push({
      key: `duty-${i}`, category: 'Attendance & Duty', title: item.name,
      description: 'Assigned duty', date: item.deadline, status: item.status,
      detail: 'Tracked as part of your duty & participation record.',
    }));

    serviceEntries.forEach((item, i) => flattened.push({
      key: `service-${i}`, category: 'Community Service', title: item.activity,
      description: `${item.hours} hrs logged`, date: item.date, status: 'complied',
      detail: 'Counted toward your community service hour requirement.',
    }));

    letterItems.forEach((item, i) => flattened.push({
      key: `letter-${i}`, category: 'Report Submissions', title: item.name,
      description: item.sentiment ? `Sentiment: ${item.sentiment}` : 'Monthly report letter',
      date: `Deadline: ${item.deadline}`, status: item.status,
      detail: item.excerpt || 'No excerpt available for this letter.',
    }));

    return flattened;
  }, [gradeItems, academicItems, dutyItems, serviceEntries, letterItems]);

  const filteredRegistryItems = useMemo(() => {
    return registryItems.filter((item) => {
      const matchesSearch = !registrySearch || item.title.toLowerCase().includes(registrySearch.toLowerCase());
      const matchesCategory = registryCategory === 'all' || item.category === registryCategory;
      const matchesStatus = registryStatus === 'all' || item.status === registryStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [registryItems, registrySearch, registryCategory, registryStatus]);

  const scrollToRegistry = () => registryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8" style={{ ...body, background: BG, minHeight: '100vh' }}>
        <div className="animate-pulse space-y-5 w-full">
          <div style={{ height: 70, background: `${BORDER}88`, borderRadius: RADIUS }} />
          <div style={{ height: 180, background: `${BORDER}88`, borderRadius: RADIUS }} />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ height: 96, background: `${BORDER}88`, borderRadius: RADIUS }} />)}
          </div>
          <div style={{ height: 60, background: `${BORDER}88`, borderRadius: RADIUS }} />
          {Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ height: 110, background: `${BORDER}88`, borderRadius: RADIUS }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...body, background: BG, minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');
        .floating-toolbar { position: sticky; top: 12px; z-index: 5; box-shadow: 0 12px 28px -18px rgba(36,21,18,0.25); }
      `}</style>

      <div className="w-full px-4 sm:px-6 lg:p-8">

        {/* ── 1. Personal header ──────────────────────────────────── */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '20px 24px', marginBottom: 20 }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: BRONZE }}>SCHOLAR PORTAL</p>
              <h1 style={{ ...display, fontSize: '1.6rem', fontWeight: 600, color: INK, marginTop: 4 }}>My Profile</h1>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY, background: `${PRIMARY}12`, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 16px' }}>
                1st Semester, AY 2026–2027
              </span>
              <button
                onClick={() => {
                  if (editMode) {
                    setEditMode(false);
                    setError('');
                    setForm({
                      fullName: profile?.full_name || '', email: profile?.email || '', age: profile?.age ?? '', phone: profile?.phone || '',
                      address: profile?.address || '', course: profile?.course || '', school: profile?.school || '', yearLevel: profile?.year_level || '',
                    });
                  } else {
                    setEditMode(true);
                  }
                }}
                className="flex items-center gap-1.5 transition-opacity hover:opacity-90"
                style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: editMode ? INK : '#fff', padding: '9px 16px', border: editMode ? `1px solid ${BORDER}` : 'none', borderRadius: 10, background: editMode ? SURFACE : `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, cursor: 'pointer' }}
              >
                <Pencil size={13} />
                {editMode ? 'Cancel Editing' : 'Edit Profile'}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mt-5 pt-5" style={{ borderTop: `1px solid ${BG}` }}>
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 52, height: 52, borderRadius: '50%', background: `${PRIMARY}12`, border: `2px solid ${PRIMARY}` }}>
                <User size={24} style={{ color: PRIMARY }} />
              </div>
              <div className="min-w-0 sm:hidden">
                <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }} className="truncate">{displayName}</h2>
                <span style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: SUCCESS }}>● {displayStatus}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="hidden sm:flex items-center gap-3 flex-wrap">
                <h2 style={{ ...display, fontSize: '1.2rem', fontWeight: 600, color: INK }} className="truncate">{displayName}</h2>
                <span style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: SUCCESS, flexShrink: 0 }}>● {displayStatus}</span>
              </div>
              <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 4 }} className="break-words">
                {displayId} &nbsp;·&nbsp; {displayYearLevel} &nbsp;·&nbsp; {displayCourse} &nbsp;·&nbsp; {profile?.school || 'University of the Philippines'}
              </p>
              <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>{displayEmail} · {profile?.phone || 'No phone on file'}</p>
            </div>
          </div>

          {saveMessage && (
            <p className="inline-block mt-4" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: SUCCESS, background: `${SUCCESS}14`, padding: '7px 14px', borderRadius: 10 }}>
              {saveMessage}
            </p>
          )}
          {!editMode && error && (
            <p className="inline-block mt-4" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: DANGER, background: `${DANGER}14`, padding: '7px 14px', borderRadius: 10 }}>
              {error}
            </p>
          )}

          {editMode && (
            <div className="mt-5" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '20px 22px' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {[
                  { key: 'fullName', label: 'Full Name' }, { key: 'email', label: 'Email', type: 'email' },
                  { key: 'age', label: 'Age', type: 'number' }, { key: 'phone', label: 'Phone' },
                  { key: 'address', label: 'Address' }, { key: 'course', label: 'Course' }, { key: 'school', label: 'School' },
                ].map((f) => (
                  <label key={f.key} className="block">
                    <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: MUTED }}>{f.label.toUpperCase()}</span>
                    <input
                      value={form[f.key]}
                      onChange={(e) => updateForm(f.key, e.target.value)}
                      type={f.type || 'text'}
                      style={{ width: '100%', marginTop: 4, paddingBottom: 8, border: 'none', borderBottom: `1.5px solid ${BORDER}`, background: 'none', ...body, fontSize: '0.85rem', color: INK, outline: 'none' }}
                    />
                  </label>
                ))}
                <label className="block">
                  <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: MUTED }}>YEAR LEVEL</span>
                  <select
                    value={form.yearLevel || ''}
                    onChange={(e) => updateForm('yearLevel', e.target.value)}
                    style={{ width: '100%', marginTop: 4, paddingBottom: 8, border: 'none', borderBottom: `1.5px solid ${BORDER}`, background: 'none', ...body, fontSize: '0.85rem', color: INK, outline: 'none' }}
                  >
                    <option value="">Select year level</option>
                    {yearLevelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              {error && <p style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: DANGER, marginTop: 16 }}>{error}</p>}
              <button
                disabled={saving}
                onClick={handleSaveProfile}
                className="transition-opacity hover:opacity-90"
                style={{ marginTop: 20, padding: '10px 22px', ...body, fontSize: '0.78rem', fontWeight: 600, color: '#fff', border: 'none', borderRadius: 10, background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>

        {/* ── 2. Hero status card (burgundy) ──────────────────────── */}
        <div
          style={{
            background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
            borderRadius: RADIUS, padding: '26px 26px', marginBottom: 20, color: '#fff',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex flex-col items-center flex-shrink-0">
              <GaugeDial score={complianceScore ?? 0} color="#fff" />
              <p style={{ ...display, fontSize: '1.9rem', fontWeight: 600, color: '#fff', marginTop: -22 }}>
                {complianceScore !== null ? Math.round(complianceScore) : '—'}
              </p>
              <p style={{ ...body, fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)' }}>points</p>
            </div>

            <div className="flex-1 min-w-0">
              <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)' }}>OVERALL STATUS</p>
              <h2 style={{ ...display, fontSize: '1.5rem', fontWeight: 600, color: '#fff', marginTop: 4 }}>{complianceLabel}</h2>
              <p style={{ ...body, fontSize: '0.83rem', color: 'rgba(255,255,255,0.85)', marginTop: 6, lineHeight: 1.55 }} className="max-w-md">
                {pendingCount > 0
                  ? `You have ${pendingCount} pending requirement${pendingCount > 1 ? 's' : ''}. Complete them this month to stay on track.`
                  : 'All tracked requirements are complete. Keep it up to maintain your standing.'}
              </p>

              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  onClick={scrollToRegistry}
                  className="transition-opacity hover:opacity-90"
                  style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: PRIMARY, background: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer' }}
                >
                  View Requirements
                </button>
                <button
                  type="button"
                  onClick={refreshCompliance}
                  className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '10px 18px', cursor: 'pointer' }}
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
            </div>
          </div>

          {/* supplementary: flags + recovery tip, kept but demoted beneath the primary hero content */}
          <div className="mt-6 pt-5 grid gap-3 sm:grid-cols-2" style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.7)' }}>ACTIVE FLAGS</p>
              {complianceLoading ? (
                <p style={{ ...body, fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>Loading…</p>
              ) : complianceError ? (
                <p style={{ ...body, fontSize: '0.8rem', color: '#ffd7d2', marginTop: 4 }}>Unable to load flags right now.</p>
              ) : complianceData?.flags?.length ? (
                <p style={{ ...body, fontSize: '0.8rem', color: '#fff', marginTop: 4 }}>{complianceData.flags[0].type} — {complianceData.flags[0].description}</p>
              ) : (
                <p style={{ ...body, fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>No current flags. You're on track.</p>
              )}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.7)' }}>RECOVERY TIP</p>
              <p style={{ ...body, fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
                {recoverableCredits > 0
                  ? `${recoverableCredits.toFixed(2).replace(/\.00$/, '')} recoverable point${recoverableCredits > 1 ? 's' : ''} available.`
                  : 'Submit early or complete a service hour to raise your score.'}
              </p>
            </div>
          </div>
        </div>

        {/* ── 3. Three quick stats ─────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <QuickStat icon={TrendingUp} label="Compliance Points" value={`${compliance} pts`} accent={PRIMARY} />
          <QuickStat icon={Heart} label="Service Hours" value={`${totalServiceHours}/${requiredHours}`} accent={SUCCESS} />
          <QuickStat icon={AlertTriangle} label="Pending Items" value={pendingCount} accent={WARNING} />
        </div>

        {/* ── 4. Floating filter toolbar ───────────────────────────── */}
        <div ref={registryRef} className="floating-toolbar flex flex-wrap items-center gap-3 mb-5" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 14 }}>
          <div className="relative flex-1" style={{ minWidth: 180 }}>
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
            <input
              type="text"
              placeholder="Search your records…"
              value={registrySearch}
              onChange={(e) => setRegistrySearch(e.target.value)}
              style={{
                ...body, fontSize: '0.84rem', color: INK, background: BG, border: `1px solid ${BORDER}`,
                borderRadius: 10, height: 42, width: '100%', padding: '0 14px 0 34px', outline: 'none',
              }}
            />
          </div>

          <select
            value={registryCategory}
            onChange={(e) => setRegistryCategory(e.target.value)}
            style={{ ...body, fontSize: '0.82rem', color: INK, background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, height: 42, padding: '0 12px', outline: 'none' }}
          >
            <option value="all">All Categories</option>
            {Object.keys(CATEGORY_META).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={registryStatus}
            onChange={(e) => setRegistryStatus(e.target.value)}
            style={{ ...body, fontSize: '0.82rem', color: INK, background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, height: 42, padding: '0 12px', outline: 'none' }}
          >
            <option value="all">All Statuses</option>
            {Object.keys(statusMap).map((s) => <option key={s} value={s}>{statusMap[s].label}</option>)}
          </select>
        </div>

        {/* ── 5. Registry cards ────────────────────────────────────── */}
        <div className="space-y-3 mb-10">
          {filteredRegistryItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '48px 20px' }}>
              <ShieldCheck size={22} style={{ color: MUTED }} />
              <p style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: INK }}>No records match these filters</p>
              <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>Try a different search term or category.</p>
            </div>
          ) : (
            filteredRegistryItems.map((item) => (
              <RegistryCard
                key={item.key}
                item={item}
                expanded={expandedCardKey === item.key}
                onToggle={() => setExpandedCardKey(expandedCardKey === item.key ? null : item.key)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ScholarProfile;