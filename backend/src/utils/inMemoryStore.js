const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class InMemoryStore {
  constructor() {
    this.users = new Map();
    this.locations = new Map();
    this.seedDefaultUsers();
  }

  seedDefaultUsers() {
    try {
      const salt = bcrypt.genSaltSync(10);
      const adminPasswordHash = bcrypt.hashSync('AdminPassword123!', salt);
      const userPasswordHash = bcrypt.hashSync('Password123!', salt);
      const empPasswordHash = bcrypt.hashSync('EmployeePassword123!', salt);

      this.saveUser({
        name: 'System Administrator',
        email: 'admin@livetracker.com',
        password: adminPasswordHash,
        role: 'admin'
      });

      this.saveUser({
        name: 'Inderjeet Karan Jaiswal',
        email: 'inderjeetkaranjaiswal@gmail.com',
        password: userPasswordHash,
        role: 'admin'
      });

      this.saveUser({
        name: 'Field Officer John',
        email: 'employee1@livetracker.com',
        password: empPasswordHash,
        role: 'employee'
      });
      console.log('[InMemoryStore] Default admin and employee accounts seeded successfully.');
    } catch (e) {
      console.error('[InMemoryStore] Seeding error:', e);
    }
  }

  // Users
  findUserByEmail(email) {
    const normEmail = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email === normEmail) return user;
    }
    return null;
  }

  findUserById(id) {
    return this.users.get(id) || null;
  }

  saveUser(userData) {
    const id = userData._id ? userData._id.toString() : crypto.randomBytes(12).toString('hex');
    const user = {
      _id: id,
      id: id,
      name: userData.name,
      email: userData.email.toLowerCase().trim(),
      password: userData.password,
      role: userData.role || 'employee',
      createdAt: userData.createdAt || new Date(),
      toJSON() {
        const copy = { ...this };
        delete copy.password;
        delete copy._id;
        delete copy.__v;
        return copy;
      }
    };
    this.users.set(id, user);
    return user;
  }

  findEmployees() {
    const list = [];
    for (const user of this.users.values()) {
      if (user.role === 'employee') list.push(user);
    }
    return list;
  }

  // Locations
  updateLocation(employeeId, latitude, longitude) {
    const now = new Date();
    const locId = crypto.randomBytes(12).toString('hex');
    const location = {
      _id: locId,
      id: locId,
      employeeId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      recordedAt: now,
      updatedAt: now,
      toJSON() {
        return {
          id: this.id,
          employeeId: this.employeeId,
          latitude: this.latitude,
          longitude: this.longitude,
          recordedAt: this.recordedAt,
          updatedAt: this.updatedAt
        };
      }
    };
    this.locations.set(employeeId, location);
    return location;
  }

  getLocationByEmployeeId(employeeId) {
    return this.locations.get(employeeId) || null;
  }

  getAllLocations() {
    return Array.from(this.locations.values());
  }
}

const memoryStore = new InMemoryStore();

module.exports = memoryStore;
