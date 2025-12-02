// controllers/adminController.js - COMPLETE VERSION WITH PHLEBOTOMIST MANAGEMENT
const Test = require('../models/Test');
const Phlebotomist = require('../models/Phlebotomist');
const bcrypt = require('bcryptjs');

// Helper functions
const getDashboardData = () => ({
    totalPatients: 150,
    activeAppointments: 75,
    pendingResults: 25,
    totalRevenue: 125000,
    recentActivity: [
        { id: 1, type: 'New Patient', description: 'John Doe registered' },
        { id: 2, type: 'Test Ordered', description: 'Complete Blood Count ordered for Sarah Johnson' }
    ],
    adminName: 'Dr. Evelyn Reed'
});

const getRequestsData = () => ({
    pendingRequests: [
        { id: 1, patient: 'John Smith', type: 'Test Appointment', test: 'Lipid Profile', date: '2023-11-15', status: 'pending' },
        { id: 2, patient: 'Emma Wilson', type: 'Home Sample Collection', test: 'Blood Glucose', date: '2023-11-14', status: 'pending' },
        { id: 3, patient: 'Robert Brown', type: 'Report Delivery', test: 'Thyroid Panel', date: '2023-11-13', status: 'pending' }
    ],
    approvedRequests: [
        { id: 4, patient: 'Sarah Johnson', type: 'Test Appointment', test: 'Complete Blood Count', date: '2023-11-10', status: 'approved' }
    ],
    rejectedRequests: [
        { id: 5, patient: 'Michael Davis', type: 'Home Sample Collection', test: 'Liver Function Test', date: '2023-11-08', status: 'rejected' }
    ]
});

// Helper to get messages from query
const getMessages = (req) => ({
    success: req.query.success || null,
    error: req.query.error || null,
    warning: req.query.warning || null,
    info: req.query.info || null
});

// Helper to redirect with message
const redirectWithMessage = (res, path, type, message) => {
    return res.redirect(`${path}?${type}=${encodeURIComponent(message)}`);
};

/**
 * Renders the main admin dashboard view.
 */
