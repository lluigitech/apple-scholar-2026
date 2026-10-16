const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { Readable } = require('stream');
const { ZipArchive } = require('archiver');
const unzipper = require('unzipper');
const mysqlEscaper = require('mysql2');
const cloudinary = require('../config/cloudinary');
const db = require('../config/db');

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.resolve(ROOT, process.env.BACKUP_DIR || 'backups');
const MANIFEST_PATH = path.join(BACKUP_DIR, 'index.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const IMAGES_DIR = path.join(ROOT, 'assets', 'images');
const SCHEDULER_LOCK_NAME = 'apple-scholar-backup-scheduler';
const DAILY_RETENTION = Math.max(1, Number.parseInt(process.env.BACKUP_DAILY_RETENTION || '14', 10));
const FULL_RETENTION = Math.max(1, Number.parseInt(process.env.BACKUP_FULL_RETENTION || '4', 10));
const DATABASE_NAME = process.env.DB_NAME || 'kalinga_db';
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff', 'mp4', 'mov', 'webm']);
const DATABASE_UNAVAILABLE = 'The database backup could not be created. Check database connectivity and mysqldump availability.';

let scheduledBackupRunning = false;
let manifestQueue = Promise.resolve();
let lastDailyRunDate = '';
let lastWeeklyRunDate = '';

const normalizeStatus = (status) => {
    const value = String(status || '').toUpperCase();
    if (value === 'COMPLETED' || value === 'COMPLETE') return 'COMPLETED';
    if (value === 'PROCESSING') return 'RESTORING';
    if (value === 'RESTORED') return 'RESTORED';
    if (value === 'CORRUPTED') return 'CORRUPTED';
    if (value === 'FAILED') return 'FAILED';
    return value || 'FAILED';
};

const isSafeId = (id) => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id);

const ensureBackupDir = async () => {
    await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
    try {
        await fs.promises.access(MANIFEST_PATH);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await fs.promises.writeFile(MANIFEST_PATH, '[]', { encoding: 'utf8', flag: 'wx' }).catch((writeError) => {
            if (writeError.code !== 'EEXIST') throw writeError;
        });
    }
};

const recordRecoveryOperation = async ({ action, backup, userId, result }) => {
    const entry = {
        timestamp: new Date().toISOString(),
        action,
        backupId: backup?.id || null,
        backupName: backup?.name || null,
        userId: userId || null,
        result,
    };
    try {
        await fs.promises.appendFile(path.join(BACKUP_DIR, 'recovery-events.jsonl'), `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (error) {
        console.error('[backup-audit] unable to write external recovery log:', error.message);
    }
};

const readManifest = async () => {
    await ensureBackupDir();
    const content = await fs.promises.readFile(MANIFEST_PATH, 'utf8');
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (error) {
        console.error('Backup manifest is invalid; existing backup records were not changed:', error.message);
        throw new Error('Backup metadata cannot be read safely.');
    }
    if (!Array.isArray(parsed)) throw new Error('Backup metadata has an invalid format.');
    return parsed;
};

const writeManifest = async (items) => {
    await ensureBackupDir();
    const temporaryPath = `${MANIFEST_PATH}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.promises.writeFile(temporaryPath, JSON.stringify(items, null, 2), { encoding: 'utf8', flag: 'wx' });
    await fs.promises.rename(temporaryPath, MANIFEST_PATH);
};

const updateManifest = async (mutate) => {
    const operation = manifestQueue.then(async () => {
        const manifest = await readManifest();
        const updated = mutate(manifest);
        await writeManifest(updated);
        return updated;
    });
    manifestQueue = operation.catch(() => {});
    return operation;
};

const getBackupPath = (backup) => {
    const storedName = typeof backup.storageName === 'string'
        ? backup.storageName
        : (typeof backup.fileName === 'string' ? backup.fileName : '');
    const normalizedName = storedName.replace(/\\/g, '/');
    if (!normalizedName || normalizedName.startsWith('/') || normalizedName.split('/').some((part) => part === '..' || !part)) {
        throw new Error('Invalid backup path.');
    }
    const resolvedPath = path.resolve(BACKUP_DIR, ...normalizedName.split('/'));
    if (!resolvedPath.startsWith(`${BACKUP_DIR}${path.sep}`)) throw new Error('Invalid backup path.');
    return resolvedPath;
};

const query = (connection, sql, values = []) => new Promise((resolve, reject) => {
    connection.query(sql, values, (error, rows) => error ? reject(error) : resolve(rows));
});

const getPoolConnection = () => new Promise((resolve, reject) => {
    db.getConnection((error, connection) => error ? reject(error) : resolve(connection));
});

const getDatabaseArgs = (dumpPath) => ({
    args: [
        '--single-transaction',
        '--routines',
        '--triggers',
        '--events',
        '--hex-blob',
        '--no-tablespaces',
        '--default-character-set=utf8mb4',
        '--host', process.env.DB_HOST || 'localhost',
        '--user', process.env.DB_USER || process.env.DB_USERNAME || 'root',
        '--result-file', dumpPath,
        '--databases', DATABASE_NAME,
    ],
});

const createDatabaseDumpWithDriver = async (dumpPath) => {
    const connection = await getPoolConnection();
    const output = ['-- Apple Scholar backup format: mysql2-fallback', 'SET FOREIGN_KEY_CHECKS=0;', ''];
    try {
        await query(connection, 'START TRANSACTION WITH CONSISTENT SNAPSHOT');
        const objects = await query(connection, 'SHOW FULL TABLES');
        const tableRows = [];
        for (const object of objects) {
            const values = Object.values(object);
            if (values[1] !== 'BASE TABLE') {
                throw new Error('mysqldump is required because the database contains views or other unsupported objects.');
            }
            tableRows.push(values[0]);
        }
        const triggers = await query(connection, 'SHOW TRIGGERS');
        const routines = await query(connection, 'SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?', [DATABASE_NAME]);
        const events = await query(connection, 'SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ?', [DATABASE_NAME]);
        if (triggers.length || routines.length || events.length) {
            throw new Error('mysqldump is required because the database contains triggers, routines, or events.');
        }

        const quotedDatabase = mysqlEscaper.escapeId(DATABASE_NAME);
        output.unshift(`CREATE DATABASE IF NOT EXISTS ${quotedDatabase};`, `USE ${quotedDatabase};`);
        for (const tableName of tableRows) {
            const quotedTable = mysqlEscaper.escapeId(tableName);
            const createRows = await query(connection, `SHOW CREATE TABLE ${quotedTable}`);
            const createStatement = createRows[0]?.['Create Table'];
            if (!createStatement) throw new Error(`Could not read table definition for ${tableName}.`);
            output.push(`DROP TABLE IF EXISTS ${quotedTable};`, `${createStatement};`);

            const rows = await query(connection, `SELECT * FROM ${quotedTable}`);
            if (rows.length) {
                const columns = Object.keys(rows[0]).map((column) => mysqlEscaper.escapeId(column)).join(', ');
                for (const row of rows) {
                    const values = Object.values(row).map((value) => mysqlEscaper.escape(value)).join(', ');
                    output.push(`INSERT INTO ${quotedTable} (${columns}) VALUES (${values});`);
                }
            }
            output.push('');
        }
        output.push('SET FOREIGN_KEY_CHECKS=1;');
        await fs.promises.writeFile(dumpPath, output.join('\n'), 'utf8');
    } finally {
        await query(connection, 'ROLLBACK').catch(() => {});
        connection.release();
    }
};

const createDatabaseDump = async (dumpPath) => {
    const { args } = getDatabaseArgs(dumpPath);
    const env = { ...process.env };
    const password = process.env.DB_PASSWORD || process.env.DB_PASS;
    if (password) env.MYSQL_PWD = password;
    try {
        await execFileAsync(process.env.MYSQLDUMP_BIN || 'mysqldump', args, {
            env,
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024,
            timeout: 30 * 60 * 1000,
        });
    } catch (error) {
        if (error.code !== 'ENOENT') {
            const wrapped = new Error(DATABASE_UNAVAILABLE);
            wrapped.code = 'DATABASE_DUMP_FAILED';
            throw wrapped;
        }
        try {
            await createDatabaseDumpWithDriver(dumpPath);
        } catch (fallbackError) {
            const wrapped = new Error(fallbackError.message.includes('mysqldump is required') ? fallbackError.message : DATABASE_UNAVAILABLE);
            wrapped.code = 'DATABASE_DUMP_FAILED';
            throw wrapped;
        }
    }
    const stat = await fs.promises.stat(dumpPath);
    if (!stat.isFile() || stat.size === 0) {
        const error = new Error('The database dump file is empty or invalid.');
        error.code = 'DATABASE_DUMP_FAILED';
        throw error;
    }
    return stat;
};

const hashFile = async (filePath) => new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
});

