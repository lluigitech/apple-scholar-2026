const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const submissionController = require('../controllers/submissionController');

// MEMORY STORAGE - used only for AI analysis previews (analyze/*).
// These files are never permanently saved anywhere, just read into a buffer,
// sent to Gemini, and discarded after the request ends.
const uploadMemory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        if (ext) cb(null, true);
        else cb(new Error('Only images and PDFs allowed'));
    }
});

// CLOUDINARY STORAGE - used for final, permanent submissions (submit, grades/submit).
// multer-storage-cloudinary uploads directly to Cloudinary and sets req.file(s).path
// to the resulting secure Cloudinary URL - no local disk involved at all.
// Routes files into subfolders by type so the Media Library stays organized:
// apple-scholar/submissions/report-cards, /cor, /other-documents, /grades-proof
const folderForField = {
    report_card: 'report-cards',
    cor: 'cor',
    media: 'other-documents',
    proof: 'grades-proof',
};

const cloudStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: `apple-scholar/submissions/${folderForField[file.fieldname] || 'other'}`,
        resource_type: 'auto', // images/pdf go as 'image', doc/docx auto-route to 'raw'
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
        public_id: `${Date.now()}-${path.parse(file.originalname).name}`,
    })
});

const uploadCloud = multer({
    storage: cloudStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf|doc|docx/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        if (ext) cb(null, true);
        else cb(new Error('Only images, PDFs, and Word documents (.doc/.docx) are allowed'));
    }
});

// AI ANALYSIS (Scholar-only, preview - not permanently saved)
router.post('/analyze/report-card', verifyToken, requireRole(['scholar']), uploadMemory.single('file'), submissionController.analyzeReportCard);
router.post('/analyze/cor', verifyToken, requireRole(['scholar']), uploadMemory.single('file'), submissionController.analyzeCor);
router.post('/analyze/letter', verifyToken, requireRole(['scholar']), submissionController.analyzeLetter);

// SUBMIT COMPLIANCE (Scholar-only, permanent -> Cloudinary)
router.post('/submit', verifyToken, requireRole(['scholar']), uploadCloud.fields([
    { name: 'report_card', maxCount: 1 },
    { name: 'cor', maxCount: 1 },
    { name: 'media', maxCount: 10 }
]), submissionController.submitCompliance);

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
router.post('/grades/submit', verifyToken, requireRole(['scholar']), uploadCloud.single('proof'), submissionController.submitGrades);

// REVIEW GRADES (Staff/Admin/Officer) - update verification_status and officer_comment for a semester
router.put('/grades/review', verifyToken, requireRole(['staff', 'admin', 'officer']), submissionController.reviewGrades);

router.post('/evaluate-ml', verifyToken, submissionController.evaluateLetterML);

module.exports = router;