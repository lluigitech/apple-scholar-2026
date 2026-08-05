import React from 'react';

// Small shared primitives used across the officer review screens.

export const Badge = ({ bg, color, children, dot }) => (
    <span style={{ backgroundColor: bg, color, fontFamily: "'DM Sans', sans-serif" }}
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] px-2.5 py-1 rounded-full">
        {dot && <span style={{ backgroundColor: dot }} className="w-1.5 h-1.5 rounded-full shrink-0" />}
        {children}
    </span>
);

export const Skeleton = () => (
    <div className="animate-pulse rounded-2xl overflow-hidden border border-slate-100">
        <div className="bg-slate-100 h-24 w-full" />
    </div>
);

export const Empty = ({ icon: Icon, text }) => (
    <div className="flex flex-col items-center justify-center py-20 text-slate-200">
        <Icon size={48} strokeWidth={1} className="mb-3" />
        <p className="text-sm font-bold text-slate-300">{text}</p>
    </div>
);

export const FilterPill = ({ label, active, onClick, maroon }) => (
    <button onClick={onClick}
        className="shrink-0 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all"
        style={{
            backgroundColor: active ? maroon : '#fff',
            color:           active ? '#fff' : '#94a3b8',
            border:          active ? `1.5px solid ${maroon}` : '1.5px solid #e2e8f0',
        }}>
        {label}
    </button>
);