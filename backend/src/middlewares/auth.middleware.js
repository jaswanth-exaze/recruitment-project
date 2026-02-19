/**
 * Authentication middleware.
 * Verifies JWT tokens and attaches decoded user identity to `req.user`.
 */

const jwt = require("jsonwebtoken");

// Validates bearer token and blocks unauthorized requests.
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  // Verify token signature and expiry.
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Session expired. Please log in again."
        });
      }

      return res.status(401).json({
        message: "Invalid token. Please log in again."
      });
    }

    // Attach decoded claims for downstream role and branch checks.
    req.user = decoded; // { user_id, role, branch_id }
    
    next();
  });
};
