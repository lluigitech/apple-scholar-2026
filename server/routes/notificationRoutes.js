const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const notificationAdmins = [verifyToken, requireRole(['admin'])];

router.get('/status', notificationAdmins, notificationController.getStatus);
router.get('/logs', notificationAdmins, notificationController.getLogs);
router.post('/test/gmail', notificationAdmins, notificationController.testGmail);
router.post('/test/messenger', notificationAdmins, notificationController.testMessenger);

module.exports = router;
