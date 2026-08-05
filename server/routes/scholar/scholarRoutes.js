const express  = require('express');
const router   = express.Router();
const scholar  = require('../../controllers/scholarController');
const { verifyToken, requireRole } = require('../../middleware/authMiddleware');

router.get('/profile/:id',    scholar.getProfile);
router.patch('/profile/:id',  verifyToken, requireRole(['scholar']), scholar.updateProfile);
router.get('/announcements',  scholar.getAnnouncements);

// Duty by Group -- protected: scholar_id galing sa JWT (req.user.scholar_id),
// hindi na sa URL, para hindi pwede palitan/i-spoof
router.get ('/my-duties', verifyToken, requireRole(['scholar', 'Scholar']), scholar.getMyDuties);
router.post('/checkin',   verifyToken, requireRole(['scholar', 'Scholar']), scholar.checkInToDuty);

module.exports = router;