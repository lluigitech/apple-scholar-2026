import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Check, Filter, Loader2, Pencil, Plus, Search,
  Trash2, Users, X, Folder, ShieldCheck,
  Layers, GraduationCap, ChevronDown,
} from 'lucide-react';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

// ── Design tokens — Executive Access Control Center ─────────────
const BG           = '#F7F4EE';
const SURFACE      = '#FFFDF9';
const BORDER       = '#E7D8C7';

const PRIMARY      = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const PRIMARY_TINT = '#F3E7EC';

const INK           = '#241512';
const MUTED         = '#8A7A68';
const BRONZE        = '#A9784E';

const SUCCESS       = '#6B8F71';
const WARNING       = '#C08A3E';
const DANGER        = '#A24A4A';

const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body    = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono    = { fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace" };

const CARD = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS };

const API = 'http://localhost:5000/api';
const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const YEAR_LEVELS = [
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  '1st Year College', '2nd Year College', '3rd Year College',
  '4th Year College', '5th Year College',
];

// ── Shared bits ──────────────────────────────────────────────
const Alert = ({ type = 'error', children }) => {
  const color = type === 'error' ? DANGER : SUCCESS;
  return (
    <div className="mb-5 rounded-xl px-4 py-3" style={{ ...body, fontSize: '0.82rem', background: `${color}10`, border: `1px solid ${color}35`, color }}>
      {children}
    </div>
  );
};

const Card = ({ icon: Icon, title, action, children, className = '', style = {} }) => (
  <div className={className} style={{ ...CARD, padding: 20, ...style }}>
    {(title || action) && (
      <div className="flex items-center justify-between mb-4 pb-3 flex-wrap gap-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} style={{ color: PRIMARY }} />}
          <h3 style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: INK }}>{title}</h3>
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
);

const skeletonCss = `
  .aac-skel {
    background: linear-gradient(90deg, ${BG} 25%, #EFE9DD 37%, ${BG} 63%);
    background-size: 400% 100%;
    animation: aac-shimmer 1.6s ease infinite;
    border-radius: 8px;
  }
  @keyframes aac-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
`;
const Skel = ({ w = '100%', h = 12, style = {} }) => <div className="aac-skel" style={{ width: w, height: h, ...style }} />;

// KPI card — the 4-card row below the header
const KpiCard = ({ icon: Icon, label, value, loading }) => (
  <div style={{ ...CARD, padding: 22 }}>
    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: PRIMARY_TINT }}>
      <Icon size={16} style={{ color: PRIMARY }} />
    </div>
    <div style={{ marginTop: 16 }}>
      {loading ? <Skel w={40} h={26} /> : <p style={{ ...display, fontSize: '1.7rem', fontWeight: 700, color: INK, lineHeight: 1 }}>{value}</p>}
      <p style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: MUTED, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
    </div>
  </div>
);

// Segmented control
const SegmentedTabs = ({ tab, setTab }) => (
  <div className="inline-flex gap-1 shrink-0" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 5 }}>
    {[
      { id: 'officers', label: 'Officers' },
      { id: 'staff', label: 'Staff' },
    ].map(t => {
      const activeState = tab === t.id;
      return (
        <button key={t.id} onClick={() => setTab(t.id)}
          className="rounded-xl px-5 transition-colors"
          style={{
            ...body, fontSize: '0.8rem', fontWeight: 600, height: 40,
            color: activeState ? '#fff' : MUTED,
            background: activeState ? PRIMARY : 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}>
          {t.label}
        </button>
      );
    })}
  </div>
);

// Directory roster entry (officer or staff)
const DirectoryRow = ({ name, email, meta, selected, onClick }) => (
  <button onClick={onClick}
    className="w-full rounded-xl p-3 text-left transition-colors mb-1.5 last:mb-0 flex items-center gap-3"
    style={{
      border: `1px solid ${selected ? PRIMARY : BORDER}`,
      background: selected ? PRIMARY_TINT : SURFACE,
    }}>
    <span className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0"
      style={{ background: selected ? PRIMARY : BG, color: selected ? '#fff' : INK }}>
      <span style={{ ...body, fontSize: '0.7rem', fontWeight: 700 }}>{(name || '?').charAt(0).toUpperCase()}</span>
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate" style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: INK }}>{name}</p>
      <p style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 1 }} className="truncate">{email}</p>
      {meta && <p style={{ ...mono, fontSize: '0.62rem', color: PRIMARY, marginTop: 4 }}>{meta}</p>}
    </div>
  </button>
);

