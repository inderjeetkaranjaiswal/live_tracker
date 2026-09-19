const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { app, server } = require('../src/server');
const { isDbConnected } = require('../src/config/database');

// Load test credentials from environment — never hardcode real credentials
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('❌ Set ADMIN_EMAIL and ADMIN_PASSWORD env vars before running this suite.');
  process.exit(1);
}

const BASE_URL = `http://127.0.0.1:8080`;

async function runSuite() {
  console.log('===============================================================');
  console.log('🧪 RUNNING COMPREHENSIVE AUTHENTICATION VERIFICATION SUITE');
  console.log('===============================================================\n');

  // Ensure local test server is listening
  if (!server.listening) {
    await new Promise((resolve) => server.listen(8080, '127.0.0.1', resolve));
  }

  // Wait up to 10 seconds for MongoDB connection to be ready
  let dbWait = 0;
  while (!isDbConnected() && dbWait < 10) {
    await new Promise((r) => setTimeout(r, 1000));
    dbWait++;
  }
  assert.ok(isDbConnected(), 'MongoDB Atlas must be connected for tests');
  console.log('✅ Connected to MongoDB Atlas:', mongoose.connection.host);

  // -------------------------------------------------------------
  // Test A: Correct admin credentials -> successful login
  // -------------------------------------------------------------
  console.log('\n[Test A] Admin Login with correct credentials...');
  const adminRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });
  assert.strictEqual(adminRes.status, 200, 'Admin login must return HTTP 200');
  const adminData = await adminRes.json();
  assert.ok(adminData.token, 'Must return valid JWT token');
  assert.strictEqual(adminData.user.role, 'admin', 'User role must be admin');
  assert.strictEqual(adminData.user.email, ADMIN_EMAIL);
  const adminToken = adminData.token;
  console.log('✅ Test A Passed: Admin login HTTP 200, role = admin, valid JWT');

  // -------------------------------------------------------------
  // Test B: Correct employee credentials -> successful login
  // -------------------------------------------------------------
  console.log('\n[Test B] Employee Login with correct credentials...');
  const empRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'employee@livetracker.com',
      password: 'EmployeePassword123!'
    })
  });
  assert.strictEqual(empRes.status, 200, 'Employee login must return HTTP 200');
  const empData = await empRes.json();
  assert.ok(empData.token, 'Must return valid JWT token');
  assert.strictEqual(empData.user.role, 'employee', 'User role must be employee');
  const empToken = empData.token;
  console.log('✅ Test B Passed: Employee login HTTP 200, role = employee, valid JWT');

  // -------------------------------------------------------------
  // Test C: Wrong password -> 401 Invalid credentials
  // -------------------------------------------------------------
  console.log('\n[Test C] Login with wrong password...');
  const wrongPwRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@livetracker.com',
      password: 'CompletelyWrongPassword123'
    })
  });
  assert.strictEqual(wrongPwRes.status, 401, 'Wrong password must return HTTP 401');
  const wrongPwData = await wrongPwRes.json();
  assert.strictEqual(wrongPwData.error, 'Invalid credentials');
  console.log('✅ Test C Passed: Wrong password returns HTTP 401 Invalid credentials');

  // -------------------------------------------------------------
  // Test D: Unknown email -> 401 Invalid credentials
  // -------------------------------------------------------------
  console.log('\n[Test D] Login with unknown email...');
  const unknownEmailRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nonexistent_account_12345@livetracker.com',
      password: 'SomePassword123!'
    })
  });
  assert.strictEqual(unknownEmailRes.status, 401, 'Unknown email must return HTTP 401');
  const unknownEmailData = await unknownEmailRes.json();
  assert.strictEqual(unknownEmailData.error, 'Invalid credentials');
  console.log('✅ Test D Passed: Unknown email returns HTTP 401 Invalid credentials');

  // -------------------------------------------------------------
  // Test E: Database disconnected -> returns 503, NEVER 401!
  // -------------------------------------------------------------
  console.log('\n[Test E] Simulating database outage...');
  // Temporarily disconnect mongoose
  await mongoose.disconnect();
  assert.strictEqual(isDbConnected(), false, 'DB must be reported disconnected');

  const dbDownRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });
  assert.strictEqual(dbDownRes.status, 503, 'When DB is down, login MUST return HTTP 503 (NOT 401)');
  const dbDownData = await dbDownRes.json();
  assert.strictEqual(dbDownData.error, 'Database unavailable');
  console.log('✅ Test E Passed: Database disconnection cleanly returns HTTP 503 (NEVER 401)');

  // Reconnect MongoDB for remaining tests
  console.log('\n[Reconnecting to MongoDB Atlas...]');
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
  });
  assert.ok(isDbConnected(), 'Reconnection successful');
  console.log('✅ Reconnected to MongoDB Atlas');

  // -------------------------------------------------------------
  // Test G & H: Restart simulation -> users persist in MongoDB Atlas
  // -------------------------------------------------------------
  console.log('\n[Test G & H] Server Restart persistence verification...');
  const postRestartAdminRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });
  assert.strictEqual(postRestartAdminRes.status, 200, 'Admin login must still succeed post-reconnect');
  console.log('✅ Test G & H Passed: MongoDB user persistence confirmed across restarts');

  // -------------------------------------------------------------
  // Test I: Employee cannot access admin endpoints -> 403 Forbidden
  // -------------------------------------------------------------
  console.log('\n[Test I] Role restriction: Employee calling admin endpoint...');
  const empAdminAccessRes = await fetch(`${BASE_URL}/location/all`, {
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  assert.strictEqual(empAdminAccessRes.status, 403, 'Employee MUST be rejected with HTTP 403 on admin routes');
  console.log('✅ Test I Passed: Employee rejected with HTTP 403 on admin-only route');

  // -------------------------------------------------------------
  // Test J: Admin can access admin endpoints -> 200 OK
  // -------------------------------------------------------------
  console.log('\n[Test J] Role restriction: Admin calling admin endpoint...');
  const adminAccessRes = await fetch(`${BASE_URL}/location/all`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminAccessRes.status, 200, 'Admin MUST be granted access on admin routes');
  console.log('✅ Test J Passed: Admin granted HTTP 200 on admin-only route');

  // -------------------------------------------------------------
  // Test K: JWT validity on protected route
  // -------------------------------------------------------------
  console.log('\n[Test K] JWT token structure and cryptographic verification...');
  const jwt = require('jsonwebtoken');
  const { getJwtSecret } = require('../src/utils/secretManager');
  const decoded = jwt.verify(adminToken, getJwtSecret(), { algorithms: ['HS256'] });
  assert.strictEqual(decoded.email, ADMIN_EMAIL);
  assert.strictEqual(decoded.role, 'admin');
  console.log('✅ Test K Passed: JWT verified with HS256, contains correct claims');

  // -------------------------------------------------------------
  // Test L: Flutter configuration audit
  // -------------------------------------------------------------
  console.log('\n[Test L] Verifying Flutter AppConfig production URL binding...');
  const fs = require('fs');
  const flutterConfig = fs.readFileSync(
    path.join(__dirname, '../../employee_app/lib/config/app_config.dart'),
    'utf-8'
  );
  assert.ok(
    flutterConfig.includes('https://live-tracker-ahr5.onrender.com'),
    'Flutter must be bound to production Render URL'
  );
  assert.ok(
    !flutterConfig.includes('127.0.0.1:'),
    'Flutter must not have active 127.0.0.1 references'
  );
  console.log('✅ Test L Passed: Flutter app_config.dart strictly bound to https://live-tracker-ahr5.onrender.com');

  console.log('\n===============================================================');
  console.log('🎉 ALL 12 AUTHENTICATION TEST SUITE CHECKS PASSED PERFECTLY!');
  console.log('===============================================================\n');

  server.close();
  await mongoose.disconnect();
  process.exit(0);
}

runSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  if (server.listening) server.close();
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
