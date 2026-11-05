import { useState } from 'react';
import { ArrowUpRight, Bell, CalendarDays, ClipboardList, RefreshCw, ShieldAlert } from 'lucide-react';

const PRIMARY = '#6D2140';
const INK = '#241512';
const MUTED = '#8A7A68';
const BRONZE = '#A9784E';
const WARNING = '#C08A3E';
const BORDER = '#E7D8C7';
const SURFACE = '#FFFDF9';
const ROSE = '#F5E8EA';
const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'Inter', sans-serif" };

export default function AdminNotifications({ loading, summary, logs = [], error = false, onRetry, onNavigate }) {
    const [open, setOpen] = useState(false);
    let preferences = {};
    try {
        preferences = JSON.parse(localStorage.getItem('admin-system-settings') || '{}');
    } catch (preferenceError) {
        console.error('Unable to read administrator notification preferences:', preferenceError);
    }

    const notifications = [];
    if (preferences.inAppNotifications !== false) {
        const pending = Number(summary?.submissions?.pending || 0);
        const overdueTasks = Number(summary?.tasks?.overdue || 0);
        const dutiesToday = Number(summary?.duties?.today || 0);

        if (pending > 0) notifications.push({
            key: 'pending-submissions',
            label: `${pending} submission${pending === 1 ? '' : 's'} awaiting review`,
            detail: 'Pending scholar submissions',
            path: '/admin/reports',
            icon: ClipboardList,
            color: WARNING,
        });
        if (overdueTasks > 0) notifications.push({
            key: 'overdue-tasks',
            label: `${overdueTasks} task${overdueTasks === 1 ? '' : 's'} overdue`,
            detail: 'Review overdue task assignments',
            path: '/admin/task-assignment',
            icon: ShieldAlert,
            color: WARNING,
        });
        if (dutiesToday > 0) notifications.push({
            key: 'duties-today',
            label: `${dutiesToday} dut${dutiesToday === 1 ? 'y' : 'ies'} scheduled today`,
            detail: 'Check today’s duty assignments',
            path: '/admin/duty-assignment',
            icon: CalendarDays,
            color: PRIMARY,
        });

        logs
            .filter(item => preferences.securityAlerts !== false || !/risk|security|overdue|compliance/i.test(item.type || ''))
            .slice(0, 5)
            .forEach(item => {
                const isSecurityAlert = /risk|security|overdue|compliance/i.test(item.type || '');
                notifications.push({
                    key: `log-${item.id}`,
                    label: (item.type || 'System notification').replace(/[_-]+/g, ' '),
                    detail: item.detail || 'A notification was sent to your admin account.',
                    path: '/admin/notifications',
                    icon: isSecurityAlert ? ShieldAlert : Bell,
                    color: isSecurityAlert ? PRIMARY : BRONZE,
                });
            });
    }

    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen(value => !value)} aria-label="Open notifications"
                className="relative inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:opacity-85"
                style={{ border: `1.5px solid ${BRONZE}66`, background: SURFACE, color: PRIMARY, cursor: 'pointer' }}>
                <Bell size={17} />
                {!loading && notifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
                        style={{ background: PRIMARY, color: '#fff', ...sans, fontSize: '0.6rem', fontWeight: 800, border: '1.5px solid #fff' }}>
                        {notifications.length}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 top-12 z-30 w-72 sm:w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-xl p-3"
                    style={{ background: SURFACE, border: `1px solid ${BORDER}`, boxShadow: '0 20px 50px -18px rgba(36,21,18,0.3)' }}>
                    <div className="flex items-center justify-between px-2 pb-2.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <p style={{ ...serif, fontSize: '0.9rem', fontWeight: 700, color: INK }}>Notifications</p>
                        <span style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Admin Updates</span>
                    </div>
                    {error && (
                        <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 mt-2"
                            style={{ background: '#fff8ed', border: `1px solid ${WARNING}44` }}>
                            <p style={{ ...sans, fontSize: '0.68rem', color: INK }}>
                                {notifications.length ? 'Some notification data could not refresh.' : 'Could not load notification data.'}
                            </p>
                            <button type="button" onClick={onRetry} aria-label="Retry loading notifications"
                                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1"
                                style={{ background: '#fff', border: `1px solid ${BORDER}`, color: PRIMARY, ...sans, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                                <RefreshCw size={12} /> Retry
                            </button>
                        </div>
                    )}
                    {notifications.length === 0 && !error ? (
                        <p style={{ ...sans, fontSize: '0.8rem', color: MUTED, textAlign: 'center', padding: '20px 8px' }}>
                            {preferences.inAppNotifications === false ? 'Website notifications are turned off.' : 'No new notifications'}
                        </p>
                    ) : notifications.length > 0 ? (
                        <div className="space-y-1.5 pt-2">
                            {notifications.map(item => {
                                const Icon = item.icon;
                                return (
                                    <button key={item.key} type="button" onClick={() => { setOpen(false); onNavigate(item.path); }}
                                        className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-[#faf6ee]"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                                            style={{ background: ROSE, color: item.color }}>
                                            <Icon size={15} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate capitalize" style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: INK }}>{item.label}</span>
                                            <span className="block truncate" style={{ ...sans, fontSize: '0.66rem', color: MUTED }}>{item.detail}</span>
                                        </span>
                                        <ArrowUpRight size={14} className="shrink-0" style={{ color: '#b7a99a' }} />
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
