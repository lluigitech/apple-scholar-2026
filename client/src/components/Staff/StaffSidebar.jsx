import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    LayoutDashboard,
    ClipboardList,
    CalendarCheck,
    FileBarChart2,
    Megaphone,
    LogOut,
    X
} from 'lucide-react';


const StaffSidebar = ({ isOpen, onClose }) => {
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
                {
                    name: 'Dashboard',
                    path: '/staff',
                    icon: <LayoutDashboard size={18} />
                }
            ]
        },
        {
            group: 'Duties',
            items: [
                {
                    name: 'Duty Assignment',
                    path: '/staff/duty-assignment',
                    icon: <ClipboardList size={18} />
                },
                {
                    name: 'Duty Attendance',
                    path: '/staff/duty-attendance',
                    icon: <CalendarCheck size={18} />
                }
            ]
        },
        {
            group: 'Communication',
            items: [
                {
                    name: 'Announcements',
                    path: '/staff/announcements',
                    icon: <Megaphone size={18} />
                }
            ]
        },
        {
            group: 'Reports',
            items: [
                {
                    name: 'Attendance Reports',
                    path: '/staff/attendance-reports',
                    icon: <FileBarChart2 size={18} />
                }
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
                    bg-white/90 backdrop-blur-2xl
                    border-r border-[#7f2d3a]/10
                    flex flex-col
                    shadow-[4px_0_24px_rgba(127,45,58,0.07)]
                    transform transition-transform duration-300 ease-in-out
                    lg:sticky lg:top-0 lg:translate-x-0 lg:h-screen lg:shrink-0
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {/* Branding */}
                <div className="px-6 pt-7 pb-5 flex items-center justify-between shrink-0 border-b border-[#7f2d3a]/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#7f2d3a] rounded-2xl flex items-center justify-center shadow-lg shadow-[#7f2d3a]/20 shrink-0">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-[15px] font-black text-[#7f2d3a] tracking-tight leading-none italic">
                                Apple Scholar
                            </h1>
                            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-0.5">
                                Staff Portal
                            </p>
                        </div>
                    </div>

                    <button onClick={onClose}
                        className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
                    {menuGroups.map((group) => (
                        <div key={group.group}>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.35em] px-3 mb-1">
                                {group.group}
                            </p>
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <button key={item.path} onClick={() => handleNavigate(item.path)}
                                            className={`
                                                w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold
                                                transition-all duration-200 flex items-center gap-3 group
                                                ${isActive
                                                    ? 'bg-[#7f2d3a] text-white shadow-md shadow-[#7f2d3a]/20 translate-x-0.5'
                                                    : 'text-slate-500 hover:bg-[#7f2d3a]/5 hover:text-slate-700'
                                                }
                                            `}>
                                            <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-[#7f2d3a]/40 group-hover:text-[#7f2d3a]'}`}>
                                                {item.icon}
                                            </span>
                                            <span className="truncate">{item.name}</span>
                                            {isActive && (
                                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* User Profile */}
                <div className="p-3 border-t border-[#7f2d3a]/10 shrink-0">
                    <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-[#fcf8f8] border border-[#7f2d3a]/10 mb-2">
                        <div className="w-8 h-8 rounded-full bg-[#7f2d3a] flex items-center justify-center shrink-0 shadow-sm">
                            <span className="text-white text-xs font-black">{getInitials(name)}</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[12px] font-black text-slate-700 truncate uppercase tracking-tight">
                                {name || 'Staff'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                <p className="text-[10px] text-[#7f2d3a] font-black uppercase tracking-widest">
                                    Staff Member
                                </p>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleLogout}
                        className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-[11px]
                        hover:bg-[#7f2d3a] transition-all duration-300 tracking-[0.15em]
                        flex items-center justify-center gap-2 shadow-sm uppercase">
                        <LogOut size={13} />
                        Sign Out
                    </button>
                </div>
            </aside>
        </>
    );
};

export default StaffSidebar;