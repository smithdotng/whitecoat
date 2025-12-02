require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const flash = require('connect-flash');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. Route Imports ---
// Ensure these files exist and export an Express Router instance
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patient');
const corporateRoutes = require('./routes/corporate');
const adminRoutes = require('./routes/adminRoutes'); // The Admin Router
const servicesRoutes = require('./routes/servicesRoutes');

// Mock Model Import (Required for homepage logic)
const Test = require('./models/Test'); // <--- Ensure this path is correct if Test model is used

// --- 2. Database Connection ---
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whitecoat', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // Note: useCreateIndex and useFindAndModify are default true/deprecated, removed for clarity
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// --- 3. Middleware Setup ---

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'whitecoat-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// Body Parsers (for handling JSON and form data)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (for CSS, JS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global variables middleware (for EJS templates)
app.use((req, res, next) => {
    // These variables are available in all EJS templates
    res.locals.user = req.session.user || null;
    res.locals.success = req.session.success || null;
    res.locals.error = req.session.error || null;
    res.locals.currentPath = req.path;
    next();
});


// --- 4. File Upload (Multer) Configuration ---

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = 'public/uploads/cv';
        // Ensure the directory exists
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        cb(null, dest);
    },
    filename: (req, file, cb) => cb(null, 'cv_' + Date.now() + '_' + file.originalname)
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDF allowed'));
    }
});


// --- 5. Application Routes (Manual/Legacy/Public) ---

// Phlebotomist Registration (Manual Example)
app.get('/register-phlebotomist', (req, res) => {
    res.render('auth/register-phlebotomist', {
        title: 'Join as Phlebotomist – WhiteCoat'
    });
});

app.post('/register-phlebotomist', upload.single('cv'), async (req, res) => {
    try {
        // Mocking save logic
        const Phlebotomist = mongoose.models.Phlebotomist || { save: () => Promise.resolve() };

        if (!req.file) {
            req.session.error = 'CV upload is required (PDF only)';
            return res.redirect('/register-phlebotomist');
        }

        console.log(`Mocking Phlebotomist application for ${req.body.firstName} ${req.body.lastName}`);

        req.session.success = 'Application submitted! We will review it within 48 hours.';
        res.redirect('/register-phlebotomist');

    } catch (err) {
        console.error('Phlebotomist apply error:', err);
        req.session.error = err.message.includes('PDF')
            ? 'Please upload a valid PDF file'
            : 'Application failed. Please try again.';
        res.redirect('/register-phlebotomist');
    }
});

// Affiliate and Phlebotomist Dashboards (Legacy/Temporary)
app.get('/affiliate/dashboard', (req, res) => {
    if (!req.session.user) {
        req.session.error = 'Please login first';
        return res.redirect('/auth/login');
    }
    res.render('affiliate/dashboard', {
        title: 'Affiliate Dashboard'
    });
});

app.get('/phlebotomist/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'phlebotomist') {
        return res.redirect('/auth/login');
    }
    res.render('phlebotomist/dashboard');
});

// Public Homepage Route (using the Test model)
app.get('/', async (req, res) => {
    try {
        const tests = await Test.find({})
                                .sort({ createdAt: -1 })
                                .limit(3);

        res.render('index', {
            title: 'WhiteCoat - Anonymous Healthcare',
            tests: tests,
        });

    } catch (err) {
        console.error('Error fetching tests for home page:', err);
        res.render('index', {
            title: 'WhiteCoat - Anonymous Healthcare',
            tests: [],
            error: 'Could not load service information.',
        });
    }
});

// Simple Static Page Routes
app.get('/about', (req, res) => res.render('about', { title: 'About WhiteCoat' }));
app.get('/services/tests', (req, res) => res.render('services/tests', { title: 'Available Tests' }));
app.get('/services/how-it-works', (req, res) => res.render('services/how-it-works', { title: 'How It Works' }));
app.get('/privacy', (req, res) => res.render('privacy', { title: 'Privacy Policy' }));
app.get('/contact', (req, res) => res.render('contact', { title: 'Contact Us' }));
app.post('/contact', (req, res) => {
    req.session.success = 'Thank you for your message! We will get back to you soon.';
    res.redirect('/contact');
});