const safeArchiveSegment = (value) => String(value || 'asset')
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-z0-9._-]/gi, '-')
    .replace(/^\.+/, '')
    .slice(0, 120) || 'asset';

const extensionOf = (value) => String(value || '').toLowerCase().replace(/^\./, '');
const formatBytes = (bytes) => {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size >= 100 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
};

const addLocalFiles = async (archive, sourceRoot, archiveRoot, acceptedExtensions) => {
    const visit = async (currentPath, relativePath = '') => {
        let entries;
        try {
            entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT') return;
            throw error;
        }
        for (const entry of entries) {
            if (entry.isSymbolicLink()) continue;
            const childPath = path.join(currentPath, entry.name);
            const childRelative = path.join(relativePath, entry.name);
            if (entry.isDirectory()) {
                if (childRelative.split(path.sep)[0].toLowerCase() === 'resumable') continue;
                await visit(childPath, childRelative);
                continue;
            }
            if (!entry.isFile() || !acceptedExtensions.has(extensionOf(path.extname(entry.name)))) continue;
            const archiveName = path.posix.join(archiveRoot, childRelative.split(path.sep).map(safeArchiveSegment).join('/'));
            archive.file(childPath, { name: archiveName });
        }
    };
    await visit(sourceRoot);
};

const isDocumentAsset = (asset) => {
    const extension = extensionOf(asset.file_format);
    return asset.resource_type === 'raw' || DOCUMENT_EXTENSIONS.has(extension);
};

const isImageAsset = (asset) => ['image', 'video'].includes(asset.resource_type) || IMAGE_EXTENSIONS.has(extensionOf(asset.file_format));

const addCloudinaryAssets = async (archive, { includeDocuments, includeImages }) => {
    if (!includeDocuments && !includeImages) return [];
    const assets = await new Promise((resolve, reject) => {
        db.query(
            'SELECT public_id, resource_type, file_format, scholar_id FROM file_assets WHERE public_id IS NOT NULL',
            (error, rows) => error ? reject(error) : resolve(rows)
        );
    });
    const archivedAssets = [];
    for (const asset of assets) {
        const document = isDocumentAsset(asset);
        const image = isImageAsset(asset);
        const includeAsset = (document && includeDocuments) || (image && includeImages);
        if (!includeAsset) continue;
        if (!['image', 'video', 'raw'].includes(asset.resource_type)) {
            throw new Error('A stored upload has an unsupported media type and could not be backed up.');
        }
        const fileFormat = safeArchiveSegment(extensionOf(asset.file_format) || 'bin');
        const resourceType = asset.resource_type;
        let downloadUrl;
        try {
            downloadUrl = cloudinary.utils.private_download_url(asset.public_id, fileFormat, {
                resource_type: resourceType,
                type: 'authenticated',
                expires_at: Math.floor(Date.now() / 1000) + 600,
                attachment: false,
            });
        } catch {
            throw new Error('Cloudinary credentials are required to include uploaded files in a full backup.');
        }
        const response = await fetch(downloadUrl, { signal: AbortSignal.timeout(120000) });
        if (!response.ok || !response.body) throw new Error('A stored upload could not be downloaded from Cloudinary.');
        const category = document && includeDocuments ? 'documents' : 'images';
        const publicIdPath = String(asset.public_id).split('/').map(safeArchiveSegment).join('/');
        const archiveName = path.posix.join('cloudinary', category, `${publicIdPath}.${fileFormat}`);
        archive.append(Readable.fromWeb(response.body), { name: archiveName });
        archivedAssets.push({
            publicId: asset.public_id,
            resourceType,
            fileFormat,
            scholarId: asset.scholar_id,
            archiveName,
            category,
        });
    }
    return archivedAssets;
};

