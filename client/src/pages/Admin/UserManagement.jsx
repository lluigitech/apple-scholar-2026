import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    Users, ShieldCheck, UserCog, Trash2, Edit3, Archive,
    Search, UserPlus, X, Eye, EyeOff,
    ChevronDown, ChevronLeft, ChevronRight, AlertTriangle, Download, Briefcase, QrCode,
    Layers, RotateCcw, RefreshCw,
} from 'lucide-react';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

const YEAR_LEVELS = [
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
    'Grade 11', 'Grade 12',
    '1st Year College', '2nd Year College',
    '3rd Year College', '4th Year College', '5th Year College',
];

// ── Token system — Executive Identity & Access Center ─────────────
const BG           = '#F7F4EE';
const SURFACE      = '#FFFDF9';
const BORDER       = '#E7D8C7';

const PRIMARY      = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const PRIMARY_TINT = '#F3E7EC';

const INK           = '#241512';
const MUTED         = '#8A7A68';
const BRONZE        = '#A9784E';
const ROSE          = '#B5657A';

const SUCCESS       = '#6B8F71';
const WARNING       = '#C08A3E';
const DANGER        = '#A24A4A';

const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', serif" };
const sans    = { fontFamily: "'Inter', sans-serif" };
const mono    = { fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace" };

const cardStyle = {
    background: SURFACE,
    borderRadius: RADIUS,
    border: `1px solid ${BORDER}`,
};

const nowrap = { whiteSpace: 'nowrap' };
const tabularNums = { fontVariantNumeric: 'tabular-nums' };

const inputCls =
    'gs-input w-full bg-white rounded-lg px-3.5 outline-none transition-colors duration-150';
const inputStyle = { ...sans, fontSize: '0.85rem', color: INK, border: `1px solid ${BORDER}`, height: 48 };
const selectCls = inputCls + ' gs-select appearance-none cursor-pointer pr-9';

// ── Helpers ────────────────────────────────────────────────────
const ID_HINT = {
    scholar: 'Auto-generated (SCH-YYYY-0001)',
    staff:   'Auto-generated (STF-YYYY-0001)',
    officer: 'Auto-generated (OFF-YYYY-0001)',
    admin:   'Auto-generated (ADM-YYYY-0001)',
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
        <label style={{ ...sans, fontSize: '0.72rem', fontWeight: 600, color: MUTED }}>
            {label}{required && <span style={{ color: DANGER, marginLeft: 2 }}>*</span>}
        </label>
        {hint && <span style={{ ...sans, fontSize: '0.66rem', color: '#B8AA9B' }}>{hint}</span>}
    </div>
);

const SelectWrap = ({ children }) => (
    <div className="relative">
        {children}
        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED }} />
    </div>
);

const ErrBox = ({ msg }) => msg ? (
    <div className="flex items-center gap-2 rounded-lg" style={{ background: `${DANGER}0f`, border: `1px solid ${DANGER}35`, padding: '10px 14px' }}>
        <AlertTriangle size={13} style={{ color: DANGER, flexShrink: 0 }} />
        <p style={{ ...sans, fontSize: '0.78rem', color: DANGER, fontWeight: 600 }}>{msg}</p>
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
        className={`${full ? 'w-full' : ''} flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg transition-colors active:scale-[0.98] disabled:opacity-60`}
        style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, color: '#fff', border: 'none', background: PRIMARY, cursor: loading ? 'default' : 'pointer' }}
        onMouseEnter={e => !loading && (e.currentTarget.style.background = PRIMARY_DEEP)}
        onMouseLeave={e => (e.currentTarget.style.background = PRIMARY)}>
        {loading ? <><Spinner /> Processing...</> : children}
    </button>
);

const GhostBtn = ({ onClick, children, full }) => (
    <button onClick={onClick}
        className={`${full ? 'w-full' : ''} py-2.5 px-5 rounded-lg transition-colors hover:bg-[#F7F4EE]`}
        style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, color: MUTED, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer' }}>
        {children}
    </button>
);