exports.renderDashboard = async (req, res) => {
    try {
        const messages = getMessages(req);
        const dashboardData = getDashboardData();
        const totalTests = await Test.countDocuments({ isActive: true });
        const testCategories = await Test.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);
        
        // Get phlebotomist stats
        const pendingPhlebsCount = await Phlebotomist.countDocuments({ status: 'pending_review' });
        const approvedPhlebsCount = await Phlebotomist.countDocuments({ status: 'approved', isActive: true });
        const totalPhlebsCount = await Phlebotomist.countDocuments();
        const suspendedPhlebsCount = await Phlebotomist.countDocuments({ status: 'suspended' });
        
        res.render('admin/dashboard', { 
            pageTitle: 'Admin Dashboard',
            data: dashboardData,
            totalTests,
            testCategories,
            pendingPhlebsCount,
            approvedPhlebsCount,
            totalPhlebsCount,
            suspendedPhlebsCount,
            success_msg: messages.success,
            error_msg: messages.error,
            warning_msg: messages.warning,
            info_msg: messages.info,
            user: req.user || null
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Server Error: Could not load dashboard.');
    }
};

/**
 * Renders the phlebotomist management page.
 */
exports.renderPhlebotomists = async (req, res) => {
    try {
        const messages = getMessages(req);
        const statusFilter = req.query.status || 'all';
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        let query = {};
        if (statusFilter !== 'all') {
            query.status = statusFilter;
        }
        
        // Get counts for each status
        const pendingCount = await Phlebotomist.countDocuments({ status: 'pending_review' });
        const approvedCount = await Phlebotomist.countDocuments({ status: 'approved', isActive: true });
        const rejectedCount = await Phlebotomist.countDocuments({ status: 'rejected' });
        const suspendedCount = await Phlebotomist.countDocuments({ status: 'suspended' });
        const totalCount = await Phlebotomist.countDocuments();
        
        // Get filtered phlebotomists
        const phlebotomists = await Phlebotomist.find(query)
            .sort({ appliedAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('firstName lastName email phone gender address status appliedAt isActive');
        
        const totalPages = Math.ceil(totalCount / limit);
        
        res.render('admin/phlebotomist-management', {
            pageTitle: 'Phlebotomist Management',
            phlebotomists,
            currentStatus: statusFilter,
            currentPage: page,
            totalPages,
            pendingCount,
            approvedCount,
            rejectedCount,
            suspendedCount,
            totalCount,
            success_msg: messages.success,
            error_msg: messages.error,
            warning_msg: messages.warning,
            info_msg: messages.info,
            user: req.user || null
        });
        
    } catch (error) {
        console.error('Render phlebotomists error:', error);
        redirectWithMessage(res, '/admin/dashboard', 'error', 'Could not load phlebotomist management page.');
    }
};

/**
 * Renders a single phlebotomist application view.
 */
exports.renderViewPhlebotomist = async (req, res) => {
    try {
        const messages = getMessages(req);
        const { id } = req.params;
        
        const phlebotomist = await Phlebotomist.findById(id);
        if (!phlebotomist) {
            return redirectWithMessage(res, '/admin/phlebotomists', 'error', 'Phlebotomist not found.');
        }
        
        res.render('admin/view-phlebotomist', {
            pageTitle: `Application: ${phlebotomist.firstName} ${phlebotomist.lastName}`,
            phlebotomist,
            success_msg: messages.success,
            error_msg: messages.error,
            warning_msg: messages.warning,
            info_msg: messages.info,
            user: req.user || null
        });
        
    } catch (error) {
        console.error('Render view phlebotomist error:', error);
        redirectWithMessage(res, '/admin/phlebotomists', 'error', 'Could not load phlebotomist details.');
    }
};

/**
 * Approves a phlebotomist application.
 */
exports.approvePhlebotomist = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        
        if (!password) {
            return redirectWithMessage(res, `/admin/phlebotomists/view/${id}`, 'error', 'Password is required for approval.');
        }
        
        const phlebotomist = await Phlebotomist.findById(id);
        if (!phlebotomist) {
            return redirectWithMessage(res, '/admin/phlebotomists', 'error', 'Phlebotomist not found.');
        }
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Update phlebotomist
        phlebotomist.status = 'approved';
        phlebotomist.password = hashedPassword;
        phlebotomist.isActive = true;
        phlebotomist.approvedAt = new Date();
        
        await phlebotomist.save();
        
        // In production, you would send an email with credentials here
        console.log(`Phlebotomist ${phlebotomist.email} approved with password: ${password}`);
        
        redirectWithMessage(res, '/admin/phlebotomists', 'success', `Phlebotomist ${phlebotomist.firstName} ${phlebotomist.lastName} approved successfully!`);
        
    } catch (error) {
        console.error('Approve phlebotomist error:', error);
        redirectWithMessage(res, `/admin/phlebotomists/view/${req.params.id}`, 'error', `Failed to approve phlebotomist: ${error.message}`);
    }
};

/**
 * Rejects a phlebotomist application.
 */
exports.rejectPhlebotomist = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        const phlebotomist = await Phlebotomist.findById(id);
        if (!phlebotomist) {
            return redirectWithMessage(res, '/admin/phlebotomists', 'error', 'Phlebotomist not found.');
        }
        
        phlebotomist.status = 'rejected';
        await phlebotomist.save();
        
        const message = reason 
            ? `Application rejected: ${reason}`
            : 'Application rejected successfully!';
        
        redirectWithMessage(res, '/admin/phlebotomists', 'success', message);
        
    } catch (error) {
        console.error('Reject phlebotomist error:', error);
        redirectWithMessage(res, `/admin/phlebotomists/view/${req.params.id}`, 'error', `Failed to reject phlebotomist: ${error.message}`);
    }
};

