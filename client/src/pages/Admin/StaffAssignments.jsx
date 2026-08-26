import { useEffect, useState } from 'react';
import axios from 'axios';
import { Check, Filter, Loader2, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';

const API = 'http://localhost:5000/api';
const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const StaffAssignments = () => {
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
  const createGroup = async () => {
    if (!groupName.trim()) return;
    try { await axios.post(`${API}/admin/scholar-groups`, { group_name: groupName.trim(), created_by: localStorage.getItem('user_id') || localStorage.getItem('id') }, authHeaders()); setGroupName(''); await load(); }
    catch (err) { setError(err.response?.data?.error || 'Failed to create group.'); }
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
      setMessage('Staff group assignments saved.');
      setEditing(false);
      await load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to save staff assignments.'); }
    finally { setSaving(false); }
  };
  const deleteAssignments = async () => {
    if (!selectedId || !window.confirm('Remove all group assignments from this staff member?')) return;
    setSaving(true); setMessage(''); setError('');
    try {
      await axios.delete(`${API}/admin/staff-assignments/${selectedId}`, authHeaders());
      setSelectedGroups([]);
      setEditing(false);
      setMessage('Staff group assignments deleted.');
      await load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete staff assignments.'); }
    finally { setSaving(false); }
  };
  const selected = staff.find(person => person.id === selectedId);

  return <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8">
    <div className="mb-6"><p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#7f2d3a]">Admin Management</p><h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-800" style={{ fontFamily: "'Playfair Display', serif" }}>Staff Assignments</h1><p className="mt-2 text-sm text-slate-500">Assign scholar groups to staff members for duty and attendance management.</p></div>
    {error && <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {message && <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700"><Users size={16} className="text-[#7f2d3a]" /> Staff</div>{loading ? <Loader2 className="animate-spin text-slate-400" size={20} /> : staff.map(person => <button key={person.id} onClick={() => selectStaff(person)} className={`mb-2 w-full rounded-xl border p-3 text-left ${selectedId === person.id ? 'border-[#7f2d3a] bg-[#fdf2f3]' : 'border-slate-100'}`}><p className="text-sm font-bold text-slate-700">{person.full_name}</p><p className="mt-1 text-[11px] text-slate-400">{person.email}</p><p className="mt-2 text-[11px] font-bold text-[#7f2d3a]">{person.assigned_groups?.length || 0} group(s) assigned</p></button>)}</section>
      <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm">{!selected ? <p className="text-sm text-slate-400">Select a staff member.</p> : <><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-800">{selected.full_name}</h2><p className="mt-1 text-xs text-slate-400">{editing ? 'Select the groups this staff member can manage.' : 'View assigned scholar groups.'}</p></div><div className="flex gap-2"><button onClick={() => setEditing(true)} disabled={editing} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"><Pencil size={13} /> Edit</button><button onClick={deleteAssignments} disabled={saving || !selectedGroups.length} className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 px-3 py-2 text-xs font-bold text-red-500 disabled:opacity-40"><Trash2 size={13} /> Delete</button></div></div><div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{groups.map(group => { const checked = selectedGroups.includes(group.id); return <button key={group.id} onClick={() => editing && toggle(group.id)} disabled={!editing} className={`rounded-xl border p-4 text-left disabled:cursor-default ${checked ? 'border-[#7f2d3a] bg-[#fdf2f3]' : 'border-slate-100'}`}><span className={`mb-3 flex h-5 w-5 items-center justify-center rounded-md border ${checked ? 'border-[#7f2d3a] bg-[#7f2d3a] text-white' : 'border-slate-300'}`}>{checked && <Check size={13} />}</span><p className="text-sm font-bold text-slate-700">{group.group_name}</p><p className="mt-1 text-xs text-slate-400">{group.member_count} scholar(s)</p></button>; })}</div><div className="mt-6 flex justify-end border-t border-slate-100 pt-4"><button onClick={save} disabled={saving || !editing} className="inline-flex items-center gap-2 rounded-xl bg-[#7f2d3a] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Saving...' : 'Save Assignments'}</button></div></>}</section>
    </div>
    <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div><h2 className="text-lg font-black text-slate-800">Scholar Groups</h2><p className="mt-1 text-xs text-slate-400">Create groups and manage scholar membership for duty assignments.</p></div>
        <div className="flex gap-2"><input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="New group name" className="w-40 border border-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#7f2d3a]" /><button onClick={createGroup} className="inline-flex items-center gap-1.5 rounded-xl bg-[#7f2d3a] px-3 py-2.5 text-xs font-black text-white"><Plus size={14} /> Add Group</button></div>
      </div>
      <div className="my-4 flex flex-wrap gap-2">{groups.map(group => <span key={group.id} className="rounded-full bg-[#7f2d3a]/10 px-3 py-1.5 text-xs font-black text-[#7f2d3a]">{group.group_name} · {group.member_count ?? 0} members</span>)}</div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={scholarSearch} onChange={e => setScholarSearch(e.target.value)} placeholder="Search scholar or ID" className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3 text-xs outline-none" /></div><div className="relative sm:w-52"><Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-3 text-xs"><option value="">All Groups</option><option value="unassigned">Unassigned</option>{groups.map(group => <option key={group.id} value={group.id}>{group.group_name}</option>)}</select></div></div>
      <div className="space-y-2">{visibleScholars.map(scholar => <div key={scholar.scholar_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-700">{scholar.full_name}</p><p className="text-[10px] text-slate-400">{scholar.year_level} · {scholar.scholar_id}</p></div><div className="flex items-center gap-2">{scholar.group_name && <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-600">{scholar.group_name}</span>}<select defaultValue="" onChange={e => assignScholar(scholar.scholar_id, e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"><option value="">{scholar.group_name ? 'Move to...' : 'Assign to...'}</option>{groups.filter(group => group.id !== scholar.group_id).map(group => <option key={group.id} value={group.id}>{group.group_name}</option>)}</select>{scholar.group_id && <button onClick={() => removeScholar(scholar.scholar_id, scholar.group_id)} aria-label="Remove from group" className="p-1 text-red-400 hover:text-red-600"><X size={14} /></button>}</div></div>)}</div>
    </section>
  </div>;
};

export default StaffAssignments;