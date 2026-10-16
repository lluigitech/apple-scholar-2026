import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    Alert as MuiAlert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    MenuItem,
    Select,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip as MuiTooltip,
    Typography,
} from '@mui/material';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Cloud,
    Database,
    Download,
    FileArchive,
    FileText,
    Folder,
    FolderArchive,
    Plus,
    RefreshCw,
    RotateCcw,
    Trash2,
    XCircle,
    CalendarClock,
} from 'lucide-react';
import { formatAdminDate, getAdminLocale, getAdminTimezone } from '../../../utils/adminPreferences';
import AdminPageHeader from '../../../components/Admin/AdminPageHeader';

const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER = '#A24A4A';
const INK = '#241512';
const MUTED = '#8A7A68';
const RADIUS = 16;
const PAGE_SIZE = 5;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const cardSx = { backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: `${RADIUS}px`, boxShadow: '0 1px 2px rgba(36,21,18,0.04)' };
const API = '/api/admin/backups';
const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const STATUS_CONFIG = {
    COMPLETED: { color: SUCCESS, icon: CheckCircle2, label: 'Valid' },
    RESTORED: { color: SUCCESS, icon: CheckCircle2, label: 'Restored' },
    RESTORING: { color: WARNING, icon: Clock3, label: 'Restoring' },
    PROCESSING: { color: WARNING, icon: Clock3, label: 'Running' },
    FAILED: { color: DANGER, icon: XCircle, label: 'Failed' },
    CORRUPTED: { color: DANGER, icon: XCircle, label: 'Corrupted' },
    Completed: { color: SUCCESS, icon: CheckCircle2, label: 'Valid' },
    Processing: { color: WARNING, icon: Clock3, label: 'Running' },
    Failed: { color: DANGER, icon: XCircle, label: 'Failed' },
};

const TYPE_COLORS = { Full: PRIMARY, Database: BRONZE, Files: SUCCESS };

// Backup kinds offered when creating a backup manually.
const BACKUP_KINDS = [
    { value: 'Database', title: 'Database Backup (Recommended)', description: 'Backup database only (scholars, records, settings, compliance data, etc.)', icon: Database, tag: 'DB' },
    { value: 'Full', title: 'Full Backup', description: 'Backup database, uploaded documents, and images.', icon: Folder, tag: 'FULL' },
];

const safeFormat = (fn, value, fallback = '') => {
    try { return value ? fn(value) : fallback; } catch { return fallback; }
};
const formatTime = (value) => safeFormat((v) => new Intl.DateTimeFormat(getAdminLocale(), { timeZone: getAdminTimezone(), hour: 'numeric', minute: '2-digit' }).format(new Date(v)), value);
const formatLongDate = (value) => safeFormat((v) => formatAdminDate(new Date(v), { month: 'long' }), value, 'No data');

const formatBytes = (bytes) => {
    const n = Number(bytes || 0);
    if (!n) return null;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
};

const pageList = (current, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const sorted = [...new Set([1, total, current - 1, current, current + 1])].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push(`gap-${p}`); out.push(p); });
    return out;
};

