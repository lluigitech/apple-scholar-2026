import { useEffect, useState } from 'react';
import axios from 'axios';
import { Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAdminLocale, getAdminTimezone } from '../../utils/adminPreferences';
import AdminSidebar from './AdminSidebar';
import appleLogo from '../../assets/logo/applelogo.png';

// ── Unified Apple Scholar tokens (same as Officer / Staff / Scholar portals) ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const densityStyles = `
    :root[data-admin-table-density="compact"] td,
    :root[data-admin-table-density="compact"] th { padding-top: 0.45rem !important; padding-bottom: 0.45rem !important; }
    :root[data-admin-table-density="condensed"] td,
    :root[data-admin-table-density="condensed"] th { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
`;

const AdminLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [adminNotification, setAdminNotification] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        let timeoutId;
        const applySettings = () => {
            let preferences = {};
            try {
                preferences = JSON.parse(localStorage.getItem('admin-system-settings') || '{}');
            } catch (error) {
                console.error('Unable to read administrator session preferences:', error);
            }
            document.documentElement.dataset.adminTableDensity = preferences.tableDensity || 'comfortable';
            document.documentElement.dataset.adminTimezone = getAdminTimezone(preferences);
            document.documentElement.lang = getAdminLocale(preferences);
            window.clearTimeout(timeoutId);
            const minutes = Number.parseInt(preferences.sessionTimeout, 10);
            const timeoutMs = (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60 * 1000;
            timeoutId = window.setTimeout(() => {
                ['token', 'role', 'name', 'email', 'id'].forEach((key) => localStorage.removeItem(key));
                navigate('/login', { replace: true });
            }, timeoutMs);
        };
        const resetIdleTimer = () => {
            applySettings();
        };
        const activityEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
        activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
        window.addEventListener('storage', applySettings);
        window.addEventListener('admin-settings-updated', applySettings);
        applySettings();

        let latestNotificationId = null;
        let notificationTimer;
        let notificationStartTimer;
        let toastTimer;
        const checkNotifications = async () => {
            const preferences = (() => {
                try { return JSON.parse(localStorage.getItem('admin-system-settings') || '{}'); }
                catch (error) {
                    console.error('Unable to read administrator notification preferences:', error);
                    return {};
                }
            })();
            if (!preferences.inAppNotifications) return;
            const token = localStorage.getItem('token');
            const email = localStorage.getItem('email');
            if (!token || !email) return;
            try {
                const apiBase = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
                const api = apiBase.endsWith('/api') ? apiBase : `${apiBase}/api`;
                const { data } = await axios.get(`${api}/admin/notifications/logs?limit=50`, {
                    headers: { Authorization: ['Bearer', token].join(' ') },
                });
                const notifications = (Array.isArray(data) ? data : [])
                    .filter((item) => item.recipient?.toLowerCase() === email.toLowerCase() && item.status === 'sent')
                    .sort((left, right) => Number(right.id) - Number(left.id));
                if (!notifications.length) return;
                const newestId = Number(notifications[0].id);
                if (latestNotificationId === null) {
                    latestNotificationId = newestId;
                    return;
                }
                const newNotification = notifications.find((item) => Number(item.id) > latestNotificationId);
                latestNotificationId = Math.max(latestNotificationId, newestId);
                if (!newNotification) return;
                const isSecurityAlert = /risk|security|overdue|compliance/i.test(newNotification.type || '');
                if (isSecurityAlert && preferences.securityAlerts === false) return;
                setAdminNotification({
                    title: (newNotification.type || 'System notification').replace(/_/g, ' '),
                    detail: newNotification.detail || 'A new system notification is available.',
                });
                window.clearTimeout(toastTimer);
                toastTimer = window.setTimeout(() => setAdminNotification(null), 8000);
            } catch (error) {
                console.error('Unable to check administrator notifications:', error);
            }
        };
        const scheduleNotificationCheck = () => {
            window.clearTimeout(notificationStartTimer);
            notificationStartTimer = window.setTimeout(checkNotifications, 10 * 1000);
        };
        notificationTimer = window.setInterval(checkNotifications, 60 * 1000);
        window.addEventListener('admin-settings-updated', scheduleNotificationCheck);

        return () => {
            window.clearTimeout(timeoutId);
            window.clearTimeout(notificationStartTimer);
            window.clearTimeout(toastTimer);
            window.clearInterval(notificationTimer);
            activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
            window.removeEventListener('storage', applySettings);
            window.removeEventListener('admin-settings-updated', applySettings);
            window.removeEventListener('admin-settings-updated', scheduleNotificationCheck);
            delete document.documentElement.dataset.adminTableDensity;
            delete document.documentElement.dataset.adminTimezone;
            document.documentElement.lang = 'en';
        };
    }, [navigate]);

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: BG }}>
            <style>{densityStyles}</style>
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {adminNotification && (
                <div role="status" className="fixed right-4 top-4 z-[120] max-w-sm rounded-xl p-4 shadow-xl" style={{ background: SURFACE, border: '1px solid #E7D8C7', color: '#241512' }}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p style={{ fontWeight: 700, textTransform: 'capitalize' }}>{adminNotification.title}</p>
                            <p style={{ marginTop: 4, fontSize: '0.78rem', color: '#8A7A68' }}>{adminNotification.detail}</p>
                        </div>
                        <button type="button" aria-label="Dismiss notification" onClick={() => setAdminNotification(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: PRIMARY }}>×</button>
                    </div>
                </div>
            )}

            <main className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden" style={{ background: BG }}>
                {/* Mobile / tablet header — hamburger + centered logo only */}
                <div
                    className="sticky top-0 z-10 flex items-center px-4 backdrop-blur-md lg:hidden"
                    style={{
                        height: 70,
                        background: 'rgba(247, 244, 238, 0.94)',
                        borderBottom: `1px solid ${BORDER}`,
                    }}
                >
                    <button
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open navigation"
                        className="relative z-10 flex items-center justify-center shrink-0 rounded-xl transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6D2140]"
                        style={{
                            width: 42,
                            height: 42,
                            background: SURFACE,
                            border: `1px solid ${BORDER}`,
                            boxShadow: '0 1px 4px rgba(36, 21, 18, 0.06)',
                            color: PRIMARY,
                            cursor: 'pointer',
                        }}
                    >
                        <Menu size={20} strokeWidth={2} />
                    </button>

                    {/* Official Apple Scholar logo — centered, proportional, uncropped.
                        Height scales 32px (320px phones) → 42px (≈440px+). */}
                    <img
                        src={appleLogo}
                        alt="Apple Scholar"
                        draggable={false}
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            display: 'block',
                            height: 'clamp(32px, 9.5vw, 42px)',
                            width: 'auto',
                            maxWidth: 170,
                            objectFit: 'contain',
                            mixBlendMode: 'multiply',
                            userSelect: 'none',
                            pointerEvents: 'none',
                        }}
                    />
                </div>

                {children}
            </main>
        </div>
    );
};

export default AdminLayout;