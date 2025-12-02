const mongoose = require('mongoose');
const crypto = require('crypto');

const patientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  anonymousId: {
    type: String,
    unique: true,
    default: () => crypto.randomBytes(16).toString('hex')
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  referralCodeUsed: {
    type: String,
    ref: 'Affiliate'
  },
  hasUsedReferralDiscount: {
    type: Boolean,
    default: false
  },
  isAffiliate: {
    type: Boolean,
    default: false
  },
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate'
  },
  privacySettings: {
    dataRetention: {
      type: String,
      enum: ['6months', '1year', '3years', 'indefinite'],
      default: '1year'
    },
    shareAggregatedData: {
      type: Boolean,
      default: false
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

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure anonymousId is always present
patientSchema.pre('save', function(next) {
  if (!this.anonymousId) {
    this.anonymousId = crypto.randomBytes(16).toString('hex');
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Patient', patientSchema);