/**
 * Authorization middleware factory.
 * Restricts endpoint access to one or more allowed role names.
 */

// Returns middleware that denies requests when user role is not permitted.
exports.checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};
