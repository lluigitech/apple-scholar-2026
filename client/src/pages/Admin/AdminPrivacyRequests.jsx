import { useEffect, useState } from 'react';
import axios from 'axios';

const API = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/, '')}/api`;
const headers = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AdminPrivacyRequests() {
    const [requests, setRequests] = useState([]);
    const [error, setError] = useState('');

    const load = async () => {
        try {
            const response = await axios.get(`${API}/admin/privacy-requests`, headers());
            setRequests(response.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to load privacy requests.');
        }
    };

    useEffect(() => {
        const initialize = async () => {
            await load();
        };
        initialize();
    }, []);

    const update = async (id, status) => {
        try {
            await axios.patch(`${API}/admin/privacy-requests/${id}`, { status }, headers());
            setRequests(current => current.map(item => item.id === id ? { ...item, status, processed_at: new Date().toISOString() } : item));
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to update privacy request.');
        }
    };

    return (
        <main className="p-6 lg:p-8">
            <h1 className="text-2xl font-bold text-[#4f1620]">Privacy Requests</h1>
            <p className="mt-1 text-sm text-slate-500">Review scholar requests for personal data export or deletion.</p>
            {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                        <th className="p-3">Scholar</th><th className="p-3">Request</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Action</th>
                    </tr></thead>
                    <tbody>
                        {!requests.length && <tr><td colSpan="5" className="p-6 text-center text-slate-500">No privacy requests.</td></tr>}
                        {requests.map(request => <tr key={request.id} className="border-t border-slate-100">
                            <td className="p-3"><div className="font-semibold">{request.full_name}</div><div className="text-xs text-slate-500">{request.scholar_id} · {request.email}</div></td>
                            <td className="p-3 capitalize">{request.request_type}</td>
                            <td className="p-3">{new Date(request.requested_at).toLocaleString('en-PH')}</td>
                            <td className="p-3 capitalize">{request.status}</td>
                            <td className="p-3">{request.status === 'pending' && <div className="flex gap-2"><button type="button" onClick={() => update(request.id, 'approved')} className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white">Approve</button><button type="button" onClick={() => update(request.id, 'rejected')} className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white">Reject</button></div>}</td>
                        </tr>)}
                    </tbody>
                </table>
            </div>
        </main>
    );
}