const archiveToFile = async ({ filePath, dumpPath, backup, includeDocuments, includeImages }) => {
    const output = fs.createWriteStream(filePath, { flags: 'wx' });
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const outputClosed = new Promise((resolve, reject) => {
        output.once('close', resolve);
        output.once('error', reject);
        archive.once('error', reject);
    });
    outputClosed.catch(() => {});
    archive.pipe(output);
    const databaseHash = await hashFile(dumpPath);
    const contents = {
        database: backup.type !== 'Files',
        documents: Boolean(includeDocuments),
        images: Boolean(includeImages),
        encryption: 'not implemented',
    };
    try {
        if (backup.type !== 'Files') archive.file(dumpPath, { name: 'database.sql' });
        if (includeDocuments) await addLocalFiles(archive, UPLOADS_DIR, 'uploads', DOCUMENT_EXTENSIONS);
        if (includeImages) await addLocalFiles(archive, UPLOADS_DIR, 'uploads', IMAGE_EXTENSIONS);
        if (includeImages) await addLocalFiles(archive, IMAGES_DIR, 'images', IMAGE_EXTENSIONS);
        const assets = await addCloudinaryAssets(archive, { includeDocuments, includeImages });
        archive.append(JSON.stringify({
            id: backup.id,
            name: backup.name,
            type: backup.type,
            createdAt: backup.createdAt,
            databaseSha256: databaseHash,
            contents,
            assets,
        }, null, 2), { name: 'backup-manifest.json' });
        await archive.finalize();
        await outputClosed;
        return { databaseHash, contents, assets };
    } catch (error) {
        archive.abort();
        output.destroy();
        throw error;
    }
};

const readZipEntry = async (entry, maximumBytes = 1024 * 1024) => {
    if (Number(entry.uncompressedSize) > maximumBytes) throw new Error('Backup manifest is too large.');
    const chunks = [];
    let length = 0;
    for await (const chunk of entry.stream()) {
        length += chunk.length;
        if (length > maximumBytes) throw new Error('Backup manifest is too large.');
        chunks.push(chunk);
    }
    return Buffer.concat(chunks, length);
};

const validateArchive = async (backup, archivePath) => {
    const stat = await fs.promises.stat(archivePath);
    if (!stat.isFile() || stat.size === 0) throw new Error('Backup file is missing or empty.');
    const archive = await unzipper.Open.file(archivePath);
    const manifestEntry = archive.files.find((entry) => entry.path === 'backup-manifest.json');
    const databaseEntry = archive.files.find((entry) => entry.path === 'database.sql');
    const databaseExpected = backup.type !== 'Files';
    if (databaseExpected && (!databaseEntry || Number(databaseEntry.uncompressedSize) === 0)) {
        throw new Error('Backup does not contain a valid database dump.');
    }
    if (!manifestEntry) throw new Error('Backup manifest is missing.');
    let manifest;
    try {
        manifest = JSON.parse((await readZipEntry(manifestEntry, 20 * 1024 * 1024)).toString('utf8'));
    } catch {
        throw new Error('Backup manifest is invalid.');
    }
    if (backup.id && manifest.id !== backup.id) throw new Error('Backup manifest does not match its metadata.');
    if (databaseEntry && manifest.databaseSha256) {
        const hash = crypto.createHash('sha256');
        for await (const chunk of databaseEntry.stream()) hash.update(chunk);
        if (hash.digest('hex') !== manifest.databaseSha256) throw new Error('Database backup checksum validation failed.');
    }
    for (const entry of archive.files) {
        const entryPath = String(entry.path || '').replace(/\\/g, '/');
        if (!entryPath || entryPath.startsWith('/') || entryPath.includes('\0') || /^[a-z]:/i.test(entryPath) ||
            entryPath.split('/').some((part) => part === '..')) {
            throw new Error('Backup contains an unsafe archive path.');
        }
    }
    return { stat, manifest, entries: archive.files };
};

const extractBackupFiles = async (archivePath, extractionPath) => {
    const archive = await unzipper.Open.file(archivePath);
    const allowedRoots = new Set(['uploads', 'images', 'cloudinary']);
    for (const entry of archive.files) {
        const normalized = String(entry.path || '').replace(/\\/g, '/').replace(/\/$/, '');
        if (!normalized || normalized === 'database.sql' || normalized === 'backup-manifest.json') continue;
        const firstSegment = normalized.split('/')[0];
        if (!allowedRoots.has(firstSegment)) throw new Error('Backup contains an unsupported file entry.');
        const target = path.resolve(extractionPath, ...normalized.split('/'));
        if (!target.startsWith(`${extractionPath}${path.sep}`)) throw new Error('Backup contains an unsafe archive path.');
        if (entry.type === 'Directory') {
            await fs.promises.mkdir(target, { recursive: true });
            continue;
        }
        if (entry.type !== 'File') throw new Error('Backup contains an unsupported archive entry.');
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(target, { flags: 'wx' });
            entry.stream().once('error', reject).pipe(output);
            output.once('error', reject);
            output.once('finish', resolve);
        });
    }
};

