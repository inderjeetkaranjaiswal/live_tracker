const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const locationRoutes = require('./routes/locationRoutes');
const { connectDB, isDbConnected, getDbDiagnostics } = require('./config/database');

const app = express();
const server = http.createServer(app);

// 1. Security Headers via Helmet (configured for cross-origin access)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' }
  })
);

// 2. CORS configuration - allow all trusted & cross-origin requests seamlessly
app.use(
  cors({
    origin: (origin, callback) => {
      // Dynamically reflect origin and allow all incoming web, mobile & local requests
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// 3. Body Parsing Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Rate Limiting to mitigate Brute-Force & DoS attacks
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs on auth routes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', message: 'Too many login/registration attempts. Please try again later.' }
});

const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/auth', authRateLimiter, authRoutes);
app.use('/location', apiRateLimiter, locationRoutes);

// 5. Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbState: isDbConnected() ? 'connected' : 'disconnected',
    db: getDbDiagnostics()
  });
});

// Direct APK Download Endpoints
app.get('/download/apk', (req, res) => {
  const filePath = require('path').resolve(__dirname, '../../LiveTracker-Latest.apk');
  res.download(filePath, 'LiveTracker-Latest.apk');
});

app.get('/download/apk-arm64', (req, res) => {
  const filePath = require('path').resolve(__dirname, '../../LiveTracker-arm64-Latest.apk');
  res.download(filePath, 'LiveTracker-arm64-Latest.apk');
});

// Manual Reconnect Endpoint to trigger immediate MongoDB reconnection attempt
app.post('/health/reconnect', async (req, res) => {
  try {
    const conn = await connectDB();
    res.status(200).json({
      success: isDbConnected(),
      db: getDbDiagnostics()
    });
  } catch (err) {
    res.status(500).json({
      error: 'Reconnect failed',
      db: getDbDiagnostics()
    });
  }
});

// Version endpoint to verify which code is deployed
app.get('/version', (req, res) => {
  res.status(200).json({
    version: '2.1.1',
    deployedAt: '2026-09-17T18:50:00Z',
    auth: 'mongodb-only',
    features: ['mongodb-sole-source-of-truth', 'no-inmemory-auth-fallback', 'clean-503-distinction', 'db-diagnostics'],
    db: getDbDiagnostics()
  });
});

// 6. Socket.IO Setup for Real-time Location Updates
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Attach socket.io instance to Express app for route access
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// 7. Self-Ping Keepalive (prevents Render free-tier cold starts)
const SELF_PING_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

function startKeepalive(baseUrl) {
  setInterval(async () => {
    try {
      const https = require('https');
      const http = require('http');
      const url = new URL(`${baseUrl}/health`);
      const client = url.protocol === 'https:' ? https : http;
      const req = client.get(url.toString(), (res) => {
        console.log(`[Keepalive] Self-ping OK — status ${res.statusCode} at ${new Date().toISOString()}`);
      });
      req.on('error', (err) => {
        console.warn(`[Keepalive] Self-ping failed: ${err.message}`);
      });
      req.end();
    } catch (err) {
      console.warn(`[Keepalive] Self-ping error: ${err.message}`);
    }
  }, SELF_PING_INTERVAL_MS);
  console.log(`[Keepalive] ✅ Self-ping active — pinging ${baseUrl}/health every 5 minutes`);
}

// 8. Database Connection & Server Initialization
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize Database Connection via environment configuration
const initDB = async () => {
  const conn = await connectDB();
  if (conn) {
    console.log('[Server] ✅ MongoDB connected successfully.');
  } else {
    console.warn('[Server] ⚠️  MongoDB connection pending or failed. Auth endpoints will return 503 until connected.');
    // Periodic retry in background every 15 seconds
    const retryInterval = setInterval(async () => {
      if (isDbConnected()) {
        clearInterval(retryInterval);
        return;
      }
      try {
        const retryConn = await connectDB();
        if (retryConn) {
          console.log('[Server] ✅ MongoDB connected on background retry!');
          clearInterval(retryInterval);
        }
      } catch (e) {
        console.error('[Server] MongoDB reconnect attempt error:', e.message);
      }
    }, 15000);
  }
};
initDB();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`=================================================`);
    console.error(`❌ PORT ${PORT} IS ALREADY IN USE!`);
    console.error(`Another process is already running on http://${HOST}:${PORT}`);
    console.error(`To free port ${PORT}, run: npx kill-port ${PORT}`);
    console.error(`=================================================`);
    process.exit(1);
  } else {
    console.error('[Server Error]', err);
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`=================================================`);
    console.log(`🚀 Live Location Backend Server running!`);
    console.log(`📡 Listening at: http://${HOST}:${PORT}`);
    console.log(`🔒 Security headers (Helmet), Rate Limiting & JWT active`);
    console.log(`=================================================`);

    // Start keepalive self-ping using the public URL in production, localhost in dev
    const selfUrl = process.env.RENDER_EXTERNAL_URL
      || process.env.SELF_URL
      || `http://localhost:${PORT}`;
    startKeepalive(selfUrl);
  });
}

module.exports = { app, server };
