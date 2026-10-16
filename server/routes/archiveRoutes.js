const express = require('express');
const router = express.Router();
const archive = require('../controllers/archiveController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const archiveReaders = [verifyToken, requireRole(['admin'], { action: 'VIEW_DOCUMENT', resourceType: 'scholar_document' })];
const archiveManagers = [verifyToken, requireRole(['admin'], { action: 'UPDATE_DOCUMENT', resourceType: 'scholar_document' })];

router.get('/documents', archiveReaders, archive.listDocuments);
router.put('/archive/:id', archiveManagers, archive.archiveDocument);
router.put('/restore/:id', archiveManagers, archive.restoreDocument);
router.delete('/document/:id', verifyToken, requireRole(['admin'], { action: 'DELETE_DOCUMENT', resourceType: 'scholar_document' }), archive.deleteDocument);

module.exports = router;
