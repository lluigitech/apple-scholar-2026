const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { validateUploadedFileSignatures, scanUploadedFiles } = require('../middleware/fileUploadSecurity');
const { rateLimit } = require('../middleware/rateLimit');
const submissionController = require('../controllers/submissionController');
const archiveController = require('../controllers/archiveController');
const resumableController = require('../controllers/resumableUploadController');
const { authorizeScholarAccess } = require('../middleware/privacyAccess');

const ALLOWED_UPLOAD_TYPES = new Map([
    ['.jpg', ['image/jpeg']],
    ['.jpeg', ['image/jpeg']],
    ['.png', ['image/png']],
    ['.pdf', ['application/pdf']],
    ['.doc', ['application/msword']],
    ['.docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
]);

const validateUploadType = (file, includeDocuments = true) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedTypes = ALLOWED_UPLOAD_TYPES.get(extension);
    const documentsAllowed = includeDocuments || !['.doc', '.docx'].includes(extension);
    return documentsAllowed && allowedTypes?.includes(file.mimetype);
};

// MEMORY STORAGE - used only for AI analysis previews (analyze/*).
// These files are never permanently saved anywhere, just read into a buffer,
// sent to Gemini, and discarded after the request ends.
const uploadMemory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        if (validateUploadType(file, false)) cb(null, true);
        else cb(new Error('Only valid JPEG, PNG, and PDF files are allowed'));
    }
});

const uploadCloud = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        if (validateUploadType(file)) cb(null, true);
        else cb(new Error('Only valid JPEG, PNG, PDF, DOC, and DOCX files are allowed'));
    }
});

const uploadChunk = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 },
});

const scoreLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: 'Score prediction limit reached. Please try again later.' });

// Resumable scholar uploads: chunks are held in a private staging directory,
// scanned only after the final merge, then consumed by the normal submission flow.
router.post('/uploads/session', rateLimit({ windowMs: 60 * 60 * 1000, max: 30 }), verifyToken, requireRole(['scholar']), resumableController.createSession);
router.put('/uploads/session/:id/chunk/:index', rateLimit({ windowMs: 60 * 60 * 1000, max: 120 }), verifyToken, requireRole(['scholar']), uploadChunk.single('chunk'), resumableController.uploadChunk);
router.get('/uploads/session/:id', verifyToken, requireRole(['scholar']), resumableController.getStatus);
router.post('/uploads/session/:id/complete', verifyToken, requireRole(['scholar']), resumableController.completeSession);
router.delete('/uploads/session/:id', verifyToken, requireRole(['scholar']), resumableController.cancelSession);

// SUBMIT COMPLIANCE (Scholar-only, permanent -> Cloudinary)
router.post('/submit', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Upload limit reached. Please try again later.' }), verifyToken, requireRole(['scholar']), uploadCloud.fields([
    { name: 'report_card', maxCount: 1 },
    { name: 'cor', maxCount: 1 },
    { name: 'media', maxCount: 10 }
]), validateUploadedFileSignatures, scanUploadedFiles, submissionController.submitCompliance);

// SCORE LETTER (Scholar-only) — safe model score preview route
router.post('/score', scoreLimiter, verifyToken, requireRole(['scholar']), submissionController.predictLetterScore);

// HISTORY (Owner or Staff/Admin)
router.get('/history/:scholar_id', verifyToken, authorizeScholarAccess({
    getScholarId: (req) => req.params.scholar_id,
    action: 'VIEW_SCHOLAR',
    resourceType: 'submission_history',
}), submissionController.getHistory);

// PREVIEW FILE (used by the officer/scholar review UI to show uploaded files inline)
router.get('/preview', verifyToken, submissionController.previewCloudinaryFile);

// Letter review data is available to Officers and Admins; Staff handle attendance only.
router.get('/all', verifyToken, requireRole(['admin', 'officer'], { action: 'VIEW_LETTER', resourceType: 'letter' }), submissionController.getAllSubmissions);
router.get('/letters', verifyToken, requireRole(['admin', 'officer'], { action: 'VIEW_LETTER', resourceType: 'letter' }), submissionController.getLetters);
router.get('/scholar-view', verifyToken, requireRole(['admin', 'officer'], { action: 'VIEW_LETTER', resourceType: 'letter' }), submissionController.getScholarSubmissions);
router.post('/archive/bulk', verifyToken, requireRole(['admin']), submissionController.archiveSubmissionsBulk);
router.put('/archive/:id/restore', verifyToken, requireRole(['admin']), archiveController.restoreSubmission);

// REVIEW SUBMISSION (Admin/Officer)
router.put('/review/:id', verifyToken, requireRole(['admin', 'officer'], {
    action: 'VALIDATE_LETTER',
    resourceType: 'letter',
    logAllowed: false,
}), submissionController.reviewSubmission);

// Generate or return existing PDF for a submission (Officer on-demand)
router.get('/generate-pdf/:id', verifyToken, requireRole(['admin', 'officer'], {
    action: 'VIEW_DOCUMENT',
    resourceType: 'letter',
    logAllowed: false,
}), submissionController.getOrGenerateSubmissionPdf);
router.post('/letters/bulk-pdf', verifyToken, requireRole(['admin'], { action: 'DOWNLOAD_DOCUMENT', resourceType: 'letter' }), submissionController.downloadMonthlyLetterPdfs);

// ALL GRADES (Admin)
// NOTE: Must come BEFORE /grades/:scholar_id to avoid being shadowed by the :scholar_id parameter
router.get('/grades/all', verifyToken, requireRole(['admin']), submissionController.getAllGrades);

// GRADES (Owner or Admin for reads; Scholar-only for submit -> Cloudinary)
router.get('/grades/:scholar_id', verifyToken, requireRole(['admin', 'scholar'], {
    action: 'VIEW_SCHOLAR',
    resourceType: 'grades',
    logAllowed: false,
}), authorizeScholarAccess({
    getScholarId: (req) => req.params.scholar_id,
    action: 'VIEW_ACADEMIC_RECORD',
    resourceType: 'grades',
}), submissionController.getGrades);
router.get('/grades/:scholar_id/check/:semester/:academic_year', verifyToken, requireRole(['admin', 'scholar'], {
    action: 'VIEW_SCHOLAR',
    resourceType: 'grades',
    logAllowed: false,
}), authorizeScholarAccess({
    getScholarId: (req) => req.params.scholar_id,
    action: 'VIEW_ACADEMIC_RECORD',
    resourceType: 'grades',
}), submissionController.checkGradesLocked);
router.post('/grades/submit', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Upload limit reached. Please try again later.' }), verifyToken, requireRole(['scholar']), uploadCloud.single('proof'), validateUploadedFileSignatures, scanUploadedFiles, submissionController.submitGrades);
router.post('/grades/submit-resumable', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Upload limit reached. Please try again later.' }), verifyToken, requireRole(['scholar']), uploadCloud.none(), submissionController.submitGradesResumable);

// REVIEW GRADES (Admin)
router.put('/grades/review', verifyToken, requireRole(['admin']), submissionController.reviewGrades);

module.exports = router;