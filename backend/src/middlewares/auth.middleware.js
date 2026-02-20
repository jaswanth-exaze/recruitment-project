const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const parts = authHeader.split(" ");
  const token = parts[0] === "Bearer" ? parts[1] : null;

  if (!token) {
    return res.status(401).json({ message: "Bearer token missing" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Session expired. Please log in again.",
        });
      }

      return res.status(401).json({
        message: "Invalid token. Please log in again.",
      });
    }

    req.user = decoded;
    next();
  });
};
