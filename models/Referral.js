const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referralId: {
    type: String,
    unique: true,
    default: () => `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true
  },
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referralDate: {
    type: Date,
    default: Date.now
  },
  appliedAllocation: {
    customerDiscount: Number,
    affiliateReward: Number
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'expired', 'cancelled'],
    default: 'pending'
  },
  discountApplied: {
    type: Boolean,
    default: false
  },
  rewardPaid: {
    type: Boolean,
    default: false
  },
  firstOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    source: String
  }
});

// Index for faster queries
referralSchema.index({ affiliateId: 1, status: 1 });
referralSchema.index({ referredUserId: 1 }, { unique: true });
referralSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Referral', referralSchema);