const mongoose = require('mongoose');

/**
 * Connect to MongoDB using process.env.MONGO_URI
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri || mongoUri.trim() === '') {
    console.error('=================================================');
    console.error('❌ FATAL CONFIGURATION ERROR:');
    console.error('process.env.MONGO_URI is missing or empty.');
    console.error('Please configure MONGO_URI in your backend/.env file.');
    console.error('Example: MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/live_tracker');
    console.error('=================================================');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    // Sanitize error message to prevent logging credentials
    const rawMsg = err.message || 'Database connection error';
    const sanitizedMsg = rawMsg.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, 'mongodb$1://***:***@');
    console.error(`[MongoDB] Connection error: ${sanitizedMsg}`);
    console.warn('[MongoDB] Operating with local state fallback if database is unreachable.');
  }
};

module.exports = connectDB;
