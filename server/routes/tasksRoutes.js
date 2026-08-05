const express = require('express');
const router = express.Router();
const taskCtrl = require('../controllers/taskController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Public read of active tasks (scholars can see available tasks)
router.get('/', taskCtrl.getAllTasks);
router.get('/:id', taskCtrl.getTask);

// Protected: create/update/delete by staff/officer/admin
router.post('/', verifyToken, requireRole(['admin', 'officer', 'staff']), taskCtrl.createTask);
router.put('/:id', verifyToken, requireRole(['admin', 'officer', 'staff']), taskCtrl.updateTask);
router.delete('/:id', verifyToken, requireRole(['admin', 'officer', 'staff']), taskCtrl.deleteTask);

module.exports = router;
