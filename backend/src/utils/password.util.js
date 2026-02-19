/**
 * Password helper utilities.
 */

const bcrypt = require("bcrypt");

// Compares plaintext credential input with stored bcrypt hash.
exports.comparePassword = (plain, hash) => {
  return bcrypt.compare(plain, hash);
};

