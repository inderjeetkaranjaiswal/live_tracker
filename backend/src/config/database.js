const mongoose = require('mongoose');

/**
 * Connect to MongoDB using process.env.MONGO_URI.
 * If MongoDB is unavailable, the server continues with in-memory fallback.
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb+srv://<user>:<password>@cluster.mongodb.net/live_tracker';

  if (!mongoUri || mongoUri.trim() === '') {
    console.warn('=================================================');
    console.warn('⚠️  WARNING: MONGO_URI is missing or empty.');
    console.warn('   Server will run with in-memory fallback store.');
    console.warn('   Data will NOT persist across restarts.');
    console.warn('   Set MONGO_URI in Render environment variables.');
    console.warn('=================================================');
    return null;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
      retryWrites: true,
    });
    console.log(`[MongoDB] ✅ Connected successfully to: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    // Sanitize error message to prevent logging credentials
    const rawMsg = err.message || 'Database connection error';
    const sanitizedMsg = rawMsg.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, 'mongodb$1://***:***@');
    console.error(`[MongoDB] ❌ Connection failed: ${sanitizedMsg}`);
    console.warn('[MongoDB] ⚠️  Falling back to in-memory store. Data will not persist.');
    // Do NOT call process.exit() — allow server to run with in-memory fallback
    return null;
  }
};

module.exports = connectDB;
