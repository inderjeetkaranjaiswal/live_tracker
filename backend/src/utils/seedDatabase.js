const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Seeds default admin and employee users into MongoDB Atlas if they don't exist.
 * This runs once after a successful DB connection.
 */
const seedDatabase = async () => {
  if (mongoose.connection.readyState !== 1) return;

  try {
    // Ensure only Inderjeet remains as admin, purge all other admin/legacy accounts
    await User.deleteMany({
      $or: [
        { email: 'admin@livetracker.com' },
        { role: 'admin', email: { $ne: 'admin@livetracker.com' } }
      ]
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('REDACTED_TEST_PASSWORD', salt);

    // Upsert Inderjeet as the sole Admin with password 'REDACTED_TEST_PASSWORD'
    await User.findOneAndUpdate(
      { email: 'admin@livetracker.com' },
      {
        name: 'Inderjeet Jaiswal',
        email: 'admin@livetracker.com',
        password: hashedPassword,
        role: 'admin'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('[Seed] ✅ Sole admin guaranteed: admin@livetracker.com / REDACTED_TEST_PASSWORD');

    const empExists = await User.findOne({ email: 'employee@livetracker.com' });
    if (!empExists) {
      const salt = await bcrypt.genSalt(10);
      await User.create({
        name: 'Field Officer',
        email: 'employee@livetracker.com',
        password: await bcrypt.hash('EmployeePassword123!', salt),
        role: 'employee'
      });
      console.log('[Seed] ✅ Employee user created: employee@livetracker.com / EmployeePassword123!');
    }

    console.log('[Seed] ✅ Database seeding complete.');
  } catch (err) {
    console.error('[Seed] ❌ Seeding error:', err.message);
  }
};

module.exports = seedDatabase;
