// routes/servicesRoutes.js
const express = require('express');
const router = express.Router();
const servicesController = require('../controllers/servicesController.js');

// Services pages
router.get('/tests', servicesController.renderServices);
router.get('/test/:testId', servicesController.renderTestDetails);

module.exports = router;