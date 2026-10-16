import React, { useState, useEffect } from 'react';
import { Send, ShieldCheck, CheckCircle, AlertCircle, Mail, Activity, Radio } from 'lucide-react';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

// ── Executive design tokens ──────────────────────────────────────
const BG           = '#F7F4EE';
const SURFACE      = '#FFFDF9';
const BORDER       = '#E7D8C7';
const PRIMARY      = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const INK          = '#241512';
const MUTED        = '#8A7A68';
const BRONZE       = '#A9784E';
const SUCCESS      = '#6B8F71';
const WARNING      = '#C08A3E';
const DANGER       = '#A24A4A';
const RADIUS       = 18;

const serif = { fontFamily: "'Playfair Display', serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

const getAuthHeaders = (includeJson = false) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Your session has expired. Please sign in again.');
    return {
        Authorization: `Bearer ${token}`,
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    };
};

// Connection status — same tri-state read as before (connected / checking / error),
// just remapped onto the executive palette instead of the wax-seal metaphor.
const STATUS_TONE = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('connect') || s.includes('ready') || s.includes('ok')) return { color: SUCCESS, label: 'Connected' };
    if (s.includes('error') || s.includes('fail')) return { color: DANGER, label: 'Connection Error' };
    if (s.includes('authentication') || s.includes('session')) return { color: DANGER, label: 'Sign in again' };
    if (s === 'loading...' || s.includes('checking')) return { color: WARNING, label: 'Checking…' };
    return { color: WARNING, label: status || 'Unknown' };
};

// ── KPI card — Playfair value, quiet uppercase label ─────────────
const KpiCard = ({ icon: Icon, label, value, color }) => (
    <div className="p-5" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center mb-4" style={{ background: `${color}12`, color }}>
            <Icon size={16} />
        </div>
        <p style={{ ...serif, fontSize: '1.4rem', fontWeight: 600, color: INK, lineHeight: 1.15 }}>{value}</p>
        <p style={{ ...sans, fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: MUTED, marginTop: 6 }}>{label}</p>
    </div>
);

