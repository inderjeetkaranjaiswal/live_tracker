const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const memoryStore = require('../utils/inMemoryStore');
const { getJwtSecret } = require('../utils/secretManager');

const router = express.Router();

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * @route   POST /auth/register
 * @desc    Register a new employee or admin user
 * @access  Public
 */
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('role').optional().isIn(['admin', 'employee']).withMessage('Role must be either admin or employee')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation Error', errors: errors.array() });
    }

    const { name, email, password, role } = req.body;

    try {
      let existingUser;
      if (isDbConnected()) {
        existingUser = await User.findOne({ email });
      } else {
        existingUser = memoryStore.findUserByEmail(email);
      }

      if (existingUser) {
        return res.status(409).json({ error: 'User already exists', message: 'An account with this email already exists.' });
      }

      // Hash password using bcrypt with 10 salt rounds
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      let savedUser;
      const userRole = role || 'employee';

      if (isDbConnected()) {
        const user = new User({ name, email, password: hashedPassword, role: userRole });
        await user.save();
        savedUser = user.toJSON();
      } else {
        const userObj = memoryStore.saveUser({ name, email, password: hashedPassword, role: userRole });
        savedUser = userObj.toJSON();
      }

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
      console.error('Registration error:', err);
      return res.status(500).json({ error: 'Server error', message: 'Failed to register user.' });
    }
  }
);

/**
 * @route   POST /auth/login
 * @desc    Authenticate user & return JWT token
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation Error', errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      let user;
      if (isDbConnected()) {
        user = await User.findOne({ email });
      } else {
        user = memoryStore.findUserByEmail(email);
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials', message: 'Email or password incorrect.' });
      }

      // Verify bcrypt password hash
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials', message: 'Email or password incorrect.' });
      }

      const userJson = typeof user.toJSON === 'function' ? user.toJSON() : { id: user.id, email: user.email, name: user.name, role: user.role };

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
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Server error', message: 'Failed to authenticate user.' });
    }
  }
);

module.exports = router;
