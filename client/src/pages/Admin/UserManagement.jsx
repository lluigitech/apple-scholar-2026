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

// ── Brand tokens — shared across Scholar / Officer / Staff / Admin portals ──
const MAROON      = '#7A2E3A';
const MAROON_DEEP = '#3D1219';
const GOLD        = '#B08D4F';
const IVORY       = '#FAF7F2';
const INK         = '#241512';
const LINE        = '#E8DFD6';
const TINT        = '#F6E9EA'; // light maroon tint — replaces old flat ROSE
const SAGE  = '#15803d';
const CLAY  = '#991b1b';
const AMBER = '#92400e';

const display = { fontFamily: "'Fraunces', serif" };
const body    = { fontFamily: "'Inter', sans-serif" };
const mono    = { fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" };

// ── Woven rule — signature motif, reused across the portal. Color carries
// meaning here: gold for standard actions, clay for destructive ones —
// so the one recurring pattern also encodes what kind of screen you're on.
const weavePattern = (color, opacity = 1) => ({
    height: 4,
    opacity,
    backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 2px, transparent 2px 7px),
                       repeating-linear-gradient(-45deg, ${color} 0 2px, transparent 2px 7px)`,
});
const WeaveRule = ({ color = GOLD, opacity = 0.85 }) => <div style={weavePattern(color, opacity)} />;

const inputCls =
    'w-full bg-white hover:border-[#d8c9c2] ' +
    'focus:ring-4 ' +
    'rounded-lg px-3.5 py-2.5 text-sm ' +
    'outline-none transition-all duration-150';
const inputStyle = { ...body, color: INK, border: `1px solid ${LINE}` };

const selectCls = inputCls + ' appearance-none cursor-pointer pr-9';

// ── Helpers ────────────────────────────────────────────────────
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
        <label style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: '#A15E6B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}{required && <span style={{ color: CLAY, marginLeft: 2 }}>*</span>}
        </label>
        {hint && <span style={{ ...body, fontSize: '0.64rem', color: '#c9b9b0' }}>{hint}</span>}
    </div>
);

const SelectWrap = ({ children }) => (
    <div className="relative">
        {children}
        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#a89890' }} />
    </div>
);

const ErrBox = ({ msg }) => msg ? (
    <div className="flex items-center gap-2 rounded-lg" style={{ background: `${CLAY}12`, border: `1px solid ${CLAY}40`, padding: '10px 14px' }}>
        <AlertTriangle size={13} style={{ color: CLAY, flexShrink: 0 }} />
        <p style={{ ...body, fontSize: '0.76rem', color: CLAY, fontWeight: 600 }}>{msg}</p>
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
        className={`${full ? 'w-full' : ''} flex items-center justify-center gap-2 py-2.5 px-5 rounded-full transition-all active:scale-[0.98] disabled:opacity-60`}
        style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: '#fff', border: 'none', background: MAROON, cursor: loading ? 'default' : 'pointer' }}>
        {loading ? <><Spinner /> Processing...</> : children}
    </button>
);

const GhostBtn = ({ onClick, children, full }) => (
    <button onClick={onClick}
        className={`${full ? 'w-full' : ''} py-2.5 px-5 rounded-full transition-colors hover:bg-[#faf7f2]`}
        style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: '#6b6058', border: `1px solid ${LINE}`, background: '#fff', cursor: 'pointer' }}>
        {children}
    </button>
);

