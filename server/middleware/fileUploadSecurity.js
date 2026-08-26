const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const isJpeg = buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
const isPng = buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const isPdf = buffer => buffer.subarray(0, 5).toString('ascii') === '%PDF-';
const isOleDocument = buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
const isZip = buffer => buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;

const hasValidFileSignature = (file) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const buffer = file.buffer;
    if (!buffer) return false;
    if (['.jpg', '.jpeg'].includes(extension)) return isJpeg(buffer);
    if (extension === '.png') return isPng(buffer);
    if (extension === '.pdf') return isPdf(buffer);
    if (extension === '.doc') return isOleDocument(buffer);
    if (extension === '.docx') return isZip(buffer);
    return false;
};

const validateUploadedFileSignatures = (req, res, next) => {
    const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
    if (files.every(hasValidFileSignature)) return next();
    return res.status(400).json({ error: 'Uploaded file content does not match its declared file type' });
};

const getClamScanPath = () => process.env.CLAMSCAN_PATH || 'C:\\ClamAV\\clamscan.exe';
const getClamDbDir = () => process.env.CLAMAV_DB_DIR || 'C:\\ClamAV\\db';

const scanBuffer = (buffer) => new Promise((resolve, reject) => {
    const temporaryPath = path.join(os.tmpdir(), `apple-scholar-scan-${crypto.randomUUID()}.bin`);
    let scanner;
    const output = [];
    let settled = false;
    const finish = async (callback, value) => {
        if (settled) return;
        settled = true;
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        callback(value);
    };

    fs.writeFile(temporaryPath, buffer).then(() => {
        const scannerArgs = ['--database=' + getClamDbDir(), '--no-summary', temporaryPath];
        scanner = spawn(getClamScanPath(), scannerArgs, { windowsHide: true });
        scanner.stdout.on('data', chunk => output.push(chunk.toString()));
        scanner.stderr.on('data', chunk => output.push(chunk.toString()));
        scanner.on('error', error => finish(reject, error));
        scanner.on('close', code => {
        if (code === 0) return finish(resolve, { clean: true, detail: output.join('').trim() });
        if (code === 1) return finish(resolve, { clean: false, infected: true, detail: output.join('').trim() });
        return finish(reject, new Error(`ClamAV exited with code ${code}: ${output.join('').trim()}`));
        });
    }).catch(error => finish(reject, error));
});

const scanUploadedFiles = async (req, res, next) => {
    const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
    if (!files.length) return next();

    try {
        for (const file of files) {
            const result = await scanBuffer(file.buffer);
            if (!result.clean) {
                console.warn('[ClamAV] Infected upload rejected:', file.originalname, result.detail);
                return res.status(400).json({ error: 'Uploaded file failed the malware scan and was rejected.' });
            }
        }
        return next();
    } catch (error) {
        console.error('[ClamAV] Scanner unavailable:', error.message);
        return res.status(503).json({ error: 'Malware scanner is unavailable. The upload was not accepted.' });
    }
};

module.exports = { hasValidFileSignature, validateUploadedFileSignatures, scanUploadedFiles, scanBuffer };