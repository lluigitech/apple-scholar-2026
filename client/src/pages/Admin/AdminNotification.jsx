import React, { useState, useEffect } from 'react';
import { BellRing, Mail, MessageSquare, CheckCircle, RefreshCw } from 'lucide-react';

const AdminNotification = () => {
    const [messengerStatus, setMessengerStatus] = useState('Loading...');
    const [gmailStatus, setGmailStatus] = useState('Loading...');
    const [loadingGmail, setLoadingGmail] = useState(false);
    const [loadingMessenger, setLoadingMessenger] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState('');
    const [testEmail, setTestEmail] = useState('');

    useEffect(() => {
        let mounted = true;
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/admin/notifications/status');
                if (!res.ok) throw new Error('Status fetch failed');
                const data = await res.json();
                if (!mounted) return;
                setGmailStatus(data.gmail || 'Unknown');
                setMessengerStatus(data.messenger || 'Unknown');
            } catch (e) {
                if (!mounted) return;
                setGmailStatus('Error');
                setMessengerStatus('Error');
            }
        };
        fetchStatus();
        return () => { mounted = false; };
    }, []);

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 font-serif">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8">
                <span className="text-[10px] bg-amber-100 text-amber-800 font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full font-sans">
                    Multi-Channel Dispatch Engine
                </span>
                <h1 className="text-3xl font-black text-slate-800 mt-2 tracking-tight">Notification Manager</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                {/* Messenger webhook box */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between gap-4">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                <MessageSquare size={22} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-base">Meta Messenger Webhook API</h3>
                                <p className="text-xs text-slate-400">Handles automated direct text alerts for deadlines.</p>
                            </div>
                        </div>
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                            {messengerStatus}
                        </span>
                    </div>
                    <div className="flex flex-col gap-2">
                        <input
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            placeholder="Optional webhook URL (overrides server)"
                            className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 placeholder-slate-400"
                        />
                        <div className="flex gap-2">
                            <button onClick={async () => {
                                try {
                                    setLoadingMessenger(true);
                                    const body = webhookUrl ? JSON.stringify({ url: webhookUrl }) : undefined;
                                    const res = await fetch('/api/admin/notifications/test/messenger', {
                                        method: 'POST',
                                        headers: body ? { 'Content-Type': 'application/json' } : undefined,
                                        body,
                                    });
                                    const json = await res.json();
                                    if (!res.ok) throw new Error(json.error || 'Failed');
                                    alert('Messenger webhook test sent');
                                } catch (err) {
                                    alert('Messenger test failed: ' + String(err));
                                } finally { setLoadingMessenger(false); }
                            }} className="text-[10px] border border-slate-200 hover:bg-slate-50 font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all">
                                {loadingMessenger ? 'Sending…' : 'Test Hook'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Gmail mailer box */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between gap-4">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                                <Mail size={22} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-base">Gmail SMTP Transporter</h3>
                                <p className="text-xs text-slate-400">Dispatches formal compliance notices and risk alerts.</p>
                            </div>
                        </div>
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                            {gmailStatus}
                        </span>
                    </div>
                    <div className="space-y-3">
                        <input
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="Recipient email for test message"
                            className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 placeholder-slate-400 w-full"
                        />
                        <div className="flex gap-2">
                            <button onClick={async () => {
                                try {
                                    setLoadingGmail(true);
                                    const body = testEmail ? JSON.stringify({ email: testEmail }) : undefined;
                                    const res = await fetch('/api/admin/notifications/test/gmail', {
                                        method: 'POST',
                                        headers: body ? { 'Content-Type': 'application/json' } : undefined,
                                        body,
                                    });
                                    const json = await res.json();
                                    if (!res.ok) throw new Error(json.error || 'Failed');
                                    alert('Test email sent — check recipient');
                                } catch (err) {
                                    alert('Gmail test failed: ' + String(err));
                                } finally { setLoadingGmail(false); }
                            }} className="text-[10px] border border-slate-200 hover:bg-slate-50 font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all">
                                {loadingGmail ? 'Sending…' : 'Test Connection'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminNotification;