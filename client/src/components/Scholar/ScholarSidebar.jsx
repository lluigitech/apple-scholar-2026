import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard,
  Upload,
  CheckSquare,
  Bell,
  LogOut,
  X,
  User,
  CalendarDays,
  Settings,
  ClipboardList,
} from 'lucide-react';

// ── Token system — shared across the Scholar Portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const IVORY = '#FBF7F2';
const INK = '#241512';
const ROSE = '#F5E8EA';

const ScholarSidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const name = localStorage.getItem('name');

  const handleNavigate = (path) => {
    navigate(path);
    if (window.innerWidth < 1024 && onClose) onClose();
  };

  const getInitials = (fullName) => {
    if (!fullName) return '?';
    return fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const menuGroups = [
    {
      group: 'Overview',
      items: [
        { name: 'Dashboard',       path: '/scholar',               icon: <LayoutDashboard size={18} /> },
        { name: 'Notifications',   path: '/scholar/notifications', icon: <Bell size={18} />             },
        { name: 'Announcements',   path: '/scholar/announcements', icon: <ClipboardList size={18} />    },
      ],
    },
    {
      group: 'Requirements',
      items: [
        { name: 'Submission',            path: '/scholar/submission', icon: <Upload size={18} />         },
        { name: 'Requirement Checklist', path: '/scholar/checklist',  icon: <CheckSquare size={18} />    },
      ],
    },
    {
      group: 'Duties & Tasks',
      items: [
        { name: 'Duty Participation', path: '/scholar/duties', icon: <CalendarDays size={18} /> },
      ],
    },
    {
      group: 'Account',
      items: [
        { name: 'Profile',   path: '/scholar/profile',   icon: <User size={18} />     },
        { name: 'Settings',  path: '/scholar/settings',  icon: <Settings size={18} /> },
      ],
    },
  ];

  const serif = { fontFamily: "'Playfair Display', serif" };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen z-30 w-64
          backdrop-blur-2xl
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:sticky lg:top-0 lg:translate-x-0 lg:h-screen lg:shrink-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: IVORY, borderRight: `1px solid #ecdfe1`, boxShadow: '4px 0 24px rgba(127,45,58,0.06)' }}
      >
        {/* Branding */}
        <div className="px-6 pt-7 pb-5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #ecdfe1' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, boxShadow: `0 6px 14px -4px ${MAROON}55` }}
            >
              {/* our own apple silhouette mark — same one used across every hero band,
                  not the Apple Inc. logo */}
              <svg viewBox="0 0 200 200" className="w-5 h-5" fill="none">
                <path
                  d="M100 62c-6-14-20-24-36-24-4 0-8 1-8 1s-2 10 4 22c5 10 15 18 26 19-4 12-6 26-6 38 0 34 18 62 40 62 8 0 12-4 20-4s12 4 20 4c22 0 40-30 40-64 0-24-12-42-30-42-8 0-14 4-20 4s-10-3-16-6c2-11 8-20 16-25-2-1-6-2-10-2-16 0-30 8-40 17z"
                  fill={GOLD}
                />
                <path d="M100 62c2-16 10-30 22-38" stroke={GOLD} strokeWidth="10" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-[15px] font-bold leading-none italic" style={{ ...serif, color: MAROON }}>
                Apple Scholar
              </h1>
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase mt-1" style={{ color: '#c9a9b0' }}>
                Scholar Portal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: '#c9a9b0' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
          {menuGroups.map((group) => (
            <div key={group.group}>
              <p className="text-[9px] font-bold uppercase tracking-[0.35em] px-3 mb-1.5" style={{ color: '#d4b3a0' }}>
                {group.group}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNavigate(item.path)}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 flex items-center gap-3 group"
                      style={isActive
                        ? { background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, color: '#fff', boxShadow: `0 4px 12px -4px ${MAROON}66` }
                        : { color: '#8a7570', background: 'transparent' }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = ROSE; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span className="shrink-0 transition-colors" style={{ color: isActive ? '#fff' : GOLD }}>
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.name}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-3 shrink-0" style={{ borderTop: '1px solid #ecdfe1' }}>
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl mb-2" style={{ background: ROSE }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)` }}
            >
              <span className="text-xs font-bold" style={{ color: GOLD }}>{getInitials(name)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold truncate uppercase tracking-tight" style={{ color: INK }}>
                {name || 'Scholar'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#15803d' }} />
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MAROON }}>Scholar</p>
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              await axios.post('http://localhost:5000/api/logout', {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
              localStorage.clear();
              navigate('/');
            }}
            className="w-full py-2.5 rounded-xl text-white font-bold text-[11px] transition-all duration-300 tracking-[0.15em] flex items-center justify-center gap-2 uppercase"
            style={{ background: `linear-gradient(120deg, ${MAROON} 0%, ${MAROON_DEEP} 100%)`, boxShadow: `0 4px 12px -4px ${MAROON}66` }}
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default ScholarSidebar;