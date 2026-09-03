const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Securely retrieves or generates a JWT secret key following multi-tiered fallback.
 */
function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim() !== '') {
    return process.env.JWT_SECRET.trim();
  }

  const localSecretPath = path.join(__dirname, '../../jwt_secret.txt');
  if (fs.existsSync(localSecretPath)) {
    try {
      const fileSecret = fs.readFileSync(localSecretPath, 'utf-8').trim();
      if (fileSecret) return fileSecret;
    } catch (err) {
      console.warn('Could not read jwt_secret.txt:', err.message);
    }
  }

  // Generate an ephemeral secret key if non-existent
  console.warn('SECURITY NOTICE: Generating ephemeral JWT secret. Session invalidation on server restart!');
  const generatedSecret = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(localSecretPath, generatedSecret, 'utf-8');
  } catch (e) {
    // Ignore write failure if directory is read-only
  }
  return generatedSecret;
}

module.exports = {
  getJwtSecret
};
