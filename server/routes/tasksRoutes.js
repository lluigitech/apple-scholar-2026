const express = require('express');
const router = express.Router();
const taskCtrl = require('../controllers/taskController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Read is authenticated so task visibility can follow scholar/officer assignments.
router.get('/', verifyToken, taskCtrl.getAllTasks);
router.post('/:id/export-pdf', verifyToken, taskCtrl.exportTaskPdf);
router.get('/:id', verifyToken, taskCtrl.getTask);

// Protected: create/update/delete by staff/officer/admin
router.post('/', verifyToken, requireRole(['admin', 'officer', 'staff']), taskCtrl.createTask);
router.put('/:id', verifyToken, requireRole(['admin', 'officer', 'staff']), taskCtrl.updateTask);
router.delete('/:id', verifyToken, requireRole(['admin', 'officer', 'staff']), taskCtrl.deleteTask);

module.exports = router;
