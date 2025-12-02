// drop-index.js
const mongoose = require('mongoose');

async function dropIndex() {
    try {
        await mongoose.connect('mongodb+srv://admin:admin@myatlasclusteredu.opxelwq.mongodb.net/whitecoat', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        const db = mongoose.connection.db;
        await db.collection('tests').dropIndex('testCode_1');
        console.log('Index dropped successfully!');
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        
        // If index doesn't exist, that's fine
        if (error.message.includes('index not found')) {
            console.log('Index already removed.');
            process.exit(0);
        }
        
        process.exit(1);
    }
}

dropIndex();