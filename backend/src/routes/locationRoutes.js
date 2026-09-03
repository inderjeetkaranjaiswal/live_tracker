const express = require('express');
const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Location = require('../models/Location');
const User = require('../models/User');
const memoryStore = require('../utils/inMemoryStore');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const isDbConnected = () => mongoose.connection.readyState === 1;

const getIO = (req) => req.app.get('io');

/**
 * @route   POST /location/update
 * @desc    Submit employee's current GPS location (Employee only)
 * @access  Private (Employee)
 */
router.post(
  '/update',
  verifyToken,
  requireRole('employee'),
  [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation Error', errors: errors.array() });
    }

    const { latitude, longitude } = req.body;
    const employeeId = req.user.id;

    try {
      const now = new Date();
      let locationDoc;

      if (isDbConnected()) {
        locationDoc = await Location.findOneAndUpdate(
          { employeeId },
          {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            updatedAt: now,
            recordedAt: now
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
      } else {
        locationDoc = memoryStore.updateLocation(employeeId, latitude, longitude);
      }

      const responseData = {
        id: locationDoc._id ? locationDoc._id.toString() : locationDoc.id,
        employeeId,
        employeeName: req.user.name,
        employeeEmail: req.user.email,
        latitude: locationDoc.latitude,
        longitude: locationDoc.longitude,
        timestamp: locationDoc.updatedAt || now,
        updatedAt: locationDoc.updatedAt || now,
        isOnline: true
      };

      // Broadcast real-time location update via Socket.IO
      const io = getIO(req);
      if (io) {
        io.emit('location_updated', responseData);
        io.emit('employeeLocationUpdated', responseData);
      }

      return res.status(200).json({
        success: true,
        message: 'Location updated successfully',
        location: responseData
      });
    } catch (err) {
      console.error('Error updating location:', err);
      return res.status(500).json({ error: 'Server error', message: 'Failed to update employee location.' });
    }
  }
);

/**
 * @route   GET /location/all
 * @desc    Get latest live location for all employees (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/all',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      let employees = [];
      let locationMap = new Map();

      if (isDbConnected()) {
        const empDocs = await User.find({ role: 'employee' }).select('-password');
        employees = empDocs.map(e => e.toJSON());

        const empIds = employees.map(e => e.id);
        const locations = await Location.find({ employeeId: { $in: empIds } });
        locations.forEach(loc => {
          locationMap.set(loc.employeeId.toString(), loc);
        });
      } else {
        employees = memoryStore.findEmployees();
        memoryStore.getAllLocations().forEach(loc => {
          locationMap.set(loc.employeeId, loc);
        });
      }

      const results = employees.map(emp => {
        const empIdStr = emp.id;
        const loc = locationMap.get(empIdStr);

        return {
          employeeId: empIdStr,
          name: emp.name,
          email: emp.email,
          role: emp.role,
          latitude: loc ? loc.latitude : null,
          longitude: loc ? loc.longitude : null,
          updatedAt: loc ? loc.updatedAt : null,
          timestamp: loc ? loc.updatedAt : null,
          isOnline: loc ? (new Date() - new Date(loc.updatedAt) < 60000) : false
        };
      });

      return res.status(200).json({
        count: results.length,
        employees: results
      });
    } catch (err) {
      console.error('Error fetching all locations:', err);
      return res.status(500).json({ error: 'Server error', message: 'Failed to fetch employee locations.' });
    }
  }
);

/**
 * @route   GET /location/:employeeId
 * @desc    Get location status & details for a specific employee (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/:employeeId',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    const { employeeId } = req.params;

    try {
      let employee;
      let location;

      if (isDbConnected()) {
        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
          return res.status(400).json({ error: 'Validation Error', message: 'Invalid employee ID format' });
        }
        const empDoc = await User.findById(employeeId).select('-password');
        if (empDoc) employee = empDoc.toJSON();
        location = await Location.findOne({ employeeId });
      } else {
        employee = memoryStore.findUserById(employeeId);
        location = memoryStore.getLocationByEmployeeId(employeeId);
      }

      if (!employee) {
        return res.status(404).json({ error: 'Not Found', message: 'Employee not found.' });
      }

      return res.status(200).json({
        employee: {
          employeeId: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          latitude: location ? location.latitude : null,
          longitude: location ? location.longitude : null,
          updatedAt: location ? location.updatedAt : null,
          timestamp: location ? location.updatedAt : null,
          isOnline: location ? (new Date() - new Date(location.updatedAt) < 60000) : false
        }
      });
    } catch (err) {
      console.error('Error fetching employee location:', err);
      return res.status(500).json({ error: 'Server error', message: 'Failed to fetch employee location details.' });
    }
  }
);

module.exports = router;
