const mongoose = require('mongoose');

/**
 * Check if MongoDB connection is active and ready (readyState === 1).
 */
const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Connect to MongoDB using process.env.MONGO_URI.
 * MongoDB is the SOLE source of truth for authentication and user records.
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri || mongoUri.trim() === '') {
    console.error('=================================================');
    console.error('[MongoDB] ❌ CRITICAL: process.env.MONGO_URI is missing or empty.');
    console.error('   MongoDB is the sole source of truth for authentication.');
    console.error('   Please configure MONGO_URI in your environment variables.');
    console.error('=================================================');
    return null;
  }

  try {
    const conn = await mongoose.connect(mongoUri.trim(), {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
      retryWrites: true,
    });
    console.log(`[MongoDB] ✅ Connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`);
    return conn;
  } catch (err) {
    // Sanitize error message to prevent logging credentials
    const rawMsg = err.message || 'Database connection error';
    const sanitizedMsg = rawMsg.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, 'mongodb$1://***:***@');
    console.error(`[MongoDB] ❌ Connection failed: ${sanitizedMsg}`);
    return null;
  }
};

module.exports = {
  connectDB,
  isDbConnected
};
