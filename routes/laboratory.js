const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const Laboratory = require('../models/Laboratory');
const Order = require('../models/Order');
const Test = require('../models/Test');

// Apply authentication and role check
router.use(requireRole(['laboratory']));

// Laboratory Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const laboratory = await Laboratory.findOne({ userId: req.user._id });
        
        // Get statistics
        const pendingSamples = await Order.countDocuments({
            laboratoryId: laboratory._id,
            status: 'at_lab'
        });
        
        const processingSamples = await Order.countDocuments({
            laboratoryId: laboratory._id,
            status: 'processing'
        });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const samplesToday = await Order.countDocuments({
            laboratoryId: laboratory._id,
            'sampleCodes.receivedAtLab': { $gte: today }
        });
        
        const recentSamples = await Order.find({
            laboratoryId: laboratory._id
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('patientId', 'anonymousId');
        
        res.render('laboratory/dashboard', {
            title: 'Laboratory Dashboard',
            laboratory,
            pendingSamples,
            processingSamples,
            samplesToday,
            recentSamples
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { 
            message: 'Error loading dashboard',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Samples Management
router.get('/samples', async (req, res) => {
    try {
        const laboratory = await Laboratory.findOne({ userId: req.user._id });
        const status = req.query.status || 'all';
        
        let query = { laboratoryId: laboratory._id };
        
        if (status !== 'all') {
            query.status = status;
        }
        
        const samples = await Order.find(query)
            .sort({ createdAt: -1 })
            .populate('patientId', 'anonymousId');
        
        res.render('laboratory/samples', {
            title: 'Samples Management',
            laboratory,
            samples,
            currentStatus: status
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading samples',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Sample Details
router.get('/samples/:id', async (req, res) => {
    try {
        const laboratory = await Laboratory.findOne({ userId: req.user._id });
        const sample = await Order.findOne({
            _id: req.params.id,
            laboratoryId: laboratory._id
        }).populate('patientId', 'anonymousId');
        
        if (!sample) {
            return res.status(404).render('404', { 
                title: 'Sample Not Found'
            });
        }
        
        res.render('laboratory/sample-details', {
            title: 'Sample Details',
            laboratory,
            sample
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading sample details',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Mark Sample Received
router.post('/samples/:id/receive', async (req, res) => {
    try {
        const laboratory = await Laboratory.findOne({ userId: req.user._id });
        
        await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                laboratoryId: laboratory._id
            },
            {
                status: 'processing',
                $set: {
                    'sampleCodes.$[elem].receivedAtLab': new Date()
                }
            },
            {
                arrayFilters: [{ 'elem.receivedAtLab': null }]
            }
        );
        
        req.session.success = 'Sample marked as received!';
        res.redirect('/laboratory/samples/' + req.params.id);
    } catch (error) {
        req.session.error = 'Error updating sample status';
        res.redirect('/laboratory/samples/' + req.params.id);
    }
});

// Upload Results
router.get('/upload', async (req, res) => {
    try {
        const laboratory = await Laboratory.findOne({ userId: req.user._id });
        
        // Get samples ready for result upload
        const samples = await Order.find({
            laboratoryId: laboratory._id,
            status: 'processing',
            resultsUploaded: false
        }).sort({ createdAt: 1 });
        
        res.render('laboratory/upload', {
            title: 'Upload Results',
            laboratory,
            samples
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading upload page',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Submit Results
router.post('/samples/:id/results', async (req, res) => {
    try {
        const { resultNotes, testResults } = req.body;
        const laboratory = await Laboratory.findOne({ userId: req.user._id });
        
        // In a real app, you'd handle file uploads here
        // For now, just update the status
        await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                laboratoryId: laboratory._id
            },
            {
                status: 'completed',
                resultsUploaded: true,
                completedAt: new Date(),
                resultNotes: resultNotes
                // You'd also save the actual results file/document here
            }
        );
        
        req.session.success = 'Results uploaded successfully!';
        res.redirect('/laboratory/samples/' + req.params.id);
    } catch (error) {
        req.session.error = 'Error uploading results';
        res.redirect('/laboratory/samples/' + req.params.id);
    }
});

// Reports & Analytics
router.get('/reports', async (req, res) => {
    try {
        const laboratory = await Laboratory.findOne({ userId: req.user._id });
        
        // Get report data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentOrders = await Order.find({
            laboratoryId: laboratory._id,
            createdAt: { $gte: thirtyDaysAgo }
        }).sort({ createdAt: -1 });
        
        // Calculate statistics
        const totalProcessed = await Order.countDocuments({
            laboratoryId: laboratory._id,
            status: 'completed'
        });
        
        const averageProcessingTime = 24; // In hours - would calculate from actual data
        
        res.render('laboratory/reports', {
            title: 'Reports & Analytics',
            laboratory,
            recentOrders,
            totalProcessed,
            averageProcessingTime
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading reports',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Inventory
router.get('/inventory', async (req, res) => {
    try {
        const laboratory = await Laboratory.findOne({ userId: req.user._id });
        
        // Get tests that this lab can perform
        const availableTests = await Test.find({
            'availableLabs.laboratoryId': laboratory._id
        });
        
        res.render('laboratory/inventory', {
            title: 'Test Inventory',
            laboratory,
            availableTests
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading inventory',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Profile
router.get('/profile', async (req, res) => {
    try {
        const laboratory = await Laboratory.findOne({ userId: req.user._id });
        
        res.render('laboratory/profile', {
            title: 'Laboratory Profile',
            laboratory
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading profile',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Update Profile
router.post('/profile', async (req, res) => {
    try {
        const { labName, phone, accreditationNumber, addressStreet, addressCity, addressState, addressZip } = req.body;
        
        await Laboratory.findOneAndUpdate(
            { userId: req.user._id },
            {
                labName,
                phone,
                accreditationNumber,
                'address.street': addressStreet,
                'address.city': addressCity,
                'address.state': addressState,
                'address.zipCode': addressZip
            }
        );
        
        req.session.success = 'Profile updated successfully!';
        res.redirect('/laboratory/profile');
    } catch (error) {
        req.session.error = 'Error updating profile';
        res.redirect('/laboratory/profile');
    }
});

module.exports = router;