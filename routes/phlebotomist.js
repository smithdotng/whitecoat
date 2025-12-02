// routes/phlebotomist.js
// ONLY PROTECTED PHLEBOTOMIST ROUTES — Login/Register live in routes/auth.js

const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const Phlebotomist = require('../models/Phlebotomist');
const Order = require('../models/Order');

// ===========================================
// ALL ROUTES BELOW ARE PROTECTED BY ROLE
// ===========================================
router.use(requireRole(['phlebotomist']));

// Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const phlebotomist = await Phlebotomist.findById(req.session.user._id);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todaysAssignments = await Order.find({
            phlebotomistId: phlebotomist._id,
            'collectionDetails.scheduledDate': {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            }
        }).sort({ 'collectionDetails.scheduledDate': 1 });

        const pendingAssignments = await Order.find({
            phlebotomistId: phlebotomist._id,
            status: { $in: ['scheduled', 'pending'] }
        }).sort({ 'collectionDetails.scheduledDate': 1 });

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const completedThisMonth = await Order.countDocuments({
            phlebotomistId: phlebotomist._id,
            status: 'completed',
            'collectionDetails.collectionDate': { $gte: startOfMonth }
        });

        res.render('phlebotomist/dashboard', {
            title: 'Phlebotomist Dashboard',
            phlebotomist,
            todaysAssignments,
            pendingAssignments,
            completedThisMonth
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', {
            message: 'Error loading dashboard',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// My Assignments (All + Filter by status)
router.get('/assignments', async (req, res) => {
    try {
        const phlebotomist = await Phlebotomist.findById(req.session.user._id);
        const status = req.query.status || 'all';
        let query = { phlebotomistId: phlebotomist._id };

        if (status !== 'all') {
            query.status = status;
        }

        const assignments = await Order.find(query)
            .sort({ 'collectionDetails.scheduledDate': 1 })
            .populate('patientId', 'anonymousId');

        res.render('phlebotomist/assignments', {
            title: 'My Assignments',
            phlebotomist,
            assignments,
            currentStatus: status
        });
    } catch (error) {
        console.error('Assignments error:', error);
        res.status(500).render('error', { message: 'Error loading assignments' });
    }
});

// Assignment Details
router.get('/assignments/:id', async (req, res) => {
    try {
        const phlebotomist = await Phlebotomist.findById(req.session.user._id);
        const assignment = await Order.findOne({
            _id: req.params.id,
            phlebotomistId: phlebotomist._id
        }).populate('patientId', 'anonymousId');

        if (!assignment) {
            return res.status(404).render('404', { title: 'Assignment Not Found' });
        }

        res.render('phlebotomist/assignment-details', {
            title: 'Assignment Details',
            phlebotomist,
            assignment
        });
    } catch (error) {
        console.error('Assignment details error:', error);
        res.status(500).render('error', { message: 'Error loading assignment' });
    }
});

// Update Assignment Status (e.g. sample_collected)
router.post('/assignments/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const phlebotomist = await Phlebotomist.findById(req.session.user._id);

        const updateData = { status };
        if (status === 'sample_collected') {
            updateData['collectionDetails.collectionDate'] = new Date();
        }

        await Order.findOneAndUpdate(
            { _id: req.params.id, phlebotomistId: phlebotomist._id },
            updateData
        );

        req.session.success = 'Assignment status updated!';
        res.redirect(`/phlebotomist/assignments/${req.params.id}`);
    } catch (error) {
        console.error('Status update error:', error);
        req.session.error = 'Failed to update status';
        res.redirect(`/phlebotomist/assignments/${req.params.id}`);
    }
});

// Schedule & Availability
router.get('/schedule', async (req, res) => {
    try {
        const phlebotomist = await Phlebotomist.findById(req.session.user._id);
        res.render('phlebotomist/schedule', {
            title: 'My Schedule',
            phlebotomist
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Error loading schedule' });
    }
});

router.post('/schedule/availability', async (req, res) => {
    try {
        const { workingHours, workingDays, serviceRadius } = req.body;

        await Phlebotomist.findByIdAndUpdate(req.session.user._id, {
            'availability.workingHours': workingHours,
            'availability.workingDays': workingDays,
            'availability.serviceRadius': serviceRadius
        });

        req.session.success = 'Availability updated successfully!';
        res.redirect('/phlebotomist/schedule');
    } catch (error) {
        req.session.error = 'Failed to update availability';
        res.redirect('/phlebotomist/schedule');
    }
});

// Earnings
router.get('/earnings', async (req, res) => {
    try {
        const phlebotomist = await Phlebotomist.findById(req.session.user._id);
        const completedAssignments = await Order.find({
            phlebotomistId: phlebotomist._id,
            status: 'completed'
        }).sort({ 'collectionDetails.collectionDate': -1 });

        const totalEarnings = completedAssignments.reduce((sum, order) => sum + (order.phlebotomistFee || 0), 0);

        const monthlyEarnings = {};
        completedAssignments.forEach(order => {
            if (order.collectionDetails?.collectionDate) {
                const key = `${order.collectionDetails.collectionDate.getFullYear()}-${String(order.collectionDetails.collectionDate.getMonth() + 1).padStart(2, '0')}`;
                monthlyEarnings[key] = (monthlyEarnings[key] || 0) + (order.phlebotomistFee || 0);
            }
        });

        res.render('phlebotomist/earnings', {
            title: 'My Earnings',
            phlebotomist,
            completedAssignments,
            totalEarnings: totalEarnings.toFixed(2),
            monthlyEarnings
        });
    } catch (error) {
        console.error('Earnings error:', error);
        res.status(500).render('error', { message: 'Error loading earnings' });
    }
});

// Profile
router.get('/profile', async (req, res) => {
    try {
        const phlebotomist = await Phlebotomist.findById(req.session.user._id);
        res.render('phlebotomist/profile', {
            title: 'My Profile',
            phlebotomist
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Error loading profile' });
    }
});

module.exports = router;