const listFilesWithExtensions = async (root, acceptedExtensions) => {
    const files = [];
    const visit = async (directory, relativePath = '') => {
        let entries;
        try {
            entries = await fs.promises.readdir(directory, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT') return;
            throw error;
        }
        for (const entry of entries) {
            if (entry.isSymbolicLink()) continue;
            const childRelative = path.join(relativePath, entry.name);
            const childPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await visit(childPath, childRelative);
            } else if (entry.isFile() && acceptedExtensions.has(extensionOf(path.extname(entry.name)))) {
                files.push({ path: childPath, relativePath: childRelative });
            }
        }
    };
    await visit(root);
    return files;
};

const replaceFilesByExtensions = async (sourceRoot, destinationRoot, acceptedExtensions) => {
    const sourceFiles = await listFilesWithExtensions(sourceRoot, acceptedExtensions);
    const destinationFiles = await listFilesWithExtensions(destinationRoot, acceptedExtensions);
    const stagingRoot = `${destinationRoot}.backup-stage-${crypto.randomUUID()}`;
    const rollbackRoot = `${destinationRoot}.backup-rollback-${crypto.randomUUID()}`;
    const movedNewFiles = [];
    const backedUpFiles = [];
    await fs.promises.mkdir(stagingRoot, { recursive: true });
    await fs.promises.mkdir(rollbackRoot, { recursive: true });
    try {
        for (const file of sourceFiles) {
            const stagedPath = path.join(stagingRoot, file.relativePath);
            await fs.promises.mkdir(path.dirname(stagedPath), { recursive: true });
            await fs.promises.copyFile(file.path, stagedPath);
        }
        for (const file of destinationFiles) {
            const backupPath = path.join(rollbackRoot, file.relativePath);
            await fs.promises.mkdir(path.dirname(backupPath), { recursive: true });
            await fs.promises.rename(file.path, backupPath);
            backedUpFiles.push({ path: backupPath, relativePath: file.relativePath });
        }
        for (const file of sourceFiles) {
            const stagedPath = path.join(stagingRoot, file.relativePath);
            const destinationPath = path.join(destinationRoot, file.relativePath);
            await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
            await fs.promises.rename(stagedPath, destinationPath);
            movedNewFiles.push(destinationPath);
        }
        await fs.promises.rm(rollbackRoot, { recursive: true, force: true });
    } catch (error) {
        await Promise.all(movedNewFiles.map((filePath) => fs.promises.rm(filePath, { force: true }).catch(() => {})));
        for (const file of backedUpFiles) {
            const destinationPath = path.join(destinationRoot, file.relativePath);
            await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
            await fs.promises.rename(file.path, destinationPath).catch((restoreError) => {
                console.error('[backup-restore] failed to put a replaced file back:', restoreError.message);
            });
        }
        throw error;
    } finally {
        await fs.promises.rm(stagingRoot, { recursive: true, force: true });
        await fs.promises.rm(rollbackRoot, { recursive: true, force: true });
    }
};

const restoreCloudinaryAssets = async (manifest, extractionPath) => {
    if (!Array.isArray(manifest.assets) || !manifest.assets.length) return;
    for (const asset of manifest.assets) {
        if (!['image', 'video', 'raw'].includes(asset.resourceType) ||
            typeof asset.publicId !== 'string' ||
            typeof asset.archiveName !== 'string') {
            throw new Error('Backup has invalid Cloudinary asset metadata.');
        }
        const source = path.resolve(extractionPath, ...asset.archiveName.split('/'));
        if (!source.startsWith(`${extractionPath}${path.sep}`)) throw new Error('Backup contains an unsafe Cloudinary asset path.');
        await fs.promises.access(source);
        await cloudinary.uploader.upload(source, {
            public_id: asset.publicId,
            resource_type: asset.resourceType,
            type: 'authenticated',
            overwrite: true,
            invalidate: true,
        });
    }
};

const toApiBackup = (backup, stat) => {
    const size = Number(stat?.size || backup.bytes || 0);
    return {
        id: backup.id,
        name: backup.name,
        type: backup.type,
        fileName: backup.fileName || null,
        size: formatBytes(size),
        bytes: size,
        createdBy: backup.createdBy || null,
        createdAt: backup.createdAt,
        date: backup.date || backup.createdAt,
        status: normalizeStatus(backup.status),
        includeDocuments: Boolean(backup.includeDocuments),
        includeImages: Boolean(backup.includeImages),
        backupScope: backup.backupScope || 'legacy',
        validatedAt: backup.validatedAt || null,
        errorMessage: backup.errorMessage || undefined,
    };
};

