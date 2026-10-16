const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { hasValidFileSignature, scanBuffer } = require('../middleware/fileUploadSecurity');

const ROOT = path.resolve(__dirname, '..', 'uploads', 'resumable');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CHUNK_SIZE = 1024 * 1024;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const ALLOWED_FIELDS = new Set(['report_card', 'cor', 'media', 'proof']);
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const sessionDir = (id) => path.join(ROOT, id);
const metadataPath = (id) => path.join(sessionDir(id), 'metadata.json');
const chunkPath = (id, index) => path.join(sessionDir(id), `chunk-${index}`);
const safeSessionId = (id) => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);

const readMetadata = async (id) => {
    if (!safeSessionId(id)) throw Object.assign(new Error('Invalid upload session'), { statusCode: 400 });
    try {
        return JSON.parse(await fs.readFile(metadataPath(id), 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') throw Object.assign(new Error('Upload session not found'), { statusCode: 404 });
        throw error;
    }
};

const assertOwner = (metadata, scholarId) => {
    if (!metadata || metadata.scholarId !== scholarId) {
        throw Object.assign(new Error('Upload session does not belong to this scholar'), { statusCode: 403 });
    }
};

const createSession = async ({ scholarId, originalName, mimetype, size, fieldname, totalChunks }) => {
    const normalizedSize = Number(size);
    const normalizedChunks = Number(totalChunks);
    if (!scholarId || !originalName || !ALLOWED_FIELDS.has(fieldname)) throw Object.assign(new Error('Invalid upload session data'), { statusCode: 400 });
    if (!Number.isInteger(normalizedSize) || normalizedSize < 1 || normalizedSize > MAX_FILE_SIZE) throw Object.assign(new Error('File must be between 1 byte and 10 MB'), { statusCode: 400 });
    if (!ALLOWED_MIME_TYPES.has(mimetype)) throw Object.assign(new Error('Unsupported file type'), { statusCode: 400 });
    if (!Number.isInteger(normalizedChunks) || normalizedChunks < 1 || normalizedChunks > Math.ceil(MAX_FILE_SIZE / MAX_CHUNK_SIZE)) throw Object.assign(new Error('Invalid chunk count'), { statusCode: 400 });

    const id = crypto.randomUUID();
    const directory = sessionDir(id);
    await fs.mkdir(directory, { recursive: true });
    const metadata = {
        id,
        scholarId,
        originalName: path.basename(originalName).slice(0, 180),
        mimetype,
        size: normalizedSize,
        fieldname,
        totalChunks: normalizedChunks,
        chunkSize: MAX_CHUNK_SIZE,
        received: [],
        createdAt: Date.now(),
        completed: false,
        scanned: false,
    };
    await fs.writeFile(metadataPath(id), JSON.stringify(metadata), 'utf8');
    return metadata;
};

const saveChunk = async (id, scholarId, index, buffer) => {
    const metadata = await readMetadata(id);
    assertOwner(metadata, scholarId);
    const chunkIndex = Number(index);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= metadata.totalChunks) throw Object.assign(new Error('Invalid chunk index'), { statusCode: 400 });
    if (!Buffer.isBuffer(buffer) || buffer.length < 1 || buffer.length > MAX_CHUNK_SIZE) throw Object.assign(new Error('Invalid chunk size'), { statusCode: 400 });
    const expectedSize = chunkIndex === metadata.totalChunks - 1
        ? metadata.size - (metadata.chunkSize * (metadata.totalChunks - 1))
        : metadata.chunkSize;
    if (buffer.length !== expectedSize) throw Object.assign(new Error('Chunk size does not match the upload session'), { statusCode: 400 });

    const temporaryPath = `${chunkPath(id, chunkIndex)}.tmp-${crypto.randomUUID()}`;
    await fs.writeFile(temporaryPath, buffer, { flag: 'wx' });
    await fs.rename(temporaryPath, chunkPath(id, chunkIndex));
    metadata.received = [...new Set([...metadata.received, chunkIndex])].sort((a, b) => a - b);
    await fs.writeFile(metadataPath(id), JSON.stringify(metadata), 'utf8');
    return metadata;
};

const getStatus = async (id, scholarId) => {
    const metadata = await readMetadata(id);
    assertOwner(metadata, scholarId);
    return metadata;
};

const completeSession = async (id, scholarId) => {
    const metadata = await readMetadata(id);
    assertOwner(metadata, scholarId);
    if (metadata.received.length !== metadata.totalChunks) throw Object.assign(new Error('Upload is incomplete'), { statusCode: 409 });

    const mergedPath = path.join(sessionDir(id), 'merged-upload');
    const output = await fs.open(mergedPath, 'w');
    try {
        for (let index = 0; index < metadata.totalChunks; index += 1) {
            const chunk = await fs.readFile(chunkPath(id, index));
            await output.write(chunk);
        }
    } finally {
        await output.close();
    }

    const buffer = await fs.readFile(mergedPath);
    const file = { originalname: metadata.originalName, mimetype: metadata.mimetype, fieldname: metadata.fieldname, buffer };
    if (!hasValidFileSignature(file)) {
        await removeSession(id);
        throw Object.assign(new Error('Uploaded file content does not match its declared type'), { statusCode: 400 });
    }
    const scan = await scanBuffer(buffer);
    if (!scan.clean) {
        await removeSession(id);
        throw Object.assign(new Error('Uploaded file failed the malware scan and was rejected'), { statusCode: 400 });
    }

    metadata.completed = true;
    metadata.scanned = true;
    metadata.completedAt = Date.now();
    await fs.writeFile(metadataPath(id), JSON.stringify(metadata), 'utf8');
    return metadata;
};

const consumeCompleted = async (id, scholarId) => {
    const metadata = await readMetadata(id);
    assertOwner(metadata, scholarId);
    if (!metadata.completed || !metadata.scanned) throw Object.assign(new Error('Upload has not completed security checks'), { statusCode: 409 });
    const buffer = await fs.readFile(path.join(sessionDir(id), 'merged-upload'));
    return { originalname: metadata.originalName, mimetype: metadata.mimetype, fieldname: metadata.fieldname, buffer, resumableId: id };
};

const removeSession = async (id) => fs.rm(sessionDir(id), { recursive: true, force: true });

const cleanupExpired = async () => {
    await fs.mkdir(ROOT, { recursive: true });
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    const cutoff = Date.now() - SESSION_TTL_MS;
    await Promise.all(entries.filter(entry => entry.isDirectory()).map(async entry => {
        try {
            const metadata = await readMetadata(entry.name);
            if (metadata.createdAt < cutoff) await removeSession(entry.name);
        } catch {
            await removeSession(entry.name);
        }
    }));
};

module.exports = { ROOT, MAX_CHUNK_SIZE, cleanupExpired, createSession, saveChunk, getStatus, completeSession, consumeCompleted, removeSession };
