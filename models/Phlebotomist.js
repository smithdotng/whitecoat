// models/Phlebotomist.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const phlebotomistSchema = new mongoose.Schema({
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: { type: String, default: 'United States' }
    },
    cv: { type: String }, // path to uploaded CV
    references: [{
        name: String,
        email: String,
        phone: String,
        relation: String
    }],
    status: {
        type: String,
        enum: ['pending_review', 'approved', 'rejected', 'suspended'],
        default: 'pending_review'
    },
    password: { type: String }, // only set after approval
    appliedAt: { type: Date, default: Date.now },
    approvedAt: Date,
    lastLogin: Date,
    isActive: { type: Boolean, default: false }
});

// Hash password before saving
phlebotomistSchema.pre('save', async function(next) {
    if (this.isModified('password') && this.password) {
        this.password = await bcrypt.hash(this.password, 12);
    }
    next();
});

// Compare password method
phlebotomistSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Phlebotomist', phlebotomistSchema);