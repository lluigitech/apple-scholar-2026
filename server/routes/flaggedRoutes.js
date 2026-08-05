const express = require('express');
const router = express.Router();
const flaggedController = require('../controllers/flaggedController');
const { verifyToken } = require('../middleware/authMiddleware');

// Shared flagged scholars endpoint — ginagamit ng Officer at Admin portals
router.get('/scholars', verifyToken, flaggedController.getFlaggedScholars);

module.exports = router;