const EmptyState = ({ icon: Icon, text }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-2.5">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: PRIMARY_TINT }}>
      <Icon size={20} style={{ color: PRIMARY }} strokeWidth={1.5} />
    </div>
    <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: MUTED }}>{text}</p>
  </div>
);

// Permission chip — year level toggle
const LevelChip = ({ label, checked, onClick }) => (
  <button onClick={onClick}
    className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 transition-colors"
    style={{
      ...body, fontSize: '0.8rem', fontWeight: 600,
      color: checked ? '#fff' : INK,
      background: checked ? PRIMARY : '#fff',
      border: `1px solid ${checked ? PRIMARY : BORDER}`,
      cursor: 'pointer',
    }}>
    <span className="flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0"
      style={{ border: `1.5px solid ${checked ? '#fff' : BORDER}`, background: checked ? 'rgba(255,255,255,0.18)' : 'transparent' }}>
      {checked && <Check size={10} color="#fff" />}
    </span>
    {label}
  </button>
);

// Assignment-count summary badge
const AssignmentBadge = ({ count, noun = 'level' }) => (
  <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5"
    style={{ ...body, fontSize: '0.72rem', fontWeight: 600, background: `${count ? SUCCESS : WARNING}12`, color: count ? SUCCESS : WARNING }}>
    <ShieldCheck size={13} /> {count ? `${count} ${noun}${count > 1 ? 's' : ''} assigned` : 'Nothing assigned'}
  </span>
);

// Toggle switch — used on scholar-group access cards
const ToggleSwitch = ({ checked }) => (
  <span className="relative rounded-full flex-shrink-0" style={{ width: 36, height: 21, background: checked ? PRIMARY : BORDER, transition: 'background 150ms ease' }}>
    <span style={{ position: 'absolute', top: 2, left: checked ? 17 : 2, width: 17, height: 17, borderRadius: '50%', background: '#fff', transition: 'left 150ms ease' }} />
  </span>
);

// Scholar-group access card — used in the Staff group panel
const GroupAccessCard = ({ name, count, checked, onClick }) => (
  <button onClick={onClick}
    className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors"
    style={{
      border: `1px solid ${checked ? PRIMARY : BORDER}`,
      background: checked ? PRIMARY_TINT : '#fff',
      cursor: 'pointer',
    }}>
    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: checked ? PRIMARY : BG, color: checked ? '#fff' : PRIMARY }}>
      <Folder size={14} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate" style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }}>{name}</p>
      <p style={{ ...body, fontSize: '0.68rem', color: MUTED, marginTop: 1 }}>{count} scholar{count === 1 ? '' : 's'}</p>
    </div>
    <ToggleSwitch checked={checked} />
  </button>
);

