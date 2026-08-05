const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/status', notificationController.getStatus);
router.get('/logs', notificationController.getLogs);
router.post('/test/gmail', notificationController.testGmail);
router.post('/test/messenger', notificationController.testMessenger);

module.exports = router;