/**
 * Suspends a phlebotomist.
 */
exports.suspendPhlebotomist = async (req, res) => {
    try {
        const { id } = req.params;
        
        const phlebotomist = await Phlebotomist.findById(id);
        if (!phlebotomist) {
            return redirectWithMessage(res, '/admin/phlebotomists', 'error', 'Phlebotomist not found.');
        }
        
        phlebotomist.status = 'suspended';
        phlebotomist.isActive = false;
        await phlebotomist.save();
        
        redirectWithMessage(res, '/admin/phlebotomists', 'success', `Phlebotomist ${phlebotomist.firstName} ${phlebotomist.lastName} suspended successfully.`);
        
    } catch (error) {
        console.error('Suspend phlebotomist error:', error);
        redirectWithMessage(res, '/admin/phlebotomists', 'error', `Failed to suspend phlebotomist: ${error.message}`);
    }
};

/**
 * Reactivates a suspended phlebotomist.
 */
exports.reactivatePhlebotomist = async (req, res) => {
    try {
        const { id } = req.params;
        
        const phlebotomist = await Phlebotomist.findById(id);
        if (!phlebotomist) {
            return redirectWithMessage(res, '/admin/phlebotomists', 'error', 'Phlebotomist not found.');
        }
        
        phlebotomist.status = 'approved';
        phlebotomist.isActive = true;
        await phlebotomist.save();
        
        redirectWithMessage(res, '/admin/phlebotomists', 'success', `Phlebotomist ${phlebotomist.firstName} ${phlebotomist.lastName} reactivated successfully.`);
        
    } catch (error) {
        console.error('Reactivate phlebotomist error:', error);
        redirectWithMessage(res, '/admin/phlebotomists', 'error', `Failed to reactivate phlebotomist: ${error.message}`);
    }
};

/**
 * Deletes a phlebotomist.
 */
exports.deletePhlebotomist = async (req, res) => {
    try {
        const { id } = req.params;
        
        const phlebotomist = await Phlebotomist.findById(id);
        if (!phlebotomist) {
            return redirectWithMessage(res, '/admin/phlebotomists', 'error', 'Phlebotomist not found.');
        }
        
        await Phlebotomist.findByIdAndDelete(id);
        
        redirectWithMessage(res, '/admin/phlebotomists', 'success', `Phlebotomist ${phlebotomist.firstName} ${phlebotomist.lastName} deleted successfully.`);
        
    } catch (error) {
        console.error('Delete phlebotomist error:', error);
        redirectWithMessage(res, '/admin/phlebotomists', 'error', `Failed to delete phlebotomist: ${error.message}`);
    }
};

// ========== EXISTING TEST MANAGEMENT FUNCTIONS (Keep all as is) ==========

/**
 * Renders the add new test page.
 */
exports.renderAddTest = async (req, res) => {
    try {
        const messages = getMessages(req);
        const allTests = await Test.find({ isActive: true }).select('name price category');
        
        const categories = [
            { id: 'blood', name: 'Blood Tests' },
            { id: 'urine', name: 'Urine Tests' },
            { id: 'panel', name: 'Test Panels' },
            { id: 'hormone', name: 'Hormone Tests' },
            { id: 'std', name: 'STD Tests' },
            { id: 'other', name: 'Other Tests' }
        ];
        
        res.render('admin/add-test', { 
            pageTitle: 'Add New Medical Test',
            categories,
            allTests,
            success_msg: messages.success,
            error_msg: messages.error,
            warning_msg: messages.warning,
            info_msg: messages.info,
            user: req.user || null
        });
    } catch (error) {
        console.error('Add test page error:', error);
        redirectWithMessage(res, '/admin/dashboard', 'error', 'Could not load add test page');
    }
};

/**
 * Handles the submission of a new test form.
 */
