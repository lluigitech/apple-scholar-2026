const backupService = require('../services/backupRecoveryService');
const { logAuditEvent } = require('../utils/auditLogger');

const getCreatedBy = (req) => req.user?.email || `Admin ${req.user?.id || ''}`.trim();
const logBackupAction = (req, action, backup, result) => logAuditEvent({
    req,
    action,
    module: 'Backup & Recovery',
    details: `Backup ${backup?.id || 'unknown'}${backup?.name ? ` (${backup.name})` : ''}`,
    result,
});

exports.list = async (req, res) => {
    try {
        res.json(await backupService.listBackups());
    } catch (error) {
        console.error('List backups failed:', error);
        res.status(500).json({ error: 'Failed to list backups.' });
    }
};

exports.policy = async (req, res) => {
    try {
        res.json(await backupService.getBackupPolicy());
    } catch (error) {
        console.error('Load backup policy failed:', error.message || error);
        res.status(500).json({ error: 'Failed to load backup policy.' });
    }
};

exports.create = async (req, res) => {
    try {
        const backup = await backupService.createBackup({
            name: req.body?.name,
            type: req.body?.type,
            includeDocuments: req.body?.includeDocuments,
            includeImages: req.body?.includeImages,
            createdBy: getCreatedBy(req),
        });
        await logBackupAction(req, 'BACKUP_CREATED', backup, 'success');
        res.status(201).json(backup);
    } catch (error) {
        console.error('Create backup failed:', error);
        await logBackupAction(req, 'BACKUP_FAILED', null, 'failed');
        const status = error.statusCode || (error.code === 'DATABASE_DUMP_FAILED' ? 503 : 500);
        res.status(status).json({ error: error.statusCode ? error.message : 'Backup creation failed. Check server logs for details.' });
    }
};

exports.download = async (req, res) => {
    try {
        const backup = await backupService.getBackup(req.params.id);
        const filePath = await backupService.getFilePath(backup.id);
        res.download(filePath, backup.fileName, (error) => {
            if (error && !res.headersSent) res.status(404).json({ error: 'Backup file not found.' });
        });
        res.once('finish', () => {
            if (res.statusCode === 200) {
                void backupService.recordRecoveryOperation({
                    action: 'BACKUP_DOWNLOADED',
                    backup,
                    userId: req.user?.id,
                    result: 'success',
                });
                void logBackupAction(req, 'BACKUP_DOWNLOADED', backup, 'success');
            }
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to download backup.' });
    }
};

exports.remove = async (req, res) => {
    try {
        const backup = await backupService.getBackup(req.params.id);
        await backupService.deleteBackup(req.params.id);
        await logBackupAction(req, 'BACKUP_DELETED', backup, 'success');
        res.status(204).end();
    } catch (error) {
        if (error.statusCode !== 404 && error.statusCode !== 400) await logBackupAction(req, 'BACKUP_DELETED', null, 'failed');
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete backup.' });
    }
};

exports.restore = async (req, res) => {
    let backup = null;
    try {
        if (req.body?.confirm !== true) return res.status(400).json({ error: 'Confirm the restore operation before continuing.' });
        backup = await backupService.getBackup(req.params.id);
        await logBackupAction(req, 'BACKUP_RESTORE_STARTED', backup, 'success');
        const result = await backupService.restoreBackup(req.params.id, { confirmed: true });
        await logBackupAction(req, 'BACKUP_RESTORE_SUCCESS', backup, 'success');
        res.json(result);
    } catch (error) {
        console.error('Restore backup failed:', error);
        await logBackupAction(req, 'BACKUP_RESTORE_FAILED', backup, 'failed');
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to restore backup.' });
    }
};