// ── Modal Shell ────────────────────────────────────────────────
const ModalShell = ({ icon, title, subtitle, onClose, children, ruleColor = GOLD }) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ backgroundColor: 'rgba(20,10,12,0.55)', backdropFilter: 'blur(6px)' }}>
        <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 30px 60px -20px rgba(36,21,18,0.4)' }}>
            <WeaveRule color={ruleColor} />
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: TINT }}>
                        <span style={{ color: MAROON }}>{icon}</span>
                    </div>
                    <div>
                        <h3 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK, lineHeight: 1.2 }}>{title}</h3>
                        {subtitle && <p style={{ ...body, fontSize: '0.72rem', color: '#a89890', marginTop: 2 }}>{subtitle}</p>}
                    </div>
                </div>
                <button onClick={onClose}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[#faf7f2]"
                    style={{ color: '#a89890', border: 'none', background: 'none', cursor: 'pointer' }}>
                    <X size={14} />
                </button>
            </div>
            <div style={{ height: 1, background: LINE, margin: '0 24px' }} />
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
            const token = localStorage.getItem('token');
            const res = await axios.post('http://localhost:5000/api/admin/users', form, {
                headers: { Authorization: `Bearer ${token}` }
            });
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

                <div>
                    <FieldLabel label="Role" required />
                    <SelectWrap>
                        <select className={selectCls} style={inputStyle} value={form.role}
                            onChange={e => set('role', e.target.value)}>
                            <option value="scholar">Scholar</option>
                            <option value="staff">Staff</option>
                            <option value="officer">Officer</option>
                            <option value="admin">Administrator</option>
                        </select>
                    </SelectWrap>
                </div>

                <div>
                    <FieldLabel label={ID_LABEL[form.role] || 'ID'} hint={ID_HINT[form.role]} />
                    <div className="rounded-lg px-3.5 py-2.5" style={{ background: IVORY, border: `1px solid ${LINE}`, ...mono, fontSize: '0.82rem', color: '#a89890' }}>
                        Will be assigned automatically
                    </div>
                </div>

                <div>
                    <FieldLabel label="Full Name" required />
                    <input className={inputCls} style={inputStyle} placeholder="Juan dela Cruz"
                        value={form.full_name}
                        onChange={e => set('full_name', e.target.value)} />
                </div>

                <div>
                    <FieldLabel label="Email Address" required />
                    <input className={inputCls} style={inputStyle} type="email" placeholder="juan@school.edu.ph"
                        value={form.email}
                        onChange={e => set('email', e.target.value)} />
                </div>

                <div>
                    <FieldLabel label="Initial Password" required />
                    <div className="relative">
                        <input className={inputCls + ' pr-10'} style={inputStyle}
                            type={showPw ? 'text' : 'password'}
                            placeholder="Set a strong password"
                            value={form.password}
                            onChange={e => set('password', e.target.value)} />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                            style={{ color: '#a89890', background: 'none', border: 'none', cursor: 'pointer' }}>
                            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                </div>

                {(form.role === 'scholar' || form.role === 'officer') && (
                    <div>
                        <FieldLabel label={getLevelLabel(form.role)} />
                        <SelectWrap>
                            <select className={selectCls} style={inputStyle} value={form.year_level}
                                onChange={e => set('year_level', e.target.value)}>
                                <option value="">Select year level</option>
                                {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </SelectWrap>
                    </div>
                )}

                <ErrBox msg={error} />
            </div>

            <div className="px-6 pb-6 pt-3 flex gap-2.5" style={{ borderTop: `1px solid ${LINE}` }}>
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
            const token = localStorage.getItem('token');
            await axios.put(`http://localhost:5000/api/admin/users/${user.id}`, form, {
                headers: { Authorization: `Bearer ${token}` }
            });
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
                    <input className={inputCls} style={inputStyle} value={form.full_name}
                        onChange={e => set('full_name', e.target.value)} />
                </div>

                <div>
                    <FieldLabel label="Email Address" />
                    <input className={inputCls} style={inputStyle} type="email" value={form.email}
                        onChange={e => set('email', e.target.value)} />
                </div>

                <div>
                    <FieldLabel label="New Password" hint="Leave blank to keep" />
                    <div className="relative">
                        <input className={inputCls + ' pr-10'} style={inputStyle}
                            type={showPw ? 'text' : 'password'}
                            placeholder="Enter new password"
                            value={form.password}
                            onChange={e => set('password', e.target.value)} />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                            style={{ color: '#a89890', background: 'none', border: 'none', cursor: 'pointer' }}>
                            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                </div>

                <div>
                    <FieldLabel label={ID_LABEL[form.role] || 'ID'} hint="Cannot be changed" />
                    <div className="rounded-lg px-3.5 py-2.5" style={{ background: IVORY, border: `1px solid ${LINE}`, ...mono, fontSize: '0.82rem', color: '#6b6058' }}>
                        {form.scholar_id || '—'}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <FieldLabel label="Role" />
                        <SelectWrap>
                            <select className={selectCls} style={inputStyle} value={form.role}
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
                            <select className={selectCls} style={inputStyle} value={form.status}
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
                            <select className={selectCls} style={inputStyle} value={form.year_level}
                                onChange={e => set('year_level', e.target.value)}>
                                <option value="">Select year level</option>
                                {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </SelectWrap>
                    </div>
                )}

                <ErrBox msg={error} />
            </div>

            <div className="px-6 pb-6 pt-3 flex gap-2.5" style={{ borderTop: `1px solid ${LINE}` }}>
                <GhostBtn onClick={onClose} full>Cancel</GhostBtn>
                <PrimaryBtn onClick={handleSubmit} loading={loading} full>Save Changes</PrimaryBtn>
            </div>
        </ModalShell>
    );
};