// ── Modal Shell ────────────────────────────────────────────────
const ModalShell = ({ icon, title, subtitle, onClose, children, accent = PRIMARY }) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ backgroundColor: 'rgba(36,21,18,0.45)', backdropFilter: 'blur(4px)' }}>
        <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}14` }}>
                        <span style={{ color: accent }}>{icon}</span>
                    </div>
                    <div className="min-w-0">
                        <h3 style={{ ...display, fontSize: '1.15rem', fontWeight: 700, color: INK, lineHeight: 1.2 }}>{title}</h3>
                        {subtitle && <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 2 }} className="truncate">{subtitle}</p>}
                    </div>
                </div>
                <button onClick={onClose}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[#F7F4EE] flex-shrink-0"
                    style={{ color: MUTED, border: 'none', background: 'none', cursor: 'pointer' }}>
                    <X size={14} />
                </button>
            </div>
            <div style={{ height: 1, background: BORDER, margin: '0 24px' }} />
            {children}
        </div>
    </div>
);

const SectionLabel = ({ children }) => (
    <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.06em', marginBottom: 10 }}>
        {children}
    </p>
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
            title="New registry entry"
            subtitle="Add a credential to the account registry"
            onClose={onClose}
        >
            <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">

                <div>
                    <SectionLabel>ACCOUNT INFORMATION</SectionLabel>
                    <div className="space-y-4">
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
                            <FieldLabel label="Full name" required />
                            <input className={inputCls} style={inputStyle} placeholder="Juan dela Cruz"
                                value={form.full_name}
                                onChange={e => set('full_name', e.target.value)} />
                        </div>
                        <div>
                            <FieldLabel label="Email address" required />
                            <input className={inputCls} style={inputStyle} type="email" placeholder="juan@school.edu.ph"
                                value={form.email}
                                onChange={e => set('email', e.target.value)} />
                        </div>
                    </div>
                </div>

                <div>
                    <SectionLabel>SECURITY</SectionLabel>
                    <div className="space-y-4">
                        <div>
                            <FieldLabel label="Initial password" required />
                            <div className="relative">
                                <input className={inputCls + ' pr-10'} style={inputStyle}
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="Set a strong password"
                                    value={form.password}
                                    onChange={e => set('password', e.target.value)} />
                                <button type="button" onClick={() => setShowPw(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: MUTED, background: 'none', border: 'none', cursor: 'pointer' }}>
                                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <FieldLabel label={ID_LABEL[form.role] || 'ID'} hint={ID_HINT[form.role]} />
                            <div className="rounded-lg px-3.5 flex items-center" style={{ height: 48, background: BG, border: `1px solid ${BORDER}`, ...mono, fontSize: '0.82rem', color: MUTED }}>
                                Will be assigned automatically
                            </div>
                        </div>
                    </div>
                </div>

                {(form.role === 'scholar' || form.role === 'officer') && (
                    <div>
                        <SectionLabel>ACADEMIC ASSIGNMENT</SectionLabel>
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
                    </div>
                )}

                <ErrBox msg={error} />
            </div>

            <div className="px-6 pb-6 pt-3 flex gap-2.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                <GhostBtn onClick={onClose} full>Cancel</GhostBtn>
                <PrimaryBtn onClick={handleSubmit} loading={loading} full>
                    Create User
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
            title="Edit entry"
            subtitle={`Updating — ${user.full_name}`}
            onClose={onClose}
            accent={WARNING}
        >
            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">

                <div>
                    <FieldLabel label="Full name" />
                    <input className={inputCls} style={inputStyle} value={form.full_name}
                        onChange={e => set('full_name', e.target.value)} />
                </div>

                <div>
                    <FieldLabel label="Email address" />
                    <input className={inputCls} style={inputStyle} type="email" value={form.email}
                        onChange={e => set('email', e.target.value)} />
                </div>

                <div>
                    <FieldLabel label="New password" hint="Leave blank to keep" />
                    <div className="relative">
                        <input className={inputCls + ' pr-10'} style={inputStyle}
                            type={showPw ? 'text' : 'password'}
                            placeholder="Enter new password"
                            value={form.password}
                            onChange={e => set('password', e.target.value)} />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                            style={{ color: MUTED, background: 'none', border: 'none', cursor: 'pointer' }}>
                            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                </div>

                <div>
                    <FieldLabel label={ID_LABEL[form.role] || 'ID'} hint="Read-only" />
                    <div className="rounded-lg px-3.5 flex items-center" style={{ height: 48, background: BG, border: `1px solid ${BORDER}`, ...mono, fontSize: '0.82rem', color: MUTED }}>
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

            <div className="px-6 pb-6 pt-3 flex gap-2.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                <GhostBtn onClick={onClose} full>Cancel</GhostBtn>
                <PrimaryBtn onClick={handleSubmit} loading={loading} full>Save changes</PrimaryBtn>
            </div>
        </ModalShell>
    );
};

// ── QR Modal ───────────────────────────────────────────────────
const QR_BADGE = {
    scholar: null,
    staff:   { color: WARNING,      label: 'Staff QR'   },
    officer: { color: SUCCESS,      label: 'Officer QR' },
    admin:   { color: PRIMARY_DEEP, label: 'Admin QR'   },
};

const QRModal = ({ qrData, onClose }) => {
    const badge = QR_BADGE[qrData.role];

    return (
        <ModalShell
            icon={<QrCode size={17} />}
            title="Event QR code"
            subtitle="For events and activity participation only — not duty attendance"
            onClose={onClose}
        >
            <div className="px-6 py-6 flex flex-col items-center gap-5">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: PRIMARY_TINT, color: PRIMARY, ...sans, fontSize: '0.9rem', fontWeight: 700 }}>
                        {qrData.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                        <p style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: INK, lineHeight: 1.2 }}>{qrData.full_name}</p>
                        <p style={{ ...mono, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>
                            {ID_LABEL[qrData.role] || 'ID'}: {qrData.scholar_id || '—'}
                        </p>
                    </div>
                </div>

                {badge && (
                    <span className="inline-block rounded-full" style={{ ...sans, fontSize: '0.64rem', fontWeight: 700, padding: '4px 12px', background: `${badge.color}14`, color: badge.color, border: `1px solid ${badge.color}35` }}>
                        {badge.label}
                    </span>
                )}

                <div className="p-3" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
                    {qrData.qr_code || qrData.qrCode
                        ? <img src={qrData.qr_code || qrData.qrCode} alt="QR Code" className="w-48 h-48 rounded-lg" />
                        : <div className="w-48 h-48 flex items-center justify-center rounded-lg" style={{ color: '#B8AA9B', ...sans, fontSize: '0.8rem', background: BG }}>
                            No QR available
                          </div>
                    }
                </div>

                <div className="flex gap-2.5 w-full">
                    <GhostBtn onClick={onClose} full>Close</GhostBtn>
                    <a href={qrData.qr_code || qrData.qrCode}
                        download={`${qrData.scholar_id || 'user'}_event_qr.png`}
                        className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors hover:bg-[#4A1730]"
                        style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, color: '#fff', background: PRIMARY }}>
                        <Download size={14} /> Download
                    </a>
                </div>
            </div>
        </ModalShell>
    );
};

// ── Archive Modal ──────────────────────────────────────────────
const ArchiveModal = ({ user, onClose, onConfirm, loading, error }) => (
    <ModalShell
        icon={<Archive size={17} />}
        title="Archive this scholar?"
        subtitle={user.full_name}
        onClose={onClose}
        accent={BRONZE}
    >
        <div className="px-6 pb-6 pt-2">
            <p style={{ ...sans, fontSize: '0.82rem', color: MUTED, lineHeight: 1.6 }}>
                You&apos;re about to move <span style={{ fontWeight: 700, color: INK }}>{user.full_name}</span> to the archived scholar records. Their historical information should remain preserved and will no longer appear in the active user registry.
            </p>
            <ErrBox msg={error} />
            <div className="flex gap-2.5 mt-5">
                <GhostBtn onClick={onClose} full>Cancel</GhostBtn>
                <button type="button" onClick={onConfirm} disabled={loading}
                    className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors hover:bg-[#4A1730] disabled:opacity-60"
                    style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, background: PRIMARY, color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer' }}>
                    {loading ? <><Spinner /> Archiving…</> : <><Archive size={14} /> Archive Scholar</>}
                </button>
            </div>
        </div>
    </ModalShell>
);

// ── Delete Modal ───────────────────────────────────────────────
const DeleteModal = ({ user, onClose, onConfirm, loading, error }) => (
    <ModalShell
        icon={<Trash2 size={17} />}
        title="Delete this account?"
        onClose={onClose}
        accent={DANGER}
    >
        <div className="px-6 pb-6 pt-2 text-center">
            <p style={{ ...sans, fontSize: '0.82rem', color: MUTED, lineHeight: 1.6 }}>
                This will mark <span style={{ fontWeight: 700, color: INK }}>{user.full_name}</span> as inactive in the registry.
                The current backend behavior marks the account inactive rather than permanently removing its record.
            </p>
            <ErrBox msg={error} />
            <div className="flex gap-2.5 mt-5">
                <GhostBtn onClick={onClose} full>Cancel</GhostBtn>
                <button onClick={onConfirm} disabled={loading}
                    className="flex-1 py-2.5 rounded-lg transition-colors hover:opacity-90 disabled:opacity-60"
                    style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, background: `${DANGER}14`, color: DANGER, border: `1px solid ${DANGER}40`, cursor: loading ? 'default' : 'pointer' }}>
                    {loading ? 'Processing…' : 'Delete'}
                </button>
            </div>
        </div>
    </ModalShell>
);

// ── Role config ────────────────────────────────────────────────
const ROLE_CFG = {
    admin:   { color: PRIMARY,      icon: <UserCog size={10} />,     label: 'Admin'   },
    staff:   { color: WARNING,      icon: <ShieldCheck size={10} />, label: 'Staff'   },
    officer: { color: SUCCESS,      icon: <Briefcase size={10} />,   label: 'Officer' },
    scholar: { color: ROSE,         icon: <Users size={10} />,       label: 'Scholar' },
};

const STATUS_DOT = {
    active:   SUCCESS,
    flagged:  DANGER,
    inactive: '#C4B8A8',
};

const SkeletonRow = () => (
    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
        {[40, 52, 20, 24, 16, 20].map((w, i) => (
            <td key={i} className="px-5 py-4">
                <div className="h-3 rounded-full skeleton-pulse" style={{ width: `${w}%` }} />
            </td>
        ))}
    </tr>
);

const SkeletonMobileRow = () => (
    <div className="flex items-center gap-3 px-5 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
        <div className="w-9 h-9 rounded-lg skeleton-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
            <div className="h-3 rounded-full skeleton-pulse" style={{ width: '55%' }} />
            <div className="h-2.5 rounded-full skeleton-pulse" style={{ width: '35%' }} />
        </div>
    </div>
);

// ── Role filter card — clickable, replaces the old role dropdown + distribution bars ──
const RoleFilterCard = ({ label, count, active, onClick, accent, loading }) => (
    <button onClick={onClick}
        aria-pressed={active}
        className="flex flex-col justify-between rounded-xl px-4 py-3 text-left transition-colors min-w-0"
        style={{
            background: active ? PRIMARY : '#fff',
            border: `1px solid ${active ? PRIMARY : BORDER}`,
            cursor: 'pointer',
        }}>
        <div className="flex items-center justify-between">
            <span style={{ ...sans, fontSize: '0.7rem', fontWeight: 600, color: active ? 'rgba(255,255,255,0.78)' : MUTED }}>{label}</span>
            {!active && accent && <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />}
        </div>
        {loading ? (
            <div className="h-6 w-8 rounded-full skeleton-pulse" style={{ marginTop: 8 }} />
        ) : (
            <p style={{ ...display, ...tabularNums, fontSize: '1.35rem', fontWeight: 700, color: active ? '#fff' : INK, marginTop: 6, lineHeight: 1 }}>{count}</p>
        )}
        <span style={{ ...sans, fontSize: '0.66rem', color: active ? 'rgba(255,255,255,0.68)' : '#B8AA9B', marginTop: 4 }}>accounts</span>
    </button>
);

// ── Row action button (shared by desktop table + mobile cards) ──
const RowAction = ({ onClick, title, hoverColor, children }) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className="p-1.5 rounded-lg transition-colors"
        style={{ color: '#B8AA9B', background: 'none', border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.background = `${hoverColor}16`; e.currentTarget.style.color = hoverColor; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#B8AA9B'; }}>
        {children}
    </button>
);

// ── MAIN ───────────────────────────────────────────────────────
const UserManagement = () => {
    const navigate = useNavigate();
    const [usersList, setUsersList]   = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [loading, setLoading]       = useState(true);
    const [registryError, setRegistryError] = useState('');
    const [registryMessage, setRegistryMessage] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [archiveError, setArchiveError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [modal, setModal]           = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [qrData, setQrData]         = useState(null);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setRegistryError('');
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/admin/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsersList(res.data);
        } catch (err) {
            console.error('Error fetching users:', err);
            setRegistryError(err.response?.data?.error || 'Unable to load the user registry. Please refresh and try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Load the user registry once when the page opens.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchUsers();
    }, []);

    const closeModal = () => setModal(null);

    const handleDelete = async () => {
        if (!selectedUser) return;
        try {
            setDeleting(true);
            setDeleteError('');
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/admin/users/${selectedUser.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            closeModal();
            await fetchUsers();
        } catch (err) {
            console.error(err);
            setDeleteError(err.response?.data?.error || 'Unable to update this account. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const handleArchiveScholar = async () => {
        if (!selectedUser || selectedUser.role !== 'scholar') return;
        try {
            setArchiving(true);
            setArchiveError('');
            setRegistryMessage('');
            const token = localStorage.getItem('token');
            await axios.patch(`http://localhost:5000/api/admin/users/${selectedUser.id}/archive`, {}, {
                headers: { Authorization: ['Bearer', token].join(' ') }
            });
            closeModal();
            setRegistryMessage('Scholar archived successfully.');
            await fetchUsers();
        } catch (err) {
            console.error('Error archiving scholar:', err);
            setArchiveError(err.response?.data?.error || 'Unable to archive scholar. Please try again.');
        } finally {
            setArchiving(false);
        }
    };

    const filtered = usersList.filter(u => {
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        const matchesSearch = [u.full_name, u.email, u.role, u.scholar_id].some(f =>
            f?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesRole && matchesSearch;
    });

    // Pagination — 10 accounts per page so the registry never turns into one long scroll.
    const PAGE_SIZE = 10;
    const [currentPage, setCurrentPage] = useState(1);
    const resetFilters = () => { setRoleFilter('all'); setSearchTerm(''); setCurrentPage(1); };
    const selectRoleFilter = (role) => { setRoleFilter(role); setCurrentPage(1); };
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedUsers = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // Role-filter counts come from the already-loaded registry.
    const totalCount     = usersList.length;
    const scholarCount   = usersList.filter(u => u.role === 'scholar').length;
    const officerCount   = usersList.filter(u => u.role === 'officer').length;
    const staffOnlyCount = usersList.filter(u => u.role === 'staff').length;
    const adminCount     = usersList.filter(u => u.role === 'admin').length;
    const roleFilterCards = [
        { id: 'all',     label: 'All Users', count: totalCount,     accent: null },
        { id: 'scholar', label: 'Scholar',   count: scholarCount,   accent: ROLE_CFG.scholar.color },
        { id: 'staff',   label: 'Staff',     count: staffOnlyCount, accent: ROLE_CFG.staff.color },
        { id: 'officer', label: 'Officer',   count: officerCount,   accent: ROLE_CFG.officer.color },
        { id: 'admin',   label: 'Admin',     count: adminCount,     accent: ROLE_CFG.admin.color },
    ];

    return (
        <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-hidden" style={{ background: BG }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');
                .gs-input, .gs-select { border: 1px solid ${BORDER}; }
                .gs-input:hover, .gs-select:hover { border-color: ${PRIMARY}55; }
                .gs-input:focus, .gs-select:focus {
                    border-color: ${PRIMARY};
                    box-shadow: 0 0 0 3px ${PRIMARY}1a;
                }
                .gs-table-row:hover { background: #FBF8F2; }
                .gs-action-card:hover { background: ${BG}; border-color: ${PRIMARY}40; }
                .skeleton-pulse {
                    background: linear-gradient(90deg, ${BG} 25%, #EFE9DD 37%, ${BG} 63%);
                    background-size: 400% 100%;
                    animation: gs-shimmer 1.6s ease infinite;
                }
                @keyframes gs-shimmer {
                    0% { background-position: 100% 50%; }
                    100% { background-position: 0 50%; }
                }
            `}</style>

            {/* Full-width registry workspace with responsive page padding. */}
            <div className="w-full px-4 sm:px-6 lg:px-8">

                <AdminPageHeader
                    title="Identity & Access Center"
                    description="Manage scholars, staff, officers, and administrators from one secure registry."
                    actions={
                        <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
                            <button onClick={fetchUsers}
                                className="flex items-center justify-center gap-2 rounded-xl transition-colors hover:bg-[#F7F4EE] flex-shrink-0"
                                style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, color: MUTED, height: 48, padding: '0 18px', border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer' }}>
                                <RefreshCw size={15} /> Refresh Registry
                            </button>
                            <button onClick={() => setModal('create')}
                                className="flex items-center justify-center gap-2 rounded-xl transition-colors hover:bg-[#4A1730] active:scale-[0.98] flex-shrink-0"
                                style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, color: '#fff', height: 48, padding: '0 20px', border: 'none', background: PRIMARY, cursor: 'pointer' }}>
                                <UserPlus size={15} /> New User
                            </button>
                        </div>
                    }
                />

                <div className="pb-14 w-full min-w-0 max-w-full">

                    {registryMessage && (
                        <div role="status" className="flex items-center gap-2 rounded-xl mb-4" style={{ background: `${SUCCESS}14`, border: `1px solid ${SUCCESS}45`, padding: '11px 14px' }}>
                            <ShieldCheck size={14} style={{ color: SUCCESS, flexShrink: 0 }} />
                            <p style={{ ...sans, fontSize: '0.78rem', color: SUCCESS, fontWeight: 600 }}>{registryMessage}</p>
                        </div>
                    )}
                    {registryError && (
                        <div role="alert" className="flex items-center gap-2 rounded-xl mb-4" style={{ background: `${DANGER}0f`, border: `1px solid ${DANGER}35`, padding: '11px 14px' }}>
                            <AlertTriangle size={14} style={{ color: DANGER, flexShrink: 0 }} />
                            <p style={{ ...sans, fontSize: '0.78rem', color: DANGER, fontWeight: 600 }}>{registryError}</p>
                        </div>
                    )}

                    {/* Role filters */}
                    <div style={{ ...cardStyle, padding: 14, marginBottom: 14 }}>
                        <p style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, color: BRONZE, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Filter by role</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                            {roleFilterCards.map(card => (
                                <RoleFilterCard key={card.id}
                                    label={card.label} count={card.count} accent={card.accent}
                                    active={roleFilter === card.id} loading={loading}
                                    onClick={() => selectRoleFilter(card.id)} />
                            ))}
                        </div>
                    </div>

                    {/* Search and compact shortcuts over the existing registry. */}
                    <div className="flex flex-col lg:flex-row lg:items-center gap-2.5" style={{ ...cardStyle, padding: 12, marginBottom: 14 }}>
                        <div className="relative w-full min-w-0 flex-1">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED }} />
                            <input type="search" aria-label="Search users" placeholder="Search by name, email, role, or scholar ID…"
                                value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="gs-input w-full pl-9 pr-3 rounded-lg outline-none"
                                style={{ ...sans, fontSize: '0.82rem', background: '#fff', color: INK, height: 42, border: `1px solid ${BORDER}` }} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setModal('create')}
                                className="gs-action-card inline-flex items-center gap-2 rounded-lg px-3 py-2 transition-colors"
                                style={{ ...sans, fontSize: '0.74rem', fontWeight: 600, color: INK, border: `1px solid ${BORDER}`, background: SURFACE, cursor: 'pointer' }}>
                                <UserPlus size={14} style={{ color: PRIMARY }} /> Register User
                            </button>
                            <button type="button" onClick={() => selectRoleFilter('scholar')}
                                className="gs-action-card inline-flex items-center gap-2 rounded-lg px-3 py-2 transition-colors"
                                style={{ ...sans, fontSize: '0.74rem', fontWeight: 600, color: INK, border: `1px solid ${BORDER}`, background: SURFACE, cursor: 'pointer' }}>
                                <Layers size={14} style={{ color: PRIMARY }} /> View Scholars
                            </button>
                            <button type="button" onClick={resetFilters}
                                className="gs-action-card inline-flex items-center gap-2 rounded-lg px-3 py-2 transition-colors"
                                style={{ ...sans, fontSize: '0.74rem', fontWeight: 600, color: INK, border: `1px solid ${BORDER}`, background: SURFACE, cursor: 'pointer' }}>
                                <RotateCcw size={14} style={{ color: PRIMARY }} /> Clear Filters
                            </button>
                        </div>
                    </div>

                    {/* Primary content card — registry table, full width */}
                    <div className="w-full min-w-0 max-w-full" style={{ ...cardStyle, overflow: 'hidden' }}>
                            <div className="px-5 sm:px-6" style={{ paddingTop: 18, paddingBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, color: BRONZE, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Identity &amp; access</p>
                                        <h2 style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: INK, marginTop: 3 }}>Account Registry</h2>
                                    </div>
                                    <span style={{ ...sans, ...tabularNums, fontSize: '0.72rem', fontWeight: 600, color: PRIMARY, background: PRIMARY_TINT, borderRadius: 8, padding: '5px 9px', whiteSpace: 'nowrap' }}>
                                        {filtered.length} {filtered.length === 1 ? 'account' : 'accounts'}
                                    </span>
                                </div>
                                <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>Manage accounts and access across the organization.</p>
                            </div>

                            {/* Desktop / tablet table */}
                            <div className="hidden sm:block overflow-x-auto w-full min-w-0">
                                <table className="w-full text-left min-w-[640px]">
                                    <thead>
                                        <tr className="sticky top-0 z-10" style={{ background: BG }}>
                                            {['User', 'Email', 'Role', 'Assigned Level', 'Status', 'Actions'].map((h, i) => (
                                                <th key={h}
                                                    className={`px-5 py-3 ${i === 5 ? 'text-center' : 'text-left'}`}
                                                    style={{ ...sans, fontSize: '0.68rem', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading
                                            ? Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)
                                            : filtered.length > 0
                                                ? paginatedUsers.map((user) => {
                                                    const badge = ROLE_CFG[user.role] || ROLE_CFG.scholar;
                                                    const displayId = user.scholar_id || '—';
                                                    const status = String(user.status || 'unknown').toLowerCase();
                                                    return (
                                                        <tr key={user.id} className="gs-table-row transition-colors" style={{ borderTop: `1px solid ${BORDER}`, height: 68 }}>
                                                            <td className="px-5 py-4">
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: PRIMARY_TINT, color: PRIMARY, ...sans, fontSize: '0.72rem', fontWeight: 700 }}>
                                                                        {(user.full_name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('')}
                                                                    </div>
                                                                    <div>
                                                                        <span style={{ ...sans, fontSize: '0.84rem', fontWeight: 600, color: INK, display: 'block' }}>{user.full_name}</span>
                                                                        <span style={{ ...mono, ...nowrap, fontSize: '0.68rem', color: MUTED }}>{displayId}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4" style={{ ...sans, fontSize: '0.78rem', color: MUTED }}>{user.email}</td>
                                                            <td className="px-5 py-4">
                                                                <span className="inline-flex items-center gap-1 rounded-full" style={{ ...sans, ...nowrap, fontSize: '0.64rem', fontWeight: 700, padding: '4px 9px', background: `${badge.color}14`, color: badge.color, border: `1px solid ${badge.color}35` }}>
                                                                    {badge.icon}{badge.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4" style={{ ...sans, ...nowrap, fontSize: '0.78rem', color: INK }}>
                                                                {formatYearLevelLabel(user.year_level)}
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <span className="inline-flex items-center gap-1.5" style={{ ...sans, ...nowrap, fontSize: '0.74rem', fontWeight: 600, color: STATUS_DOT[status] || MUTED, textTransform: 'capitalize' }}>
                                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[status] || MUTED, flexShrink: 0 }} />
                                                                    {status}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <div className="flex items-center justify-center gap-0.5">
                                                                    {user.role === 'scholar' && (
                                                                        <RowAction onClick={() => navigate(`/admin/scholars/${user.id}`)} title="View Profile" hoverColor={PRIMARY}>
                                                                            <Eye size={13} />
                                                                        </RowAction>
                                                                    )}
                                                                    <RowAction onClick={() => { setSelectedUser(user); setModal('edit'); }} title="Edit" hoverColor={WARNING}>
                                                                        <Edit3 size={13} />
                                                                    </RowAction>
                                                                    {user.role === 'scholar' ? (
                                                                        <RowAction onClick={() => { setSelectedUser(user); setArchiveError(''); setRegistryMessage(''); setModal('archive'); }} title="Archive Scholar" hoverColor={BRONZE}>
                                                                            <Archive size={13} />
                                                                        </RowAction>
                                                                    ) : (
                                                                        <RowAction onClick={() => { setSelectedUser(user); setDeleteError(''); setModal('delete'); }} title="Delete" hoverColor={DANGER}>
                                                                            <Trash2 size={13} />
                                                                        </RowAction>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                                : (
                                                    <tr>
                                                        <td colSpan="6" className="py-16 text-center">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-1" style={{ background: PRIMARY_TINT }}>
                                                                    <Users size={22} style={{ color: PRIMARY }} strokeWidth={1.5} />
                                                                </div>
                                                                <p style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, color: MUTED }}>No users found</p>
                                                                <p style={{ ...sans, fontSize: '0.78rem', color: '#B8AA9B' }}>Try adjusting your search query</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                        }
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile card list — replaces the table below the sm breakpoint */}
                            <div className="sm:hidden">
                                {loading
                                    ? Array(4).fill(0).map((_, i) => <SkeletonMobileRow key={i} />)
                                    : filtered.length > 0
                                        ? paginatedUsers.map(user => {
                                            const badge = ROLE_CFG[user.role] || ROLE_CFG.scholar;
                                            const displayId = user.scholar_id || '—';
                                            const status = String(user.status || 'unknown').toLowerCase();
                                            return (
                                                <div key={user.id} className="px-5 py-4 flex items-start gap-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: PRIMARY_TINT, color: PRIMARY, ...sans, fontSize: '0.76rem', fontWeight: 700 }}>
                                                        {(user.full_name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('')}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span style={{ ...sans, fontSize: '0.86rem', fontWeight: 600, color: INK }} className="truncate">{user.full_name}</span>
                                                            <span className="inline-flex items-center gap-1 rounded-full flex-shrink-0" style={{ ...sans, ...nowrap, fontSize: '0.62rem', fontWeight: 700, padding: '3px 8px', background: `${badge.color}14`, color: badge.color, border: `1px solid ${badge.color}35` }}>
                                                                {badge.icon}{badge.label}
                                                            </span>
                                                        </div>
                                                        <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 2 }} className="truncate">{user.email}</p>
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <span style={{ ...mono, fontSize: '0.7rem', color: INK }}>{displayId}</span>
                                                            <span className="inline-flex items-center gap-1.5" style={{ ...sans, fontSize: '0.7rem', fontWeight: 600, color: STATUS_DOT[status] || MUTED, textTransform: 'capitalize' }}>
                                                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_DOT[status] || MUTED, flexShrink: 0 }} />
                                                                {status}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 mt-2 -ml-1.5">
                                                            {user.role === 'scholar' && (
                                                                <RowAction onClick={() => navigate(`/admin/scholars/${user.id}`)} title="View Profile" hoverColor={PRIMARY}>
                                                                    <Eye size={14} />
                                                                </RowAction>
                                                            )}
                                                            <RowAction onClick={() => { setSelectedUser(user); setModal('edit'); }} title="Edit" hoverColor={WARNING}>
                                                                <Edit3 size={14} />
                                                            </RowAction>
                                                            {user.role === 'scholar' ? (
                                                                <RowAction onClick={() => { setSelectedUser(user); setArchiveError(''); setRegistryMessage(''); setModal('archive'); }} title="Archive Scholar" hoverColor={BRONZE}>
                                                                    <Archive size={14} />
                                                                </RowAction>
                                                            ) : (
                                                                <RowAction onClick={() => { setSelectedUser(user); setDeleteError(''); setModal('delete'); }} title="Delete" hoverColor={DANGER}>
                                                                    <Trash2 size={14} />
                                                                </RowAction>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                        : (
                                            <div className="py-14 text-center px-5">
                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: PRIMARY_TINT }}>
                                                    <Users size={22} style={{ color: PRIMARY }} strokeWidth={1.5} />
                                                </div>
                                                <p style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, color: MUTED }}>No users found</p>
                                                <p style={{ ...sans, fontSize: '0.78rem', color: '#B8AA9B' }}>Try adjusting your search query</p>
                                            </div>
                                        )
                                }
                            </div>

                            <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 w-full" style={{ borderTop: `1px solid ${BORDER}` }}>
                                <span style={{ ...sans, fontSize: '0.74rem', color: MUTED }}>
                                    Showing <span style={{ fontWeight: 700, color: INK, ...tabularNums }}>{filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</span> of{' '}
                                    <span style={{ fontWeight: 700, color: INK, ...tabularNums }}>{filtered.length}</span> users
                                </span>
                                {totalPages > 1 && (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                                            className="flex items-center justify-center rounded-lg disabled:opacity-40"
                                            style={{ width: 34, height: 34, border: `1px solid ${BORDER}`, background: '#fff', color: INK, cursor: safePage === 1 ? 'default' : 'pointer' }}>
                                            <ChevronLeft size={14} />
                                        </button>
                                        <span style={{ ...sans, ...tabularNums, fontSize: '0.76rem', fontWeight: 600, color: INK, minWidth: 64, textAlign: 'center' }}>
                                            Page {safePage} of {totalPages}
                                        </span>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                            className="flex items-center justify-center rounded-lg disabled:opacity-40"
                                            style={{ width: 34, height: 34, border: `1px solid ${BORDER}`, background: '#fff', color: INK, cursor: safePage === totalPages ? 'default' : 'pointer' }}>
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                </div>
            </div>

            {/* Modals */}
            {modal === 'create' && (
                <CreateModal
                    onClose={closeModal}
                    onSuccess={(data) => { setQrData(data); fetchUsers(); closeModal(); setModal('qr'); }}
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
            {modal === 'archive' && selectedUser?.role === 'scholar' && (
                <ArchiveModal user={selectedUser} onClose={closeModal} onConfirm={handleArchiveScholar} loading={archiving} error={archiveError} />
            )}
            {modal === 'delete' && selectedUser && (
                <DeleteModal user={selectedUser} onClose={closeModal} onConfirm={handleDelete} loading={deleting} error={deleteError} />
            )}
        </div>
    );
};

export default UserManagement;