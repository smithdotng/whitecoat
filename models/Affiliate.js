const mongoose = require('mongoose');
const crypto = require('crypto');

const affiliateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  referralCode: {
    type: String,
    unique: true,
    default: () => `WHITECOAT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
  },
  defaultAllocation: {
    customerDiscount: {
      type: Number,
      min: 0,
      max: 15,
      default: 10
    },
    affiliateReward: {
      type: Number,
      min: 0,
      max: 15,
      default: 5
    }
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  availableBalance: {
    type: Number,
    default: 0
  },
  pendingBalance: {
    type: Number,
    default: 0
  },
  totalReferrals: {
    type: Number,
    default: 0
  },
  successfulReferrals: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'suspended'],
    default: 'active'
  },
  payoutMethod: {
    type: {
      type: String,
      enum: ['paypal', 'bank_transfer', 'crypto'],
      default: 'paypal'
    },
    details: {
      type: Map,
      of: String
    }
  },
  minimumPayout: {
    type: Number,
    default: 25
  },
  performanceMetrics: {
    conversionRate: {
      type: Number,
      default: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0
    },
    last30DaysEarnings: {
      type: Number,
      default: 0
    }
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

// Validation to ensure total discount = 15%
affiliateSchema.pre('save', function(next) {
  if (this.defaultAllocation.customerDiscount + this.defaultAllocation.affiliateReward !== 15) {
    const err = new Error('Total discount allocation must equal 15%');
    return next(err);
  }
  this.updatedAt = Date.now();
  next();
});

// Virtual for total discount pool
affiliateSchema.virtual('totalDiscountPool').get(function() {
  return 15;
});

module.exports = mongoose.model('Affiliate', affiliateSchema);