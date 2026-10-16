import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    LayoutDashboard, Users, Megaphone, ClipboardList,
    FilePieChart, LogOut, X,
    Bell, BarChart3,
    Archive, Settings, AlertTriangle, Network, CalendarDays,
} from 'lucide-react';
import appleLogo from '../../assets/logo/applelogo.png';

// ── Same tokens as AdminLayout — single source of truth, keep in sync ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const INK = '#241512';
const MUTED = '#8A7A68';
const BRONZE = '#A9784E';
const RADIUS = 12;

const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

// `isOpen` / `onClose` drive the mobile drawer.
// `collapsed` drives the desktop 256px ↔ 84px rail — the toggle button
// itself lives in AdminLayout's header, so this component only reads the
// prop; it never renders its own collapse control (avoids a duplicate).
const AdminSidebar = ({ isOpen, onClose, collapsed = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const name = localStorage.getItem('name');

    const handleLogout = async () => {
        await axios.post('http://localhost:5000/api/logout', {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
        localStorage.clear();
        navigate('/');
    };

    const handleNavigate = (path) => {
        navigate(path);
        if (window.innerWidth < 1024 && onClose) onClose();
    };

    const menuGroups = [
        {
            group: 'Overview',
            items: [
                { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
            ],
        },
        {
            group: 'Management',
            items: [
                { name: 'User Management', path: '/admin/users', icon: Users },
                { name: 'Flagged Scholars', path: '/admin/flagged', icon: AlertTriangle },
                { name: 'Team Assignments', path: '/admin/team-assignments', icon: Network },
                { name: 'Task Assignment', path: '/admin/task-assignment', icon: ClipboardList },
                { name: 'Duty Assignment', path: '/admin/duty-assignment', icon: CalendarDays },
                { name: 'Archive Management', path: '/admin/archive', icon: Archive },
            ],
        },
        {
            group: 'Communications',
            items: [
                { name: 'Announcements', path: '/admin/announcements', icon: Megaphone },
                { name: 'Notifications', path: '/admin/notifications', icon: Bell },
            ],
        },
        {
            group: 'Analytics',
            items: [
                { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
                { name: 'System Reports', path: '/admin/reports', icon: FilePieChart },
                { name: 'Donor Reporting Center', path: '/admin/donor', icon: BarChart3 },
            ],
        },
        {
            group: 'System',
            items: [
                { name: 'Settings', path: '/admin/settings', icon: Settings },
            ],
        },
    ];

    // Active check — also highlights sidebar when viewing a scholar profile
    const isActive = (path) => {
        if (path === '/admin/users') {
            return location.pathname === '/admin/users' ||
                   location.pathname.startsWith('/admin/scholars/');
        }
        return location.pathname === path;
    };

    // Mobile drawer is always shown fully expanded — `collapsed` is a
    // desktop-only affordance and its toggle only exists at the lg breakpoint.
    const rail = collapsed;

    const initial = name ? name.charAt(0).toUpperCase() : 'A';

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/25 backdrop-blur-sm z-20 lg:hidden"
                    onClick={onClose}
                />
            )}

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');

                .as-scroll::-webkit-scrollbar { width: 5px; }
                .as-scroll::-webkit-scrollbar-track { background: transparent; }
                .as-scroll::-webkit-scrollbar-thumb { background: rgba(109,33,64,0.16); border-radius: 999px; }
                .as-scroll::-webkit-scrollbar-thumb:hover { background: rgba(109,33,64,0.30); }
                .as-scroll { scrollbar-width: thin; scrollbar-color: rgba(109,33,64,0.16) transparent; }

                .as-sidebar {
                    width: min(272px, 86vw);
                    transition: width 200ms ease;
                    box-shadow: 4px 0 24px rgba(74, 23, 48, 0.04);
                }
                @media (min-width: 1024px) {
                    .as-sidebar { width: 256px; }
                    .as-sidebar.as-rail { width: 84px; }
                }

                .as-navitem {
                    transition: background-color 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
                    outline: none;
                    cursor: pointer;
                    border: none;
                }
                .as-navitem:focus-visible,
                .as-logout:focus-visible,
                .as-close:focus-visible {
                    outline: 2px solid ${PRIMARY};
                    outline-offset: 2px;
                }
                .as-navitem.is-idle { background: transparent; color: ${MUTED}; }
                .as-navitem.is-idle:hover { background: ${BG}; color: ${PRIMARY}; }
                .as-navitem.is-idle:not(.is-rail):hover { transform: translateX(2px); }
                .as-navitem.is-active {
                    background: ${PRIMARY};
                    color: #fff;
                    box-shadow: 0 4px 12px rgba(109, 33, 64, 0.22);
                }

                .as-logout { transition: background-color 180ms ease; }
                .as-logout:hover { background: ${PRIMARY_DEEP} !important; }

                .as-close { transition: background-color 180ms ease, color 180ms ease; }
                .as-close:hover { background: ${BG}; color: ${PRIMARY}; }

                .as-group-line { flex: 1; height: 1px; background: ${BORDER}; opacity: 0.7; }
            `}</style>

            {/* Sidebar */}
            <aside
                className={`
                    as-sidebar fixed top-0 left-0 h-screen z-30
                    flex flex-col overflow-hidden
                    transform transition-transform duration-300 ease-in-out
                    lg:sticky lg:top-0 lg:translate-x-0 lg:h-screen lg:shrink-0
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    ${rail ? 'as-rail' : ''}
                `}
                style={{ background: SURFACE, borderRight: `1px solid ${BORDER}` }}
            >
                {/* Branding */}
                <div
                    className="relative shrink-0 flex flex-col items-center"
                    style={{
                        borderBottom: `1px solid ${BORDER}`,
                        padding: rail ? '22px 0 20px' : '24px 20px 18px',
                    }}
                >
                    {!rail && (
                        <button
                            onClick={onClose}
                            className="as-close lg:hidden absolute flex items-center justify-center rounded-lg shrink-0"
                            style={{ top: 12, right: 12, width: 32, height: 32, color: MUTED, background: 'transparent', border: 'none', cursor: 'pointer' }}
                            aria-label="Close menu"
                        >
                            <X size={17} />
                        </button>
                    )}

                    {/* Full Apple Scholar logo (horizontal, ~2:1). Shown uncropped and
                        undistorted; multiply blend dissolves any white background into
                        the cream sidebar without touching the artwork. */}
                    <img
                        src={appleLogo}
                        alt="Apple Scholar"
                        draggable={false}
                        style={{
                            display: 'block',
                            width: rail ? 66 : '100%',
                            maxWidth: rail ? 66 : 190,
                            height: 'auto',
                            mixBlendMode: 'multiply',
                            userSelect: 'none',
                        }}
                    />

                    {!rail && (
                        <p
                            style={{
                                ...body,
                                fontSize: '0.66rem',
                                color: BRONZE,
                                fontWeight: 700,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                marginTop: 6,
                            }}
                        >
                            Admin Portal
                        </p>
                    )}
                </div>

                {/* Navigation */}
                <nav
                    className="as-scroll flex-1 min-h-0 overflow-y-auto flex flex-col"
                    style={{ padding: rail ? '20px 12px' : '22px 16px', gap: 22 }}
                    aria-label="Admin navigation"
                >
                    {menuGroups.map((group) => (
                        <div key={group.group}>
                            {!rail && (
                                <div className="flex items-center gap-2 px-3 mb-2">
                                    <p
                                        style={{ ...body, fontSize: '0.64rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
                                    >
                                        {group.group}
                                    </p>
                                    <span className="as-group-line" aria-hidden />
                                </div>
                            )}
                            {rail && (
                                <div aria-hidden style={{ height: 1, background: BORDER, opacity: 0.7, margin: '0 10px 10px' }} />
                            )}
                            <div className="flex flex-col" style={{ gap: 2 }}>
                                {group.items.map((item) => {
                                    const active = isActive(item.path);
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.path}
                                            onClick={() => handleNavigate(item.path)}
                                            title={rail ? item.name : undefined}
                                            aria-label={rail ? item.name : undefined}
                                            aria-current={active ? 'page' : undefined}
                                            className={`as-navitem w-full text-left flex items-center gap-3 ${active ? 'is-active' : 'is-idle'} ${rail ? 'is-rail' : ''}`}
                                            style={{
                                                height: 42,
                                                width: rail ? 42 : undefined,
                                                margin: rail ? '0 auto' : 0,
                                                padding: rail ? 0 : '0 12px',
                                                justifyContent: rail ? 'center' : 'flex-start',
                                                borderRadius: RADIUS,
                                                ...body,
                                                fontSize: '0.84rem',
                                                fontWeight: active ? 600 : 500,
                                                letterSpacing: '0.005em',
                                            }}
                                        >
                                            <Icon
                                                size={18}
                                                strokeWidth={1.8}
                                                style={{ color: active ? '#fff' : PRIMARY, flexShrink: 0 }}
                                            />
                                            {!rail && <span className="truncate flex-1">{item.name}</span>}
                                            {!rail && active && (
                                                <span
                                                    aria-hidden
                                                    className="rounded-full shrink-0"
                                                    style={{ width: 6, height: 6, background: '#fff', opacity: 0.9 }}
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* User profile & log out */}
                <div className="shrink-0" style={{ padding: rail ? '14px 10px' : 16, borderTop: `1px solid ${BORDER}` }}>
                    {!rail ? (
                        <>
                            <div
                                className="flex items-center gap-3"
                                style={{
                                    padding: '10px 12px',
                                    marginBottom: 12,
                                    background: BG,
                                    border: `1px solid ${BORDER}`,
                                    borderRadius: RADIUS,
                                }}
                            >
                                <div className="relative shrink-0" style={{ width: 36, height: 36 }}>
                                    <div
                                        className="rounded-full flex items-center justify-center"
                                        style={{ width: 36, height: 36, background: PRIMARY }}
                                    >
                                        <span style={{ ...body, color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>
                                            {initial}
                                        </span>
                                    </div>
                                    <span
                                        aria-hidden
                                        className="absolute rounded-full"
                                        style={{ right: -1, bottom: -1, width: 10, height: 10, background: '#3FA66B', border: `2px solid ${BG}` }}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK, lineHeight: 1.2 }} className="truncate">
                                        {name || 'Administrator'}
                                    </p>
                                    <p style={{ ...body, fontSize: '0.69rem', color: MUTED, marginTop: 3, lineHeight: 1 }}>Administrator</p>
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="as-logout w-full flex items-center justify-center gap-2"
                                style={{
                                    height: 43,
                                    borderRadius: RADIUS,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: PRIMARY,
                                    color: '#fff',
                                    ...body,
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    letterSpacing: '0.01em',
                                }}
                            >
                                <LogOut size={16} />
                                Log out
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <div className="relative shrink-0" style={{ width: 36, height: 36 }} title={name || 'Administrator'}>
                                <div
                                    className="rounded-full flex items-center justify-center"
                                    style={{ width: 36, height: 36, background: PRIMARY }}
                                >
                                    <span style={{ ...body, color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>
                                        {initial}
                                    </span>
                                </div>
                                <span
                                    aria-hidden
                                    className="absolute rounded-full"
                                    style={{ right: -1, bottom: -1, width: 10, height: 10, background: '#3FA66B', border: `2px solid ${SURFACE}` }}
                                />
                            </div>
                            <button
                                onClick={handleLogout}
                                className="as-logout flex items-center justify-center"
                                style={{ width: 40, height: 40, borderRadius: RADIUS, border: 'none', cursor: 'pointer', background: PRIMARY, color: '#fff' }}
                                title="Log out"
                                aria-label="Log out"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
};

export default AdminSidebar;