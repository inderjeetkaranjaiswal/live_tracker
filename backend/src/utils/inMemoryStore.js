const crypto = require('crypto');

/**
 * In-memory buffer for real-time ephemeral location coordinates.
 * NOTE: User authentication and credentials DO NOT use in-memory stores.
 * MongoDB is the sole source of truth for all authentication.
 */
class InMemoryStore {
  constructor() {
    this.locations = new Map();
  }

  // Locations buffer
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

  findEmployees() {
    // Deprecated — all employee queries strictly use MongoDB User collection
    return [];
  }
}

const memoryStore = new InMemoryStore();

module.exports = memoryStore;