const listBackups = async () => {
    const manifest = await readManifest();
    const items = await Promise.all(manifest.map(async (backup) => {
        if (normalizeStatus(backup.status) === 'FAILED') return toApiBackup(backup);
        try {
            const filePath = getBackupPath(backup);
            const stat = await fs.promises.stat(filePath);
            if (!stat.isFile() || stat.size === 0) throw new Error('Backup file is missing or empty.');
            return toApiBackup(backup, stat);
        } catch (error) {
            if (normalizeStatus(backup.status) === 'COMPLETED' || normalizeStatus(backup.status) === 'RESTORED') {
                await updateManifest((records) => records.map((item) => item.id === backup.id
                    ? { ...item, status: 'CORRUPTED', errorMessage: 'Backup file is missing or unreadable.' }
                    : item));
                return toApiBackup({ ...backup, status: 'CORRUPTED', errorMessage: 'Backup file is missing or unreadable.' });
            }
            return null;
        }
    }));
    return items.filter(Boolean).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

const getBackupPolicy = async () => {
    const rows = await new Promise((resolve, reject) => {
        db.query(
            'SELECT scheduled_backups, backup_retention_count FROM admin_system_settings WHERE id = 1',
            (error, result) => error ? reject(error) : resolve(result)
        );
    });
    const { time, timezone } = getScheduleTime();
    return {
        scheduledBackups: rows.length ? Boolean(rows[0].scheduled_backups) : process.env.ENABLE_SCHEDULED_BACKUPS !== 'false',
        dailyTime: time,
        timezone,
        weeklyDay: 'Sunday',
        dailyRetention: Math.max(1, Number.parseInt(rows[0]?.backup_retention_count, 10) || DAILY_RETENTION),
        fullRetention: FULL_RETENTION,
        encryption: false,
    };
};

const sanitizeName = (name) => {
    const normalized = String(name || `AppleScholar-Backup-${new Date().toISOString().slice(0, 10)}`)
        .normalize('NFKC')
        .replace(/[^a-z0-9._ -]/gi, '-')
        .replace(/[. ]+$/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80);
    if (!normalized || normalized === '.' || normalized === '..') {
        const error = new Error('Enter a valid backup name.');
        error.statusCode = 400;
        throw error;
    }
    return normalized;
};

const persistFailedBackup = async (backup, error) => {
    await updateManifest((records) => [backup, ...records.filter((item) => item.id !== backup.id)]);
    console.error(`[backup] ${backup.id} failed:`, error.message || error);
};

const createBackup = async (options) => {
    const { name, type, createdBy, backupScope = 'manual', scheduledDate } = options;
    const includeDocuments = options.includeDocuments === undefined ? type === 'Full' : options.includeDocuments;
    const includeImages = options.includeImages === undefined ? type === 'Full' : options.includeImages;
    if (!['Database', 'Full'].includes(type)) {
        const error = new Error('Backup type must be Database or Full.');
        error.statusCode = 400;
        throw error;
    }
    if (typeof includeDocuments !== 'boolean' || typeof includeImages !== 'boolean') {
        const error = new Error('File inclusion settings must be boolean values.');
        error.statusCode = 400;
        throw error;
    }
    if (type === 'Database' && (includeDocuments || includeImages)) {
        const error = new Error('Database-only backups cannot include uploaded files.');
        error.statusCode = 400;
        throw error;
    }
    const safeName = sanitizeName(name);
    const id = crypto.randomUUID();
    const folder = backupScope === 'daily' ? 'daily' : backupScope === 'weekly' ? 'full' : 'manual';
    const storageName = path.posix.join(folder, `${id}.zip`);
    const fileName = `${safeName}-${id}.zip`;
    const finalPath = getBackupPath({ storageName });
    const temporaryDirectory = path.join(BACKUP_DIR, 'tmp', id);
    const dumpPath = path.join(temporaryDirectory, 'database.sql');
    const temporaryArchivePath = `${finalPath}.tmp`;
    const createdAt = new Date().toISOString();
    const backup = {
        id,
        name: safeName,
        type,
        fileName,
        storageName,
        createdBy: createdBy || null,
        createdAt,
        status: 'PROCESSING',
        includeDocuments,
        includeImages,
        backupScope,
        scheduledDate: scheduledDate || null,
        backupFormat: 2,
        encryption: 'not implemented',
    };

    await fs.promises.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.promises.mkdir(temporaryDirectory, { recursive: true });
    await updateManifest((records) => [backup, ...records.filter((item) => item.id !== id)]);
    try {
        const databaseStat = await createDatabaseDump(dumpPath);
        const { databaseHash, contents } = await archiveToFile({
            filePath: temporaryArchivePath,
            dumpPath,
            backup,
            includeDocuments,
            includeImages,
        });
        const archiveStat = await fs.promises.stat(temporaryArchivePath);
        if (!archiveStat.isFile() || archiveStat.size === 0) throw new Error('The completed backup archive is empty.');
        const validation = await validateArchive(backup, temporaryArchivePath);
        if (validation.stat.size !== archiveStat.size) throw new Error('Backup size validation failed.');
        await fs.promises.rename(temporaryArchivePath, finalPath);
        const completed = {
            ...backup,
            status: 'COMPLETED',
            bytes: archiveStat.size,
            databaseBytes: databaseStat.size,
            databaseSha256: databaseHash,
            contents,
            validatedAt: new Date().toISOString(),
            errorMessage: null,
        };
        await updateManifest((records) => [completed, ...records.filter((item) => item.id !== id)]);
        await recordRecoveryOperation({ action: 'BACKUP_CREATED', backup: completed, userId: createdBy, result: 'success' });
        return toApiBackup(completed, archiveStat);
    } catch (error) {
        await fs.promises.rm(temporaryArchivePath, { force: true }).catch(() => {});
        await fs.promises.rm(finalPath, { force: true }).catch(() => {});
        const failed = {
            ...backup,
            status: 'FAILED',
            errorMessage: error.code === 'DATABASE_DUMP_FAILED' ? DATABASE_UNAVAILABLE : 'Backup creation or validation failed.',
        };
        await persistFailedBackup(failed, error);
        await recordRecoveryOperation({ action: 'BACKUP_FAILED', backup: failed, userId: createdBy, result: 'failed' });
        throw error;
    } finally {
        await fs.promises.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
    }
};

const getBackup = async (id) => {
    if (!isSafeId(id)) {
        const error = new Error('Invalid backup ID.');
        error.statusCode = 400;
        throw error;
    }
    const backups = await readManifest();
    const backup = backups.find((item) => item.id === id);
    if (!backup) {
        const error = new Error('Backup not found.');
        error.statusCode = 404;
        throw error;
    }
    return backup;
};

const getFilePath = async (id) => {
    const backup = await getBackup(id);
    if (!['COMPLETED', 'RESTORED'].includes(normalizeStatus(backup.status))) {
        const error = new Error('Only completed, validated backups can be downloaded.');
        error.statusCode = 409;
        throw error;
    }
    await validateBackup(backup);
    return getBackupPath(backup);
};

const deleteBackup = async (id) => {
    const backup = await getBackup(id);
    const status = normalizeStatus(backup.status);
    if (['COMPLETED', 'RESTORED'].includes(status)) {
        const backups = await readManifest();
        const otherCandidates = backups.filter((item) =>
            item.id !== id &&
            ['Database', 'Full'].includes(item.type) &&
            ['COMPLETED', 'RESTORED'].includes(normalizeStatus(item.status))
        );
        let validRecoveryPointExists = false;
        for (const candidate of otherCandidates) {
            try {
                await validateArchive(candidate, getBackupPath(candidate));
                validRecoveryPointExists = true;
                break;
            } catch {
                await updateManifest((records) => records.map((item) => item.id === candidate.id
                    ? { ...item, status: 'CORRUPTED', errorMessage: 'Backup validation failed.' }
                    : item));
            }
        }
        if (!validRecoveryPointExists) {
            const error = new Error('Cannot delete the only known valid database recovery point.');
            error.statusCode = 409;
            throw error;
        }
    }
    if (backup.storageName || backup.fileName) {
        await fs.promises.rm(getBackupPath(backup), { force: true });
    }
    await updateManifest((records) => records.filter((item) => item.id !== id));
    await recordRecoveryOperation({ action: 'BACKUP_DELETED', backup, result: 'success' });
};

const validateBackup = async (backup) => {
    if (!['COMPLETED', 'RESTORED'].includes(normalizeStatus(backup.status))) {
        const error = new Error('Only completed backups can be restored.');
        error.statusCode = 409;
        throw error;
    }
    const archivePath = getBackupPath(backup);
    try {
        return await validateArchive(backup, archivePath);
    } catch (validationError) {
        await updateManifest((records) => records.map((item) => item.id === backup.id
            ? { ...item, status: 'CORRUPTED', errorMessage: 'Backup validation failed.' }
            : item));
        const error = new Error('This backup is corrupted or failed validation and cannot be restored.');
        error.statusCode = 409;
        throw error;
    }
};

const splitSqlStatements = (sql) => {
    const statements = [];
    let start = 0;
    let quote = '';
    let escaped = false;
    for (let index = 0; index < sql.length; index += 1) {
        const character = sql[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (character === '\\' && quote !== '`') {
            escaped = true;
            continue;
        }
        if (quote) {
            if (character === quote) quote = '';
            continue;
        }
        if (character === '\'' || character === '"' || character === '`') {
            quote = character;
            continue;
        }
        if (character === ';') {
            const statement = sql.slice(start, index).trim();
            if (statement) statements.push(statement);
            start = index + 1;
        }
    }
    const remainder = sql.slice(start).trim();
    if (remainder) statements.push(remainder);
    return statements;
};

const restoreUsingMysqlBinary = async (dumpPath) => {
    const args = [
        '--host', process.env.DB_HOST || 'localhost',
        '--user', process.env.DB_USER || process.env.DB_USERNAME || 'root',
    ];
    const env = { ...process.env };
    const password = process.env.DB_PASSWORD || process.env.DB_PASS;
    if (password) env.MYSQL_PWD = password;
    try {
        await new Promise((resolve, reject) => {
            const child = require('child_process').spawn(process.env.MYSQL_BIN || 'mysql', args, {
                env,
                windowsHide: true,
                stdio: ['pipe', 'ignore', 'pipe'],
            });
            let stderr = '';
            child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-2000); });
            child.once('error', reject);
            child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`mysql restore exited with status ${code}${stderr ? '.' : ''}`)));
            const input = fs.createReadStream(dumpPath);
            input.once('error', reject);
            input.pipe(child.stdin);
        });
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
    }
};

