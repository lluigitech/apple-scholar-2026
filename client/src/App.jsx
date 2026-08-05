import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';

// 📂 Administrator Pages
// 📂 Admin Pages
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminReports from './pages/Admin/AdminReports';
import AdminAnnouncement from './pages/Admin/AdminAnnouncement';
import ComplianceManager from './pages/Admin/ComplianceManager';
import CorrespondenceEvaluator from './pages/Admin/CorrespondenceEvaluator';
import NotificationManager from './pages/Admin/AdminNotification';
import SecurityAuditLogs from './pages/Admin/SecurityAuditLogs';
import UserManagement from './pages/Admin/UserManagement';
import DutyManagement from './pages/Admin/DutyManagement';
import AdminAnalytics from './pages/Admin/AdminAnalytics';
import AdminTaskAssignment from './pages/Admin/AdminTaskAssignment';
import ScholarProfileView from './pages/Admin/ScholarProfileView';
import AdminLayout from './components/Admin/AdminLayout';
import SharedFlaggedScholars from './pages/SharedPages/FlaggedScholars';

// 📂 Officer Pages
import OfficerLayout from './components/Officer/OfficerLayout';
import OfficerDashboard from './pages/Officer/OfficerDashboard';
import OfficerManualValidation from './pages/Officer/OfficerManualValidation';
import OfficerAnalytics from './pages/Officer/OfficerAnalytics';
import OfficerAnnouncements from './pages/Officer/OfficerAnnouncements';
import OfficerCommunication from './pages/Officer/OfficerCommunication';
import OfficerDutyAttendance from './pages/Officer/OfficerDutyAttendance';
import OfficerReports from './pages/Officer/OfficerReports';
import OfficerTaskAssignment from './pages/Officer/OfficerTaskAssignment';

// 📂 Staff Pages
import StaffLayout from './components/Staff/StaffLayout';
import StaffDashboard from './pages/Staff/StaffDashboard';
import StaffDutyAssignment from './pages/Staff/StaffDutyAssignment';
import StaffDutyAttendance from './pages/Staff/StaffDutyAttendance';
import StaffAnnouncement from './pages/staff/StaffAnnouncement'; 
import StaffAttendanceReports from './pages/Staff/StaffAttendanceReports';

// 📂 Scholar Pages
import ScholarLayout from './components/Scholar/ScholarLayout';
import ScholarDashboard from './pages/Scholar/ScholarDashboard';
import Submission from './pages/Scholar/Submission';
import ScholarAnnouncements from './pages/Scholar/ScholarAnnouncements';
import ScholarProfile from './pages/Scholar/Profile';
import DutyParticipation from './pages/Scholar/DutyParticipation';
import ScholarNotification from './pages/Scholar/ScholarNotification';
import ScholarSettings from './pages/Scholar/ScholarSettings';
import RequirementsChecklist from './pages/Scholar/RequirementsChecklist';
import ScholarGrades from './components/Scholar/SubmissionPage/ScholarGrades';

// 🔒 Route Guard
const ProtectedRoute = ({ children, allowedRoles }) => {
  const role = localStorage.getItem('role');
  if (!role) return <Navigate to="/login" replace />;
  const allowed = Array.isArray(allowedRoles)
    ? allowedRoles.map(r => r.toLowerCase()).includes(role.toLowerCase())
    : role.toLowerCase() === allowedRoles.toLowerCase();
  if (!allowed) return <Navigate to="/login" replace />;
  return children;
};

// 🔑 Key wrapper — forces full remount when scholar :id changes
// Without this, React reuses the same component instance when navigating
// between scholars, so useEffect doesn't re-fire and the old data stays.
const KeyedScholarProfile = () => {
  const { id } = useParams();
  return <ScholarProfileView key={id} />;
};

function App() {
  return (
    <div className="min-h-screen font-sans selection:bg-cyan-500/30">
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />

          {/* 🛡️ ADMIN ROUTES */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><AdminDashboard /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><UserManagement /></AdminLayout>
            </ProtectedRoute>
          } />

          {/* ✅ FIXED: KeyedScholarProfile forces remount on id change */}
          <Route path="/admin/scholars/:id" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><KeyedScholarProfile /></AdminLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/flagged" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><SharedFlaggedScholars portalLabel="Admin Portal" /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/correspondence" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><CorrespondenceEvaluator /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/compliance" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><ComplianceManager /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/announcements" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><AdminAnnouncement /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/notifications" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><NotificationManager /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/reports" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><AdminReports /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/security" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><SecurityAuditLogs /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/duties" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><DutyManagement /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><AdminAnalytics /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/task-assignment" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><AdminTaskAssignment /></AdminLayout>
            </ProtectedRoute>
          } />

          {/* 🛡️ OFFICER ROUTES */}
          <Route path="/officer" element={
            <ProtectedRoute allowedRoles="officer">
              <OfficerLayout />
            </ProtectedRoute>
          }>
            <Route index element={<OfficerDashboard />} />
            <Route path="flagged" element={<SharedFlaggedScholars portalLabel="Officer Portal" />} />
            <Route path="validation" element={<OfficerManualValidation />} />
            <Route path="analytics" element={<OfficerAnalytics />} />
            <Route path="announcements" element={<OfficerAnnouncements />} />
            <Route path="communication" element={<OfficerCommunication />} />
            <Route path="duty-attendance" element={<OfficerDutyAttendance />} />
            <Route path="reports" element={<OfficerReports />} />
            <Route path="task-assignment" element={<OfficerTaskAssignment />} />
          </Route>

          {/* 🛡️ STAFF ROUTES */}
          <Route path="/staff" element={
            <ProtectedRoute allowedRoles="staff">
              <StaffLayout />
            </ProtectedRoute>
          }>
            <Route index element={<StaffDashboard />} />
            <Route path="duty-assignment" element={<StaffDutyAssignment />} />
            <Route path="/staff/announcements" element={<StaffAnnouncement />} />
            <Route path="duty-attendance" element={<StaffDutyAttendance />} />
            <Route path="attendance-reports" element={<StaffAttendanceReports />} />
          </Route>

          {/* 🛡️ SCHOLAR ROUTES */}
          <Route path="/scholar" element={
            <ProtectedRoute allowedRoles="scholar">
              <ScholarLayout />
            </ProtectedRoute>
          }>
            <Route index element={<ScholarDashboard />} />
            <Route path="submission" element={<Submission />} />
            <Route path="checklist" element={<RequirementsChecklist />} />
            <Route path="announcements" element={<ScholarAnnouncements />} />
            <Route path="profile" element={<ScholarProfile />} />
            <Route path="duties" element={<DutyParticipation />} />
            <Route path="notifications" element={<ScholarNotification />} />
            <Route path="settings" element={<ScholarSettings />} />
            <Route path="grades" element={<ScholarGrades />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;