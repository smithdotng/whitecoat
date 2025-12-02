// routes/patient.js - UPDATED VERSION
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Patient = require('../models/Patient');
const Order = require('../models/Order');
const Test = require('../models/Test');

// Debug middleware
router.use(async (req, res, next) => {
    console.log('=== PATIENT ROUTE DEBUG ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Session user:', req.session.user);
    
    if (!req.session.user) {
        req.session.error = 'Please login first';
        return res.redirect('/auth/login');
    }
    
    if (req.session.user.role !== 'patient') {
        req.session.error = 'Access denied';
        return res.redirect('/auth/login');
    }
    
    // Ensure patient profile exists
    if (!req.session.user.patientId) {
        const patient = await Patient.findOne({ userId: req.session.user._id });
        if (patient) {
            req.session.user.patientId = patient._id;
        }
    }
    
    next();
});

// ==========================================
// DASHBOARD - FIXED VERSION
// ==========================================
router.get('/dashboard', async (req, res) => {
    try {
        console.log('=== DASHBOARD REQUEST ===');
        
        // 1. Find the Patient
        let patient = await Patient.findOne({ userId: req.session.user._id });
        
        if (!patient) {
            req.session.error = "Please complete your profile details before accessing the dashboard.";
            return res.redirect('/patient/profile'); 
        }

        // 2. Get Counts for the Stats Area - FIXED SYNTAX
        // Check if Order model exists and has countDocuments method
        let totalOrders = 0;
        let pendingOrders = 0;
        let resultsReady = 0;
        
        if (Order && typeof Order.countDocuments === 'function') {
            totalOrders = await Order.countDocuments({ 
                patientId: patient._id 
            });

            pendingOrders = await Order.countDocuments({ 
                patientId: patient._id, 
                status: { $in: ['pending', 'scheduled', 'processing', 'sample_collected'] } 
            });

            resultsReady = await Order.countDocuments({ 
                patientId: patient._id, 
                status: 'completed' 
            });
        } else {
            console.warn('Order model not properly loaded or missing countDocuments method');
        }

        // 3. Get Recent Orders
        let recentOrders = [];
        if (Order && typeof Order.find === 'function') {
            recentOrders = await Order.find({ patientId: patient._id })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('tests.testId');
        }

        // 4. Affiliate Earnings (Placeholder)
        const affiliateEarnings = 0;

        // 5. Render
        res.render('patient/dashboard', {
            title: 'My Dashboard',
            success: req.session.success,
            error: req.session.error,
            patient,
            totalOrders,
            pendingOrders,
            resultsReady, 
            affiliateEarnings,
            recentOrders 
        });
        
        // Clear flash messages
        delete req.session.success;
        delete req.session.error;

    } catch (err) {
        console.error('Patient dashboard error:', err);
        
        // Simple error page without includes for debugging
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Error - WhiteCoat</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    .error-container { max-width: 800px; margin: 0 auto; }
                    .error-box { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 20px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>Unable to Load Dashboard</h1>
                    <div class="error-box">
                        <h3>Error Details:</h3>
                        <p><strong>Message:</strong> ${err.message}</p>
                        ${process.env.NODE_ENV === 'development' ? `<pre>${err.stack}</pre>` : ''}
                    </div>
                    <p><a href="/patient/dashboard">Try Again</a> | <a href="/">Return Home</a></p>
                </div>
            </body>
            </html>
        `);
    }
});

// ==========================================
// SIMPLIFIED DASHBOARD FOR TESTING
// ==========================================
router.get('/dashboard-test', async (req, res) => {
    try {
        // Simple test version without Order model dependencies
        let patient = await Patient.findOne({ userId: req.session.user._id });
        
        if (!patient) {
            patient = {
                firstName: 'Guest',
                lastName: 'User'
            };
        }
        
        res.render('patient/dashboard', {
            title: 'My Dashboard',
            patient,
            totalOrders: 0,
            pendingOrders: 0,
            resultsReady: 0,
            affiliateEarnings: 0,
            recentOrders: []
        });
        
    } catch (err) {
        console.error('Test dashboard error:', err);
        res.send(`
            <h1>Test Dashboard Error</h1>
            <p>${err.message}</p>
            <a href="/patient/dashboard">Back to Dashboard</a>
        `);
    }
});

// ==========================================
// PROFILE GET - SIMPLIFIED
// ==========================================
router.get('/profile', async (req, res) => {
    try {
        const patient = await Patient.findOne({ userId: req.session.user._id });
        
        res.render('patient/profile', {
            title: 'My Profile',
            success: req.session.success,
            error: req.session.error,
            patient: patient || {
                firstName: '',
                lastName: '',
                phone: '',
                address: {
                    street: '',
                    city: '',
                    state: '',
                    zipCode: ''
                }
            },
        });
        
        delete req.session.success;
        delete req.session.error;

    } catch (error) {
        console.error('Profile page error:', error);
        res.status(500).send(`
            <h1>Error Loading Profile</h1>
            <p>${error.message}</p>
            <a href="/patient/dashboard">Back to Dashboard</a>
        `);
    }
});

// ==========================================
// PROFILE POST - KEEP AS IS
// ==========================================
router.post('/profile', async (req, res) => {
    try {
        const { firstName, lastName, phone, addressStreet, addressCity, addressState, addressZip } = req.body;
        
        const updatedPatient = await Patient.findOneAndUpdate(
            { userId: req.session.user._id },
            {
                firstName,
                lastName,
                phone,
                'address.street': addressStreet,
                'address.city': addressCity,
                'address.state': addressState,
                'address.zipCode': addressZip
            },
            { new: true, upsert: true }
        );
        
        req.session.user.patientId = updatedPatient._id;
        req.session.success = 'Profile updated successfully!';
        
        return res.redirect('/patient/dashboard');

    } catch (error) {
        console.error('Profile update error:', error);
        req.session.error = 'Error updating profile. Please try again.';
        res.redirect('/patient/profile');
    }
});

// ==========================================
// OTHER ROUTES - SIMPLIFIED TEMPORARILY
// ==========================================
router.get('/tests', async (req, res) => {
    try {
        let tests = [];
        if (Test && typeof Test.find === 'function') {
            tests = await Test.find({ isActive: true });
        }
        
        const patient = await Patient.findOne({ userId: req.session.user._id });
        
        res.render('patient/tests', {
            title: 'Browse Tests',
            tests,
            patient: patient || { firstName: 'Guest' }
        });
    } catch (error) {
        console.error('Tests page error:', error);
        res.status(500).send(`Error loading tests: ${error.message}`);
    }
});

// Simple placeholder for other routes
router.get('/orders', (req, res) => res.render('patient/orders', { 
    title: 'My Orders',
    orders: [],
    patient: { firstName: 'Guest' }
}));

router.get('/results', (req, res) => res.render('patient/results', { 
    title: 'Test Results',
    orders: [],
    patient: { firstName: 'Guest' }
}));

router.get('/schedule', (req, res) => res.render('patient/schedule', { 
    title: 'Schedule Test',
    tests: [],
    patient: { firstName: 'Guest' }
}));

router.get('/cart', (req, res) => res.render('patient/cart', { 
    title: 'Shopping Cart',
    patient: { firstName: 'Guest' }
}));

module.exports = router;