// Readable default name, e.g. AppleScholar_DB_2026-10-05 (adds the time if that name is already taken).
const buildBackupName = (kind, existingNames) => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const base = `AppleScholar_${kind === 'Full' ? 'FULL' : 'DB'}_${date}`;
    if (!existingNames.has(base)) return base;
    return `${base}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
};

// ── Presentational helpers ──

const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.Completed;
    const Icon = config.icon;
    return (
        <Chip
            icon={<Icon size={13} />}
            label={config.label}
            size="small"
            sx={{
                ...body, height: 24, color: config.color, backgroundColor: `${config.color}18`, border: `1px solid ${config.color}30`,
                fontWeight: 600, fontSize: '0.72rem', '& .MuiChip-icon': { color: config.color, ml: '6px' },
            }}
        />
    );
};

const TypeBadge = ({ type }) => (
    <Chip
        label={type}
        size="small"
        sx={{ ...body, height: 22, borderRadius: '6px', color: '#fff', backgroundColor: TYPE_COLORS[type] || MUTED, fontWeight: 600, fontSize: '0.72rem' }}
    />
);

const IconCircle = ({ icon: Icon, filled = false, size = 36 }) => (
    <Box sx={{ width: size, height: size, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', color: filled ? '#fff' : PRIMARY, backgroundColor: filled ? PRIMARY : `${PRIMARY}12` }}>
        <Icon size={Math.round(size * 0.47)} />
    </Box>
);

const SectionHeading = ({ icon, title, subtitle, action }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 0 }}>
            <IconCircle icon={icon} filled />
            <Box sx={{ minWidth: 0 }}>
                <Typography component="h2" sx={{ ...display, color: INK, fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.2 }}>{title}</Typography>
                {subtitle && <Typography sx={{ ...body, color: MUTED, fontSize: '0.8rem', mt: 0.25 }}>{subtitle}</Typography>}
            </Box>
        </Box>
        {action}
    </Box>
);

const OverviewCard = ({ icon, label, value, lines = [], badge, loading }) => (
    <Box sx={{ ...cardSx, p: 2.25, display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
        <IconCircle icon={icon} size={52} />
        <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ ...body, color: INK, fontSize: '0.8rem', fontWeight: 500 }}>{label}</Typography>
            {loading ? <Skeleton variant="text" width={90} height={36} /> : (
                <Typography sx={{ ...display, color: INK, fontSize: '1.55rem', lineHeight: 1.2, fontWeight: 700 }}>{value}</Typography>
            )}
            {!loading && lines.map((line) => (
                <Typography key={line} sx={{ ...body, color: MUTED, fontSize: '0.76rem', lineHeight: 1.45 }}>{line}</Typography>
            ))}
            {!loading && badge}
        </Box>
    </Box>
);

const LoadingRows = () => (
    <>
        {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
                {Array.from({ length: 6 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}><Skeleton variant="text" /></TableCell>
                ))}
            </TableRow>
        ))}
    </>
);

const EmptyState = () => (
    <Box sx={{ py: 5, textAlign: 'center' }}>
        <Box sx={{ width: 64, height: 64, mx: 'auto', mb: 1.5, display: 'grid', placeItems: 'center', borderRadius: '50%', color: PRIMARY, backgroundColor: `${PRIMARY}0d` }}><FileArchive size={28} strokeWidth={1.5} /></Box>
        <Typography sx={{ ...display, color: INK, fontSize: '1.1rem', fontWeight: 600 }}>No backups found</Typography>
        <Typography sx={{ ...body, color: MUTED, mt: 0.5, fontSize: '0.8rem' }}>Create a backup above, or change the type filter.</Typography>
    </Box>
);

const BackupRecovery = ({ embedded = false }) => {
    const [loading, setLoading] = useState(true);
    const [backups, setBackups] = useState([]);
    const [policy, setPolicy] = useState({
        scheduledBackups: true,
        dailyTime: '23:59',
        timezone: 'Asia/Manila',
        weeklyDay: 'Sunday',
        dailyRetention: 14,
        fullRetention: 4,
    });
    const [backupType, setBackupType] = useState('Database');
    const [includeDocuments, setIncludeDocuments] = useState(false);
    const [includeImages, setIncludeImages] = useState(false);
    const [creating, setCreating] = useState(false);
    const [actionMessage, setActionMessage] = useState('');
    const [selectedBackupId, setSelectedBackupId] = useState('');
    const [restoreOpen, setRestoreOpen] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [typeFilter, setTypeFilter] = useState('all');
    const [page, setPage] = useState(1);

    const fetchBackups = async () => {
        try {
            const response = await axios.get(API, authConfig());
            setBackups(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            setActionMessage(error.response?.data?.error || 'Unable to load backups.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const response = await axios.get(API, authConfig());
                if (!mounted) return;
                setBackups(Array.isArray(response.data) ? response.data : []);
            } catch (error) {
                if (mounted) setActionMessage(error.response?.data?.error || 'Unable to load backups.');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        axios.get(`${API}/policy`, authConfig())
            .then(({ data }) => {
                if (mounted) setPolicy(data);
            })
            .catch((error) => {
                console.error('Unable to load backup schedule policy:', error);
            });
        return () => { mounted = false; };
    }, []);

    // Choosing a backup kind sets the type and what gets included.
    const selectKind = (kind) => {
        setBackupType(kind);
        setIncludeDocuments(kind === 'Full');
        setIncludeImages(kind === 'Full');
    };

    const createBackup = async () => {
        setCreating(true);
        setActionMessage('');
        const name = buildBackupName(backupType, new Set(backups.map((b) => b.name)));
        const payload = { name, type: backupType, includeDocuments, includeImages };
        try {
            const response = await axios.post(API, payload, authConfig());
            setBackups((current) => [response.data, ...current]);
            setPage(1);
            setActionMessage(`Backup "${response.data?.name || name}" created successfully.`);
        } catch (error) {
            setActionMessage(error.response?.data?.error || 'Unable to create backup.');
        } finally {
            setCreating(false);
        }
    };

    const downloadBackup = async (backup) => {
        try {
            const response = await axios.get(`${API}/${backup.id}/download`, { ...authConfig(), responseType: 'blob' });
            const url = URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = backup.fileName || `${backup.name}.zip`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            setActionMessage(error.response?.data?.error || 'Unable to download backup.');
        }
    };

    const deleteBackup = async (backup) => {
        try {
            await axios.delete(`${API}/${backup.id}`, authConfig());
            setBackups((current) => current.filter((item) => item.id !== backup.id));
            if (selectedBackupId === String(backup.id)) setSelectedBackupId('');
        } catch (error) {
            setActionMessage(error.response?.data?.error || 'Unable to delete backup.');
        } finally {
            setDeleteTarget(null);
        }
    };

    const selectedBackup = backups.find((backup) => String(backup.id) === selectedBackupId);

    const handleRestore = async () => {
        if (!selectedBackup) return;
        setRestoring(true);
        setActionMessage('');
        try {
            await axios.post(`${API}/${selectedBackup.id}/restore`, { confirm: true }, authConfig());
            setActionMessage('Backup restored successfully.');
            setRestoreOpen(false);
            await fetchBackups();
        } catch (error) {
            setActionMessage(error.response?.data?.error || 'Unable to restore backup.');
        } finally {
            setRestoring(false);
        }
    };

    // ── Derived overview values (all from the real backups list) ──
    const overview = useMemo(() => {
        const byDate = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        // Database and Full backups both contain the database.
        const valid = backups.filter((b) => ['COMPLETED', 'RESTORED', 'Completed'].includes(b.status));
        const latestDb = valid.filter((b) => b.type === 'Database' || b.type === 'Full').sort(byDate)[0];
        const dailyCount = valid.filter((b) => b.backupScope === 'daily' || (b.type === 'Database' && b.backupScope === 'legacy')).length;
        const fullCount = valid.filter((b) => b.backupScope === 'weekly' || (b.type === 'Full' && b.backupScope === 'legacy')).length;
        const totalBytes = backups.reduce((sum, b) => sum + Number(b.bytes || 0), 0);
        return { latestDb, dailyCount, fullCount, storage: formatBytes(totalBytes) };
    }, [backups]);

    const filteredBackups = useMemo(
        () => (typeFilter === 'all' ? backups : backups.filter((b) => b.type === typeFilter)),
        [backups, typeFilter]
    );
    useEffect(() => { setPage(1); }, [typeFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredBackups.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredBackups.slice(start, start + PAGE_SIZE);

    const latest = overview.latestDb;
    const latestStatus = latest ? (STATUS_CONFIG[latest.status] || STATUS_CONFIG.COMPLETED) : null;

    const detailRow = (label, value) => (
        <Box key={label} sx={{ display: 'flex', gap: 2, py: 0.5 }}>
            <Typography sx={{ ...body, color: MUTED, fontSize: '0.82rem', width: 64 }}>{label}:</Typography>
            <Typography sx={{ ...body, color: INK, fontSize: '0.82rem', fontWeight: 600 }}>{value || '—'}</Typography>
        </Box>
    );

    return (
        <Box sx={{ minHeight: '100%', pb: 2, px: embedded ? 0 : { xs: 2, sm: 3, lg: 4 } }}>
            {!embedded && (
                <AdminPageHeader
                    title="Backup & Recovery"
                    description="Create backups, review retention, and restore system data."
                />
            )}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
                @keyframes br-spin { to { transform: rotate(360deg); } }
                .br-spin { animation: br-spin 0.9s linear infinite; }
                .backup-table .MuiTableCell-root { border-bottom: 1px solid ${BORDER}; padding: 10px 12px; }
                .backup-table .MuiTableHead-root .MuiTableCell-root { background: ${BG}; color: ${INK}; font-size: 0.74rem; font-weight: 700; white-space: nowrap; }
                .backup-table .MuiTableBody-root .MuiTableCell-root { color: ${INK}; font-size: 0.8rem; }
                .backup-table .MuiTableBody-root .MuiTableRow-root:last-child .MuiTableCell-root { border-bottom: 0; }
            `}</style>

            {/* ── 1. Backup overview ── */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 2.5 }}>
                <OverviewCard
                    icon={Database}
                    label="Last Database Backup"
                    loading={loading}
                    value={latest ? formatLongDate(latest.createdAt) : 'No data'}
                    lines={latest ? [`${formatTime(latest.createdAt)} · ${latestStatus.label}`] : ['No backups yet']}
                    badge={latest && (
                        <Chip
                            label={['COMPLETED', 'RESTORED', 'Completed'].includes(latest.status) ? 'Success' : latestStatus.label}
                            size="small"
                            sx={{ ...body, mt: 0.75, height: 22, color: latestStatus.color, backgroundColor: `${latestStatus.color}18`, fontWeight: 600, fontSize: '0.72rem' }}
                        />
                    )}
                />
                <OverviewCard icon={FileText} label="Daily Backups Retained" loading={loading} value={overview.dailyCount} lines={['Daily copies (database only)']} />
                <OverviewCard icon={Folder} label="Weekly / Full Backups" loading={loading} value={overview.fullCount} lines={['Weekly backups', '(database + documents + images)']} />
                <OverviewCard icon={Cloud} label="Backup Storage" loading={loading} value={overview.storage || '—'} lines={[overview.storage ? 'Used backup storage' : 'Storage size not reported']} />
            </Box>

            {/* ── 2. Backup Schedule & Policy (informational) ── */}
            <Box sx={{ ...cardSx, p: 2.5, mb: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.1fr 1fr 1fr' }, gap: { xs: 2.5, lg: 0 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, pr: { lg: 3 } }}>
                    <IconCircle icon={Clock3} size={44} />
                    <Box>
                        <Typography component="h2" sx={{ ...display, color: INK, fontSize: '1.1rem', fontWeight: 600 }}>Backup Schedule &amp; Policy</Typography>
                        <Typography sx={{ ...body, color: MUTED, fontSize: '0.8rem', mt: 0.25 }}>Automated backup configuration for data protection.</Typography>
                    </Box>
                </Box>

                {[
                    { icon: CalendarClock, title: 'Daily Database Backup', lines: [`Every day at ${policy.dailyTime} (${policy.timezone})`, `Retain ${policy.dailyRetention} valid copies`], tag: 'Database only', tagColor: BRONZE },
                    { icon: Folder, title: 'Weekly / Full Backup', lines: [`Every ${policy.weeklyDay}: database + selected files`, `Retain ${policy.fullRetention} valid copies`], tag: 'Full system backup', tagColor: PRIMARY },
                ].map((item) => (
                    <Box key={item.title} sx={{ display: 'flex', alignItems: 'center', gap: 1.75, pl: { lg: 3 }, borderLeft: { lg: `1px solid ${BORDER}` }, borderTop: { xs: `1px solid ${BORDER}`, lg: 'none' }, pt: { xs: 2.5, lg: 0 } }}>
                        <IconCircle icon={item.icon} size={40} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ ...body, color: INK, fontSize: '0.88rem', fontWeight: 700 }}>{item.title}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                                <Box>
                                    {item.lines.map((line) => (
                                        <Typography key={line} sx={{ ...body, color: MUTED, fontSize: '0.78rem', lineHeight: 1.5 }}>{line}</Typography>
                                    ))}
                                </Box>
                                <Chip label={item.tag} size="small" sx={{ ...body, height: 22, color: item.tagColor, backgroundColor: `${item.tagColor}14`, fontWeight: 600, fontSize: '0.7rem' }} />
                            </Box>
                        </Box>
                    </Box>
                ))}
            </Box>

            {actionMessage && (
                <MuiAlert severity="info" onClose={() => setActionMessage('')} sx={{ ...body, mb: 2.5, color: PRIMARY, backgroundColor: `${PRIMARY}0d`, border: `1px solid ${PRIMARY}25`, '& .MuiAlert-icon': { color: PRIMARY } }}>
                    {actionMessage}
                </MuiAlert>
            )}

            {/* ── 3. Main bento: left 70% / right 30% ── */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(0, 3fr)' }, gap: 2.5, alignItems: 'start' }}>

                {/* LEFT */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>

                    {/* Create Backup */}
                    <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
                        <SectionHeading icon={Plus} title="Create Backup" subtitle="Manually create a backup of the system data." />
                        <Box role="radiogroup" aria-label="Backup type" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                            {BACKUP_KINDS.map((kind) => {
                                const selected = backupType === kind.value;
                                return (
                                    <Box
                                        key={kind.value}
                                        role="radio"
                                        aria-checked={selected}
                                        tabIndex={0}
                                        onClick={() => selectKind(kind.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectKind(kind.value); } }}
                                        sx={{
                                            display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75, borderRadius: '12px', cursor: 'pointer',
                                            border: `1.5px solid ${selected ? PRIMARY : BORDER}`, backgroundColor: selected ? `${PRIMARY}0a` : '#fff',
                                            transition: 'border-color .15s, background-color .15s', '&:focus-visible': { outline: `2px solid ${PRIMARY}`, outlineOffset: 2 },
                                        }}
                                    >
                                        <IconCircle icon={kind.icon} size={40} />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{ ...body, color: INK, fontSize: '0.86rem', fontWeight: 700 }}>{kind.title}</Typography>
                                            <Typography sx={{ ...body, color: MUTED, fontSize: '0.76rem', mt: 0.25, lineHeight: 1.45 }}>{kind.description}</Typography>
                                        </Box>
                                        <Box sx={{ width: 20, height: 20, flexShrink: 0, borderRadius: '50%', border: `2px solid ${selected ? PRIMARY : BORDER}`, display: 'grid', placeItems: 'center' }}>
                                            {selected && <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: PRIMARY }} />}
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                            <Button
                                variant="contained"
                                onClick={createBackup}
                                disabled={creating}
                                startIcon={creating ? <RefreshCw size={16} className="br-spin" /> : <Database size={16} />}
                                sx={{ ...body, minHeight: 40, px: 2.5, borderRadius: '10px', backgroundColor: PRIMARY, boxShadow: 'none', textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', '&:hover': { backgroundColor: PRIMARY_DEEP, boxShadow: 'none' } }}
                            >
                                {creating ? 'Creating…' : 'Create Backup'}
                            </Button>
                        </Box>
                    </Box>

                    {/* Available Backups */}
                    <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
                        <SectionHeading
                            icon={Database}
                            title="Available Backups"
                            subtitle="View and manage all system backups."
                            action={
                                <FormControl size="small" sx={{ minWidth: 140 }}>
                                    <Select
                                        value={typeFilter}
                                        onChange={(e) => setTypeFilter(e.target.value)}
                                        inputProps={{ 'aria-label': 'Filter by backup type' }}
                                        sx={{ ...body, fontSize: '0.82rem', borderRadius: '10px', backgroundColor: '#fff', '& fieldset': { borderColor: BORDER } }}
                                    >
                                        <MenuItem value="all">All Types</MenuItem>
                                        <MenuItem value="Database">Database</MenuItem>
                                        <MenuItem value="Full">Full</MenuItem>
                                    </Select>
                                </FormControl>
                            }
                        />

                        {loading ? (
                            <TableContainer><Table className="backup-table"><TableBody><LoadingRows /></TableBody></Table></TableContainer>
                        ) : filteredBackups.length === 0 ? (
                            <EmptyState />
                        ) : (
                            <>
                                <TableContainer sx={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
                                    <Table className="backup-table" sx={{ minWidth: 760 }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Backup File</TableCell>
                                                <TableCell>Type</TableCell>
                                                <TableCell>Size</TableCell>
                                                <TableCell>Created</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell align="right">Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {pageRows.map((backup) => (
                                                <TableRow key={backup.id} hover>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                                            <Box sx={{ color: MUTED, display: 'grid', placeItems: 'center' }}><FileText size={16} /></Box>
                                                            <Typography sx={{ ...body, fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{backup.fileName || backup.name}</Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell><TypeBadge type={backup.type} /></TableCell>
                                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{backup.size || '—'}</TableCell>
                                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                        {formatLongDate(backup.createdAt)}{formatTime(backup.createdAt) ? <span style={{ color: MUTED }}> {formatTime(backup.createdAt)}</span> : null}
                                                    </TableCell>
                                                    <TableCell><StatusBadge status={backup.status} /></TableCell>
                                                    <TableCell align="right">
                                                        <Box sx={{ display: 'inline-flex', gap: 0.75 }}>
                                                            {[
                                                                { label: 'Download', icon: Download, color: PRIMARY, disabled: !['COMPLETED', 'RESTORED', 'Completed'].includes(backup.status), onClick: () => downloadBackup(backup) },
                                                                { label: 'Restore', icon: RotateCcw, color: PRIMARY, disabled: !['COMPLETED', 'RESTORED', 'Completed'].includes(backup.status), onClick: () => { setSelectedBackupId(String(backup.id)); setRestoreOpen(true); } },
                                                                { label: 'Delete', icon: Trash2, color: DANGER, onClick: () => setDeleteTarget(backup) },
                                                            ].map(({ label, icon: Icon, color, disabled = false, onClick }) => (
                                                                <MuiTooltip key={label} title={label}>
                                                                    <IconButton aria-label={`${label} ${backup.name}`} size="small" disabled={disabled} onClick={onClick} sx={{ color, border: `1px solid ${BORDER}`, borderRadius: '8px', width: 30, height: 30, backgroundColor: '#fff' }}>
                                                                        <Icon size={15} />
                                                                    </IconButton>
                                                                </MuiTooltip>
                                                            ))}
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mt: 1.75 }}>
                                    <Typography sx={{ ...body, color: MUTED, fontSize: '0.8rem' }}>
                                        Showing {start + 1} to {Math.min(start + PAGE_SIZE, filteredBackups.length)} of {filteredBackups.length} backup{filteredBackups.length === 1 ? '' : 's'}
                                    </Typography>
                                    <Box component="nav" aria-label="Pagination" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <IconButton aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} sx={{ width: 32, height: 32, borderRadius: '8px', border: `1px solid ${BORDER}`, backgroundColor: '#fff', color: INK }}>
                                            <ChevronLeft size={16} />
                                        </IconButton>
                                        {pageList(currentPage, totalPages).map((p) => (typeof p === 'string' ? (
                                            <Typography key={p} sx={{ ...body, color: MUTED, px: 0.5 }}>…</Typography>
                                        ) : (
                                            <Button
                                                key={p}
                                                onClick={() => setPage(p)}
                                                aria-current={p === currentPage ? 'page' : undefined}
                                                sx={{
                                                    ...body, minWidth: 32, width: 32, height: 32, p: 0, borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                                                    color: p === currentPage ? '#fff' : INK, backgroundColor: p === currentPage ? PRIMARY : '#fff',
                                                    border: `1px solid ${p === currentPage ? PRIMARY : BORDER}`, '&:hover': { backgroundColor: p === currentPage ? PRIMARY_DEEP : BG },
                                                }}
                                            >
                                                {p}
                                            </Button>
                                        )))}
                                        <IconButton aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} sx={{ width: 32, height: 32, borderRadius: '8px', border: `1px solid ${BORDER}`, backgroundColor: '#fff', color: INK }}>
                                            <ChevronRight size={16} />
                                        </IconButton>
                                    </Box>
                                </Box>
                            </>
                        )}
                    </Box>
                </Box>

                {/* RIGHT — Restore Backup */}
                <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
                    <SectionHeading icon={RotateCcw} title="Restore Backup" subtitle="Select a backup from the list to restore." />

                    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', p: 1.5, borderRadius: '12px', backgroundColor: `${WARNING}12`, border: `1px solid ${WARNING}30`, mb: 2 }}>
                        <Box sx={{ color: WARNING, mt: '2px', display: 'grid' }}><AlertTriangle size={17} /></Box>
                        <Typography sx={{ ...body, color: INK, fontSize: '0.78rem', lineHeight: 1.55 }}>
                            Restoring will replace the current database with the selected backup. Make sure to choose the correct backup file.
                        </Typography>
                    </Box>

                    <Typography component="label" htmlFor="restore-select" sx={{ ...body, display: 'block', color: INK, fontSize: '0.84rem', fontWeight: 700, mb: 0.75 }}>Select Backup</Typography>
                    <FormControl fullWidth size="small">
                        <Select
                            id="restore-select"
                            displayEmpty
                            value={selectedBackupId}
                            onChange={(e) => setSelectedBackupId(e.target.value)}
                            renderValue={(value) => (value ? (backups.find((b) => String(b.id) === value)?.name || '') : <span style={{ color: MUTED }}>Choose a backup file…</span>)}
                            sx={{ ...body, fontSize: '0.84rem', borderRadius: '10px', backgroundColor: '#fff', '& fieldset': { borderColor: BORDER } }}
                        >
                            <MenuItem value=""><em>Choose a backup file…</em></MenuItem>
                            {backups.map((backup) => (
                                ['COMPLETED', 'RESTORED', 'Completed'].includes(backup.status)
                                    ? <MenuItem key={backup.id} value={String(backup.id)} sx={{ ...body, fontSize: '0.82rem' }}>{backup.name}</MenuItem>
                                    : null
                            ))}
                        </Select>
                    </FormControl>

                    <Typography sx={{ ...body, color: INK, fontSize: '0.84rem', fontWeight: 700, mt: 2.25, mb: 0.5 }}>Backup Details</Typography>
                    <Box>
                        {detailRow('Type', selectedBackup?.type)}
                        {detailRow('Size', selectedBackup?.size)}
                        {detailRow('Date', selectedBackup ? `${selectedBackup.date}${formatTime(selectedBackup.createdAt) ? ` · ${formatTime(selectedBackup.createdAt)}` : ''}` : '')}
                        {detailRow('Status', selectedBackup ? (STATUS_CONFIG[selectedBackup.status]?.label || selectedBackup.status) : '')}
                    </Box>

                    <Button
                        fullWidth
                        variant="contained"
                        disabled={!selectedBackup || !['COMPLETED', 'RESTORED', 'Completed'].includes(selectedBackup.status)}
                        onClick={() => setRestoreOpen(true)}
                        startIcon={<RotateCcw size={16} />}
                        sx={{ ...body, mt: 2.25, minHeight: 44, borderRadius: '10px', backgroundColor: PRIMARY, boxShadow: 'none', textTransform: 'none', fontWeight: 700, '&:hover': { backgroundColor: PRIMARY_DEEP, boxShadow: 'none' } }}
                    >
                        Restore Database
                    </Button>
                </Box>
            </Box>

            {/* ── Restore confirmation ── */}
            <Dialog open={restoreOpen} onClose={() => !restoring && setRestoreOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle sx={{ ...display, color: INK, fontWeight: 700 }}>Confirm database recovery</DialogTitle>
                <DialogContent>
                    <MuiAlert icon={<AlertTriangle size={19} />} severity="error" sx={{ ...body, color: DANGER, backgroundColor: `${DANGER}10`, border: `1px solid ${DANGER}30`, '& .MuiAlert-icon': { color: DANGER } }}>
                        This will replace the current database with the selected backup. This action may overwrite newer records.
                    </MuiAlert>
                    <Typography sx={{ ...body, color: MUTED, fontSize: '0.82rem', mt: 2 }}>
                        Selected backup: <strong style={{ color: INK }}>{selectedBackup?.name || 'None'}</strong>
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2.5, pt: 1 }}>
                    <Button onClick={() => setRestoreOpen(false)} disabled={restoring} sx={{ ...body, color: MUTED, textTransform: 'none' }}>Cancel</Button>
                    <Button variant="contained" onClick={handleRestore} disabled={restoring || !selectedBackup || !['COMPLETED', 'RESTORED', 'Completed'].includes(selectedBackup.status)} startIcon={<RotateCcw size={16} />} sx={{ ...body, backgroundColor: DANGER, boxShadow: 'none', textTransform: 'none', fontWeight: 700, '&:hover': { backgroundColor: '#8A3C3C', boxShadow: 'none' } }}>
                        {restoring ? 'Restoring…' : 'Confirm Restore'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Delete confirmation ── */}
            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ ...display, color: INK, fontWeight: 700 }}>Delete this backup?</DialogTitle>
                <DialogContent>
                    <Typography sx={{ ...body, color: MUTED, fontSize: '0.84rem' }}>
                        <strong style={{ color: INK }}>{deleteTarget?.name}</strong> will be permanently removed and can no longer be restored.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2.5, pt: 1 }}>
                    <Button onClick={() => setDeleteTarget(null)} sx={{ ...body, color: MUTED, textTransform: 'none' }}>Cancel</Button>
                    <Button variant="contained" onClick={() => deleteBackup(deleteTarget)} startIcon={<Trash2 size={16} />} sx={{ ...body, backgroundColor: DANGER, boxShadow: 'none', textTransform: 'none', fontWeight: 700, '&:hover': { backgroundColor: '#8A3C3C', boxShadow: 'none' } }}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default BackupRecovery;