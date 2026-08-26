import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    LayoutDashboard,
    ClipboardCheck,
    ClipboardList,
    Flag,
    Megaphone,
    FileBarChart2,
    BarChart3,
    LogOut,
    X
} from 'lucide-react';

// ── Token system — shared across the whole portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const INK = '#241512';
const SAGE = '#6b8f71';
const PAPER = '#F6EFE4';
const RULE = '#e8dccb';
const ROSE = '#F5E8EA';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'DM Sans', sans-serif" };

const OfficerSidebar = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const name = localStorage.getItem('name');

    const handleNavigate = (path) => {
        navigate(path);
        if (window.innerWidth < 1024 && onClose) onClose();
    };

    const handleLogout = async () => {
        await axios.post('http://localhost:5000/api/logout', {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
        localStorage.clear();
        navigate('/');
    };

    const getInitials = (fullName) => {
        if (!fullName) return '?';
        return fullName
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    const menuGroups = [
        {
            group: 'Overview',
            items: [
                { name: 'Dashboard', path: '/officer', icon: <LayoutDashboard size={18} /> },
            ]
        },
        {
            group: 'Management',
            items: [
                { name: 'Manual Validation', path: '/officer/validation', icon: <ClipboardCheck size={18} /> },
                { name: 'Flagged Scholars', path: '/officer/flagged', icon: <Flag size={18} /> },
                { name: 'Task Assignment', path: '/officer/task-assignment', icon: <ClipboardList size={18} /> },
            ]
        },
        {
            group: 'Communication',
            items: [
                { name: 'Announcements', path: '/officer/announcements', icon: <Megaphone size={18} /> },
            ]
        },
        {
            group: 'Reports',
            items: [
                { name: 'Reports', path: '/officer/reports', icon: <FileBarChart2 size={18} /> },
                { name: 'Analytics', path: '/officer/analytics', icon: <BarChart3 size={18} /> },
            ]
        }
    ];

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside
                className={`
                    fixed top-0 left-0 h-screen z-30 w-64
                    flex flex-col
                    transform transition-transform duration-300 ease-in-out
                    lg:sticky lg:top-0 lg:translate-x-0 lg:h-screen lg:shrink-0
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
                style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', borderRight: `1px solid ${RULE}`, boxShadow: '4px 0 24px rgba(36,21,18,0.06)' }}
            >
                {/* Branding */}
                <div className="px-6 pt-7 pb-5 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${RULE}` }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${MAROON}, ${MAROON_DEEP})`, boxShadow: `0 6px 16px -6px ${MAROON}88` }}>
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                            </svg>
                        </div>
                        <div>
                            <h1 style={{ ...serif, fontSize: '0.95rem', fontWeight: 700, color: MAROON, fontStyle: 'italic', lineHeight: 1 }}>
                                Apple Scholar
                            </h1>
                            <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, color: '#c9b9b0', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 3 }}>
                                Officer Portal
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="lg:hidden p-1.5 rounded-lg transition-colors hover:bg-[#f6efe4]"
                        style={{ color: '#a89890', border: 'none', background: 'none', cursor: 'pointer' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
                    {menuGroups.map((group) => (
                        <div key={group.group}>
                            <p style={{ ...sans, fontSize: '0.58rem', fontWeight: 800, color: '#c9b9b0', letterSpacing: '0.3em', textTransform: 'uppercase', padding: '0 12px', marginBottom: 4 }}>
                                {group.group}
                            </p>
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <button
                                            key={item.path}
                                            onClick={() => handleNavigate(item.path)}
                                            className="w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-3 group"
                                            style={{
                                                ...sans, fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                                                background: isActive ? MAROON : 'transparent',
                                                color: isActive ? '#fff' : '#8a7a70',
                                                boxShadow: isActive ? `0 6px 16px -8px ${MAROON}88` : 'none',
                                            }}
                                        >
                                            <span className="shrink-0 transition-colors" style={{ color: isActive ? '#fff' : `${MAROON}66` }}>
                                                {item.icon}
                                            </span>
                                            <span className="truncate">{item.name}</span>
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

                {/* User Profile */}
                <div className="p-3 shrink-0" style={{ borderTop: `1px solid ${RULE}` }}>
                    <div className="flex items-center gap-3 px-3 py-3 rounded-lg mb-2" style={{ background: PAPER, border: `1px solid ${RULE}` }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${MAROON}, ${MAROON_DEEP})` }}>
                            <span style={{ ...sans, fontSize: '0.68rem', fontWeight: 800, color: '#fff' }}>
                                {getInitials(name)}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 800, color: INK, textTransform: 'uppercase', letterSpacing: '0.02em' }} className="truncate">
                                {name || 'Officer'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: SAGE }} />
                                <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 800, color: MAROON, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                                    Officer
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full py-2.5 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2 hover:opacity-90"
                        style={{ ...sans, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', background: MAROON_DEEP, color: '#fff', border: 'none', cursor: 'pointer' }}
                    >
                        <LogOut size={13} />
                        Sign Out
                    </button>
                </div>
            </aside>
        </>
    );
};

export default OfficerSidebar;