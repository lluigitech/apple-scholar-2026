const express = require('express');
const router = express.Router();
const controller = require('../controllers/backupRecoveryController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const adminOnly = [verifyToken, requireRole(['admin'])];

router.get('/', adminOnly, controller.list);
router.get('/policy', adminOnly, controller.policy);
router.post('/', adminOnly, controller.create);
router.get('/:id/download', adminOnly, controller.download);
router.post('/:id/restore', adminOnly, controller.restore);
router.delete('/:id', adminOnly, controller.remove);

module.exports = router;
