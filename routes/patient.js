const express = require('express');
const router = express.Router();
// Ensure you have this middleware file, or comment this line out if not
const { requireRole } = require('../middleware/auth'); 
const Patient = require('../models/Patient');
const Order = require('../models/Order');
const Test = require('../models/Test');

// Apply authentication and role check to all routes in this file
router.use(requireRole(['patient']));

// ==========================================
// DASHBOARD
// ==========================================
router.get('/dashboard', async (req, res) => {
    try {
        // 1. Find the Patient linked to the logged-in User
        let patient = await Patient.findOne({ userId: req.session.user._id });
        
        // Safety check: if patient profile doesn't exist yet, redirect to profile creation
        // THIS IS THE KEY CHANGE.
        if (!patient) {
            req.session.error = "Please complete your profile details before accessing the dashboard.";
            return res.redirect('/patient/profile'); 
        }

        // 2. Get Counts for the Stats Area
        const totalOrders = await Order.countDocuments({ 
            patientId: patient._id 
        });

        const pendingOrders = await Order.countDocuments({ 
            patientId: patient._id, 
            status: { $in: ['pending', 'scheduled', 'processing', 'sample_collected'] } 
        });

        const resultsReady = await Order.countDocuments({ 
            patientId: patient._id, 
            status: 'completed' 
        });

        // 3. Get Recent Orders (Limit to 5 for the dashboard table)
        const recentOrders = await Order.find({ patientId: patient._id })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('tests.testId'); // Populate to get test names if needed

        // 4. Affiliate Earnings (Placeholder for now)
        const affiliateEarnings = 0;

        // 5. Render
        res.render('patient/dashboard', {
            title: 'My Dashboard',
            success: req.session.success, // Pass flash messages
            error: req.session.error,     // Pass flash messages
            patient,
            totalOrders,
            pendingOrders,
            resultsReady, 
            affiliateEarnings,
            recentOrders 
        });
        
        // Clear flash messages after rendering
        delete req.session.success;
        delete req.session.error;

    } catch (err) {
        console.error('Patient dashboard error:', err);
        res.status(500).render('error', { 
            message: 'Unable to load dashboard',
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }
});

// ==========================================
// BROWSE TESTS
// ==========================================
router.get('/tests', async (req, res) => {
    try {
        const tests = await Test.find({ isActive: true });
        let patient = await Patient.findOne({ userId: req.session.user._id });
        
        if (!patient) {
            req.session.error = "Please complete your profile details before ordering tests.";
            return res.redirect('/patient/profile');
        }

        res.render('patient/tests', {
            title: 'Browse Tests',
            tests,
            patient
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading tests',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// ==========================================
// MY ORDERS
// ==========================================
router.get('/orders', async (req, res) => {
    try {
        let patient = await Patient.findOne({ userId: req.session.user._id });
        
        if (!patient) {
            req.session.error = "Please complete your profile details to view orders.";
            return res.redirect('/patient/profile');
        }

        const orders = await Order.find({ patientId: patient._id })
            .sort({ createdAt: -1 });
        
        res.render('patient/orders', {
            title: 'My Orders',
            orders,
            patient
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading orders',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// ==========================================
// ORDER DETAILS
// ==========================================
router.get('/orders/:id', async (req, res) => {
    try {
        let patient = await Patient.findOne({ userId: req.session.user._id });
        
        if (!patient) {
            req.session.error = "Please complete your profile details to view order details.";
            return res.redirect('/patient/profile');
        }

        const order = await Order.findOne({ 
            _id: req.params.id,
            patientId: patient._id 
        });
        
        if (!order) {
            return res.status(404).render('404', { 
                title: 'Order Not Found'
            });
        }
        
        res.render('patient/order-details', {
            title: 'Order Details',
            order,
            patient
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading order details',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// ==========================================
// TEST RESULTS
// ==========================================
router.get('/results', async (req, res) => {
    try {
        let patient = await Patient.findOne({ userId: req.session.user._id });
        
        if (!patient) {
            req.session.error = "Please complete your profile details to view results.";
            return res.redirect('/patient/profile');
        }

        const orders = await Order.find({ 
            patientId: patient._id,
            status: 'completed'
        }).sort({ createdAt: -1 });
        
        res.render('patient/results', {
            title: 'Test Results',
            orders,
            patient
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading results',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// ==========================================
// SCHEDULE
// ==========================================
router.get('/schedule', async (req, res) => {
    try {
        let patient = await Patient.findOne({ userId: req.session.user._id });
        
        if (!patient) {
            req.session.error = "Please complete your profile details to schedule a test.";
            return res.redirect('/patient/profile');
        }

        const tests = await Test.find({ isActive: true });
        
        res.render('patient/schedule', {
            title: 'Schedule Test',
            patient,
            tests
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading schedule page',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// ==========================================
// CART (assuming this page needs patient data for order context)
// ==========================================
router.get('/cart', async (req, res) => {
    let patient = await Patient.findOne({ userId: req.session.user._id });
    
    if (!patient) {
        req.session.error = "Please complete your profile details before proceeding to the cart.";
        return res.redirect('/patient/profile');
    }

    res.render('patient/cart', {
        title: 'Shopping Cart',
        patient
    });
});

// ==========================================
// PROFILE GET (This page is the destination for redirects)
// ==========================================
router.get('/profile', async (req, res) => {
    try {
        // Fetch patient data; it might be null if they hit this page via redirect
        const patient = await Patient.findOne({ userId: req.session.user._id });
        
        res.render('patient/profile', {
            title: 'My Profile',
            success: req.session.success,
            error: req.session.error,
            patient, // Can be null or an object
        });
        
        delete req.session.success;
        delete req.session.error;

    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading profile',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// ==========================================
// PROFILE POST
// ==========================================
router.post('/profile', async (req, res) => {
    try {
        const { firstName, lastName, phone, addressStreet, addressCity, addressState, addressZip } = req.body;
        
        // Find the linked user to ensure their data is correct, though Patient model should have the necessary fields
        // await User.findOneAndUpdate({ _id: req.session.user._id }, { phone });

        // The key part: using upsert: true ensures a Patient profile is CREATED if it doesn't exist.
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
            { new: true, upsert: true } // Create if doesn't exist
        );
        
        req.session.success = 'Profile updated successfully!';
        
        // If they just created their profile for the first time, redirect them to the dashboard
        if (req.session.redirectAfterProfile) {
            delete req.session.redirectAfterProfile;
            return res.redirect('/patient/dashboard');
        }

        res.redirect('/patient/profile');
    } catch (error) {
        console.error('Profile update error:', error);
        req.session.error = 'Error updating profile. Please try again.';
        res.redirect('/patient/profile');
    }
});

module.exports = router;