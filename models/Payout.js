const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
    payoutId: {
        type: String,
        unique: true,
        required: true
    },
    affiliateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Affiliate',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['paypal', 'bank_transfer', 'crypto'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    processedDate: {
        type: Date
    },
    paymentDetails: {
        accountLast4: String,
        paymentGateway: String,
        gatewayPayoutId: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Payout', payoutSchema);