exports.addNewTest = async (req, res) => {
    try {
        const { 
            name, 
            description, 
            price, 
            category, 
            isPackage,
            requirements,
            turnaroundTime,
            isActive 
        } = req.body;
        
        // Validate required fields
        if (!name || !description || !price || !category) {
            return redirectWithMessage(res, '/admin/add-test', 'error', 'Please fill in all required fields.');
        }
        
        // Validate price
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) {
            return redirectWithMessage(res, '/admin/add-test', 'error', 'Price must be a valid positive number.');
        }
        
        // Handle items for package tests
        let items = [];
        if (isPackage === 'true') {
            const itemNames = req.body.itemName || [];
            const itemQuantities = req.body.itemQuantity || [];
            
            items = itemNames.map((name, index) => ({
                test: name,
                quantity: parseInt(itemQuantities[index]) || 1
            }));
        }
        
        // Create new test
        const newTest = new Test({
            name,
            description,
            price: priceNum,
            category,
            isPackage: isPackage === 'true',
            items: items.length > 0 ? items : [],
            requirements: requirements || '',
            turnaroundTime: turnaroundTime || '24-48 hours',
            isActive: isActive === 'true',
            imageUrl: req.body.imageUrl || ''
        });
        
        await newTest.save();
        
        redirectWithMessage(res, '/admin/add-test', 'success', 'Medical test added successfully!');
        
    } catch (error) {
        console.error('Add test error:', error);
        redirectWithMessage(res, '/admin/add-test', 'error', `Failed to add test: ${error.message}`);
    }
};

/**
 * Renders the create new admin user page.
 */
exports.renderCreateAdmin = (req, res) => {
    try {
        const messages = getMessages(req);
        
        const adminRoles = [
            { id: 'lab_director', name: 'Lab Director' },
            { id: 'pathologist', name: 'Pathologist' },
            { id: 'lab_technician', name: 'Lab Technician' },
            { id: 'receptionist', name: 'Receptionist' },
            { id: 'admin', name: 'Administrator' },
            { id: 'viewer', name: 'Viewer' }
        ];
        
        const departments = [
            { id: 'pathology', name: 'Pathology' },
            { id: 'microbiology', name: 'Microbiology' },
            { id: 'biochemistry', name: 'Biochemistry' },
            { id: 'hematology', name: 'Hematology' },
            { id: 'immunology', name: 'Immunology' },
            { id: 'administration', name: 'Administration' }
        ];
        
        res.render('admin/create-admin', { 
            pageTitle: 'Create New Lab Staff',
            adminRoles,
            departments,
            success_msg: messages.success,
            error_msg: messages.error,
            warning_msg: messages.warning,
            info_msg: messages.info,
            user: req.user || null
        });
        
    } catch (error) {
        console.error('Create admin page error:', error);
        redirectWithMessage(res, '/admin/dashboard', 'error', 'Could not load create admin page');
    }
};

/**
 * Handles the creation of a new admin user.
 */
exports.createNewAdmin = (req, res) => {
    try {
        const { 
            firstName, 
            lastName, 
            email, 
            username, 
            password, 
            confirmPassword,
            role, 
            department,
            phone,
            permissions
        } = req.body;
        
        // Validate required fields
        if (!firstName || !lastName || !email || !username || !password || !confirmPassword || !role) {
            return redirectWithMessage(res, '/admin/create-admin', 'error', 'Please fill in all required fields.');
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return redirectWithMessage(res, '/admin/create-admin', 'error', 'Please enter a valid email address.');
        }
        
        // Validate passwords match
        if (password !== confirmPassword) {
            return redirectWithMessage(res, '/admin/create-admin', 'error', 'Passwords do not match.');
        }
        
        // Validate password strength
        if (password.length < 8) {
            return redirectWithMessage(res, '/admin/create-admin', 'error', 'Password must be at least 8 characters long.');
        }
        
        // In production, you would:
        // 1. Hash the password
        // 2. Save to database
        // 3. Send welcome email
        
        console.log('New lab staff created:', {
            firstName,
            lastName,
            email,
            username,
            role,
            department,
            phone
        });
        
        redirectWithMessage(res, '/admin/create-admin', 'success', 'Lab staff account created successfully!');
        
    } catch (error) {
        console.error('Create admin error:', error);
        redirectWithMessage(res, '/admin/create-admin', 'error', `Failed to create staff account: ${error.message}`);
    }
};