// --- 6. Router Mounting (The Critical Section) ---
// ALL dedicated routers MUST be mounted BEFORE the 404 handler.

app.use('/auth', authRoutes);
app.use('/patient', patientRoutes);
app.use('/corporate', corporateRoutes); // Example for corporate routes

// ✅ CORRECT PLACEMENT: Mount the admin router here
app.use('/admin', adminRoutes);

app.use('/services', servicesRoutes);

// --- 7. Flash Message Cleanup ---
// Clears messages so they don't persist on the next request.
app.use((req, res, next) => {
    if (req.session) {
        delete req.session.success;
        delete req.session.error;
    }
    next();
});

// --- 8. Views Creation Utility (For development/setup) ---
const basicViews = [
    'index',
    'about',
    'services/tests',
    'services/how-it-works',
    'privacy',
    'contact',
    'auth/login',
    'auth/register',
    'auth/register-phlebotomist',
    'patient/dashboard',
    'affiliate/dashboard',
    'phlebotomist/dashboard',
    'admin/dashboard' // Added admin dashboard to the creation list
];

basicViews.forEach(view => {
    const viewPath = path.join(__dirname, 'views', view + '.ejs');
    if (!fs.existsSync(viewPath)) {
        const dir = path.dirname(viewPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Basic EJS structure to prevent errors
        fs.writeFileSync(viewPath, `<%- include('../layouts/main', { title: '${view.split('/').pop().replace('-', ' ').toUpperCase()}' }) %>
<div class="container py-5">
    <h1 class="mb-4">${view.split('/').pop().replace('-', ' ').toUpperCase()}</h1>
    <p>This is the ${view} page. Content coming soon.</p>
</div>`);
        console.log(`Created view: ${view}.ejs`);
    }
});


// --- 9. Error Handlers (MUST be last) ---

// 404 Handler (Catch-all for any route not matched above)
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>404 - Page Not Found</title>
            <style>
                body { font-family: sans-serif; text-align: center; padding: 50px; background-color: #f4f7f6; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                .display-1 { font-size: 6rem; color: #dc3545; margin-bottom: 0; }
                .mb-4 { margin-bottom: 1.5rem; }
                .lead { font-size: 1.25rem; color: #6c757d; }
                .btn-primary { background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1 class="display-1">404</h1>
                <h2 class="mb-4">Page Not Found</h2>
                <p class="lead mb-4">The page you are looking for does not exist.</p>
                <a href="/" class="btn btn-primary">Go Home</a>
            </div>
        </body>
        </html>
    `);
});

// 500 Error Handler (Catches errors passed via next(err))
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>500 - Server Error</title>
             <style>
                body { font-family: sans-serif; text-align: center; padding: 50px; background-color: #f4f7f6; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                .display-1 { font-size: 6rem; color: #ffc107; margin-bottom: 0; }
                .mb-4 { margin-bottom: 1.5rem; }
                .lead { font-size: 1.25rem; color: #6c757d; }
                .btn-primary { background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                pre { background: #f8f8f8; padding: 15px; border: 1px solid #ddd; text-align: left; overflow-x: auto; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1 class="display-1">500</h1>
                <h2 class="mb-4">Server Error</h2>
                <p class="lead mb-4">Something went wrong on our server.</p>
                ${process.env.NODE_ENV === 'development' ? `<pre>${err.stack}</pre>` : ''}
                <a href="/" class="btn btn-primary">Go Home</a>
                <a href="javascript:location.reload()" class="btn btn-primary ms-2">Try Again</a>
            </div>
        </body>
        </html>
    `);
});


// --- 10. Start Server ---

app.listen(PORT, () => {
    console.log(`🚀 WhiteCoat server running on port ${PORT}`);
    console.log(`🌐 Access the app at: http://localhost:${PORT}`);
    console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
});