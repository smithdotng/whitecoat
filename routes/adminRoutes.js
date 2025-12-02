const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Admin Dashboard Routes
router.get('/dashboard', adminController.renderDashboard);

// Phlebotomist Management Routes
router.get('/phlebotomists', adminController.renderPhlebotomists);
router.get('/phlebotomists/view/:id', adminController.renderViewPhlebotomist);
router.post('/phlebotomists/approve/:id', adminController.approvePhlebotomist);
router.post('/phlebotomists/reject/:id', adminController.rejectPhlebotomist);
router.post('/phlebotomists/suspend/:id', adminController.suspendPhlebotomist);
router.post('/phlebotomists/reactivate/:id', adminController.reactivatePhlebotomist);
router.post('/phlebotomists/delete/:id', adminController.deletePhlebotomist);

// Test Management Routes
router.get('/add-test', adminController.renderAddTest);
router.post('/add-test', adminController.addNewTest);
router.get('/manage-tests', adminController.renderManageTests);
router.get('/view-tests', adminController.renderViewTests);
router.get('/edit-test/:testId', adminController.renderEditTest);
router.post('/update-test/:testId', adminController.updateTest);
router.post('/delete-test/:testId', adminController.deleteTest);
router.post('/toggle-test/:testId', adminController.toggleTestStatus);
router.get('/test-stats', adminController.renderTestStats);
router.post('/bulk-test-actions', adminController.bulkTestActions);

// Admin User Management Routes
router.get('/create-admin', adminController.renderCreateAdmin);
router.post('/create-admin', adminController.createNewAdmin);

// Request Management Routes
router.get('/view-requests', adminController.renderViewRequests);
router.post('/handle-request', adminController.handleRequestAction);

module.exports = router;