const mongoose = require('mongoose');

let lastDbError = null;

/**
 * Check if MongoDB connection is active and ready (readyState === 1).
 */
const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Get diagnostic information about the database connection (without exposing secrets).
 */
const getDbDiagnostics = () => {
  const uri = process.env.MONGO_URI;
  let hostInfo = 'none';
  if (uri && uri.trim()) {
    const match = uri.match(/@([^/?]+)/);
    hostInfo = match ? match[1] : 'configured';
  }
  return {
    readyState: mongoose.connection.readyState,
    readyStateDesc: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
    mongoUriConfigured: Boolean(uri && uri.trim() !== ''),
    mongoHost: hostInfo,
    lastError: lastDbError
  };
};

/**
 * Connect to MongoDB using process.env.MONGO_URI.
 * MongoDB is the SOLE source of truth for authentication and user records.
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri || mongoUri.trim() === '') {
    lastDbError = {
      name: 'MissingMongoUri',
      message: 'process.env.MONGO_URI is missing or empty in environment variables'
    };
    console.error('=================================================');
    console.error('[MongoDB] ❌ CRITICAL: process.env.MONGO_URI is missing or empty.');
    console.error('   MongoDB is the sole source of truth for authentication.');
    console.error('   Please configure MONGO_URI in your environment variables.');
    console.error('=================================================');
    return null;
  }

  // Avoid re-connecting if already connecting or connected
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (mongoose.connection.readyState === 2) {
    console.log('[MongoDB] Connection already in progress...');
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
    lastDbError = null;
    console.log(`[MongoDB] ✅ Connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`);
    return conn;
  } catch (err) {
    // Sanitize error message to prevent logging credentials
    const rawMsg = err.message || 'Database connection error';
    const sanitizedMsg = rawMsg.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, 'mongodb$1://***:***@');
    lastDbError = {
      name: err.name || 'MongoConnectionError',
      message: sanitizedMsg,
      code: err.code || null
    };
    console.error(`[MongoDB] ❌ Connection failed: ${sanitizedMsg}`);
    return null;
  }
};

module.exports = {
  connectDB,
  isDbConnected,
  getDbDiagnostics
};
