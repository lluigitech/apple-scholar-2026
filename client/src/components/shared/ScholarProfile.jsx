import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X, User, BookOpen, Heart, FileText, TrendingUp,
  Calendar, CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, ChevronLeft,
} from 'lucide-react';

const MAROON = '#802B36';
const MAROON_LIGHT = '#F5E8EA';

// ─── Status Badge ──────────────────────────────────────────────
const badgeMap = {
  complied: { bg: '#dcfce7', color: '#15803d', Icon: CheckCircle, label: 'Complied' },
  pending:  { bg: '#fef9c3', color: '#854d0e', Icon: Clock,        label: 'Pending'  },
  missed:   { bg: '#fee2e2', color: '#991b1b', Icon: XCircle,      label: 'Missed'   },
  passed:   { bg: '#dcfce7', color: '#15803d', Icon: CheckCircle,  label: 'Passed'   },
  failed:   { bg: '#fee2e2', color: '#991b1b', Icon: XCircle,      label: 'Failed'   },
};

function StatusBadge({ status }) {
  const cfg = badgeMap[status] ?? badgeMap.pending;
  const { Icon, bg, color, label } = cfg;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: bg, color }}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── Mock Data (palitan ng real API call later) ────────────────
const getMockProfile = (user) => ({
  name: user?.full_name || 'Scholar Name',
  id: user?.scholar_id || 'AS-0000-000',
  yearLevel: user?.year_level || 'N/A',
  course: 'BS Education',
  school: 'University of the Philippines',
  scholarshipYear: 2023,
  grantType: 'Full Scholar',
  email: user?.email || 'scholar@email.com',
  phone: '09171234567',
  address: 'Brgy. San Antonio, Quezon City',
});

const mockGrades = [
  { semester: '1st Sem AY 2023-2024', gwa: 1.75, status: 'passed',  units: 21 },
  { semester: '2nd Sem AY 2023-2024', gwa: 1.50, status: 'passed',  units: 21 },
  { semester: '1st Sem AY 2024-2025', gwa: 1.25, status: 'passed',  units: 21 },
  { semester: '2nd Sem AY 2024-2025', gwa: 1.50, status: 'passed',  units: 21 },
  { semester: '1st Sem AY 2025-2026', gwa: null,  status: 'pending', units: 21 },
];

const mockRequirements = [
  {
    category: 'Academic',
    items: [
      { name: '1st Sem Grades (AY 2025-2026)', status: 'pending',  deadline: 'Jul 15, 2026' },
      { name: 'Enrollment Certificate',         status: 'complied', deadline: 'Jun 1, 2026'  },
      { name: 'Class Schedule',                 status: 'complied', deadline: 'Jun 1, 2026'  },
    ],
  },
  {
    category: 'Attendance & Duty',
    items: [
      { name: 'June Monthly Duty (4 hours)',  status: 'complied', deadline: 'Jun 30, 2026' },
      { name: 'July Monthly Duty (4 hours)',  status: 'pending',  deadline: 'Jul 31, 2026' },
      { name: 'Foundation Day Attendance',    status: 'missed',   deadline: 'Jun 10, 2026' },
    ],
  },
  {
    category: 'Community Service',
    items: [
      { name: 'Q1 Service Hours (8 hrs)', status: 'complied', deadline: 'Mar 31, 2026' },
      { name: 'Q2 Service Hours (8 hrs)', status: 'complied', deadline: 'Jun 30, 2026' },
      { name: 'Q3 Service Hours (8 hrs)', status: 'pending',  deadline: 'Sep 30, 2026' },
    ],
  },
  {
    category: 'Report Submissions',
    items: [
      { name: 'Monthly Report - April 2026', status: 'complied', deadline: 'Apr 30, 2026' },
      { name: 'Monthly Report - May 2026',   status: 'complied', deadline: 'May 31, 2026' },
      { name: 'Monthly Report - June 2026',  status: 'pending',  deadline: 'Jun 30, 2026' },
    ],
  },
];

const mockServiceHours = {
  completed: 24,
  required: 32,
  breakdown: [
    { activity: 'Library Assistance',          hours: 8,  date: 'Mar 2026' },
    { activity: 'Community Tutorial Program',  hours: 10, date: 'Apr 2026' },
    { activity: 'Scholarship Orientation Help', hours: 6, date: 'May 2026' },
  ],
};

const mockSentiment = [
  { month: 'March 2026', label: 'Positive', score: 82, color: '#22c55e', excerpt: 'Grateful for the opportunity, improving academically...' },
  { month: 'April 2026', label: 'Positive', score: 75, color: '#22c55e', excerpt: 'Dedicated to my studies, thankful for the support...' },
  { month: 'May 2026',   label: 'Neutral',  score: 55, color: '#f59e0b', excerpt: 'Reporting my progress for the month of May...' },
];