/**
 * Renders the view requests page.
 */
exports.renderViewRequests = (req, res) => {
    try {
        const messages = getMessages(req);
        const requestsData = getRequestsData();
        
        res.render('admin/view-requests', { 
            pageTitle: 'View Patient Requests',
            data: requestsData,
            success_msg: messages.success,
            error_msg: messages.error,
            warning_msg: messages.warning,
            info_msg: messages.info,
            user: req.user || null
        });
        
    } catch (error) {
        console.error('View requests page error:', error);
        redirectWithMessage(res, '/admin/dashboard', 'error', 'Could not load requests page');
    }
};

/**
 * Handles request actions (approve/reject).
 */
exports.handleRequestAction = (req, res) => {
    try {
        const { requestId, action, notes } = req.body;
        
        if (!requestId || !action) {
            return redirectWithMessage(res, '/admin/view-requests', 'error', 'Invalid request data.');
        }
        
        if (!['approve', 'reject', 'pending'].includes(action)) {
            return redirectWithMessage(res, '/admin/view-requests', 'error', 'Invalid action.');
        }
        
        // In production, you would update the request in database
        console.log(`Request ${requestId} ${action}ed`, notes ? `with notes: ${notes}` : '');
        
        redirectWithMessage(res, '/admin/view-requests', 'success', `Request ${action}ed successfully!`);
        
    } catch (error) {
        console.error('Handle request error:', error);
        redirectWithMessage(res, '/admin/view-requests', 'error', `Failed to process request: ${error.message}`);
    }
};

/**
 * Renders the manage tests page.
 */
exports.renderManageTests = async (req, res) => {
    try {
        const messages = getMessages(req);
        
        // Fetch all tests from database
        const tests = await Test.find().sort({ createdAt: -1 });
        
        res.render('admin/manage-tests', { 
            pageTitle: 'Manage Medical Tests',
            tests,
            success_msg: messages.success,
            error_msg: messages.error,
            warning_msg: messages.warning,
            info_msg: messages.info,
            user: req.user || null
        });
        
    } catch (error) {
        console.error('Manage tests page error:', error);
        redirectWithMessage(res, '/admin/dashboard', 'error', 'Could not load manage tests page');
    }
};

/**
 * Handles updating a test.
 */
exports.updateTest = async (req, res) => {
    try {
        const { testId } = req.params;
        const updateData = req.body;
        
        if (!testId) {
            return redirectWithMessage(res, '/admin/manage-tests', 'error', 'Invalid test ID.');
        }
        
        // Check if test exists
        const testExists = await Test.findById(testId);
        if (!testExists) {
            return redirectWithMessage(res, '/admin/manage-tests', 'error', 'Test not found.');
        }
        
        // Handle price conversion
        if (updateData.price) {
            const priceNum = parseFloat(updateData.price);
            if (isNaN(priceNum) || priceNum < 0) {
                return redirectWithMessage(res, `/admin/edit-test/${testId}`, 'error', 'Price must be a valid positive number.');
            }
            updateData.price = priceNum;
        }
        
        // Handle boolean values
        if (updateData.isPackage !== undefined) {
            updateData.isPackage = updateData.isPackage === 'true';
        }
        if (updateData.isActive !== undefined) {
            updateData.isActive = updateData.isActive === 'true';
        }
        
        // Handle package items if it's a package
        if (updateData.isPackage === true) {
            const itemNames = req.body.itemName || [];
            const itemQuantities = req.body.itemQuantity || [];
            
            updateData.items = itemNames.map((name, index) => ({
                test: name,
                quantity: parseInt(itemQuantities[index]) || 1
            }));
        } else {
            updateData.items = [];
        }
        
        await Test.findByIdAndUpdate(testId, updateData, { new: true });
        
        redirectWithMessage(res, '/admin/manage-tests', 'success', 'Test updated successfully!');
        
    } catch (error) {
        console.error('Update test error:', error);
        redirectWithMessage(res, '/admin/manage-tests', 'error', `Failed to update test: ${error.message}`);
    }
};

