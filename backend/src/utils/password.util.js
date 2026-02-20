/**
 * Password helper utilities.
 */

const bcrypt = require("bcrypt");
const SALT_ROUNDS = 10;

// Compares plaintext credential input with stored bcrypt hash.
exports.comparePassword = (plain, hash) => {
  return bcrypt.compare(plain, hash);
};

exports.hashPassword = (plain) => {
  return bcrypt.hash(plain, SALT_ROUNDS);
};
