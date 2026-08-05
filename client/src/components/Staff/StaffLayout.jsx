import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import StaffSidebar from './StaffSidebar';

const StaffLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-[#fcf8f8]">
            <StaffSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 overflow-y-auto w-full min-w-0">
                {/* Mobile hamburger */}
                <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-md border-b border-[#7f2d3a]/10 lg:hidden">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded-xl bg-[#fcf8f8] border border-[#7f2d3a]/10 shadow-sm text-[#7f2d3a]"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#7f2d3a] rounded-lg flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                            </svg>
                        </div>
                        <span className="text-sm font-black text-[#7f2d3a] uppercase tracking-widest italic">Apple Scholar</span>
                    </div>
                </div>

                <Outlet />
            </main>
        </div>
    );
};

export default StaffLayout;