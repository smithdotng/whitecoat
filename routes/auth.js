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
        
        console.log('=== LOGIN ATTEMPT ===');
        console.log('Email:', email);
        console.log('Password length:', password.length);
        
        const user = await User.findOne({ email: email.toLowerCase() });
        
        console.log('User found:', !!user);
        if (user) {
            console.log('User ID:', user._id);
            console.log('User password hash exists:', !!user.password);
            console.log('Password hash starts with:', user.password ? user.password.substring(0, 20) + '...' : 'No password');
            console.log('Has comparePassword method:', typeof user.comparePassword === 'function');
            
            // Test password comparison
            const isMatch = await user.comparePassword(password);
            console.log('Password match result:', isMatch);
        }

        if (!user || !await user.comparePassword(password)) {
            console.log('Login failed: invalid credentials');
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

        req.session.user = {
            _id: user._id,
            email: user.email,
            role: user.role,
            userType: user.userType || 'individual'
        };

        req.session.success = 'Welcome back!';
        console.log('Login successful, redirecting to:', getDashboardPath(user));
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
router.post('/register', [
    body('email').isEmail().normalizeEmail(),
    body('phone').isMobilePhone('any'),
    body('password').isLength({ min: 8 }),
    body('confirmPassword').custom((v, { req }) => v === req.body.password || 'Passwords do not match'),
    body('firstName').notEmpty().withMessage('First Name is required.'),
    body('lastName').notEmpty().withMessage('Last Name is required.'),
    body('dateOfBirth').isISO8601().withMessage('Date of Birth is required.'),
    body('residentialStreet').notEmpty().withMessage('Street address is required.'),
    body('residentialCity').notEmpty().withMessage('City is required.'),
    body('residentialState').notEmpty().withMessage('State is required.'),
    body('residentialZip').notEmpty().withMessage('ZIP Code is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.session.error = errors.array()[0].msg;
        return res.redirect('/auth/register');
    }

    const {
        email, password, phone, 
        firstName, middleName, lastName, gender, dateOfBirth,
        residentialStreet, residentialCity, residentialState, residentialZip,
        occupation
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
            userType: 'individual',
            role: 'patient',
            firstName: firstName.trim(),
            middleName: (middleName || '').trim(),
            lastName: lastName.trim(),
            gender,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            residentialAddress: {
                street: residentialStreet.trim(),
                city: residentialCity.trim(),
                state: residentialState.trim(),
                zipCode: residentialZip.trim(),
                country: 'United States'
            },
            occupation: occupation || ''
        });

        await user.save();

        // 2. Create the corresponding Patient document
        // IMPORTANT: Check if dateOfBirth is valid
        const dobDate = dateOfBirth ? new Date(dateOfBirth) : null;
        if (!dobDate || isNaN(dobDate.getTime())) {
            req.session.error = 'Invalid date of birth';
            return res.redirect('/auth/register');
        }

        const patient = new Patient({
            userId: user._id, // LINKED TO USER ID
            firstName: user.firstName,
            lastName: user.lastName,
            dateOfBirth: dobDate,
            phone: user.phone,
            address: {
                street: user.residentialAddress.street,
                city: user.residentialAddress.city,
                state: user.residentialAddress.state,
                zipCode: user.residentialAddress.zipCode,
                country: user.residentialAddress.country || 'United States'
            }
        });

        await patient.save();

        // 3. Set up the session
        req.session.user = {
            _id: user._id,
            email: user.email,
            role: user.role,
            userType: user.userType,
            patientId: patient._id // Store patient ID in session too
        };

        req.session.success = `Welcome, ${firstName}!`;
        
        // 4. Redirect to dashboard
        res.redirect('/patient/dashboard');

    } catch (err) {
        console.error('Registration error:', err);
        
        // More specific error messages
        if (err.code === 11000) {
            req.session.error = 'Email already registered';
        } else if (err.name === 'ValidationError') {
            req.session.error = Object.values(err.errors).map(e => e.message).join(', ');
        } else {
            req.session.error = 'Registration failed. Please try again.';
        }
        
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
            email, phone, // ADD THESE
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
            email: email.trim().toLowerCase(), // ADD THIS
            phone: phone.trim(), // ADD THIS
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
        
        // Check for duplicate email error
        if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
            req.session.error = 'This email is already registered. Please use a different email.';
        } else if (err.message.includes('PDF')) {
            req.session.error = 'Please upload a valid PDF file';
        } else if (err.name === 'ValidationError') {
            // More specific validation errors
            const messages = [];
            if (err.errors.email) messages.push('Email is required');
            if (err.errors.phone) messages.push('Phone is required');
            req.session.error = messages.join(', ');
        } else {
            req.session.error = 'Application failed. Please try again.';
        }
        
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

// Add this temporary route to debug
router.get('/debug-users', async (req, res) => {
    try {
        const users = await User.find({}).select('email password role createdAt').lean();
        
        // Check if passwords are hashed
        users.forEach(user => {
            user.passwordIsHashed = user.password && 
                (user.password.startsWith('$2a$') || 
                 user.password.startsWith('$2b$') ||
                 user.password.startsWith('$2y$'));
            user.passwordPreview = user.password ? 
                user.password.substring(0, 30) + '...' : 'No password';
        });
        
        res.json({
            totalUsers: users.length,
            users: users
        });
    } catch (err) {
        res.json({ error: err.message });
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