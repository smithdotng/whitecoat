// routes/corporate.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');

// ====================
// Middleware: Auth + Role + Corporate Check
// ====================
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        req.session.error = 'Please log in first';
        return res.redirect('/auth/login');
    }
    next();
};

const requireCorporate = (req, res, next) => {
    if (req.session.user.userType !== 'corporate') {
        req.session.error = 'Access denied';
        return res.redirect('/patient/dashboard');
    }
    next();
};

// Apply middlewares
router.use(requireAuth);
router.use(requireCorporate);

// ====================
// Corporate Dashboard
// ====================
// routes/corporate.js  (only dashboard route updated)

router.get('/dashboard', async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id).lean();

        const totalTests = await Order.countDocuments({ corporateUserId: user._id });

        const pendingTests = await Order.countDocuments({
            corporateUserId: user._id,
            status: { $in: ['pending', 'scheduled', 'sample_collected', 'at_lab', 'processing'] }
        });

        const recentOrders = await Order.find({ corporateUserId: user._id })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('tests.testId', 'name')
            .lean();

        // Fake employee count until you have real data
        const totalEmployees = await Order.distinct('patientId', { corporateUserId: user._id }).then(arr => arr.length);

        res.render('corporate/dashboard', {
            title: 'Corporate Dashboard – WhiteCoat',
            user,
            stats: {
                totalEmployees,
                totalTests,
                pendingTests
            },
            recentOrders
        });

    } catch (err) {
        console.error('Corporate dashboard error:', err);
        res.status(500).render('error', {
            message: 'Unable to load dashboard',
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }
});

// Other corporate pages (you can expand later)
router.get('/bulk-order', (req, res) => {
    res.render('corporate/bulk-order', { title: 'Bulk Employee Testing' });
});

router.get('/employees', (req, res) => {
    res.render('corporate/employees', { title: 'Manage Employees' });
});

router.get('/reports', (req, res) => {
    res.render('corporate/reports', { title: 'Reports & Analytics' });
});

// THIS LINE WAS MISSING — THIS IS WHAT CAUSED THE ERROR!
module.exports = router;