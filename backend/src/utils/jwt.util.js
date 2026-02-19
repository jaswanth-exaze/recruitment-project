/**
 * JWT helper utilities.
 */

const jwt = require("jsonwebtoken");
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

exports.REFRESH_COOKIE_NAME = "refreshToken";

// Signs a short-lived access token for authenticated sessions.
exports.generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

exports.generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};

// Verifies refresh token signature and expiry.
exports.verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
};

// Builds cookie options for refresh token delivery across environments.
exports.getRefreshCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: "/auth",
  };
};
