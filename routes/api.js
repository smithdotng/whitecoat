const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// Public API endpoints
router.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Protected API endpoints
router.use('/secure', authMiddleware);

router.get('/secure/user', (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;