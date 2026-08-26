import { useEffect, useState } from 'react';
import axios from 'axios';
import { Check, Loader2, ShieldCheck, Users } from 'lucide-react';

const API = 'http://localhost:5000/api';
const YEAR_LEVELS = [
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  '1st Year College', '2nd Year College', '3rd Year College',
  '4th Year College', '5th Year College',
];
const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const OfficerAssignments = () => {
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
      setMessage('Assignments saved successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save assignments.');
    } finally {
      setSaving(false);
    }
  };

  const selectedOfficer = officers.find(officer => officer.id === selectedId);

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#7f2d3a]">Admin Management</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-800" style={{ fontFamily: "'Playfair Display', serif" }}>Officer Assignments</h1>
        <p className="mt-2 text-sm text-slate-500">Assign year levels so each officer only sees the scholars they are responsible for.</p>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700"><Users size={16} className="text-[#7f2d3a]" /> Officers</div>
          {loading ? <Loader2 className="animate-spin text-slate-400" size={20} /> : officers.length === 0 ? <p className="text-sm text-slate-400">No officers found.</p> : (
            <div className="space-y-2">
              {officers.map(officer => (
                <button key={officer.id} onClick={() => selectOfficer(officer)} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedId === officer.id ? 'border-[#7f2d3a] bg-[#fdf2f3]' : 'border-slate-100 hover:border-slate-200'}`}>
                  <p className="truncate text-sm font-bold text-slate-700">{officer.full_name}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{officer.email}</p>
                  <p className="mt-2 text-[11px] font-bold text-[#7f2d3a]">{officer.assigned_year_levels?.length || 0} level(s) assigned</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm">
          {!selectedOfficer ? <div className="flex min-h-56 items-center justify-center text-sm text-slate-400">Select an officer to manage assignments.</div> : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-5">
                <div>
                  <p className="text-lg font-black text-slate-800">{selectedOfficer.full_name}</p>
                  <p className="mt-1 text-xs text-slate-400">{selectedOfficer.email}</p>
                </div>
                <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold ${selectedLevels.length ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <ShieldCheck size={13} /> {selectedLevels.length ? 'Assigned' : 'Needs assignment'}
                </span>
              </div>
              <div className="py-5">
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Visible Scholar Year Levels</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {YEAR_LEVELS.map(level => {
                    const checked = selectedLevels.includes(level);
                    return <button key={level} onClick={() => toggleLevel(level)} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-bold transition-colors ${checked ? 'border-[#7f2d3a] bg-[#fdf2f3] text-[#7f2d3a]' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${checked ? 'border-[#7f2d3a] bg-[#7f2d3a] text-white' : 'border-slate-300'}`}>{checked && <Check size={13} />}</span>{level}</button>;
                  })}
                </div>
                <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-500">An officer with no assigned level will see no scholar records. Admin accounts retain full visibility.</p>
              </div>
              <div className="flex justify-end border-t border-slate-100 pt-4"><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#7f2d3a] px-5 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50">{saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Saving...' : 'Save Assignments'}</button></div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default OfficerAssignments;