// ── Officers tab ─────────────────────────────────────────────
const OfficerPanel = ({ onStats }) => {
  const [officers, setOfficers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/admin/officer-assignments`, authHeaders());
      setOfficers(res.data || []);
      if (!selectedId && res.data?.[0]) {
        setSelectedId(res.data[0].id);
        setSelectedLevels(res.data[0].assigned_year_levels || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load officer assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const levelsCovered = new Set(officers.flatMap(o => o.assigned_year_levels || [])).size;
    onStats?.({ totalOfficers: officers.length, levelsCovered });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officers]);

  const selectOfficer = (officer) => {
    setSelectedId(officer.id);
    setSelectedLevels(officer.assigned_year_levels || []);
    setMessage('');
    setError('');
  };

  const toggleLevel = (level) => {
    setSelectedLevels(current => current.includes(level)
      ? current.filter(item => item !== level)
      : [...current, level]);
  };

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await axios.put(`${API}/admin/officer-assignments/${selectedId}`, { year_levels: selectedLevels }, authHeaders());
      setOfficers(current => current.map(officer => officer.id === selectedId
        ? { ...officer, assigned_year_levels: selectedLevels }
        : officer));
      setMessage('Assignment saved.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save assignments.');
    } finally {
      setSaving(false);
    }
  };

  const selectedOfficer = officers.find(officer => officer.id === selectedId);

  return (
    <>
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-5">
        <Card icon={Users} title="Officer directory">
          {loading ? (
            <div className="space-y-2">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skel w={32} h={32} style={{ borderRadius: '50%' }} />
                  <div className="flex-1 space-y-1.5">
                    <Skel w="60%" h={11} />
                    <Skel w="40%" h={9} />
                  </div>
                </div>
              ))}
            </div>
          ) : officers.length === 0
            ? <EmptyState icon={Users} text="No officers available" />
            : officers.map(officer => (
                <DirectoryRow key={officer.id}
                  name={officer.full_name} email={officer.email}
                  meta={`${officer.assigned_year_levels?.length || 0} level(s) assigned`}
                  selected={selectedId === officer.id}
                  onClick={() => selectOfficer(officer)} />
              ))
          }
        </Card>

        <Card>
          {loading ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Skel w={44} h={44} style={{ borderRadius: '50%' }} />
                <div className="space-y-1.5"><Skel w={160} h={14} /><Skel w={120} h={10} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {Array(6).fill(0).map((_, i) => <Skel key={i} h={40} />)}
              </div>
            </div>
          ) : !selectedOfficer ? (
            <div className="flex min-h-56 items-center justify-center" style={{ ...body, fontSize: '0.82rem', color: MUTED }}>
              Select an officer to manage their assignments.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full flex-shrink-0" style={{ background: PRIMARY_TINT, color: PRIMARY, ...body, fontSize: '0.9rem', fontWeight: 700 }}>
                    {selectedOfficer.full_name?.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: INK }}>{selectedOfficer.full_name}</p>
                    <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>{selectedOfficer.email}</p>
                  </div>
                </div>
                <AssignmentBadge count={selectedLevels.length} noun="level" />
              </div>

              <div className="py-5">
                <p style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: MUTED, marginBottom: 12 }}>
                  Year levels this officer can view — tap to toggle
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {YEAR_LEVELS.map(level => (
                    <LevelChip key={level} label={level} checked={selectedLevels.includes(level)} onClick={() => toggleLevel(level)} />
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                <button onClick={save} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl px-5 disabled:opacity-50"
                  style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: 'none', cursor: saving ? 'default' : 'pointer', height: 44 }}>
                  {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Saving…' : 'Save assignment'}
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
};

// ── Staff tab ────────────────────────────────────────────────
const StaffPanel = ({ onStats }) => {
  const [staff, setStaff] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [scholars, setScholars] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [scholarSearch, setScholarSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [editing, setEditing] = useState(false);
  const [groupEditingId, setGroupEditingId] = useState(null);
  const [groupDraftName, setGroupDraftName] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API}/admin/staff-assignments`, authHeaders());
      setStaff(res.data.staff || []);
      setGroups(res.data.groups || []);
      const scholarsRes = await axios.get(`${API}/admin/scholar-groups/scholars`, authHeaders());
      setScholars(scholarsRes.data || []);
      if (!selectedId && res.data.staff?.[0]) {
        setSelectedId(res.data.staff[0].id);
        setSelectedGroups(res.data.staff[0].assigned_groups?.map(group => group.id) || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load staff assignments.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    onStats?.({ totalStaff: staff.length, totalGroups: groups.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, groups]);

  const createGroup = async () => {
    if (!groupName.trim()) return;
    try {
      await axios.post(`${API}/admin/scholar-groups`, { group_name: groupName.trim(), created_by: localStorage.getItem('user_id') || localStorage.getItem('id') }, authHeaders());
      setGroupName(''); await load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to create group.'); }
  };
  const assignScholar = async (scholarId, groupId) => {
    if (!groupId) return;
    try { await axios.post(`${API}/admin/scholar-groups/${groupId}/members`, { scholar_ids: [scholarId] }, authHeaders()); await load(); }
    catch (err) { setError(err.response?.data?.error || 'Failed to assign scholar.'); }
  };
  const removeScholar = async (scholarId, groupId) => {
    try { await axios.delete(`${API}/admin/scholar-groups/${groupId}/members/${scholarId}`, authHeaders()); await load(); }
    catch (err) { setError(err.response?.data?.error || 'Failed to remove scholar.'); }
  };
  const visibleScholars = scholars.filter(s => {
    const query = scholarSearch.trim().toLowerCase();
    return (!query || s.full_name?.toLowerCase().includes(query) || s.scholar_id?.toLowerCase().includes(query))
      && (!groupFilter || (groupFilter === 'unassigned' ? !s.group_id : String(s.group_id) === groupFilter));
  });
  const selectStaff = (person) => { setSelectedId(person.id); setSelectedGroups(person.assigned_groups?.map(group => group.id) || []); setEditing(false); setMessage(''); };
  const toggle = (id) => setSelectedGroups(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const save = async () => {
    if (!selectedId) return;
    setSaving(true); setMessage(''); setError('');
    try {
      await axios.put(`${API}/admin/staff-assignments/${selectedId}`, { group_ids: selectedGroups }, authHeaders());
      setMessage('Assignment saved.');
      setEditing(false);
      await load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to save staff assignments.'); }
    finally { setSaving(false); }
  };
  const deleteAssignments = async () => {
    if (!selectedId || !window.confirm('Remove every group this staff member has access to?')) return;
    setSaving(true); setMessage(''); setError('');
    try {
      await axios.delete(`${API}/admin/staff-assignments/${selectedId}`, authHeaders());
      setSelectedGroups([]);
      setEditing(false);
      setMessage('Assignments removed.');
      await load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete staff assignments.'); }
    finally { setSaving(false); }
  };
  const saveGroupEdit = async (groupId) => {
    const trimmed = groupDraftName.trim();
    if (!trimmed) {
      setError('Group name is required.');
      return;
    }

    try {
      await axios.put(`${API}/admin/scholar-groups/${groupId}`, { group_name: trimmed }, authHeaders());
      setGroupEditingId(null);
      setGroupDraftName('');
      setMessage('Group updated.');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update group.');
    }
  };
  const deleteGroup = async (groupId) => {
    if (!window.confirm('Delete this group and remove its members?')) return;

    try {
      await axios.delete(`${API}/admin/scholar-groups/${groupId}`, authHeaders());
      if (groupEditingId === groupId) {
        setGroupEditingId(null);
        setGroupDraftName('');
      }
      if (selectedId && selectedGroups.includes(groupId)) {
        setSelectedGroups(current => current.filter(id => id !== groupId));
      }
      setMessage('Group deleted.');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete group.');
    }
  };
  const selected = staff.find(person => person.id === selectedId);
  const inputStyle = { ...body, color: INK, border: `1px solid ${BORDER}`, background: '#fff' };
  const unfiledCount = scholars.filter(s => !s.group_id).length;

  return (
    <>
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}

      {/* Directory + group access panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-5 mb-5">
        <Card icon={Users} title="Staff directory">
          {loading ? (
            <div className="space-y-2">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skel w={32} h={32} style={{ borderRadius: '50%' }} />
                  <div className="flex-1 space-y-1.5">
                    <Skel w="60%" h={11} />
                    <Skel w="40%" h={9} />
                  </div>
                </div>
              ))}
            </div>
          ) : staff.length === 0
            ? <EmptyState icon={Users} text="No staff available" />
            : staff.map(person => (
                <DirectoryRow key={person.id}
                  name={person.full_name} email={person.email}
                  meta={`${person.assigned_groups?.length || 0} group(s) assigned`}
                  selected={selectedId === person.id}
                  onClick={() => selectStaff(person)} />
              ))
          }
        </Card>

        <Card>
          {!selected ? (
            <p style={{ ...body, fontSize: '0.82rem', color: MUTED }}>Select a staff member.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full flex-shrink-0" style={{ background: PRIMARY_TINT, color: PRIMARY, ...body, fontSize: '0.9rem', fontWeight: 700 }}>
                    {selected.full_name?.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: INK }}>{selected.full_name}</p>
                    <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>
                      {editing ? 'Choose the groups this staff member should access.' : 'Viewing current group access.'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setEditing(true)} disabled={editing}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 disabled:opacity-40"
                    style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: INK, border: `1px solid ${BORDER}`, background: '#fff', cursor: editing ? 'default' : 'pointer', height: 40 }}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button onClick={deleteAssignments} disabled={saving || !selectedGroups.length}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 disabled:opacity-40"
                    style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: DANGER, border: `1px solid ${DANGER}35`, background: '#fff', cursor: 'pointer', height: 40 }}>
                    <Trash2 size={13} /> Remove all
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {groups.length === 0
                  ? <EmptyState icon={Folder} text="Create your first scholar group" />
                  : groups.map(group => (
                      <GroupAccessCard key={group.id}
                        name={group.group_name} count={group.member_count ?? 0}
                        checked={selectedGroups.includes(group.id)}
                        onClick={() => editing && toggle(group.id)} />
                    ))
                }
              </div>

              <div className="mt-6 flex justify-end pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                <button onClick={save} disabled={saving || !editing}
                  className="inline-flex items-center gap-2 rounded-xl px-5 disabled:opacity-50"
                  style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: 'none', cursor: (saving || !editing) ? 'default' : 'pointer', height: 44 }}>
                  {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Saving…' : 'Save assignment'}
                </button>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Scholar directory + group management */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
        <Card icon={Search} title="Scholar directory" action={
          unfiledCount > 0 && (
            <span style={{ ...body, fontSize: '0.68rem', fontWeight: 600, color: WARNING }}>{unfiledCount} unfiled</span>
          )
        }>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
              <input value={scholarSearch} onChange={e => setScholarSearch(e.target.value)} placeholder="Search scholar or ID"
                className="w-full rounded-xl py-2.5 pl-9 pr-3 text-xs outline-none" style={inputStyle} />
            </div>
            <div className="relative sm:w-52">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED }} />
              <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
                className="w-full appearance-none rounded-xl py-2.5 pl-9 pr-8 text-xs" style={inputStyle}>
                <option value="">All groups</option>
                <option value="unassigned">Unfiled</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.group_name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED }} />
            </div>
          </div>

          <div className="space-y-1.5">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ border: `1px solid ${BORDER}` }}>
                  <Skel w={30} h={30} style={{ borderRadius: '50%' }} />
                  <div className="flex-1 space-y-1.5"><Skel w="45%" h={10} /><Skel w="30%" h={8} /></div>
                </div>
              ))
            ) : visibleScholars.length === 0 ? (
              <p className="text-center py-8" style={{ ...body, fontSize: '0.82rem', color: MUTED }}>No scholars match your search.</p>
            ) : visibleScholars.map((scholar) => (
              <div key={scholar.scholar_id} className="gs-scholar-row flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 transition-colors"
                style={{ border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0" style={{ background: PRIMARY_TINT, color: PRIMARY, ...body, fontSize: '0.7rem', fontWeight: 700 }}>
                    {(scholar.full_name || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate" style={{ ...body, fontSize: '0.83rem', fontWeight: 600, color: INK }}>{scholar.full_name}</p>
                    <p style={{ ...mono, fontSize: '0.64rem', color: MUTED, marginTop: 2 }}>{formatYearLevelLabel(scholar.year_level)} · {scholar.scholar_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {scholar.group_name && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1" style={{ ...body, fontSize: '0.64rem', fontWeight: 600, background: `${SUCCESS}12`, color: SUCCESS }}>
                      <Folder size={10} /> {scholar.group_name}
                    </span>
                  )}
                  <select defaultValue="" onChange={e => assignScholar(scholar.scholar_id, e.target.value)}
                    className="rounded-lg px-2 py-1.5 text-xs" style={inputStyle}>
                    <option value="">{scholar.group_name ? 'Move to…' : 'Assign to…'}</option>
                    {groups.filter(group => group.id !== scholar.group_id).map(group => <option key={group.id} value={group.id}>{group.group_name}</option>)}
                  </select>
                  {scholar.group_id && (
                    <button onClick={() => removeScholar(scholar.scholar_id, scholar.group_id)} aria-label="Remove from group"
                      className="p-1.5 rounded-lg transition-colors" style={{ color: DANGER, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card icon={Folder} title="Scholar groups">
          <div className="flex gap-2 mb-4">
            <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="New group name"
              className="flex-1 rounded-xl px-3 py-2 text-xs outline-none" style={inputStyle} />
            <button onClick={createGroup}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 shrink-0"
              style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: PRIMARY, border: 'none', cursor: 'pointer', height: 38 }}>
              <Plus size={13} /> Add
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {groups.length === 0 && !loading && <EmptyState icon={Folder} text="Create your first scholar group" />}
            {groups.map(group => (
              <div key={group.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: '#fff', border: `1px solid ${BORDER}` }}>
                {groupEditingId === group.id ? (
                  <>
                    <input
                      value={groupDraftName}
                      onChange={e => setGroupDraftName(e.target.value)}
                      className="flex-1 rounded-lg px-2 py-1 text-xs outline-none"
                      style={{ ...inputStyle, minWidth: 0 }}
                    />
                    <button onClick={() => saveGroupEdit(group.id)} className="rounded-lg px-2 py-1 text-[10px] font-bold shrink-0" style={{ background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer' }}>
                      Save
                    </button>
                    <button onClick={() => { setGroupEditingId(null); setGroupDraftName(''); }} className="rounded-lg px-2 py-1 text-[10px] font-bold shrink-0" style={{ background: SURFACE, color: MUTED, border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: PRIMARY_TINT, color: PRIMARY }}>
                      <Folder size={13} />
                    </div>
                    <span className="flex-1 truncate" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: INK }}>
                      {group.group_name}
                    </span>
                    <span style={{ ...mono, fontSize: '0.62rem', color: MUTED }}>{group.member_count ?? 0}</span>
                    <button onClick={() => { setGroupEditingId(group.id); setGroupDraftName(group.group_name); }} className="p-1 shrink-0" style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer' }} aria-label={`Edit ${group.group_name}`}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => deleteGroup(group.id)} className="p-1 shrink-0" style={{ background: 'transparent', border: 'none', color: DANGER, cursor: 'pointer' }} aria-label={`Delete ${group.group_name}`}>
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
};

// ── Main ─────────────────────────────────────────────────────
const TeamAssignments = () => {
  const [tab, setTab] = useState('officers');
  const [officerStats, setOfficerStats] = useState({ totalOfficers: 0, levelsCovered: 0 });
  const [staffStats, setStaffStats] = useState({ totalStaff: 0, totalGroups: 0 });

  return (
    <div className="min-h-screen" style={{ background: BG, ...body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');
        ${skeletonCss}
        .gs-scholar-row:hover { background: #FBF8F2; }
      `}</style>

      <div className="w-full px-4 sm:px-6 lg:px-8" style={{ paddingBottom: 40 }}>

        <AdminPageHeader
          title="Access Control Center"
          description="Control visibility of scholars by year level and scholar groups across Officers and Staff."
          className="mb-6"
        />

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5" style={{ marginBottom: 24 }}>
          <KpiCard icon={ShieldCheck} label="Total Officers" value={officerStats.totalOfficers} />
          <KpiCard icon={Users} label="Total Staff" value={staffStats.totalStaff} />
          <KpiCard icon={Folder} label="Scholar Groups" value={staffStats.totalGroups} />
          <KpiCard icon={GraduationCap} label="Year Levels Covered" value={officerStats.levelsCovered} />
        </div>

        {/* Segmented tab control */}
        <div style={{ marginBottom: 24 }}>
          <SegmentedTabs tab={tab} setTab={setTab} />
        </div>

        {/* Keep both panels mounted so KPI stats stay accurate across tab switches */}
        <div style={{ display: tab === 'officers' ? 'block' : 'none' }}>
          <OfficerPanel onStats={setOfficerStats} />
        </div>
        <div style={{ display: tab === 'staff' ? 'block' : 'none' }}>
          <StaffPanel onStats={setStaffStats} />
        </div>
      </div>
    </div>
  );
};

export default TeamAssignments;