const express = require('express');
const router = express.Router();
const archive = require('../controllers/archiveController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const archiveReaders = [verifyToken, requireRole(['admin'], { action: 'VIEW_DOCUMENT', resourceType: 'scholar_document' })];

router.get('/retention/expiring', archiveReaders, archive.expiringDocuments);
router.put('/restore/:id', verifyToken, requireRole(['admin'], { action: 'UPDATE_DOCUMENT', resourceType: 'scholar_document' }), archive.restoreDocument);
router.delete('/document/:id', verifyToken, requireRole(['admin'], { action: 'DELETE_DOCUMENT', resourceType: 'scholar_document' }), archive.deleteDocument);

module.exports = router;
