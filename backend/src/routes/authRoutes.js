const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isDbConnected } = require('../config/database');
const { getJwtSecret } = require('../utils/secretManager');

const router = express.Router();

/**
 * Helper to check if an error is database-connectivity related.
 */
function isDbError(err) {
  if (!err) return false;
  const name = err.name || '';
  const msg = err.message || '';
  return (
    name === 'MongoNetworkError' ||
    name === 'MongoServerSelectionError' ||
    name === 'MongooseServerSelectionError' ||
    name === 'MongoTimeoutError' ||
    msg.includes('buffering timed out') ||
    msg.includes('connection timed out') ||
    msg.includes('Topology was destroyed') ||
    msg.includes('server selection')
  );
}

/**
 * @route   POST /auth/register
 * @desc    Register a new employee or admin user in MongoDB
 * @access  Public
 */
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('role').optional().isIn(['admin', 'employee']).withMessage('Role must be either admin or employee')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation Error', errors: errors.array() });
    }

    // Strictly verify MongoDB availability — NO in-memory fallback
    if (!isDbConnected()) {
      return res.status(503).json({
        error: 'Database unavailable',
        message: 'Server temporarily unavailable. Please try again.'
      });
    }

    const { name, email, password, role } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    try {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          message: 'An account with this email already exists.'
        });
      }

      // Hash password using bcrypt with 10 salt rounds
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const userRole = role || 'employee';
      const user = new User({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: userRole
      });
      await user.save();
      const savedUser = user.toJSON();

      // Sign JWT token
      const secret = getJwtSecret();
      const token = jwt.sign(
        { id: savedUser.id, email: savedUser.email, role: savedUser.role, name: savedUser.name },
        secret,
        { algorithm: 'HS256', expiresIn: '24h' }
      );

      return res.status(201).json({
        message: 'User registered successfully',
        token,
        user: savedUser
      });
    } catch (err) {
      console.error('[Auth Register] Error:', err.message || err);
      if (isDbError(err)) {
        return res.status(503).json({
          error: 'Database unavailable',
          message: 'Server temporarily unavailable. Please try again.'
        });
      }
      return res.status(500).json({
        error: 'Server error',
        message: 'Failed to register user.'
      });
    }
  }
);

/**
 * @route   POST /auth/login
 * @desc    Authenticate user against MongoDB & return JWT token
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation Error', errors: errors.array() });
    }

    // Strictly verify MongoDB availability — NEVER return 401 when DB is down
    if (!isDbConnected()) {
      return res.status(503).json({
        error: 'Database unavailable',
        message: 'Server temporarily unavailable. Please try again.'
      });
    }

    const { email, password } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    try {
      // Query MongoDB as the SOLE source of truth
      const user = await User.findOne({ email: normalizedEmail });

      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials',
          message: 'Invalid email or password.'
        });
      }

      // Verify bcrypt password hash
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          error: 'Invalid credentials',
          message: 'Invalid email or password.'
        });
      }

      const userJson = typeof user.toJSON === 'function'
        ? user.toJSON()
        : { id: user._id.toString(), email: user.email, name: user.name, role: user.role };

      // Sign JWT token
      const secret = getJwtSecret();
      const token = jwt.sign(
        { id: userJson.id, email: userJson.email, role: userJson.role, name: userJson.name },
        secret,
        { algorithm: 'HS256', expiresIn: '24h' }
      );

      return res.status(200).json({
        message: 'Login successful',
        token,
        user: userJson
      });
    } catch (err) {
      console.error('[Auth Login] Error:', err.message || err);
      if (isDbError(err)) {
        return res.status(503).json({
          error: 'Database unavailable',
          message: 'Server temporarily unavailable. Please try again.'
        });
      }
      return res.status(500).json({
        error: 'Server error',
        message: 'Failed to authenticate user.'
      });
    }
  }
);

module.exports = router;
