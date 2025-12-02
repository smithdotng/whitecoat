// routes/auth.js  ← FINAL VERSION (WORKS 100% NO 404)

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');


// ==================== MODELS ====================
const User = require('../models/User');

// Try to load Phlebotomist model — won't crash if missing
let Phlebotomist = null;
try {
    Phlebotomist = require('../models/Phlebotomist');
} catch (err) {
    console.warn('Warning: models/Phlebotomist.js not found. Phlebotomist registration disabled until created.');
}

const Patient = require('../models/Patient');

// ==================== MULTER: CV UPLOAD ====================
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'public/uploads/cv/');
        },
        filename: (req, file, cb) => {
            const uniqueName = `cv_${Date.now()}_${Math.round(Math.random() * 1E9)}.pdf`;
            cb(null, uniqueName);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files allowed'), false);
        }
    }
});

// ==================== HELPER: Smart Dashboard Redirect ====================
const getDashboardPath = (user) => {
    return user.userType === 'corporate' ? '/corporate/dashboard' : '/patient/dashboard';
};

// ==================== GET: Login ====================
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect(getDashboardPath(req.session.user));
    }

    res.render('auth/login', {
        title: 'Login to WhiteCoat',
        success: req.session.success || null,
        error: req.session.error || null
    });

    delete req.session.success;
    delete req.session.error;
});

// ==================== POST: Login ====================
// ==================== POST: Login ====================
router.post('/login', [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.session.error = errors.array()[0].msg;
        return res.redirect('/auth/login');
    }

    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user || !await user.comparePassword(password)) {
            req.session.error = 'Invalid email or password';
            return res.redirect('/auth/login');
        }

        if (!user.isActive) {
            req.session.error = 'Account deactivated. Contact support.';
            return res.redirect('/auth/login');
        }

        user.lastLogin = new Date();
        user.ipAddress = req.ip || req.connection.remoteAddress;
        await user.save();

        // **FIXED BLOCK START**
        req.session.user = {
            _id: user._id,
            email: user.email,
            role: user.role,
            userType: user.userType || 'individual'
        };
        // **FIXED BLOCK END**

        req.session.success = 'Welcome back!';
        res.redirect(getDashboardPath(user));

    } catch (err) {
        console.error('Login error:', err);
        req.session.error = 'Server error. Try again.';
        res.redirect('/auth/login');
    }
});

// ==================== GET: Register (Patient/Corporate) ====================
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect(getDashboardPath(req.session.user));
    }

    res.render('auth/register', {
        title: 'Create Account – WhiteCoat',
        success: req.session.success || null,
        error: req.session.error || null
    });

    delete req.session.success;
    delete req.session.error;
});

// ==================== POST: Register (Patient/Corporate) ====================
// ==================== POST: Register (Patient/Corporate) ====================
router.post('/register', [
    body('email').isEmail().normalizeEmail(),
    body('phone').isMobilePhone('any'),
    body('password').isLength({ min: 8 }),
    body('confirmPassword').custom((v, { req }) => v === req.body.password || 'Passwords do not match'),
    body('firstName').if(body('userType').equals('individual')).notEmpty().withMessage('First Name is required.'),
    body('lastName').if(body('userType').equals('individual')).notEmpty().withMessage('Last Name is required.'),
    body('dateOfBirth').if(body('userType').equals('individual')).isISO8601().withMessage('Date of Birth is required.'),
    body('residentialStreet').if(body('userType').equals('individual')).notEmpty().withMessage('Street address is required.'),
    body('companyName').if(body('userType').equals('corporate')).notEmpty().withMessage('Company Name is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.session.error = errors.array()[0].msg;
        return res.redirect('/auth/register');
    }

    const {
        email, password, phone, userType = 'individual',
        firstName, middleName, lastName, gender, dateOfBirth,
        residentialStreet, residentialCity, residentialState, residentialZip,
        companyName, companySector, companyStreet, companyCity, companyState, companyZip
    } = req.body;

    try {
        if (await User.findOne({ email: email.toLowerCase() })) {
            req.session.error = 'Email already registered';
            return res.redirect('/auth/register');
        }

        // 1. Create the User document
        const user = new User({
            email: email.toLowerCase(),
            password,
            phone,
            userType,
            role: 'patient',
            ...(userType === 'individual' && {
                firstName: firstName?.trim(),
                middleName: (middleName || '').trim(),
                lastName: lastName?.trim(),
                gender,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                residentialAddress: residentialStreet ? {
                    street: residentialStreet.trim(),
                    city: residentialCity.trim(),
                    state: residentialState.trim(),
                    zipCode: residentialZip.trim(),
                    country: 'United States'
                } : null
            }),
            ...(userType === 'corporate' && {
                companyName: companyName.trim(),
                companySector: companySector || '',
                companyAddress: companyStreet ? {
                    street: companyStreet.trim(),
                    city: companyCity.trim(),
                    state: companyState.trim(),
                    zipCode: companyZip.trim(),
                    country: 'United States'
                } : null
            })
        });

        await user.save();

        // 2. Create the corresponding Patient document IF it's an individual user
        if (userType === 'individual') {
            const patient = new Patient({
                userId: user._id, // LINKED TO USER ID
                firstName: user.firstName,
                lastName: user.lastName,
                dateOfBirth: user.dateOfBirth,
                phone: user.phone,
                // Pass the entire address object
                address: user.residentialAddress
            });
            await patient.save();
        }

        // 3. Set up the session
        req.session.user = {
            _id: user._id,
            email: user.email,
            role: user.role,
            userType: user.userType
        };

        req.session.success = userType === 'individual'
            ? `Welcome, ${firstName}!`
            : `Account created for ${companyName}!`;

        // 4. Redirect to dashboard
        res.redirect(getDashboardPath(user));

    } catch (err) {
        console.error('Registration error:', err);
        req.session.error = 'Registration failed. Please check server logs.';
        res.redirect('/auth/register');
    }
});

