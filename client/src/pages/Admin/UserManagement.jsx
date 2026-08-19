import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    Users, ShieldCheck, UserCog, Trash2, Edit3,
    Search, UserPlus, X, QrCode, Eye, EyeOff,
    ChevronDown, AlertTriangle, Download, Briefcase,
} from 'lucide-react';

const YEAR_LEVELS = [
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
    'Grade 11', 'Grade 12',
    '1st Year College', '2nd Year College',
    '3rd Year College', '4th Year College', '5th Year College',
];

const MAROON       = '#7f2d3a';
const MAROON_LIGHT = '#fdf2f3';

const inputCls =
    'w-full bg-white border border-slate-200 hover:border-slate-300 ' +
    'focus:border-[#7f2d3a] focus:ring-4 focus:ring-[#7f2d3a]/8 ' +
    'rounded-xl px-3.5 py-2.5 text-sm text-slate-700 ' +
    'placeholder:text-slate-300 outline-none transition-all duration-150';

const selectCls = inputCls + ' appearance-none cursor-pointer pr-9';

// ── Helpers ────────────────────────────────────────────────────
const isNonScholar = (role) => ['staff', 'officer', 'admin'].includes(role);

const ID_HINT = {
    scholar: 'Auto-generated (AS-YYYY-XXXXXX)',
    staff:   'Auto-generated (AK-YYYY-XXX)',
    officer: 'Auto-generated (AO-YYYY-XXX)',
    admin:   'Auto-generated (AK-YYYY-XXX)',
};

const ID_LABEL = {
    scholar: 'Scholar ID',
    staff:   'Staff ID',
    officer: 'Officer ID',
    admin:   'Admin ID',
};

const getLevelLabel = (role) => role === 'officer' ? 'Officer Level' : 'Year Level';

const formatYearLevelLabel = (value) => {
    if (!value) return 'Unassigned';
    const normalized = String(value).trim().toLowerCase().replace(/_/g, ' ');
    const aliasMap = {
        'grade 7': 'Grade 7',
        'grade 8': 'Grade 8',
        'grade 9': 'Grade 9',
        'grade 10': 'Grade 10',
        'grade 11': 'Grade 11',
        'grade 12': 'Grade 12',
        'college 1': '1st Year College',
        'college 2': '2nd Year College',
        'college 3': '3rd Year College',
        'college 4': '4th Year College',
        'college 5': '5th Year College',
        '1st year college': '1st Year College',
        '2nd year college': '2nd Year College',
        '3rd year college': '3rd Year College',
        '4th year college': '4th Year College',
        '5th year college': '5th Year College',
    };
    return aliasMap[normalized] || value;
};

// ── Atoms ──────────────────────────────────────────────────────
const FieldLabel = ({ label, required, hint }) => (
    <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
            {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-[10px] text-slate-400 normal-case font-normal">{hint}</span>}
    </div>
);

const SelectWrap = ({ children }) => (
    <div className="relative">
        {children}
        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
);

const ErrBox = ({ msg }) => msg ? (
    <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-3.5 py-2.5 rounded-xl">
        <AlertTriangle size={13} className="text-red-400 shrink-0" />
        <p className="text-xs text-red-600 font-medium">{msg}</p>
    </div>
) : null;

const Spinner = () => (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
);

const PrimaryBtn = ({ onClick, disabled, loading, children, full }) => (
    <button onClick={onClick} disabled={disabled || loading}
        className={`${full ? 'w-full' : ''} flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60`}
        style={{ background: `linear-gradient(135deg, ${MAROON}, #a63d4d)`, boxShadow: `0 4px 14px ${MAROON}35` }}>
        {loading ? <><Spinner /> Processing...</> : children}
    </button>
);

const GhostBtn = ({ onClick, children, full }) => (
    <button onClick={onClick}
        className={`${full ? 'w-full' : ''} py-2.5 px-5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all`}>
        {children}
    </button>
);

// ── Modal Shell ────────────────────────────────────────────────
const ModalShell = ({ icon, title, subtitle, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ backgroundColor: 'rgba(10,10,20,0.55)', backdropFilter: 'blur(8px)' }}>
        <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 40px 80px -20px rgba(0,0,0,0.35)' }}>
            <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${MAROON}, #c97080, ${MAROON}44)` }} />
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${MAROON_LIGHT}, #f5e6e8)` }}>
                        <span style={{ color: MAROON }}>{icon}</span>
                    </div>
                    <div>
                        <h3 className="text-[15px] font-bold text-slate-800 leading-tight">{title}</h3>
                        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
                    </div>
                </div>
                <button onClick={onClose}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                    <X size={14} />
                </button>
            </div>
            <div className="h-px bg-slate-100 mx-6" />
            {children}
        </div>
    </div>
);