const restoreUsingPool = async (dumpPath) => {
    const connection = await getPoolConnection();
    try {
        const fileHeader = await fs.promises.open(dumpPath, 'r');
        let header;
        try {
            const buffer = Buffer.alloc(128);
            const { bytesRead } = await fileHeader.read(buffer, 0, buffer.length, 0);
            header = buffer.subarray(0, bytesRead).toString('utf8');
        } finally {
            await fileHeader.close();
        }
        if (!header.includes('mysql2-fallback')) {
            throw new Error('The mysql command line client is required to restore this database dump.');
        }
        const sql = await fs.promises.readFile(dumpPath, 'utf8');
        const statements = splitSqlStatements(sql);
        for (const statement of statements) {
            if (/^\s*(CREATE DATABASE|USE)\b/i.test(statement)) continue;
            await query(connection, statement);
        }
    } finally {
        try {
            await query(connection, 'SET FOREIGN_KEY_CHECKS=1');
        } finally {
            connection.release();
        }
    }
};

const verifyDatabase = async () => {
    const connection = await getPoolConnection();
    try {
        await query(connection, 'SELECT 1 AS ok');
        const applicationTables = await query(connection, 'SHOW TABLES LIKE \'users\'');
        if (!applicationTables.length) throw new Error('The restored database is missing the users table.');
    } finally {
        connection.release();
    }
};

