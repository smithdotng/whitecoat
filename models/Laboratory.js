const mongoose = require('mongoose');

const laboratorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    labName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    accreditationNumber: {
        type: String,
        required: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: {
            type: String,
            default: 'USA'
        }
    },
    contactPerson: {
        name: String,
        email: String,
        phone: String
    },
    labCode: {
        type: String,
        unique: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    processingTime: {
        type: Number, // in hours
        default: 48
    },
    testsPerformed: [{
        testId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Test'
        },
        testCode: String,
        price: Number
    }],
    qualityMetrics: {
        accuracyRate: {
            type: Number,
            default: 99.5
        },
        turnaroundTime: {
            type: Number,
            default: 24
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

// Generate lab code
laboratorySchema.pre('save', function(next) {
    if (!this.labCode) {
        this.labCode = 'LAB-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Laboratory', laboratorySchema);