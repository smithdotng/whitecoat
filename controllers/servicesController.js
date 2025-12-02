// controllers/servicesController.js - COMPLETE FIXED VERSION
const Test = require('../models/Test');

/**
 * Renders the services/tests page.
 */
exports.renderServices = async (req, res) => {
    try {
        console.log('Starting renderServices function...');
        
        // Fetch all active tests from database
        let tests = [];
        try {
            tests = await Test.find({ isActive: true }).sort({ name: 1 });
            console.log(`Found ${tests.length} tests in database`);
        } catch (dbError) {
            console.error('Database error:', dbError);
            tests = [];
        }
        
        // Group tests by category
        const testsByCategory = {};
        const categoryCounts = {};
        
        tests.forEach(test => {
            const category = test.category || 'other';
            if (!testsByCategory[category]) {
                testsByCategory[category] = [];
            }
            testsByCategory[category].push(test);
            
            // Count tests per category
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });
        
        // Category display names
        const categoryNames = {
            blood: 'Blood Tests',
            urine: 'Urine Tests',
            panel: 'Test Panels',
            hormone: 'Hormone Tests',
            std: 'STD Tests',
            other: 'Other Tests'
        };
        
        // Get category descriptions
        const categoryDescriptions = {
            blood: 'Comprehensive blood tests to assess overall health, detect diseases, and monitor treatment effectiveness.',
            urine: 'Urine analysis tests to evaluate kidney function, detect infections, and screen for metabolic disorders.',
            panel: 'Bundled test packages offering comprehensive health assessments at discounted rates.',
            hormone: 'Hormone level tests to evaluate endocrine system function and diagnose hormonal imbalances.',
            std: 'Discreet and confidential tests for sexually transmitted diseases and infections.',
            other: 'Specialized tests including genetic screening, allergy testing, and specialized diagnostics.'
        };
        
        // Calculate statistics
        const totalTests = tests.length;
        const packageTests = tests.filter(test => test.isPackage).length;
        const individualTests = totalTests - packageTests;
        
        // Prepare ALL data to send
        const data = {
            pageTitle: 'Our Medical Tests & Services',
            tests: tests,
            testsByCategory: testsByCategory,
            categoryNames: categoryNames,
            categoryDescriptions: categoryDescriptions,
            categoryCounts: categoryCounts,
            totalTests: totalTests,
            packageTests: packageTests,
            individualTests: individualTests,
            user: req.user || null
        };
        
        console.log('Sending data to view. Keys:', Object.keys(data));
        console.log('totalTests value:', data.totalTests);
        
        // Render the view
        res.render('services/tests', data);
        
    } catch (error) {
        console.error('Critical error in renderServices:', error);
        
        // Send minimal data on error
        res.status(500).render('services/tests', {
            pageTitle: 'Error - Medical Tests',
            tests: [],
            testsByCategory: {},
            categoryNames: {},
            categoryDescriptions: {},
            categoryCounts: {},
            totalTests: 0,
            packageTests: 0,
            individualTests: 0,
            user: null,
            error: 'Unable to load tests at this time.'
        });
    }
};

/**
 * Renders a single test details page.
 */
exports.renderTestDetails = async (req, res) => {
    try {
        const { testId } = req.params;
        
        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).render('404', { 
                pageTitle: 'Test Not Found',
                user: req.user || null 
            });
        }
        
        // Fetch related tests
        const relatedTests = await Test.find({
            _id: { $ne: testId },
            category: test.category,
            isActive: true
        }).limit(4);
        
        // Category display name
        const categoryNames = {
            blood: 'Blood Tests',
            urine: 'Urine Tests',
            panel: 'Test Panels',
            hormone: 'Hormone Tests',
            std: 'STD Tests',
            other: 'Other Tests'
        };
        
        res.render('services/test-details', {
            pageTitle: test.name || 'Test Details',
            test: test,
            relatedTests: relatedTests || [],
            categoryName: categoryNames[test.category] || test.category || 'Uncategorized',
            user: req.user || null
        });
        
    } catch (error) {
        console.error('Error in renderTestDetails:', error);
        res.status(500).render('error', {
            pageTitle: 'Server Error',
            error: error.message,
            user: req.user || null
        });
    }
};