# Backup and disaster recovery

## Storage and contents

Backup archives and their JSON manifest are stored under `BACKUP_DIR` (default:
`server/backups`). Set it to a mounted, access-restricted disk or remote filesystem
for production. Local storage on the same machine does not protect against loss of
that machine or disk. The manifest is intentionally outside MySQL so backup IDs
and files remain available when the application database is unavailable.

Backups are ZIP files containing a SQL database dump and, when selected, uploaded
files. The application stores scholar uploads in Cloudinary and may also keep
generated documents under `server/uploads`; full backups include both sources
when the requested include options are enabled. Cloudinary credentials must be
configured for backups that include Cloudinary-hosted files.

Backup archives are **not encrypted**. Restrict access to the backup directory
and use encrypted storage provided by the deployment environment.

## Schedule and retention

- Daily database-only backup: `BACKUP_TIME` (default `23:59`) in
  `BACKUP_TIMEZONE` (default `Asia/Manila`); retain 14 valid scheduled daily
  backups by default.
- Weekly full backup: Sunday at the same configured time; retain 4 valid
  scheduled full backups by default.
- `BACKUP_DAILY_RETENTION` and `BACKUP_FULL_RETENTION` configure those defaults.
  The administrator's Backup Defaults retention setting overrides the daily
  retention value.
- Failed or corrupted backups do not count toward retention. Retention is only
  applied after a newly scheduled backup has completed and passed validation.
- MySQL `GET_LOCK` prevents two application instances connected to the same
  MySQL server from running the scheduled job simultaneously.

## Restore

The Admin website requires a valid administrator token from the live database.
If MySQL is unavailable, its normal login and authenticated restore endpoint
cannot be used. An operator with shell access to the server can restore by backup
ID:

```powershell
cd server
node scripts/restore-backup.js <backup-id>
```

The command creates a safety backup first and stops if it cannot. Only when an
operator has explicitly decided that no safety backup is possible should they
use:

```powershell
node scripts/restore-backup.js <backup-id> --allow-no-safety-backup
```

For recovery when the database itself is unavailable, install the MySQL command
line client (`mysql`) and configure its host/user/password using the application's
existing `DB_HOST`, `DB_USER`, and `DB_PASSWORD` (or `DB_PASS`) environment
variables. The `mysql` client must have permission to create/use the configured
database. Do not expose recovery scripts or backup files through a public static
web path.

The UI restore operation requires explicit confirmation, validates the selected
archive and SQL checksum, creates a full safety backup, restores the database,
restores selected local/Cloudinary files, and verifies that the database responds
and contains tables. If a restore fails after the safety backup succeeds, the
service attempts to restore that safety backup. Restore outcome is recorded in
the database audit log when available and in `recovery-events.jsonl` beside the
manifest.

Database dump creation prefers `mysqldump`. If it is unavailable, a limited
mysql2 fallback can back up databases consisting only of base tables; it fails
explicitly if views, triggers, routines, or events exist. Restoring an archive
when the database is unavailable requires the `mysql` command line client.

Backups are disaster-recovery artifacts containing sensitive scholar data.
Store `BACKUP_DIR` outside the application database and preferably on separate,
access-controlled storage. The application does not currently replicate backup
archives to another host/object store.
