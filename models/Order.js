// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    // ... other fields
    status: {
        type: String,
        enum: ['pending', 'scheduled', 'sample_collected', 'processing', 'completed', 'cancelled'],
        default: 'pending'
    },
    // ... more fields
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Make sure you're exporting it correctly
module.exports = mongoose.model('Order', orderSchema);