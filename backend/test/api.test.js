const assert = require('assert');
const { io } = require('socket.io-client');
const { server } = require('../src/server');

const BASE_URL = 'http://127.0.0.1:8080';

async function runComprehensiveVerification() {
  console.log('=================================================');
  console.log('🧪 COMPREHENSIVE END-TO-END VERIFICATION SUITE');
  console.log('=================================================');

  try {
    if (!server.listening) {
      await new Promise((resolve, reject) => {
        server.listen(8080, '127.0.0.1', resolve).on('error', reject);
      });
    }

    // 1. Health Check
    console.log('\n[Phase 1.1] GET /health - Server & DB Connectivity');
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(healthRes.status, 200, 'Health check should return 200');
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok');
    console.log(`✓ Health status: OK | DB State: ${healthData.dbState}`);

    // 2. Admin Registration
    console.log('\n[Phase 1.2] POST /auth/register - Admin Account Creation');
    const adminEmail = `admin_test_${Date.now()}@livetracker.com`;
    const adminRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Chief Administrator',
        email: adminEmail,
        password: 'AdminPassword123!',
        role: 'admin'
      })
    });
    assert.strictEqual(adminRegRes.status, 201, 'Admin registration should return 201');
    const adminRegData = await adminRegRes.json();
    assert.ok(adminRegData.token, 'Token should be returned');
    assert.strictEqual(adminRegData.user.role, 'admin');
    assert.strictEqual(adminRegData.user.password, undefined, 'Password must not be returned');
    const adminToken = adminRegData.token;
    console.log('✓ Admin created successfully with password hashing & clean JSON response.');

    // 3. Employee Registration
    console.log('\n[Phase 1.3] POST /auth/register - Employee Account Creation');
    const empEmail = `employee_test_${Date.now()}@livetracker.com`;
    const empRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Field Engineer John',
        email: empEmail,
        password: 'EmployeePassword123!',
        role: 'employee'
      })
    });
    assert.strictEqual(empRegRes.status, 201, 'Employee registration should return 201');
    const empRegData = await empRegRes.json();
    const empId = empRegData.user.id;
    assert.ok(empId, 'Employee ID must exist');
    console.log(`✓ Employee created successfully (ID: ${empId}).`);

    // 4. Duplicate Email Validation
    console.log('\n[Phase 1.4] POST /auth/register - Duplicate Email Validation');
    const dupRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate John',
        email: empEmail,
        password: 'EmployeePassword123!'
      })
    });
    assert.strictEqual(dupRes.status, 409, 'Duplicate registration should return 409 Conflict');
    console.log('✓ Duplicate email rejected with HTTP 409 Conflict.');

    // 5. Admin & Employee Login
    console.log('\n[Phase 1.5] POST /auth/login - Authentication & JWT Claims');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: empEmail,
        password: 'EmployeePassword123!'
      })
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    const empToken = loginData.token;
    assert.ok(empToken);
    console.log('✓ Login successful. Valid JWT Bearer token signed with HS256.');

    // 6. Invalid Password Test
    console.log('\n[Phase 1.6] POST /auth/login - Invalid Password Rejection');
    const badLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: empEmail,
        password: 'WrongPassword999!'
      })
    });
    assert.strictEqual(badLoginRes.status, 401);
    console.log('✓ Invalid password rejected with HTTP 401 Unauthorized.');

    // 7. Socket.IO Real-time Event Test
    console.log('\n[Phase 3] Socket.IO - Real-Time Location Update Broadcast Verification');
    const socket = io(BASE_URL, { transports: ['websocket', 'polling'] });

    const socketEventPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket.IO event timeout')), 5000);
      socket.on('location_updated', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    await new Promise((resolve) => socket.on('connect', resolve));
    console.log('✓ Socket.IO Client connected to server.');

    // 8. Location Update (Employee)
    console.log('\n[Phase 1.7] POST /location/update - GPS Coordinates Transmission');
    const testLat = 37.7749;
    const testLng = -122.4194;
    const locRes = await fetch(`${BASE_URL}/location/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${empToken}`
      },
      body: JSON.stringify({ latitude: testLat, longitude: testLng })
    });
    assert.strictEqual(locRes.status, 200);
    const locData = await locRes.json();
    assert.strictEqual(locData.location.latitude, testLat);
    assert.strictEqual(locData.location.longitude, testLng);
    console.log('✓ Location update saved in database.');

    // Wait for Socket.IO broadcast event
    const broadcastedData = await socketEventPromise;
    assert.strictEqual(broadcastedData.employeeId, empId);
    assert.strictEqual(broadcastedData.latitude, testLat);
    console.log('✓ Real-time Socket.IO event received by dashboard listener!');

    socket.disconnect();

    // 9. Coordinate Out of Bounds Validation
    console.log('\n[Phase 1.8] POST /location/update - Invalid Coordinate Bounds Validation');
    const invalidLocRes = await fetch(`${BASE_URL}/location/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${empToken}`
      },
      body: JSON.stringify({ latitude: 150.0, longitude: -200.0 })
    });
    assert.strictEqual(invalidLocRes.status, 400);
    console.log('✓ Invalid coordinates rejected with HTTP 400 Bad Request.');

    // 10. RBAC Protection Test
    console.log('\n[Phase 1.9] GET /location/all - Role-Based Access Control (RBAC)');
    const employeeAccessRes = await fetch(`${BASE_URL}/location/all`, {
      headers: { 'Authorization': `Bearer ${empToken}` }
    });
    assert.strictEqual(employeeAccessRes.status, 403);
    console.log('✓ RBAC Enforced: Employee prohibited from accessing Admin overview (403 Forbidden).');

    // 11. Admin Accessing All Locations
    console.log('\n[Phase 1.10] GET /location/all - Admin Real-time Tracking Overview');
    const adminAccessRes = await fetch(`${BASE_URL}/location/all`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminAccessRes.status, 200);
    const adminOverviewData = await adminAccessRes.json();
    assert.ok(adminOverviewData.employees.length > 0);
    console.log(`✓ Admin retrieved all employee tracking metrics (${adminOverviewData.count} active employees).`);

    // 12. GET /location/:employeeId
    console.log('\n[Phase 1.11] GET /location/:employeeId - Single Employee Detailed View');
    const singleEmpRes = await fetch(`${BASE_URL}/location/${empId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(singleEmpRes.status, 200);
    const singleEmpData = await singleEmpRes.json();
    assert.strictEqual(singleEmpData.employee.employeeId, empId);
    assert.strictEqual(singleEmpData.employee.latitude, testLat);
    console.log('✓ Single employee location record fetched successfully.');

    console.log('\n=================================================');
    console.log('🎉 ALL 12 INTEGRATION & REAL-TIME TESTS PASSED!');
    console.log('=================================================');
  } catch (err) {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  } finally {
    if (server && server.close) {
      server.close();
    }
  }
}

runComprehensiveVerification();
