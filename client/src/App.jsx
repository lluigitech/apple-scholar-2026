import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import New from './pages/new';
import ForgotPassword from './pages/ForgotPassword';

// 📂 Administrator Pages
// 📂 Admin Pages
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminReports from './pages/Admin/AdminReports';
import AdminAnnouncement from './pages/Admin/AdminAnnouncement';
import ComplianceManager from './pages/Admin/SettingsComponent/ComplianceManager';
import BackupRecovery from './pages/Admin/SettingsComponent/BackupRecovery';
import NotificationManager from './pages/Admin/AdminNotification';
import SecurityAuditLogs from './pages/Admin/SettingsComponent/SecurityAuditLogs';
import ArchiveManagement from './pages/Admin/SettingsComponent/ArchiveManagement';
import UserManagement from './pages/Admin/UserManagement';
import AdminAnalytics from './pages/Admin/AdminAnalytics';
import TeamAssignments from './pages/Admin/TeamAssignments';
import AdminTaskAssignmentBoard from './pages/Admin/AdminTaskAssignmentBoard';
import ScholarProfileView from './pages/Admin/ScholarProfileView';
import MonthlyReportYearLevelPage from './pages/Admin/MonthlyReportYearLevelPage';
import AdminDonorPage from './pages/Admin/AdminDonorPage';
import AdminLayout from './components/Admin/AdminLayout';
import FlaggedScholars from './pages/Admin/FlaggedScholars';

// 📂 Officer Pages
import OfficerLayout from './components/Officer/OfficerLayout';
import OfficerDashboard from './pages/Officer/OfficerDashboard';
import OfficerManualValidation from './pages/Officer/OfficerManualValidation';
import OfficerAnalytics from './pages/Officer/OfficerAnalytics';
import OfficerAnnouncements from './pages/Officer/OfficerAnnouncements';
import OfficerCommunication from './pages/Officer/OfficerCommunication';
import OfficerReports from './pages/Officer/OfficerReports';
import OfficerTaskAssignment from './pages/Officer/OfficerTaskAssignment';
import OfficerSettings from './pages/Officer/OfficerSettings';

// 📂 Staff Pages
import StaffLayout from './components/Staff/StaffLayout';
import StaffDashboard from './pages/Staff/StaffDashboard';
import StaffDutyAssignment from './pages/Staff/StaffDutyAssignment';
import AdminDutyAssignment from './pages/Admin/AdminDutyAssignment';
import AdminSettings from './pages/Admin/AdminSettings';
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
import ScholarSettings from './pages/Scholar/ScholarSettings';
import RequirementsChecklist from './pages/Scholar/RequirementsChecklist';
import ScholarGrades from './components/Scholar/SubmissionPage/ScholarGrades';
import OfflineIndicator from './components/shared/OfflineIndicator';

// 🔒 Route Guard
const ProtectedRoute = ({ children, allowedRoles }) => {
  const role = localStorage.getItem('role');
  if (!role) return <Navigate to="/login" replace />;
  if (role.toLowerCase() === 'scholar' && localStorage.getItem('must_change_password') === 'true') {
    return <Navigate to="/account/setup" replace />;
  }
  const allowed = Array.isArray(allowedRoles)
    ? allowedRoles.map(r => r.toLowerCase()).includes(role.toLowerCase())
    : role.toLowerCase() === allowedRoles.toLowerCase();
  if (!allowed) return <Navigate to="/login" replace />;
  return children;
};

const AccountSetupRoute = ({ children }) => {
  const role = localStorage.getItem('role');
  const token = localStorage.getItem('token');
  if (!token || role?.toLowerCase() !== 'scholar') return <Navigate to="/login" replace />;
  if (localStorage.getItem('must_change_password') !== 'true') return <Navigate to="/scholar" replace />;
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
      <OfflineIndicator />
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/account/setup" element={<AccountSetupRoute><New /></AccountSetupRoute>} />

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
          <Route path="/admin/flagged" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><FlaggedScholars portalLabel="Admin Portal" /></AdminLayout>
            </ProtectedRoute>
          } />

          {/* ✅ FIXED: KeyedScholarProfile forces remount on id change */}
          <Route path="/admin/scholars/:id" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><KeyedScholarProfile /></AdminLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/compliance" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><ComplianceManager /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/backup-recovery" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><BackupRecovery /></AdminLayout>
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
          <Route path="/admin/reports/:month/:yearLevel" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><MonthlyReportYearLevelPage /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/donor" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><AdminDonorPage /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/security" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><SecurityAuditLogs /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/archive" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><ArchiveManagement /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><AdminAnalytics /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/team-assignments" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><TeamAssignments /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/task-assignment" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><AdminTaskAssignmentBoard /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/duty-assignment" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><AdminDutyAssignment /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/settings" element={
            <ProtectedRoute allowedRoles="admin">
              <AdminLayout><AdminSettings /></AdminLayout>
            </ProtectedRoute>
          } />

          {/* 🛡️ OFFICER ROUTES */}
          <Route path="/officer" element={
            <ProtectedRoute allowedRoles="officer">
              <OfficerLayout />
            </ProtectedRoute>
          }>
            <Route index element={<OfficerDashboard />} />
            <Route path="validation" element={<OfficerManualValidation />} />
            <Route path="analytics" element={<OfficerAnalytics />} />
            <Route path="announcements" element={<OfficerAnnouncements />} />
            <Route path="communication" element={<OfficerCommunication />} />
            <Route path="reports" element={<OfficerReports />} />
            <Route path="task-assignment" element={<OfficerTaskAssignment />} />
            <Route path="settings" element={<OfficerSettings />} />
          </Route>

          {/* 🛡️ STAFF ROUTES */}
          <Route path="/staff" element={
            <ProtectedRoute allowedRoles="staff">
              <StaffLayout />
            </ProtectedRoute>
          }>
            <Route index element={<StaffDashboard />} />
            <Route path="duty-assignment" element={<StaffDutyAssignment />} />
            <Route path="announcements" element={<StaffAnnouncement />} />
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