// ── QR Modal ───────────────────────────────────────────────────
const QR_BADGE = {
    scholar: null,
    staff:   { color: AMBER,  label: 'Staff QR'   },
    officer: { color: SAGE,   label: 'Officer QR' },
    admin:   { color: MAROON, label: 'Admin QR'   },
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
                    <p style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>{qrData.full_name}</p>
                    <p style={{ ...mono, fontSize: '0.74rem', color: '#a89890', marginTop: 4 }}>
                        {ID_LABEL[qrData.role] || 'ID'}: {qrData.scholar_id || '—'}
                    </p>
                    {badge && (
                        <span className="inline-block rounded-full" style={{ marginTop: 8, ...body, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 12px', background: `${badge.color}16`, color: badge.color, border: `1px solid ${badge.color}45` }}>
                            {badge.label}
                        </span>
                    )}
                </div>

                <div className="p-3 rounded-xl" style={{ background: '#fff', border: `1px solid ${LINE}` }}>
                    {qrData.qr_code || qrData.qrCode
                        ? <img src={qrData.qr_code || qrData.qrCode} alt="QR Code" className="w-48 h-48 rounded-lg" />
                        : <div className="w-48 h-48 flex items-center justify-center rounded-lg" style={{ color: '#c9b9b0', ...body, fontSize: '0.78rem', background: IVORY }}>
                            No QR available
                          </div>
                    }
                </div>

                <div className="flex gap-2.5 w-full">
                    <GhostBtn onClick={onClose} full>Close</GhostBtn>
                    <a href={qrData.qr_code || qrData.qrCode}
                        download={`${qrData.scholar_id || 'user'}_event_qr.png`}
                        className="flex-1 py-2.5 rounded-full flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 active:scale-[0.98]"
                        style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: '#fff', background: MAROON }}>
                        <Download size={14} /> Download
                    </a>
                </div>
            </div>
        </ModalShell>
    );
};

// ── Delete Modal ── uses the same ModalShell, ruleColor=CLAY marks it as
// the destructive action — the pattern stays consistent, only the color
// of the pattern changes to signal severity.
const DeleteModal = ({ user, onClose, onConfirm }) => (
    <ModalShell
        icon={<Trash2 size={17} />}
        title="Delete this user?"
        onClose={onClose}
        ruleColor={CLAY}
    >
        <div className="px-6 pb-6 pt-2 text-center">
            <p style={{ ...body, fontSize: '0.78rem', color: '#a89890', lineHeight: 1.6 }}>
                You're about to permanently delete{' '}
                <span style={{ fontWeight: 700, color: '#6b6058' }}>{user.full_name}</span>.
                This action cannot be undone.
            </p>
            <div className="flex gap-2.5 mt-5">
                <GhostBtn onClick={onClose} full>Cancel</GhostBtn>
                <button onClick={onConfirm}
                    className="flex-1 py-2.5 rounded-full transition-opacity hover:opacity-90"
                    style={{ ...body, fontSize: '0.85rem', fontWeight: 600, background: CLAY, color: '#fff', border: 'none', cursor: 'pointer' }}>
                    Delete
                </button>
            </div>
        </div>
    </ModalShell>
);