const restoreBackup = async (id, { confirmed = false, allowNoSafetyBackup = false } = {}) => {
    if (!confirmed && !allowNoSafetyBackup) {
        const error = new Error('Explicit confirmation is required before restoring a backup.');
        error.statusCode = 400;
        throw error;
    }
    const backup = await getBackup(id);
    if (!['Database', 'Full'].includes(backup.type)) {
        const error = new Error('This backup does not contain a database and cannot be restored.');
        error.statusCode = 400;
        throw error;
    }
    const validated = await validateBackup(backup);
    const workDirectory = path.join(BACKUP_DIR, 'tmp', `restore-${crypto.randomUUID()}`);
    let dumpPath;
    try {
        await fs.promises.mkdir(workDirectory, { recursive: true });
        const sqlEntry = validated.entries.find((entry) => entry.path === 'database.sql');
        if (!sqlEntry) throw new Error('The backup archive is missing its database dump.');
        dumpPath = path.join(workDirectory, 'database.sql');
        await extractBackupFiles(getBackupPath(backup), workDirectory);
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(dumpPath, { flags: 'wx' });
            sqlEntry.stream().once('error', reject).pipe(output);
            output.once('error', reject);
            output.once('finish', resolve);
        });
    } catch (error) {
        await fs.promises.rm(workDirectory, { recursive: true, force: true }).catch((cleanupError) => {
            console.error('[backup-restore] failed to remove incomplete restore workspace:', cleanupError.message);
        });
        throw error;
    }

    let safetyBackup = null;
    let previousStatus = normalizeStatus(backup.status);
    await updateManifest((records) => records.map((item) => item.id === id ? { ...item, status: 'RESTORING' } : item));
    await recordRecoveryOperation({ action: 'BACKUP_RESTORE_STARTED', backup, result: 'started' });
    try {
        try {
            safetyBackup = await createBackup({
                name: `Pre-Restore-${new Date().toISOString().replace(/[:.]/g, '-')}`,
                type: backup.includeDocuments || backup.includeImages ? 'Full' : 'Database',
                includeDocuments: backup.includeDocuments,
                includeImages: backup.includeImages,
                createdBy: 'system-pre-restore',
                backupScope: 'manual',
            });
        } catch (safetyError) {
            if (!allowNoSafetyBackup) {
                const error = new Error('A safety backup of the current database could not be created; restore was cancelled.');
                error.statusCode = 503;
                throw error;
            }
            console.warn('[backup-restore] proceeding without a safety backup by explicit local operator request:', safetyError.message);
        }

        let restoredWithBinary = false;
        try {
            restoredWithBinary = await restoreUsingMysqlBinary(dumpPath);
            if (!restoredWithBinary) await restoreUsingPool(dumpPath);
            if (backup.includeDocuments || backup.includeImages) {
                await restoreCloudinaryAssets(validated.manifest, workDirectory);
                if (backup.includeDocuments) {
                    await replaceFilesByExtensions(path.join(workDirectory, 'uploads'), UPLOADS_DIR, DOCUMENT_EXTENSIONS);
                }
                if (backup.includeImages) {
                    await replaceFilesByExtensions(path.join(workDirectory, 'uploads'), UPLOADS_DIR, IMAGE_EXTENSIONS);
                    await replaceFilesByExtensions(path.join(workDirectory, 'images'), IMAGES_DIR, IMAGE_EXTENSIONS);
                }
            }
            await verifyDatabase();
        } catch (restoreError) {
            if (safetyBackup) {
                try {
                    const safety = await getBackup(safetyBackup.id);
                    const safetyArchive = await validateArchive(safety, getBackupPath(safety));
                    const safetySql = safetyArchive.entries.find((entry) => entry.path === 'database.sql');
                    const safetyDumpPath = path.join(workDirectory, 'safety-database.sql');
                    await new Promise((resolve, reject) => {
                        const output = fs.createWriteStream(safetyDumpPath, { flags: 'wx' });
                        safetySql.stream().once('error', reject).pipe(output);
                        output.once('error', reject);
                        output.once('finish', resolve);
                    });
                    if (!await restoreUsingMysqlBinary(safetyDumpPath)) await restoreUsingPool(safetyDumpPath);
                    const safetyWorkDirectory = path.join(workDirectory, 'safety');
                    await fs.promises.mkdir(safetyWorkDirectory, { recursive: true });
                    await extractBackupFiles(getBackupPath(safety), safetyWorkDirectory);
                    await restoreCloudinaryAssets(safetyArchive.manifest, safetyWorkDirectory);
                    if (safety.includeDocuments) {
                        await replaceFilesByExtensions(path.join(safetyWorkDirectory, 'uploads'), UPLOADS_DIR, DOCUMENT_EXTENSIONS);
                    }
                    if (safety.includeImages) {
                        await replaceFilesByExtensions(path.join(safetyWorkDirectory, 'uploads'), UPLOADS_DIR, IMAGE_EXTENSIONS);
                        await replaceFilesByExtensions(path.join(safetyWorkDirectory, 'images'), IMAGES_DIR, IMAGE_EXTENSIONS);
                    }
                    await verifyDatabase();
                } catch (rollbackError) {
                    console.error('[backup-restore] emergency rollback failed:', rollbackError.message);
                }
            }
            throw new Error('Database restore failed; check server logs and use the retained safety backup if needed.');
        }

        previousStatus = 'RESTORED';
        await updateManifest((records) => records.map((item) => item.id === id
            ? { ...item, status: 'RESTORED', validatedAt: new Date().toISOString(), restoredAt: new Date().toISOString(), errorMessage: null }
            : item));
        await recordRecoveryOperation({ action: 'BACKUP_RESTORE_SUCCESS', backup, result: 'success' });
        return { restored: true, id, safetyBackupId: safetyBackup?.id || null };
    } catch (error) {
        await updateManifest((records) => records.map((item) => item.id === id
            ? { ...item, status: previousStatus, errorMessage: null }
            : item));
        await recordRecoveryOperation({ action: 'BACKUP_RESTORE_FAILED', backup, result: 'failed' });
        throw error;
    } finally {
        await fs.promises.rm(workDirectory, { recursive: true, force: true }).catch(() => {});
    }
};

const applyRetention = async (scope, retentionCount) => {
    const maximum = Math.max(1, Number.parseInt(retentionCount, 10) || (scope === 'daily' ? DAILY_RETENTION : FULL_RETENTION));
    const manifest = await readManifest();
    const validCandidates = [];
    for (const candidate of manifest.filter((item) =>
        item.backupScope === scope && ['COMPLETED', 'RESTORED'].includes(normalizeStatus(item.status))
    )) {
        try {
            await validateArchive(candidate, getBackupPath(candidate));
            validCandidates.push(candidate);
        } catch {
            await updateManifest((records) => records.map((item) => item.id === candidate.id
                ? { ...item, status: 'CORRUPTED', errorMessage: 'Backup validation failed.' }
                : item));
        }
    }
    const candidates = validCandidates
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    for (const expired of candidates.slice(maximum)) {
        const knownGood = candidates.filter((item) => item.id !== expired.id);
        if (!knownGood.length) continue;
        try {
            await fs.promises.rm(getBackupPath(expired), { force: true });
            await updateManifest((records) => records.filter((item) => item.id !== expired.id));
        } catch (error) {
            console.error(`[backup-retention] unable to remove expired backup ${expired.id}:`, error.message);
        }
    }
};

