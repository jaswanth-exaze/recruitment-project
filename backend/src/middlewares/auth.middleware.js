const jwt = require("jsonwebtoken");
const db = require("../config/db");

async function resolveAuthorizedUser(userId) {
  const [rows] = await db.promise().query(
    `
      SELECT
        u.id,
        u.role,
        u.company_id,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        c.is_active AS company_is_active
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId],
  );

  const user = rows[0] || null;
  if (!user || !user.is_active) return null;
  if (user.company_id && Number(user.company_is_active) !== 1) return null;

  return {
    user_id: user.id,
    role: user.role,
    company_id: user.company_id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  };
}

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

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
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

    try {
      const authorizedUser = await resolveAuthorizedUser(decoded.user_id);
      if (!authorizedUser) {
        return res.status(401).json({
          message: "Account is inactive. Please contact admin.",
        });
      }

      req.user = authorizedUser;
      return next();
    } catch (dbErr) {
      return res.status(500).json({
        message: "Unable to validate session. Please try again.",
      });
    }
  });
};
