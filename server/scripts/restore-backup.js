const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', 'utils', '.env') });

const backupId = process.argv[2];
const allowNoSafetyBackup = process.argv.includes('--allow-no-safety-backup');

if (!backupId) {
    console.error('Usage: node scripts/restore-backup.js <backup-id> [--allow-no-safety-backup]');
    process.exit(2);
}

const db = require('../config/db');
const backupService = require('../services/backupRecoveryService');

(async () => {
    try {
        await db.ready;
        const result = await backupService.restoreBackup(backupId, {
            confirmed: true,
            allowNoSafetyBackup,
        });
        console.log(JSON.stringify({
            action: 'BACKUP_RESTORE_SUCCESS',
            backupId: result.id,
            safetyBackupId: result.safetyBackupId,
            restored: result.restored,
        }));
    } catch (error) {
        console.error(JSON.stringify({
            action: 'BACKUP_RESTORE_FAILED',
            backupId,
            error: error.message || 'Restore failed.',
        }));
        process.exitCode = 1;
    } finally {
        db.end(() => {});
    }
})();
