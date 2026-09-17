#!/usr/bin/env node
/**
 * Secure CLI Script to Create or Reset an Administrator Account in MongoDB.
 * 
 * Usage:
 *   ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="SecurePassword123" node scripts/createOrResetAdmin.js
 * Or:
 *   node scripts/createOrResetAdmin.js <email> <password> [name]
 *
 * NOTE:
 *   - Passwords are NEVER logged or stored in plaintext.
 *   - Passwords are encrypted using bcrypt with 10 salt rounds.
 *   - MongoDB URI is loaded from process.env.MONGO_URI or backend/.env
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../src/models/User');

async function main() {
  const emailArg = process.argv[2] || process.env.ADMIN_EMAIL;
  const passwordArg = process.argv[3] || process.env.ADMIN_PASSWORD;
  const nameArg = process.argv[4] || process.env.ADMIN_NAME || 'System Administrator';

  if (!emailArg || !passwordArg) {
    console.error('================================================================');
    console.error('❌ Usage: node scripts/createOrResetAdmin.js <email> <password> [name]');
    console.error('   Or pass via environment:');
    console.error('   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/createOrResetAdmin.js');
    console.error('================================================================');
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const password = passwordArg.trim();
  const name = nameArg.trim();

  if (password.length < 8) {
    console.error('❌ Error: Admin password must be at least 8 characters long.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Error: process.env.MONGO_URI is not set. Check backend/.env');
    process.exit(1);
  }

  try {
    console.log('[Admin Setup] Connecting to MongoDB...');
    await mongoose.connect(mongoUri.trim(), {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000
    });
    console.log(`[Admin Setup] ✅ Connected to host: ${mongoose.connection.host}`);

    // Generate bcrypt hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Upsert admin user
    const adminUser = await User.findOneAndUpdate(
      { email },
      {
        name,
        email,
        password: hashedPassword,
        role: 'admin'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('================================================================');
    console.log('✅ Administrator account successfully configured in MongoDB:');
    console.log(`   User ID : ${adminUser._id}`);
    console.log(`   Name    : ${adminUser.name}`);
    console.log(`   Email   : ${adminUser.email}`);
    console.log(`   Role    : ${adminUser.role}`);
    console.log('   Password: [SECURE BCRYPT HASH STORED]');
    console.log('================================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create/reset admin:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

main();