// ==================== GET: Phlebotomist Registration Page ====================
router.get('/register-phlebotomist', (req, res) => {
    // Even if model doesn't exist, the page still loads
    res.render('auth/register-phlebotomist', {
        title: 'Join as Phlebotomist – WhiteCoat',
        success: req.session.success || null,
        error: req.session.error || null
    });
    delete req.session.success;
    delete req.session.error;
});

// ==================== POST: Phlebotomist Registration (Safe) ====================
router.post('/register-phlebotomist', upload.single('cv'), async (req, res) => {
    // If model not found, just show message but don't crash
    if (!Phlebotomist) {
        req.session.error = 'Phlebotomist registration is temporarily unavailable.';
        return res.redirect('/auth/register-phlebotomist');
    }

    try {
        const {
            firstName, middleName, lastName, gender,
            street, city, state, zipCode,
            ref1Name, ref1Email, ref1Phone, ref1Relation,
            ref2Name, ref2Email, ref2Phone, ref2Relation
        } = req.body;

        if (!req.file) {
            req.session.error = 'CV upload is required (PDF only)';
            return res.redirect('/auth/register-phlebotomist');
        }

        const newPhleb = new Phlebotomist({
            firstName: firstName.trim(),
            middleName: (middleName || '').trim(),
            lastName: lastName.trim(),
            gender,
            address: {
                street: street.trim(),
                city: city.trim(),
                state: state.trim(),
                zipCode: zipCode.trim(),
                country: 'United States'
            },
            cv: `/uploads/cv/${req.file.filename}`,
            references: [
                { name: ref1Name.trim(), email: ref1Email, phone: ref1Phone, relation: ref1Relation.trim() },
                { name: ref2Name.trim(), email: ref2Email, phone: ref2Phone, relation: ref2Relation.trim() }
            ],
            status: 'pending_review',
            appliedAt: new Date()
        });

        await newPhleb.save();

        req.session.success = 'Application submitted! We will review it within 48 hours.';
        res.redirect('/auth/register-phlebotomist');

    } catch (err) {
        console.error('Phlebotomist apply error:', err);
        req.session.error = err.message.includes('PDF')
            ? 'Please upload a valid PDF file'
            : 'Application failed. Please try again.';
        res.redirect('/auth/register-phlebotomist');
    }
});

// GET: Phlebotomist Login Page
router.get('/login-phlebotomist', (req, res) => {
    if (req.session.user && req.session.user.role === 'phlebotomist') {
        return res.redirect('/phlebotomist/dashboard');
    }
    res.render('auth/login-phlebotomist', {
        title: 'Phlebotomist Login – WhiteCoat',
        error: req.session.error || null,
        success: req.session.success || null
    });
    delete req.session.error; delete req.session.success;
});

// POST: Phlebotomist Login
router.post('/login-phlebotomist', async (req, res) => {
    const { email, password } = req.body;

    try {
        const phleb = await Phlebotomist.findOne({ email: email.toLowerCase() });

        if (!phleb) {
            req.session.error = 'No account found with that email';
            return res.redirect('/auth/login-phlebotomist');
        }

        if (phleb.status !== 'approved') {
            req.session.error = 'Your account is not yet approved. Check your email for updates.';
            return res.redirect('/auth/login-phlebotomist');
        }

        if (!phleb.password || !(await phleb.comparePassword(password))) {
            req.session.error = 'Invalid email or password';
            return res.redirect('/auth/login-phlebotomist');
        }

        if (!phleb.isActive) {
            req.session.error = 'Account suspended. Contact support.';
            return res.redirect('/auth/login-phlebotomist');
        }

        // Success – Set session
        req.session.user = {
            _id: phleb._id,
            email: phleb.email,
            role: 'phlebotomist',
            name: `${phleb.firstName} ${phleb.lastName}`
        };

        phleb.lastLogin = new Date();
        await phleb.save();

        req.session.success = 'Welcome back!';
        res.redirect('/phlebotomist/dashboard');

    } catch (err) {
        console.error('Phlebotomist login error:', err);
        req.session.error = 'Server error. Try again.';
        res.redirect('/auth/login-phlebotomist');
    }
});

// ==================== GET: Logout ====================
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Logout error:', err);
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

module.exports = router;