// routes/admin.js (COMPLETED)
const express = require('express');
const router = express.Router();
const Test = require('../models/Test');

// Middleware to ensure the user is logged in AND is an admin
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.session.error = 'Admin access required';
    return res.redirect('/auth/login');
  }
  next();
};

router.use(requireAdmin);

// --- Admin Dashboard Route ---
router.get('/dashboard', (req, res) => {
    res.render('admin/dashboard', { 
        title: 'Admin Dashboard – WhiteCoat' 
    });
});

// --- Test Management Routes ---

// GET: List All Tests
router.get('/tests', async (req, res) => {
    try {
        const tests = await Test.find({}).sort({ createdAt: -1 });
        res.render('admin/tests', {
            title: 'Manage Tests – WhiteCoat',
            tests
        });
    } catch (err) {
        console.error('List tests error:', err);
        req.session.error = 'Failed to load tests.';
        res.redirect('/admin/dashboard');
    }
});

// GET: Add Test Page
router.get('/tests/add', (req, res) => {
    res.render('admin/add-test', {
        title: 'Add New Test/Package – WhiteCoat',
        categories: Test.schema.path('category').enumValues,
        testData: {} // Empty object for initial form load
    });
});

// POST: Save New Test
router.post('/tests/add', async (req, res) => {
    try {
        const {
            name, description, price, category, requirements, turnaroundTime, imageUrl, isPackage, itemsJson
        } = req.body;

        // Basic validation (can be expanded)
        if (!name || !price || !category) {
            req.session.error = 'Name, price, and category are required.';
            return res.redirect('/admin/tests/add');
        }

        let itemsArray = [];
        if (isPackage === 'on' && itemsJson) {
            try {
                // itemsJson is expected to be a stringified array of { test: 'ID', quantity: 1 }
                itemsArray = JSON.parse(itemsJson); 
            } catch (parseError) {
                console.error('JSON parsing error for items:', parseError);
                req.session.error = 'Invalid JSON format for package items.';
                return res.redirect('/admin/tests/add');
            }
        }

        const test = new Test({
            name,
            description,
            price: parseFloat(price),
            category,
            isPackage: isPackage === 'on',
            items: itemsArray,
            requirements,
            turnaroundTime,
            imageUrl,
            isActive: true
        });

        await test.save();

        req.session.success = 'Test/Package added successfully!';
        res.redirect('/admin/tests');

    } catch (err) {
        console.error('Add test error:', err);
        // Mongoose validation or cast error handling
        req.session.error = err.name === 'ValidationError' 
                            ? 'Validation failed: Check all required fields.'
                            : 'Failed to add test. Please try again.';
        res.redirect('/admin/tests/add');
    }
});

// GET: Edit Test Page
router.get('/tests/edit/:id', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) {
            req.session.error = 'Test not found.';
            return res.redirect('/admin/tests');
        }

        // Fetch all tests for populating the 'items' dropdown if it's a package
        const allTests = await Test.find({ isPackage: false, _id: { $ne: test._id } });

        res.render('admin/edit-test', {
            title: `Edit ${test.name}`,
            testData: test,
            categories: Test.schema.path('category').enumValues,
            allTests
        });
    } catch (err) {
        console.error('Edit test page error:', err);
        req.session.error = 'Failed to load test for editing.';
        res.redirect('/admin/tests');
    }
});

// POST: Update Test
router.post('/tests/edit/:id', async (req, res) => {
    try {
        const {
            name, description, price, category, requirements, turnaroundTime, imageUrl, isPackage, isActive, itemsJson
        } = req.body;

        let itemsArray = [];
        if (isPackage === 'on' && itemsJson) {
            try {
                itemsArray = JSON.parse(itemsJson); 
            } catch (parseError) {
                console.error('JSON parsing error for items:', parseError);
                req.session.error = 'Invalid JSON format for package items.';
                return res.redirect(`/admin/tests/edit/${req.params.id}`);
            }
        }
        
        const updateData = {
            name,
            description,
            price: parseFloat(price),
            category,
            requirements,
            turnaroundTime,
            imageUrl,
            isPackage: isPackage === 'on',
            items: isPackage === 'on' ? itemsArray : [],
            isActive: isActive === 'on', // Checkbox value logic
            updatedAt: Date.now()
        };

        await Test.findByIdAndUpdate(req.params.id, updateData);

        req.session.success = 'Test/Package updated successfully!';
        res.redirect('/admin/tests');
    } catch (err) {
        console.error('Update test error:', err);
        req.session.error = 'Failed to update test. Please try again.';
        res.redirect(`/admin/tests/edit/${req.params.id}`);
    }
});

// POST: Delete Test (soft delete by setting isActive to false)
router.post('/tests/delete/:id', async (req, res) => {
    try {
        await Test.findByIdAndUpdate(req.params.id, { isActive: false, updatedAt: Date.now() });
        req.session.success = 'Test deactivated successfully.';
        res.redirect('/admin/tests');
    } catch (err) {
        console.error('Delete test error:', err);
        req.session.error = 'Failed to deactivate test.';
        res.redirect('/admin/tests');
    }
});


module.exports = router;