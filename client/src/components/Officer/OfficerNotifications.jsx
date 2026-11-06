import { useState } from 'react';
import { ArrowUpRight, Bell, Calendar, Clock, Megaphone, RefreshCw } from 'lucide-react';

// ── Token system — shared across the whole portal ──
const MAROON = '#7f2d3a';
const GOLD = '#b98b4e';
const INK = '#241512';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';
const AMBER = '#b8863f';
const PAPER = '#F6EFE4';
const RULE = '#e8dccb';
const ROSE = '#F5E8EA';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'DM Sans', sans-serif" };

export default function OfficerNotifications({ loading, pending, pendingReviews = 0, deadlines = [], announcements = [], preferences = {}, error = false, onRetry, onNavigate }) {
  const [open, setOpen] = useState(false);
  const notifications = [
    preferences.new_submissions !== false && pending > 0 && { key: 'new-submissions', label: `${pending} new submission${pending === 1 ? '' : 's'}`, path: '/officer/validation', icon: Clock, color: AMBER, bg: `${AMBER}16` },
    preferences.pending_reviews !== false && pendingReviews > 0 && { key: 'pending-reviews', label: `${pendingReviews} submission${pendingReviews === 1 ? '' : 's'} under review`, path: '/officer/validation', icon: Clock, color: AMBER, bg: `${AMBER}16` },
    ...(preferences.deadlines === false ? [] : deadlines.map(reminder => {
      const dueText = reminder.days_remaining === 0
        ? 'Due today'
        : `${reminder.days_remaining} day${reminder.days_remaining === 1 ? '' : 's'} left`;
      const count = reminder.outstanding_count || 0;
      return {
        key: `deadline-${reminder.id}`,
        label: `${reminder.title || reminder.type} · ${dueText}`,
        detail: `${count} scholar${count === 1 ? '' : 's'} still need to submit`,
        path: '/officer/task-assignment',
        icon: Calendar,
        color: reminder.days_remaining === 0 ? AMBER : MAROON,
        bg: ROSE,
      };
    })),
    ...(preferences.announcements === false ? [] : announcements.slice(0, 3).map(announcement => ({
      key: `announcement-${announcement.id || announcement.title}`,
      label: announcement.title || 'New announcement',
      detail: announcement.priority ? `${announcement.priority} announcement` : 'New announcement',
      path: '/officer/announcements', icon: Megaphone, color: MAROON, bg: ROSE,
    }))),
  ].filter(Boolean);

  return (
    <div className="relative">
      <button onClick={() => setOpen(value => !value)} aria-label="Open notifications"
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:opacity-85"
        style={{ border: `1.5px solid ${GOLD}55`, background: 'rgba(255,255,255,0.06)', color: '#d4af7a', cursor: 'pointer' }}>
        <Bell size={17} />
        {!loading && notifications.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
            style={{ background: MAROON, color: '#fff', ...sans, fontSize: '0.6rem', fontWeight: 800, border: '1.5px solid #fff' }}>
            {notifications.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-20 w-72 sm:w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-xl p-3"
          style={{ background: '#fff', border: `1px solid ${RULE}`, boxShadow: '0 20px 50px -18px rgba(36,21,18,0.4)' }}>
          <div className="flex items-center justify-between px-2 pb-2.5" style={{ borderBottom: `1px solid ${RULE}` }}>
            <p style={{ ...serif, fontSize: '0.85rem', fontWeight: 700, color: INK }}>Notifications</p>
            <span style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, color: '#a89890', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Officer Updates</span>
          </div>
          {error && (
            <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 mt-2"
              style={{ background: '#fff8ed', border: `1px solid ${AMBER}44` }}>
              <p style={{ ...sans, fontSize: '0.68rem', color: INK }}>
                Some notification data could not be refreshed{notifications.length ? '; showing the last loaded data.' : '.'}
              </p>
              <button onClick={onRetry} aria-label="Retry loading notifications"
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1"
                style={{ background: '#fff', border: `1px solid ${RULE}`, color: MAROON, ...sans, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          )}
          {notifications.length === 0 && !error ? (
            <p style={{ ...sans, fontSize: '0.8rem', color: '#a89890', textAlign: 'center', padding: '20px 8px' }}>No new notifications</p>
          ) : notifications.length > 0 ? (
            <div className="space-y-1.5 pt-2">
              {notifications.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.key} onClick={() => { setOpen(false); onNavigate(item.path); }}
                    className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-[#faf6ee]"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: item.bg, color: item.color }}>
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: INK }}>{item.label}</span>
                      {item.detail && <span className="block truncate" style={{ ...sans, fontSize: '0.66rem', color: '#a89890' }}>{item.detail}</span>}
                    </span>
                    <ArrowUpRight size={14} className="shrink-0" style={{ color: '#c9b9b0' }} />
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