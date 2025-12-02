// models/Test.js (new file)
const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['blood', 'urine', 'panel', 'hormone', 'std', 'other'],
    required: true
  },
  isPackage: {
    type: Boolean,
    default: false
  },
  items: [{
    test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
    quantity: { type: Number, default: 1 }
  }],
  requirements: {
    type: String,
    default: ''
  },
  turnaroundTime: {
    type: String,
    default: '24-48 hours'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

testSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Test', testSchema);