const getScheduleTime = () => {
    const time = process.env.BACKUP_TIME || '23:59';
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('BACKUP_TIME must use HH:mm in 24-hour time.');
    const timezone = process.env.BACKUP_TIMEZONE || 'Asia/Manila';
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    } catch {
        throw new Error('BACKUP_TIMEZONE must be a valid IANA timezone.');
    }
    return { time, timezone };
};

const getLocalScheduleParts = (date = new Date()) => {
    const { timezone } = getScheduleTime();
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date).map(({ type, value }) => [type, value]));
    return { ...parts, dateKey: `${parts.year}-${parts.month}-${parts.day}` };
};

const isScheduledTimeReached = (now, scheduledTime) => (
    `${now.hour}:${now.minute}` >= scheduledTime
);

const calendarDayDifference = (laterDate, earlierDate) => {
    const later = Date.parse(`${laterDate}T00:00:00Z`);
    const earlier = Date.parse(`${earlierDate}T00:00:00Z`);
    if (!Number.isFinite(later) || !Number.isFinite(earlier)) return 0;
    return Math.floor((later - earlier) / 86_400_000);
};

const getBackupDate = (backup) => {
    if (typeof backup.scheduledDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(backup.scheduledDate)) {
        return backup.scheduledDate;
    }
    const createdAt = new Date(backup.createdAt || NaN);
    return Number.isNaN(createdAt.getTime()) ? null : getLocalScheduleParts(createdAt).dateKey;
};

const shouldCreateDailyBackup = (records, now, scheduledTime) => {
    const validSnapshots = records.filter((backup) =>
        ['Database', 'Full'].includes(backup.type) &&
        ['COMPLETED', 'RESTORED'].includes(normalizeStatus(backup.status))
    );
    const alreadyBackedUpToday = validSnapshots.some((backup) => getBackupDate(backup) === now.dateKey);
    if (alreadyBackedUpToday) return false;

    const backupDates = validSnapshots
        .map(getBackupDate)
        .filter(Boolean)
        .sort();
    const latestBackupDate = backupDates[backupDates.length - 1];
    const missedDay = !latestBackupDate || calendarDayDifference(now.dateKey, latestBackupDate) > 1;
    return isScheduledTimeReached(now, scheduledTime) || missedDay;
};

const withSchedulerLock = async (run) => {
    const connection = await getPoolConnection();
    let locked = false;
    try {
        const rows = await query(connection, 'SELECT GET_LOCK(?, 0) AS acquired', [SCHEDULER_LOCK_NAME]);
        locked = Number(rows[0]?.acquired) === 1;
        if (!locked) return { skipped: true, reason: 'another server instance holds the backup scheduler lock' };
        return await run();
    } finally {
        if (locked) await query(connection, 'SELECT RELEASE_LOCK(?)', [SCHEDULER_LOCK_NAME]).catch((error) => {
            console.error('[backup-scheduler] failed to release advisory lock:', error.message);
        });
        connection.release();
    }
};

const runScheduledBackups = async ({ enabled = true, dailyRetentionCount = DAILY_RETENTION } = {}) => {
    if (!enabled || scheduledBackupRunning) return { skipped: true, reason: 'scheduled backup disabled or already running' };
    const { time } = getScheduleTime();
    const now = getLocalScheduleParts();
    scheduledBackupRunning = true;
    try {
        return await withSchedulerLock(async () => {
            const records = await readManifest();
            const results = [];
            if (lastDailyRunDate !== now.dateKey && shouldCreateDailyBackup(records, now, time)) {
                lastDailyRunDate = now.dateKey;
                const daily = await createBackup({
                    name: `AppleScholar-Daily-${now.dateKey}`,
                    type: 'Database',
                    createdBy: 'system-scheduler',
                    backupScope: 'daily',
                    scheduledDate: now.dateKey,
                });
                await applyRetention('daily', dailyRetentionCount);
                results.push(daily);
            }
            if (isScheduledTimeReached(now, time) && now.weekday === 'Sun' && lastWeeklyRunDate !== now.dateKey && !records.some((item) => item.backupScope === 'weekly' && item.scheduledDate === now.dateKey && normalizeStatus(item.status) === 'COMPLETED')) {
                lastWeeklyRunDate = now.dateKey;
                const weekly = await createBackup({
                    name: `AppleScholar-Full-${now.dateKey}`,
                    type: 'Full',
                    includeDocuments: true,
                    includeImages: true,
                    createdBy: 'system-scheduler',
                    backupScope: 'weekly',
                    scheduledDate: now.dateKey,
                });
                await applyRetention('weekly', FULL_RETENTION);
                results.push(weekly);
            }
            return { skipped: results.length === 0, backups: results };
        });
    } finally {
        scheduledBackupRunning = false;
    }
};

const runScheduledBackup = async (retentionCount) => runScheduledBackups({ enabled: true, dailyRetentionCount: retentionCount });

module.exports = {
    listBackups,
    getBackupPolicy,
    createBackup,
    getBackup,
    getFilePath,
    deleteBackup,
    restoreBackup,
    runScheduledBackup,
    runScheduledBackups,
    recordRecoveryOperation,
    validateArchive,
    splitSqlStatements,
    getBackupPath,
    isScheduledTimeReached,
    shouldCreateDailyBackup,
    constants: { BACKUP_DIR, DAILY_RETENTION, FULL_RETENTION },
};