// ─── Main Component ────────────────────────────────────────────
const ScholarProfile = ({ user, onClose, mode = 'admin' }) => {
  const [expandedCategory, setExpandedCategory] = useState('Academic');

  const [profile, setProfile] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [grades, setGrades] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.id) return;
    setLoading(true);
    // Choose endpoints based on mode: 'admin' (view other scholars) or 'scholar' (self-view)
    const profileReq = mode === 'scholar'
      ? axios.get(`http://localhost:5000/api/scholar/profile/${user.id}`).then(r => r.data).catch(() => null)
      : axios.get(`http://localhost:5000/api/admin/scholars/${user.id}/profile`).then(r => r.data).catch(() => null);

    const submissionsReq = mode === 'scholar'
      ? axios.get(`http://localhost:5000/api/submission/scholar-view`).then(r => r.data).catch(() => [])
      : axios.get(`http://localhost:5000/api/admin/scholars/${user.id}/submissions`).then(r => r.data).catch(() => []);

    const attendanceReq = mode === 'scholar'
      ? axios.get(`http://localhost:5000/api/scholar/my-duties`).then(r => r.data).catch(() => [])
      : axios.get(`http://localhost:5000/api/admin/scholars/${user.id}/attendance`).then(r => r.data).catch(() => []);

    Promise.all([profileReq, submissionsReq, attendanceReq])
      .then(([p, subs, att]) => {
        setProfile(p);
        setSubmissions(Array.isArray(subs) ? subs : []);
        setAttendance(Array.isArray(att) ? att : []);

        // Try fetching grades: admin has a per-scholar grades endpoint; scholar uses submission grades endpoint
        if (mode === 'admin') {
          axios.get(`http://localhost:5000/api/admin/scholars/${user.id}/grades`).then(r => setGrades(r.data)).catch(() => null);
        } else {
          const sid = (p && p.scholar_id) || user.scholar_id;
          if (sid) {
            axios.get(`http://localhost:5000/api/submission/grades/${sid}`).then(r => setGrades(r.data)).catch(() => null);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  // derive values from real data when available
  const display = profile || getMockProfile(user);
  const viewLabel = mode === 'admin' ? 'Admin View' : 'Scholar View';

  // service hours from submissions (if submissions contain service_hours)
  const totalServiceHours = submissions.reduce((sum, s) => sum + (parseFloat(s.service_hours) || 0), 0);
  const requiredHours = mockServiceHours.required;
  const serviceProgress = Math.min((totalServiceHours / requiredHours) * 100, 100);

  const totalItems = mockRequirements.flatMap(r => r.items);
  const complied   = totalItems.filter(i => i.status === 'complied').length;
  const compliance = Math.round((complied / totalItems.length) * 100);
  const pendingCount = totalItems.filter(i => i.status === 'pending').length;

  // Use fetched grades if available, otherwise fallback to mockGrades
  const gradesToShow = Array.isArray(grades) && grades.length ? grades : mockGrades;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div className="min-h-screen flex items-start justify-center p-4 pt-8 pb-12">
        <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden">

          {/* ── Header ── */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ background: MAROON_LIGHT, borderBottom: '1px solid #f3d0d4' }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                style={{
                  fontFamily: "'DM Sans',sans-serif", fontSize: '0.82rem', fontWeight: 600,
                  color: MAROON, background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <span style={{ color: '#d1d5db' }}>|</span>
              <div>
                <p style={{ fontFamily: "'Playfair Display',serif", fontSize: '0.95rem', fontWeight: 700, color: MAROON }}>
                  Scholar Profile
                </p>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.74rem', color: '#9ca3af' }}>
                  {display.id} · {viewLabel}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="overflow-y-auto" style={{ maxHeight: '82vh' }}>
            <div className="p-6 space-y-5">

              {/* Profile Header Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: MAROON_LIGHT }}
                  >
                    <User className="w-8 h-8" style={{ color: MAROON }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.3rem', fontWeight: 700, color: '#1a1a1a' }}>
                      {display.name}
                    </h2>
                    <p className="text-sm" style={{ fontFamily: "'DM Sans',sans-serif", color: '#6b7280' }}>
                      {display.id} · {display.yearLevel} · {display.course}
                    </p>
                    <p className="text-sm" style={{ fontFamily: "'DM Sans',sans-serif", color: '#6b7280' }}>
                      {display.school}
                    </p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <span
                      className="text-xs font-semibold px-3 py-1 rounded-full text-white"
                      style={{ backgroundColor: MAROON }}
                    >
                      {display.grantType}
                    </span>
                    <span className="text-xs" style={{ fontFamily: "'DM Sans',sans-serif", color: '#6b7280' }}>
                      Scholar since {display.scholarshipYear}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
                  {[
                    ['Email',   display.email  ],
                    ['Phone',   display.phone  ],
                    ['Address', display.address],
                  ].map(([label, value]) => (
                    <div key={label} className={label === 'Address' ? 'col-span-2 sm:col-span-1' : ''}>
                      <p className="text-xs mb-0.5" style={{ fontFamily: "'DM Sans',sans-serif", color: '#6b7280' }}>{label}</p>
                      <p className="text-sm font-medium" style={{ fontFamily: "'DM Sans',sans-serif", color: '#1a1a1a' }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compliance Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: <TrendingUp className="w-5 h-5" style={{ color: MAROON }} />,
                    iconBg: MAROON_LIGHT,
                    label: 'Overall Compliance',
                    value: `${compliance}%`,
                    valueColor: MAROON,
                  },
                  {
                    icon: <Heart className="w-5 h-5 text-green-600" />,
                    iconBg: '#dcfce7',
                    label: 'Service Hours',
                    value: `${mockServiceHours.completed}/${mockServiceHours.required} hrs`,
                    valueColor: '#16a34a',
                  },
                  {
                    icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
                    iconBg: '#fef9c3',
                    label: 'Pending Items',
                    value: pendingCount,
                    valueColor: '#d97706',
                  },
                ].map(({ icon, iconBg, label, value, valueColor }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: iconBg }}>
                      {icon}
                    </div>
                    <div>
                      <p className="text-xs" style={{ fontFamily: "'DM Sans',sans-serif", color: '#6b7280' }}>{label}</p>
                      <p className="text-xl font-bold" style={{ fontFamily: "'DM Sans',sans-serif", color: valueColor }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grades + Service Hours */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Academic Record */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-4 h-4" style={{ color: MAROON }} />
                    <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>
                      Academic Record
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {gradesToShow.map((g, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium" style={{ fontFamily: "'DM Sans',sans-serif", color: '#1a1a1a' }}>
                            {g.semester}
                          </p>
                          <p className="text-xs" style={{ fontFamily: "'DM Sans',sans-serif", color: '#6b7280' }}>
                            {g.units} units
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ fontFamily: "'DM Sans',sans-serif", color: MAROON }}>
                            {g.status === 'pending' ? 'TBA' : (g.gwa !== null && g.gwa !== undefined ? Number(g.gwa).toFixed(2) : (g.gwa === null ? 'TBA' : g.gwa))}
                          </span>
                          <StatusBadge status={g.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Community Service */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Heart className="w-4 h-4" style={{ color: MAROON }} />
                    <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>
                      Community Service
                    </h3>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1" style={{ fontFamily: "'DM Sans',sans-serif", color: '#374151' }}>
                      <span>{mockServiceHours.completed} hrs completed</span>
                      <span>{mockServiceHours.required} hrs required</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${serviceProgress}%`, backgroundColor: '#22c55e' }}
                      />
                    </div>
                    <p className="text-xs mt-1" style={{ fontFamily: "'DM Sans',sans-serif", color: '#6b7280' }}>
                      {mockServiceHours.required - mockServiceHours.completed} hours remaining
                    </p>
                  </div>
                  <div className="space-y-2">
                    {mockServiceHours.breakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium" style={{ fontFamily: "'DM Sans',sans-serif", color: '#1a1a1a' }}>
                            {item.activity}
                          </p>
                          <p className="text-xs" style={{ fontFamily: "'DM Sans',sans-serif", color: '#6b7280' }}>{item.date}</p>
                        </div>
                        <span className="text-sm font-semibold" style={{ fontFamily: "'DM Sans',sans-serif", color: '#22c55e' }}>
                          {item.hours} hrs
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Requirements Tracker */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4" style={{ color: MAROON }} />
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>
                    Requirements Compliance Tracker
                  </h3>
                </div>
                <div className="space-y-2">
                  {mockRequirements.map(cat => {
                    const isOpen = expandedCategory === cat.category;
                    const catComplied = cat.items.filter(i => i.status === 'complied').length;
                    return (
                      <div key={cat.category} className="border border-gray-100 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedCategory(isOpen ? null : cat.category)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold" style={{ fontFamily: "'DM Sans',sans-serif", color: '#1a1a1a' }}>
                              {cat.category}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600" style={{ fontFamily: "'DM Sans',sans-serif" }}>
                              {catComplied}/{cat.items.length}
                            </span>
                          </div>
                          {isOpen
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>
                        {isOpen && (
                          <div className="border-t border-gray-100 divide-y divide-gray-50">
                            {cat.items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between px-4 py-3">
                                <div>
                                  <p className="text-sm" style={{ fontFamily: "'DM Sans',sans-serif", color: '#374151' }}>{item.name}</p>
                                  <p className="text-xs" style={{ fontFamily: "'DM Sans',sans-serif", color: '#9ca3af' }}>Deadline: {item.deadline}</p>
                                </div>
                                <StatusBadge status={item.status} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sentiment History */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4" style={{ color: MAROON }} />
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>
                    Letter Submission Sentiment History
                  </h3>
                </div>
                <div className="space-y-3">
                  {mockSentiment.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#fafafa' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium" style={{ fontFamily: "'DM Sans',sans-serif", color: '#1a1a1a' }}>
                            {item.month}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: item.color }}>
                            {item.label}
                          </span>
                        </div>
                        <p className="text-xs italic" style={{ fontFamily: "'DM Sans',sans-serif", color: '#6b7280' }}>
                          "{item.excerpt}"
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold" style={{ fontFamily: "'DM Sans',sans-serif", color: item.color }}>
                          {item.score}
                        </p>
                        <p className="text-xs" style={{ fontFamily: "'DM Sans',sans-serif", color: '#9ca3af' }}>score</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScholarProfile;