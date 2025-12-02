const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const Affiliate = require('../models/Affiliate');
const Referral = require('../models/Referral');
const Order = require('../models/Order');
const Patient = require('../models/Patient');

// Apply authentication and role check
router.use(requireRole(['patient', 'phlebotomist']));

// Affiliate Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const affiliate = await Affiliate.findOne({ userId: req.user._id });
        
        if (!affiliate) {
            return res.redirect('/affiliate/opt-in');
        }

        // Get referrals
        const referrals = await Referral.find({ affiliateId: affiliate._id })
            .sort({ referralDate: -1 })
            .limit(10);

        // Calculate recent earnings (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentEarnings = await Order.aggregate([
            {
                $match: {
                    affiliateId: affiliate._id,
                    status: 'completed',
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$appliedDiscountAmount' }
                }
            }
        ]);

        res.render('affiliate/dashboard', {
            title: 'Affiliate Dashboard',
            affiliate,
            referrals,
            recentEarnings: recentEarnings[0]?.total || 0
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { 
            message: 'Error loading dashboard',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Opt-in to affiliate program
router.get('/opt-in', async (req, res) => {
    try {
        const existingAffiliate = await Affiliate.findOne({ userId: req.user._id });
        if (existingAffiliate) {
            return res.redirect('/affiliate/dashboard');
        }

        const patient = await Patient.findOne({ userId: req.user._id });
        
        res.render('affiliate/opt-in', {
            title: 'Become a WhiteCoat Affiliate',
            patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'User'
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading opt-in page',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

router.post('/opt-in', async (req, res) => {
    try {
        const affiliate = new Affiliate({
            userId: req.user._id,
            defaultAllocation: {
                customerDiscount: 10,
                affiliateReward: 5
            }
        });

        await affiliate.save();

        // Update patient record
        await Patient.findOneAndUpdate(
            { userId: req.user._id },
            { 
                isAffiliate: true,
                affiliateId: affiliate._id 
            }
        );

        req.session.success = 'Successfully enrolled in affiliate program!';
        res.redirect('/affiliate/dashboard');
    } catch (error) {
        console.error('Opt-in error:', error);
        req.session.error = 'Error enrolling in affiliate program';
        res.redirect('/affiliate/opt-in');
    }
});

// Referral management
router.get('/referrals', async (req, res) => {
    try {
        const affiliate = await Affiliate.findOne({ userId: req.user._id });
        
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const referrals = await Referral.find({ affiliateId: affiliate._id })
            .sort({ referralDate: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Referral.countDocuments({ affiliateId: affiliate._id });

        res.render('affiliate/referrals', {
            title: 'My Referrals',
            affiliate,
            referrals,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalReferrals: total
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading referrals',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Earnings and payout
router.get('/earnings', async (req, res) => {
    try {
        const affiliate = await Affiliate.findOne({ userId: req.user._id });
        
        // Get earnings by month
        const monthlyEarnings = await Order.aggregate([
            {
                $match: {
                    affiliateId: affiliate._id,
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalEarnings: { $sum: '$appliedDiscountAmount' },
                    orderCount: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': -1, '_id.month': -1 }
            }
        ]);

        res.render('affiliate/earnings', {
            title: 'Earnings',
            affiliate,
            monthlyEarnings
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error loading earnings',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Update allocation settings
router.post('/update-allocation', async (req, res) => {
    try {
        const { customerDiscount } = req.body;
        const affiliateReward = 15 - customerDiscount;

        const affiliate = await Affiliate.findOneAndUpdate(
            { userId: req.user._id },
            {
                defaultAllocation: {
                    customerDiscount: parseInt(customerDiscount),
                    affiliateReward
                }
            },
            { new: true }
        );

        req.session.success = 'Discount allocation updated successfully!';
        res.json({ success: true, affiliate });
    } catch (error) {
        console.error('Update allocation error:', error);
        res.status(500).json({ error: 'Failed to update allocation' });
    }
});

// Request payout
router.post('/request-payout', async (req, res) => {
    try {
        const affiliate = await Affiliate.findOne({ userId: req.user._id });
        
        if (affiliate.availableBalance < affiliate.minimumPayout) {
            return res.status(400).json({
                error: `Minimum payout amount is $${affiliate.minimumPayout}`
            });
        }

        // Simulate payout
        affiliate.availableBalance = 0;
        affiliate.totalEarnings += affiliate.availableBalance;
        await affiliate.save();

        req.session.success = 'Payout request submitted successfully!';
        res.json({ success: true, newBalance: affiliate.availableBalance });
    } catch (error) {
        console.error('Payout error:', error);
        res.status(500).json({ error: 'Failed to process payout request' });
    }
});

module.exports = router;