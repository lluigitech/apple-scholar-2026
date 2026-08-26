const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { validateUploadedFileSignatures, scanUploadedFiles } = require('../middleware/fileUploadSecurity');
const { rateLimit } = require('../middleware/rateLimit');
const submissionController = require('../controllers/submissionController');

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

// AI ANALYSIS (Scholar-only, preview - not permanently saved)
router.post('/analyze/report-card', verifyToken, requireRole(['scholar']), uploadMemory.single('file'), validateUploadedFileSignatures, scanUploadedFiles, submissionController.analyzeReportCard);
router.post('/analyze/cor', verifyToken, requireRole(['scholar']), uploadMemory.single('file'), validateUploadedFileSignatures, scanUploadedFiles, submissionController.analyzeCor);
router.post('/analyze/letter', verifyToken, requireRole(['scholar']), submissionController.analyzeLetter);

// SUBMIT COMPLIANCE (Scholar-only, permanent -> Cloudinary)
router.post('/submit', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Upload limit reached. Please try again later.' }), verifyToken, requireRole(['scholar']), uploadCloud.fields([
    { name: 'report_card', maxCount: 1 },
    { name: 'cor', maxCount: 1 },
    { name: 'media', maxCount: 10 }
]), validateUploadedFileSignatures, scanUploadedFiles, submissionController.submitCompliance);

// HISTORY (Owner or Staff/Admin)
router.get('/history/:scholar_id', verifyToken, submissionController.getHistory);

// PREVIEW FILE (used by the officer/scholar review UI to show uploaded files inline)
router.get('/preview', verifyToken, submissionController.previewCloudinaryFile);

// ALL SUBMISSIONS (Staff/Admin/Officer)
router.get('/all', verifyToken, requireRole(['staff', 'admin', 'officer']), submissionController.getAllSubmissions);
router.get('/letters', verifyToken, requireRole(['staff', 'admin', 'officer']), submissionController.getLetters);
router.get('/scholar-view', verifyToken, submissionController.getScholarSubmissions);

// REVIEW SUBMISSION (Staff/Admin/Officer)
router.put('/review/:id', verifyToken, requireRole(['staff', 'admin', 'officer']), submissionController.reviewSubmission);

// Generate or return existing PDF for a submission (Officer on-demand)
router.get('/generate-pdf/:id', verifyToken, requireRole(['staff', 'admin', 'officer']), submissionController.getOrGenerateSubmissionPdf);

// ALL GRADES (Staff/Admin/Officer) - used by the officer's grouped review view
// NOTE: Must come BEFORE /grades/:scholar_id to avoid being shadowed by the :scholar_id parameter
router.get('/grades/all', verifyToken, requireRole(['staff', 'admin', 'officer']), submissionController.getAllGrades);

// GRADES (Owner or Staff/Admin for reads; Scholar-only for submit -> Cloudinary)
router.get('/grades/:scholar_id', verifyToken, submissionController.getGrades);
router.get('/grades/:scholar_id/check/:semester/:academic_year', verifyToken, submissionController.checkGradesLocked);
router.post('/grades/submit', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Upload limit reached. Please try again later.' }), verifyToken, requireRole(['scholar']), uploadCloud.single('proof'), validateUploadedFileSignatures, scanUploadedFiles, submissionController.submitGrades);

// REVIEW GRADES (Staff/Admin/Officer) - update verification_status and officer_comment for a semester
router.put('/grades/review', verifyToken, requireRole(['staff', 'admin', 'officer']), submissionController.reviewGrades);

router.post('/evaluate-ml', verifyToken, submissionController.evaluateLetterML);

module.exports = router;