const StatusRow = ({ icon: Icon, label, value, color, isLast }) => (
    <div className="flex items-center justify-between py-3.5" style={{ borderBottom: isLast ? 'none' : `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-3">
            <span className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: `${PRIMARY}0F`, color: PRIMARY }}>
                <Icon size={14} />
            </span>
            <span style={{ ...sans, fontSize: '0.84rem', fontWeight: 600, color: INK }}>{label}</span>
        </div>
        <span className="px-2.5 py-1 rounded-full" style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, background: `${color}14`, color, border: `1px solid ${color}35` }}>
            {value}
        </span>
    </div>
);

const AdminNotification = () => {
    const [gmailStatus, setGmailStatus] = useState('Loading...');
    const [loadingGmail, setLoadingGmail] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [lastSent, setLastSent] = useState(null);
    const [sendError, setSendError] = useState('');

    useEffect(() => {
        let mounted = true;
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/admin/notifications/status', {
                    headers: getAuthHeaders(),
                });
                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        throw new Error('Authentication required');
                    }
                    throw new Error('Status fetch failed');
                }
                const data = await res.json();
                if (!mounted) return;
                setGmailStatus(data.gmail || 'Unknown');
            } catch (error) {
                if (!mounted) return;
                console.error('Unable to fetch notification service status:', error);
                setGmailStatus(error.message === 'Authentication required'
                    || error.message.includes('session has expired')
                    ? 'Authentication required'
                    : 'Error');
            }
        };
        fetchStatus();
        return () => { mounted = false; };
    }, []);

    const tone = STATUS_TONE(gmailStatus);
    const isCheckingStatus = gmailStatus === 'Loading...';

    const handleSendTest = async () => {
        setSendError('');
        setLastSent(null);
        try {
            setLoadingGmail(true);
            const body = testEmail ? JSON.stringify({ email: testEmail }) : undefined;
            const res = await fetch('/api/admin/notifications/test/gmail', {
                method: 'POST',
                headers: getAuthHeaders(Boolean(body)),
                body,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed');
            setLastSent(testEmail || 'the configured recipient');
        } catch (err) {
            setSendError('Gmail test failed: ' + String(err.message || err));
        } finally {
            setLoadingGmail(false);
        }
    };

    if (isCheckingStatus) {
        return (
            <div className="min-h-screen" style={{ background: BG, ...sans }}>
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="animate-pulse h-3 w-28 rounded-full mb-4" style={{ background: `${BRONZE}30` }} />
                    <div className="animate-pulse h-8 w-72 rounded-lg mb-8" style={{ background: `${PRIMARY}14` }} />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        {[0, 1, 2].map(i => <div key={i} className="animate-pulse rounded-2xl h-28" style={{ background: '#EFE6D8' }} />)}
                    </div>
                    <div className="animate-pulse rounded-2xl h-48 mb-6" style={{ background: '#EFE6D8' }} />
                    <div className="animate-pulse rounded-2xl h-64" style={{ background: '#EFE6D8' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ background: BG, ...sans }}>
            <div className="w-full px-4 sm:px-6 lg:px-8" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                <AdminPageHeader
                    title="Notification Center"
                    description="Monitor the institutional Gmail transporter and dispatch official email notifications securely."
                    actions={
                    <div className="flex flex-wrap gap-3 flex-shrink-0">
                        <div className="px-4 py-3 rounded-2xl" style={{ background: SURFACE, border: `1px solid ${BORDER}`, minWidth: 150 }}>
                            <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Gmail Status</p>
                            <p style={{ ...serif, fontSize: '1rem', fontWeight: 600, color: tone.color, marginTop: 3 }}>{tone.label}</p>
                        </div>
                        <div className="px-4 py-3 rounded-2xl" style={{ background: SURFACE, border: `1px solid ${BORDER}`, minWidth: 150 }}>
                            <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Delivery Service</p>
                            <p style={{ ...serif, fontSize: '1rem', fontWeight: 600, color: tone.color === SUCCESS ? SUCCESS : MUTED, marginTop: 3 }}>{tone.color === SUCCESS ? 'SMTP Ready' : tone.color === DANGER ? 'SMTP Error' : 'SMTP Checking'}</p>
                        </div>
                    </div>
                        }
                    />

                {/* ── System health KPI row ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiCard icon={Mail}        label="Gmail Transport"    value={tone.label}                          color={tone.color} />
                    <KpiCard icon={Radio}       label="Connection Status"  value={tone.color === SUCCESS ? 'Live' : tone.color === DANGER ? 'Down' : 'Pending'} color={tone.color} />
                    <KpiCard icon={Activity}    label="Test Deliveries"    value={lastSent ? '1 Sent' : '0 Sent'}      color={lastSent ? SUCCESS : BRONZE} />
                </div>

                {/* ── Connection status panel ── */}
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 22 }}>
                    <h3 style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: PRIMARY, marginBottom: 4 }}>Connection Status</h3>
                    <div className="mt-2">
                        <StatusRow icon={ShieldCheck} label="SMTP Transport"   value={tone.color === SUCCESS ? 'Connected' : tone.color === DANGER ? 'Disconnected' : 'Checking…'} color={tone.color} />
                        <StatusRow icon={CheckCircle} label="Authentication"  value={tone.color === SUCCESS ? 'Verified' : tone.color === DANGER ? 'Unverified' : 'Pending'} color={tone.color} />
                        <StatusRow icon={Mail}        label="Delivery Channel" value="Gmail" color={PRIMARY} isLast />
                    </div>
                </div>

                {/* ── Notification composer ── */}
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 22 }}>
                    <h3 style={{ ...serif, fontSize: '1.1rem', fontWeight: 600, color: INK }}>Send Test Notification</h3>
                    <p style={{ ...sans, fontSize: '0.8rem', color: MUTED, marginTop: 4, marginBottom: 22 }}>
                        Verify that outgoing institutional emails are delivered correctly.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                            <label style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: MUTED, display: 'block', marginBottom: 8 }}>
                                Recipient Email
                            </label>
                            <input
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                placeholder="recipient@email.com"
                                className="w-full outline-none transition-shadow"
                                style={{
                                    ...sans, fontSize: '0.86rem', color: INK, background: BG,
                                    border: `1px solid ${BORDER}`, borderRadius: 14, height: 48, padding: '0 16px',
                                }}
                                onFocus={(e) => { e.target.style.border = `1px solid ${PRIMARY}`; e.target.style.boxShadow = `0 0 0 3px ${PRIMARY}1A`; }}
                                onBlur={(e) => { e.target.style.border = `1px solid ${BORDER}`; e.target.style.boxShadow = 'none'; }}
                            />
                            <p style={{ ...sans, fontSize: '0.68rem', color: MUTED, marginTop: 6 }}>Leave blank to use the server's configured test address.</p>
                        </div>
                        <div>
                            <label style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: MUTED, display: 'block', marginBottom: 8 }}>
                                Sender
                            </label>
                            <div className="w-full flex items-center gap-2" style={{
                                background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, height: 48, padding: '0 16px',
                            }}>
                                <Mail size={14} style={{ color: BRONZE, flexShrink: 0 }} />
                                <span style={{ ...sans, fontSize: '0.86rem', color: MUTED }}>Gmail Transport (configured)</span>
                            </div>
                        </div>
                    </div>

                    {sendError && (
                        <div className="flex items-center gap-2.5 mb-4 rounded-xl px-4 py-3" style={{ background: `${DANGER}0F`, border: `1px solid ${DANGER}35` }}>
                            <AlertCircle size={16} style={{ color: DANGER, flexShrink: 0 }} />
                            <span style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: DANGER }}>{sendError}</span>
                        </div>
                    )}
                    {lastSent && !sendError && (
                        <div className="flex items-center gap-2.5 mb-4 rounded-xl px-4 py-3" style={{ background: `${SUCCESS}0F`, border: `1px solid ${SUCCESS}35` }}>
                            <CheckCircle size={16} style={{ color: SUCCESS, flexShrink: 0 }} />
                            <span style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: SUCCESS }}>Test email successfully delivered to {lastSent}.</span>
                        </div>
                    )}

                    <button
                        onClick={handleSendTest}
                        disabled={loadingGmail}
                        className="w-full flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                        style={{
                            ...sans, fontSize: '0.86rem', fontWeight: 700, background: PRIMARY, color: '#fff',
                            border: 'none', borderRadius: 14, height: 48, cursor: loadingGmail ? 'default' : 'pointer',
                        }}
                    >
                        {loadingGmail ? (
                            <>
                                <span className="animate-spin rounded-full" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                                Sending…
                            </>
                        ) : (
                            <>
                                <Send size={15} /> Send Test Email
                            </>
                        )}
                    </button>
                </div>

                {/* ── Activity footer ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 22 }}>
                    <div>
                        <p style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Last Test</p>
                        <p style={{ ...serif, fontSize: '1rem', fontWeight: 600, color: INK, marginTop: 3 }}>{lastSent || 'No test sent yet'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full" style={{ width: 8, height: 8, background: tone.color }} />
                        <span style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: tone.color }}>
                            {tone.color === SUCCESS ? 'SMTP Connected' : tone.color === DANGER ? 'SMTP Disconnected' : 'SMTP Checking…'}
                        </span>
                    </div>
                </div>

                <p style={{ ...sans, fontSize: '0.72rem', color: MUTED, textAlign: 'center', lineHeight: 1.5 }}>
                    This sends a live email through the configured Gmail transporter — use a real inbox you can check.
                </p>
            </div>
        </div>
    );
};

export default AdminNotification;