// ── Create Modal ───────────────────────────────────────────────
const CreateModal = ({ onClose, onSuccess }) => {
    const [form, setForm] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'scholar',
        year_level: '',
    });
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async () => {
        setError('');
        if (!form.full_name || !form.email || !form.password || !form.role) {
            setError('Please fill in all required fields.'); return;
        }
        try {
            setLoading(true);
            const res = await axios.post('http://localhost:5000/api/admin/users', form);
            onSuccess({
                qrCode:     res.data.qrCode,
                full_name:  form.full_name,
                scholar_id: res.data.scholarId || res.data.officerId || res.data.staffId || res.data.adminId,
                role:       form.role,
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Error creating user.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalShell
            icon={<UserPlus size={17} />}
            title="Create New Account"
            subtitle="Fill in the details below to register"
            onClose={onClose}
        >
            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">

                {/* Role selector */}
                <div>
                    <FieldLabel label="Role" required />
                    <SelectWrap>
                        <select className={selectCls} value={form.role}
                            onChange={e => set('role', e.target.value)}>
                            <option value="scholar">Scholar</option>
                            <option value="staff">Staff</option>
                            <option value="officer">Officer</option>
                            <option value="admin">Administrator</option>
                        </select>
                    </SelectWrap>
                </div>

                {/* ID field — auto-generated for ALL roles */}
                <div>
                    <FieldLabel
                        label={ID_LABEL[form.role] || 'ID'}
                        hint={ID_HINT[form.role]}
                    />
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 font-mono">
                        Will be assigned automatically
                    </div>
                </div>

                <div>
                    <FieldLabel label="Full Name" required />
                    <input className={inputCls} placeholder="Juan dela Cruz"
                        value={form.full_name}
                        onChange={e => set('full_name', e.target.value)} />
                </div>

                <div>
                    <FieldLabel label="Email Address" required />
                    <input className={inputCls} type="email" placeholder="juan@school.edu.ph"
                        value={form.email}
                        onChange={e => set('email', e.target.value)} />
                </div>

                <div>
                    <FieldLabel label="Initial Password" required />
                    <div className="relative">
                        <input className={inputCls + ' pr-10'}
                            type={showPw ? 'text' : 'password'}
                            placeholder="Set a strong password"
                            value={form.password}
                            onChange={e => set('password', e.target.value)} />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                </div>

                {/* Assign year level to scholars and officers */}
                {(form.role === 'scholar' || form.role === 'officer') && (
                    <div>
                        <FieldLabel label={getLevelLabel(form.role)} />
                        <SelectWrap>
                            <select className={selectCls} value={form.year_level}
                                onChange={e => set('year_level', e.target.value)}>
                                <option value="">Select year level</option>
                                {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </SelectWrap>
                    </div>
                )}

                <ErrBox msg={error} />
            </div>

            <div className="px-6 pb-6 pt-3 border-t border-slate-100 flex gap-2.5">
                <GhostBtn onClick={onClose} full>Cancel</GhostBtn>
                <PrimaryBtn onClick={handleSubmit} loading={loading} full>
                    Create &amp; Generate QR
                </PrimaryBtn>
            </div>
        </ModalShell>
    );
};

// ── Edit Modal ─────────────────────────────────────────────────
const EditModal = ({ user, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        scholar_id: user.scholar_id || '',
        full_name:  user.full_name  || '',
        email:      user.email      || '',
        password:   '',
        role:       user.role       || 'scholar',
        year_level: user.year_level || '',
        status:     user.status     || 'active',
    });
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async () => {
        setError('');
        try {
            setLoading(true);
            await axios.put(`http://localhost:5000/api/admin/users/${user.id}`, form);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.error || 'Error updating user.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalShell
            icon={<Edit3 size={17} />}
            title="Edit User"
            subtitle={`Updating — ${user.full_name}`}
            onClose={onClose}
        >
            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">

                <div>
                    <FieldLabel label="Full Name" />
                    <input className={inputCls} value={form.full_name}
                        onChange={e => set('full_name', e.target.value)} />
                </div>

                <div>
                    <FieldLabel label="Email Address" />
                    <input className={inputCls} type="email" value={form.email}
                        onChange={e => set('email', e.target.value)} />
                </div>

                <div>
                    <FieldLabel label="New Password" hint="Leave blank to keep" />
                    <div className="relative">
                        <input className={inputCls + ' pr-10'}
                            type={showPw ? 'text' : 'password'}
                            placeholder="Enter new password"
                            value={form.password}
                            onChange={e => set('password', e.target.value)} />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                </div>

                {/* ID — read-only, label per role */}
                <div>
                    <FieldLabel
                        label={ID_LABEL[form.role] || 'ID'}
                        hint="Cannot be changed"
                    />
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-500 font-mono">
                        {form.scholar_id || '—'}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <FieldLabel label="Role" />
                        <SelectWrap>
                            <select className={selectCls} value={form.role}
                                onChange={e => set('role', e.target.value)}>
                                <option value="scholar">Scholar</option>
                                <option value="staff">Staff</option>
                                <option value="officer">Officer</option>
                                <option value="admin">Administrator</option>
                            </select>
                        </SelectWrap>
                    </div>
                    <div>
                        <FieldLabel label="Status" />
                        <SelectWrap>
                            <select className={selectCls} value={form.status}
                                onChange={e => set('status', e.target.value)}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="flagged">Flagged</option>
                            </select>
                        </SelectWrap>
                    </div>
                </div>

                {(form.role === 'scholar' || form.role === 'officer') && (
                    <div>
                        <FieldLabel label={getLevelLabel(form.role)} />
                        <SelectWrap>
                            <select className={selectCls} value={form.year_level}
                                onChange={e => set('year_level', e.target.value)}>
                                <option value="">Select year level</option>
                                {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </SelectWrap>
                    </div>
                )}

                <ErrBox msg={error} />
            </div>

            <div className="px-6 pb-6 pt-3 border-t border-slate-100 flex gap-2.5">
                <GhostBtn onClick={onClose} full>Cancel</GhostBtn>
                <PrimaryBtn onClick={handleSubmit} loading={loading} full>Save Changes</PrimaryBtn>
            </div>
        </ModalShell>
    );
};

// ── QR Modal ───────────────────────────────────────────────────
const QR_BADGE = {
    scholar: null,
    staff:   { cls: 'bg-amber-50 text-amber-600 border-amber-200',     label: 'Staff QR'   },
    officer: { cls: 'bg-emerald-50 text-emerald-600 border-emerald-200', label: 'Officer QR' },
    admin:   { cls: 'bg-violet-50 text-violet-600 border-violet-200',   label: 'Admin QR'   },
};

const QRModal = ({ qrData, onClose }) => {
    const badge = QR_BADGE[qrData.role];

    return (
        <ModalShell
            icon={<QrCode size={17} />}
            title="Event QR Code"
            subtitle="Use for events and activity participation only — not for duty attendance"
            onClose={onClose}
        >
            <div className="px-6 py-6 flex flex-col items-center gap-5">
                <div className="text-center">
                    <p className="font-bold text-slate-800 text-base">{qrData.full_name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                        {ID_LABEL[qrData.role] || 'ID'}: {qrData.scholar_id || '—'}
                    </p>
                    {badge && (
                        <span className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${badge.cls}`}>
                            {badge.label}
                        </span>
                    )}
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-150"
                    style={{ boxShadow: '0 8px 30px rgba(127,45,58,0.10)' }}>
                    {qrData.qr_code || qrData.qrCode
                        ? <img src={qrData.qr_code || qrData.qrCode} alt="QR Code" className="w-48 h-48 rounded-xl" />
                        : <div className="w-48 h-48 flex items-center justify-center text-slate-300 text-xs rounded-xl bg-slate-50">
                            No QR available
                          </div>
                    }
                </div>

                <div className="flex gap-2.5 w-full">
                    <GhostBtn onClick={onClose} full>Close</GhostBtn>
                    <a href={qrData.qr_code || qrData.qrCode}
                        download={`${qrData.scholar_id || 'user'}_event_qr.png`}
                        className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold text-center flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                        style={{ background: `linear-gradient(135deg, ${MAROON}, #a63d4d)`, boxShadow: `0 4px 14px ${MAROON}35` }}>
                        <Download size={14} /> Download
                    </a>
                </div>
            </div>
        </ModalShell>
    );
};

// ── Delete Modal ───────────────────────────────────────────────
const DeleteModal = ({ user, onClose, onConfirm }) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ backgroundColor: 'rgba(10,10,20,0.55)', backdropFilter: 'blur(8px)' }}>
        <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 40px 80px -20px rgba(0,0,0,0.35)' }}>
            <div className="h-[3px] bg-gradient-to-r from-red-500 via-red-400 to-red-300" />
            <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                    <Trash2 size={20} className="text-red-400" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Delete this user?</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    You're about to permanently delete{' '}
                    <span className="font-semibold text-slate-700">{user.full_name}</span>.
                    This action cannot be undone.
                </p>
                <div className="flex gap-2.5 mt-6">
                    <GhostBtn onClick={onClose} full>Cancel</GhostBtn>
                    <button onClick={onConfirm}
                        className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all active:scale-[0.98]">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    </div>
);

// ── Role pill config ───────────────────────────────────────────
const ROLE_CFG = {
    admin:   { cls: 'bg-violet-50 text-violet-600 border border-violet-200',    icon: <UserCog size={10} />,     label: 'Admin'   },
    staff:   { cls: 'bg-amber-50 text-amber-600 border border-amber-200',        icon: <ShieldCheck size={10} />, label: 'Staff'   },
    officer: { cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200',  icon: <Briefcase size={10} />,   label: 'Officer' },
    scholar: { cls: 'bg-sky-50 text-sky-600 border border-sky-200',              icon: <Users size={10} />,       label: 'Scholar' },
};

const STATUS_DOT = {
    active:   'bg-emerald-400',
    flagged:  'bg-red-400 animate-pulse',
    inactive: 'bg-slate-300',
};

const SkeletonRow = () => (
    <tr className="border-b border-slate-50">
        {[40, 52, 64, 28, 24, 20, 30].map((w, i) => (
            <td key={i} className="px-5 py-4">
                <div className="h-3 bg-slate-100 rounded-full animate-pulse" style={{ width: `${w}%` }} />
            </td>
        ))}
    </tr>
);

// ── MAIN ───────────────────────────────────────────────────────
const UserManagement = () => {
    const navigate = useNavigate();
    const [usersList, setUsersList]   = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading]       = useState(true);
    const [modal, setModal]           = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [qrData, setQrData]         = useState(null);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await axios.get('http://localhost:5000/api/admin/users');
            setUsersList(res.data);
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const closeModal = () => setModal(null);

    const handleDelete = async () => {
        try {
            await axios.delete(`http://localhost:5000/api/admin/users/${selectedUser.id}`);
            closeModal();
            fetchUsers();
        } catch (err) {
            console.error(err);
        }
    };

    const handleViewQR = async (user) => {
        try {
            const res = await axios.get(`http://localhost:5000/api/admin/users/${user.id}/qr`);
            setQrData({ ...res.data, role: user.role });
            setModal('qr');
        } catch (err) {
            console.error(err);
        }
    };

    const filtered = usersList.filter(u =>
        [u.full_name, u.email, u.role, u.scholar_id].some(f =>
            f?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <>
            <div className="bg-white rounded-3xl overflow-hidden"
                style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}>

                {/* Top bar */}
                <div className="relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none"
                        style={{ background: `linear-gradient(135deg, ${MAROON_LIGHT} 0%, white 60%)` }} />
                    <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                                style={{ background: `linear-gradient(135deg, ${MAROON}, #a63d4d)`, boxShadow: `0 4px 12px ${MAROON}40` }}>
                                <Users size={18} className="text-white" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-base font-bold text-slate-800 truncate">User Account Registry</h2>
                                <p className="text-[11px] text-slate-400 mt-0.5">Manage credentials, roles &amp; account status</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                                <span className="text-[11px] font-bold text-slate-500">{usersList.length}</span>
                                <span className="text-[11px] text-slate-400">users</span>
                            </div>
                            <div className="relative">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input type="text" placeholder="Search…"
                                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    className="w-36 sm:w-48 pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#7f2d3a] focus:ring-2 focus:ring-[#7f2d3a]/10 transition-all placeholder:text-slate-300 shadow-sm" />
                            </div>
                            <button onClick={() => setModal('create')}
                                className="flex items-center gap-1.5 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all active:scale-95 flex-shrink-0"
                                style={{ background: `linear-gradient(135deg, ${MAROON}, #a63d4d)`, boxShadow: `0 4px 12px ${MAROON}35` }}>
                                <UserPlus size={13} />
                                <span className="hidden sm:inline">New User</span>
                                <span className="sm:hidden">New</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="h-px" style={{ background: `linear-gradient(90deg, ${MAROON}30, transparent)` }} />

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[580px]">
                        <thead>
                            <tr style={{ background: 'linear-gradient(180deg, #fafafa, #f5f5f7)' }}
                                className="border-b border-slate-100">
                                {['ID', 'Full Name', 'Email', 'Role', 'Assigned Level', 'Status', 'Actions'].map((h, i) => (
                                    <th key={h}
                                        className={`px-5 py-3 text-[10px] font-bold uppercase tracking-widest ${i === 6 ? 'text-center' : ''}`}
                                        style={{ color: i === 0 ? MAROON : '#94a3b8' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading
                                ? Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)
                                : filtered.length > 0
                                    ? filtered.map((user) => {
                                        const badge = ROLE_CFG[user.role] || ROLE_CFG.scholar;
                                        return (
                                            <tr key={user.id}
                                                className="border-b border-slate-50 hover:bg-[#fdf2f3]/40 transition-colors group">
                                                <td className="px-5 py-3.5">
                                                    <div>
                                                        <span className="font-mono text-xs font-bold" style={{ color: MAROON }}>
                                                            {user.scholar_id || <span className="text-slate-300 font-normal">—</span>}
                                                        </span>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                                            {ID_LABEL[user.role] || 'ID'}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                                            style={{ background: `linear-gradient(135deg, ${MAROON}bb, #a63d4d)` }}>
                                                            {user.full_name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-semibold text-slate-700">{user.full_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-400">{user.email}</td>
                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}>
                                                        {badge.icon}{badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-500">
                                                    {formatYearLevelLabel(user.year_level)}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        {/* View Profile — scholars only */}
                                                        {user.role === 'scholar' && (
                                                            <button
                                                                onClick={() => navigate(`/admin/scholars/${user.id}`)}
                                                                title="View Profile"
                                                                className="p-1.5 rounded-lg text-slate-300 transition-all"
                                                                onMouseEnter={e => { e.currentTarget.style.background = '#F5E8EA'; e.currentTarget.style.color = MAROON; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; }}>
                                                                <Eye size={13} />
                                                            </button>
                                                        )}
                                                        {/* QR — scholars only */}
                                                        {user.role === 'scholar' && (
                                                            <button
                                                                onClick={() => handleViewQR(user)}
                                                                title="View Event QR (for events/participation only)"
                                                                className="p-1.5 rounded-lg text-slate-300 hover:bg-blue-50 hover:text-blue-500 transition-all">
                                                                <QrCode size={13} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => { setSelectedUser(user); setModal('edit'); }}
                                                            title="Edit"
                                                            className="p-1.5 rounded-lg text-slate-300 hover:bg-amber-50 hover:text-amber-500 transition-all">
                                                            <Edit3 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => { setSelectedUser(user); setModal('delete'); }}
                                                            title="Delete"
                                                            className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                    : (
                                        <tr>
                                            <td colSpan="7" className="py-16 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-1"
                                                        style={{ background: MAROON_LIGHT }}>
                                                        <Users size={22} style={{ color: MAROON }} strokeWidth={1.5} />
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-400">No users found</p>
                                                    <p className="text-xs text-slate-300">Try adjusting your search query</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                            }
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between"
                    style={{ background: 'linear-gradient(180deg, #fafafa, white)' }}>
                    <span className="text-[11px] text-slate-400">
                        Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of{' '}
                        <span className="font-semibold text-slate-600">{usersList.length}</span> users
                    </span>
                    <span className="text-[10px] text-slate-300 font-mono uppercase tracking-widest hidden sm:block">
                        Data Privacy Certified
                    </span>
                </div>
            </div>

            {/* Modals */}
            {modal === 'create' && (
                <CreateModal
                    onClose={closeModal}
                    onSuccess={(qr) => { setQrData(qr); fetchUsers(); setModal('qr'); }}
                />
            )}
            {modal === 'edit' && selectedUser && (
                <EditModal
                    user={selectedUser}
                    onClose={closeModal}
                    onSuccess={() => { closeModal(); fetchUsers(); }}
                />
            )}
            {modal === 'qr' && qrData && (
                <QRModal qrData={qrData} onClose={closeModal} />
            )}
            {modal === 'delete' && selectedUser && (
                <DeleteModal user={selectedUser} onClose={closeModal} onConfirm={handleDelete} />
            )}
        </>
    );
};

export default UserManagement;