/**
 * Handles deleting a test.
 */
exports.deleteTest = async (req, res) => {
    try {
        const { testId } = req.params;
        
        if (!testId) {
            return redirectWithMessage(res, '/admin/manage-tests', 'error', 'Invalid test ID.');
        }
        
        // Check if test exists
        const testExists = await Test.findById(testId);
        if (!testExists) {
            return redirectWithMessage(res, '/admin/manage-tests', 'error', 'Test not found.');
        }
        
        await Test.findByIdAndDelete(testId);
        
        redirectWithMessage(res, '/admin/manage-tests', 'success', 'Test deleted successfully!');
        
    } catch (error) {
        console.error('Delete test error:', error);
        redirectWithMessage(res, '/admin/manage-tests', 'error', `Failed to delete test: ${error.message}`);
    }
};

/**
 * Renders the view tests page.
 */
exports.renderViewTests = async (req, res) => {
    try {
        const messages = getMessages(req);
        
        // Fetch all active tests from database
        const tests = await Test.find({ isActive: true }).sort({ name: 1 });
        
        // Group tests by category for better organization
        const testsByCategory = {};
        tests.forEach(test => {
            if (!testsByCategory[test.category]) {
                testsByCategory[test.category] = [];
            }
            testsByCategory[test.category].push(test);
        });
        
        // Get category names for display
        const categoryNames = {
            blood: 'Blood Tests',
            urine: 'Urine Tests',
            panel: 'Test Panels',
            hormone: 'Hormone Tests',
            std: 'STD Tests',
            other: 'Other Tests'
        };
        
        res.render('admin/view-tests', { 
            pageTitle: 'View Medical Tests',
            tests,
            testsByCategory,
            categoryNames,
            success_msg: messages.success,
            error_msg: messages.error,
            warning_msg: messages.warning,
            info_msg: messages.info,
            user: req.user || null
        });
        
    } catch (error) {
        console.error('View tests page error:', error);
        redirectWithMessage(res, '/admin/dashboard', 'error', 'Could not load view tests page');
    }
};

/**
 * Renders the edit test page.
 */
exports.renderEditTest = async (req, res) => {
    try {
        const messages = getMessages(req);
        const { testId } = req.params;
        
        if (!testId) {
            return redirectWithMessage(res, '/admin/manage-tests', 'error', 'Invalid test ID.');
        }
        
        const test = await Test.findById(testId);
        if (!test) {
            return redirectWithMessage(res, '/admin/manage-tests', 'error', 'Test not found.');
        }
        
        // Fetch all active tests for package items selection
        const allTests = await Test.find({ isActive: true }).select('name price category');
        
        const categories = [
            { id: 'blood', name: 'Blood Tests' },
            { id: 'urine', name: 'Urine Tests' },
            { id: 'panel', name: 'Test Panels' },
            { id: 'hormone', name: 'Hormone Tests' },
            { id: 'std', name: 'STD Tests' },
            { id: 'other', name: 'Other Tests' }
        ];
        
        res.render('admin/edit-test', { 
            pageTitle: 'Edit Medical Test',
            test,
            categories,
            allTests,
            success_msg: messages.success,
            error_msg: messages.error,
            warning_msg: messages.warning,
            info_msg: messages.info,
            user: req.user || null
        });
        
    } catch (error) {
        console.error('Edit test page error:', error);
        redirectWithMessage(res, '/admin/manage-tests', 'error', 'Could not load test for editing.');
    }
};