// ── Role pill config ───────────────────────────────────────────
const ROLE_CFG = {
    admin:   { color: MAROON, icon: <UserCog size={10} />,     label: 'Admin'   },
    staff:   { color: AMBER,  icon: <ShieldCheck size={10} />, label: 'Staff'   },
    officer: { color: SAGE,   icon: <Briefcase size={10} />,   label: 'Officer' },
    scholar: { color: GOLD,   icon: <Users size={10} />,       label: 'Scholar' },
};

const STATUS_DOT = {
    active:   SAGE,
    flagged:  CLAY,
    inactive: '#c9b9b0',
};

const SkeletonRow = () => (
    <tr style={{ borderTop: `1px solid ${LINE}` }}>
        {[40, 52, 64, 28, 24, 20, 30].map((w, i) => (
            <td key={i} className="px-5 py-4">
                <div className="h-3 rounded-full animate-pulse" style={{ width: `${w}%`, background: IVORY }} />
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
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/admin/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
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
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/admin/users/${selectedUser.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            closeModal();
            fetchUsers();
        } catch (err) {
            console.error(err);
        }
    };

    const handleViewQR = async (user) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/admin/users/${user.id}/qr`, {
                headers: { Authorization: `Bearer ${token}` }
            });
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
            <div className="rounded-xl overflow-hidden bg-white" style={{ border: `1px solid ${LINE}` }}>

                {/* Top bar */}
                <div>
                    <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: TINT }}>
                        <div className="flex-1 flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: MAROON }}>
                                <Users size={18} style={{ color: '#fff' }} />
                            </div>
                            <div className="min-w-0">
                                <h2 style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK }} className="truncate">User Account Registry</h2>
                                <p style={{ ...body, fontSize: '0.72rem', color: '#A15E6B', marginTop: 2 }}>Manage credentials, roles &amp; account status</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: '#fff', border: `1px solid ${LINE}` }}>
                                <span style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: MAROON }}>{usersList.length}</span>
                                <span style={{ ...body, fontSize: '0.72rem', color: '#a89890' }}>users</span>
                            </div>
                            <div className="relative">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#a89890' }} />
                                <input type="text" placeholder="Search…"
                                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    className="w-36 sm:w-48 pl-8 pr-3 py-2 rounded-full outline-none"
                                    style={{ ...body, fontSize: '0.78rem', background: '#fff', border: `1px solid ${LINE}`, color: INK }} />
                            </div>
                            <button onClick={() => setModal('create')}
                                className="flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-90 active:scale-95 flex-shrink-0"
                                style={{ ...body, fontSize: '0.76rem', fontWeight: 600, color: '#fff', padding: '9px 14px', border: 'none', background: MAROON, cursor: 'pointer' }}>
                                <UserPlus size={13} />
                                <span className="hidden sm:inline">New User</span>
                                <span className="sm:hidden">New</span>
                            </button>
                        </div>
                    </div>
                    <WeaveRule color={GOLD} opacity={0.7} />
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[580px]">
                        <thead>
                            <tr style={{ background: IVORY, borderBottom: `1px solid ${LINE}` }}>
                                {['ID', 'Full Name', 'Email', 'Role', 'Assigned Level', 'Status', 'Actions'].map((h, i) => (
                                    <th key={h}
                                        className={`px-5 py-3 ${i === 6 ? 'text-center' : 'text-left'}`}
                                        style={{ ...body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: i === 0 ? MAROON : '#a89890' }}>
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
                                            <tr key={user.id} className="transition-colors hover:bg-[#faf7f2]" style={{ borderTop: `1px solid ${LINE}` }}>
                                                <td className="px-5 py-3.5">
                                                    <div>
                                                        <span style={{ ...mono, fontSize: '0.76rem', fontWeight: 700, color: MAROON }}>
                                                            {user.scholar_id || <span style={{ color: '#c9b9b0', fontWeight: 400 }}>—</span>}
                                                        </span>
                                                        <p style={{ ...body, fontSize: '0.64rem', color: '#a89890', marginTop: 2 }}>{ID_LABEL[user.role] || 'ID'}</p>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: MAROON, color: '#fff', ...body, fontSize: '0.66rem', fontWeight: 700 }}>
                                                            {user.full_name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }}>{user.full_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5" style={{ ...body, fontSize: '0.76rem', color: '#a89890' }}>{user.email}</td>
                                                <td className="px-5 py-3.5">
                                                    <span className="inline-flex items-center gap-1 rounded-full" style={{ ...body, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 9px', background: `${badge.color}16`, color: badge.color, border: `1px solid ${badge.color}40` }}>
                                                        {badge.icon}{badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5" style={{ ...body, fontSize: '0.76rem', color: '#6b6058' }}>
                                                    {formatYearLevelLabel(user.year_level)}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span className="inline-flex items-center gap-1.5" style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: '#6b6058', textTransform: 'capitalize' }}>
                                                        <span className={user.status === 'flagged' ? 'animate-pulse' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[user.status] || STATUS_DOT.inactive, flexShrink: 0 }} />
                                                        {user.status || 'active'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        {user.role === 'scholar' && (
                                                            <button
                                                                onClick={() => navigate(`/admin/scholars/${user.id}`)}
                                                                title="View Profile"
                                                                className="p-1.5 rounded-lg transition-colors"
                                                                style={{ color: '#c9b9b0', background: 'none', border: 'none', cursor: 'pointer' }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = TINT; e.currentTarget.style.color = MAROON; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9b9b0'; }}>
                                                                <Eye size={13} />
                                                            </button>
                                                        )}
                                                        {user.role === 'scholar' && (
                                                            <button
                                                                onClick={() => handleViewQR(user)}
                                                                title="View Event QR (for events/participation only)"
                                                                className="p-1.5 rounded-lg transition-colors"
                                                                style={{ color: '#c9b9b0', background: 'none', border: 'none', cursor: 'pointer' }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = `${SAGE}16`; e.currentTarget.style.color = SAGE; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9b9b0'; }}>
                                                                <QrCode size={13} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => { setSelectedUser(user); setModal('edit'); }}
                                                            title="Edit"
                                                            className="p-1.5 rounded-lg transition-colors"
                                                            style={{ color: '#c9b9b0', background: 'none', border: 'none', cursor: 'pointer' }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = `${AMBER}16`; e.currentTarget.style.color = AMBER; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9b9b0'; }}>
                                                            <Edit3 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => { setSelectedUser(user); setModal('delete'); }}
                                                            title="Delete"
                                                            className="p-1.5 rounded-lg transition-colors"
                                                            style={{ color: '#c9b9b0', background: 'none', border: 'none', cursor: 'pointer' }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = `${CLAY}16`; e.currentTarget.style.color = CLAY; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9b9b0'; }}>
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
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-1" style={{ background: TINT }}>
                                                        <Users size={22} style={{ color: MAROON }} strokeWidth={1.5} />
                                                    </div>
                                                    <p style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: '#a89890' }}>No users found</p>
                                                    <p style={{ ...body, fontSize: '0.76rem', color: '#c9b9b0' }}>Try adjusting your search query</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                            }
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 flex items-center justify-between" style={{ borderTop: `1px solid ${LINE}`, background: IVORY }}>
                    <span style={{ ...body, fontSize: '0.72rem', color: '#a89890' }}>
                        Showing <span style={{ fontWeight: 700, color: '#6b6058' }}>{filtered.length}</span> of{' '}
                        <span style={{ fontWeight: 700, color: '#6b6058' }}>{usersList.length}</span> users
                    </span>
                    <span className="hidden sm:block" style={{ ...mono, fontSize: '0.62rem', color: '#c9b9b0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
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