// cleanup.js
const mongoose = require('mongoose');
require('dotenv').config();

async function cleanupDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whitecoat', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Connected to MongoDB');
        
        // Delete all users
        const User = require('./models/User');
        const Patient = require('./models/Patient');
        const Order = require('./models/Order');
        const Test = require('./models/Test');
        
        console.log('Deleting users...');
        const userResult = await User.deleteMany({});
        console.log(`Deleted ${userResult.deletedCount} users`);
        
        console.log('Deleting patients...');
        const patientResult = await Patient.deleteMany({});
        console.log(`Deleted ${patientResult.deletedCount} patients`);
        
        console.log('Deleting orders...');
        const orderResult = await Order.deleteMany({});
        console.log(`Deleted ${orderResult.deletedCount} orders`);
        
        // Keep tests (optional)
        // const testResult = await Test.deleteMany({});
        // console.log(`Deleted ${testResult.deletedCount} tests`);
        
        console.log('Cleanup completed successfully!');
        
        // Display remaining counts
        const userCount = await User.countDocuments({});
        const patientCount = await Patient.countDocuments({});
        const orderCount = await Order.countDocuments({});
        
        console.log('\nRemaining documents:');
        console.log(`Users: ${userCount}`);
        console.log(`Patients: ${patientCount}`);
        console.log(`Orders: ${orderCount}`);
        
    } catch (error) {
        console.error('Cleanup error:', error);
    } finally {
        // Close connection
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

cleanupDatabase();