/**
 * Toggles test active status.
 */
exports.toggleTestStatus = async (req, res) => {
    try {
        const { testId } = req.params;
        
        if (!testId) {
            return redirectWithMessage(res, '/admin/manage-tests', 'error', 'Invalid test ID.');
        }
        
        const test = await Test.findById(testId);
        if (!test) {
            return redirectWithMessage(res, '/admin/manage-tests', 'error', 'Test not found.');
        }
        
        test.isActive = !test.isActive;
        await test.save();
        
        const statusMessage = test.isActive ? 'activated' : 'deactivated';
        redirectWithMessage(res, '/admin/manage-tests', 'success', `Test ${statusMessage} successfully!`);
        
    } catch (error) {
        console.error('Toggle test status error:', error);
        redirectWithMessage(res, '/admin/manage-tests', 'error', `Failed to toggle test status: ${error.message}`);
    }
};

/**
 * Renders test statistics page.
 */
exports.renderTestStats = async (req, res) => {
    try {
        const messages = getMessages(req);
        
        // Get test statistics
        const totalTests = await Test.countDocuments();
        const activeTests = await Test.countDocuments({ isActive: true });
        const inactiveTests = await Test.countDocuments({ isActive: false });
        const packageTests = await Test.countDocuments({ isPackage: true });
        
        // Get tests by category
        const testsByCategory = await Test.aggregate([
            { 
                $group: { 
                    _id: '$category', 
                    count: { $sum: 1 },
                    totalPrice: { $sum: '$price' },
                    avgPrice: { $avg: '$price' }
                } 
            },
            { $sort: { count: -1 } }
        ]);
        
        // Get recent tests
        const recentTests = await Test.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('name category price isActive createdAt');
        
        res.render('admin/test-stats', { 
            pageTitle: 'Test Statistics',
            totalTests,
            activeTests,
            inactiveTests,
            packageTests,
            testsByCategory,
            recentTests,
            success_msg: messages.success,
            error_msg: messages.error,
            warning_msg: messages.warning,
            info_msg: messages.info,
            user: req.user || null
        });
        
    } catch (error) {
        console.error('Test stats page error:', error);
        redirectWithMessage(res, '/admin/dashboard', 'error', 'Could not load test statistics');
    }
};

/**
 * Handles bulk test actions.
 */
exports.bulkTestActions = async (req, res) => {
    try {
        const { action, testIds } = req.body;
        
        if (!action || !testIds || !Array.isArray(testIds) || testIds.length === 0) {
            return redirectWithMessage(res, '/admin/manage-tests', 'error', 'Please select tests and an action.');
        }
        
        let updateResult;
        let message;
        
        switch(action) {
            case 'activate':
                updateResult = await Test.updateMany(
                    { _id: { $in: testIds } },
                    { $set: { isActive: true } }
                );
                message = `${updateResult.modifiedCount} test(s) activated successfully!`;
                break;
                
            case 'deactivate':
                updateResult = await Test.updateMany(
                    { _id: { $in: testIds } },
                    { $set: { isActive: false } }
                );
                message = `${updateResult.modifiedCount} test(s) deactivated successfully!`;
                break;
                
            case 'delete':
                const deleteResult = await Test.deleteMany({ _id: { $in: testIds } });
                message = `${deleteResult.deletedCount} test(s) deleted successfully!`;
                break;
                
            default:
                return redirectWithMessage(res, '/admin/manage-tests', 'error', 'Invalid action selected.');
        }
        
        redirectWithMessage(res, '/admin/manage-tests', 'success', message);
        
    } catch (error) {
        console.error('Bulk test actions error:', error);
        redirectWithMessage(res, '/admin/manage-tests', 'error', `Failed to perform bulk action: ${error.message}`);
    }
};