/**
 * Auth service.
 * Basic auth service with straightforward refresh-token flow.
 */

const db = require("../config/db");
const { comparePassword } = require("../utils/password.util");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt.util");
const crypto = require("crypto");

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
}

// Authenticates user credentials and builds login response data.
exports.login = async ({ email, password }) => {
  if (!email || !password) {
    throw new Error("Email and password required");
  }


  let userRows;
  try {
    [userRows] = await db.promise().query(
      `
      SELECT id, company_id, email, first_name, last_name, role, password_hash, is_active, last_login_at FROM users WHERE email = ? AND is_active = 1 LIMIT 1;
      `,
      [email],
    );
  } catch (err) {
    console.log("DB ERROR:", err);
    throw new Error("Invalid credentials");
  }

  if (!userRows.length) {
    throw new Error("Invalid credentials");
  }

  const user = userRows[0];
  const isValid = await comparePassword(password, user.password_hash);

  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  const token = generateAccessToken({
    user_id: user.id,
    role: user.role,
    company_id: user.company_id,
  });
  const refreshToken = generateRefreshToken({ user_id: user.id });
  const hashedRefreshToken = hashRefreshToken(refreshToken);

  await db.promise().query(
    `
    INSERT INTO refresh_tokens (user_id, token, expires_at, is_revoked, created_at)
    VALUES (?, ?, ?, false, NOW())
    `,
    [user.id, hashedRefreshToken, refreshExpiryDate()],
  );
  //updade last login time
  await db.promise().query(
    `
    UPDATE users SET last_login_at = NOW() WHERE id = ?
    `,
    [user.id],
  );
    


  return {
    message: "Login successful",
    token,
    refreshToken,
    role: user.role,
  };
};

// Rotates refresh token, revokes old token, and returns a new access token pair.
exports.refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new Error("Refresh token missing");
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new Error("Invalid refresh token");
  }

  const hashedIncomingToken = hashRefreshToken(refreshToken);
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [tokenRows] = await connection.query(
      `
      SELECT id, expires_at
      FROM refresh_tokens
      WHERE token = ? AND user_id = ? AND is_revoked = false
      LIMIT 1
      FOR UPDATE
      `,
      [hashedIncomingToken, decoded.user_id],
    );

    if (!tokenRows.length) {
      throw new Error("Refresh token not recognized");
    }

    const tokenRecord = tokenRows[0];

    if (new Date(tokenRecord.expires_at) <= new Date()) {
      throw new Error("Refresh token expired");
    }

    const [userRows] = await connection.query(
      `
      SELECT u.user_id, u.branch_id, r.role_name
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      WHERE u.user_id = ? AND u.is_active = 1
      LIMIT 1
      `,
      [decoded.user_id],
    );

    if (!userRows.length) {
      throw new Error("User not found");
    }

    const user = userRows[0];
    const nextAccessToken = generateAccessToken({
      user_id: user.user_id,
      role: user.role_name,
      branch_id: user.branch_id,
    });
    const nextRefreshToken = generateRefreshToken({ user_id: user.user_id });
    const hashedNextRefreshToken = hashRefreshToken(nextRefreshToken);

    await connection.query(
      `
      UPDATE refresh_tokens
      SET is_revoked = true
      WHERE id = ?
      `,
      [tokenRecord.id],
    );

    await connection.query(
      `
      INSERT INTO refresh_tokens (user_id, token, expires_at, is_revoked, created_at)
      VALUES (?, ?, ?, false, NOW())
      `,
      [user.user_id, hashedNextRefreshToken, refreshExpiryDate()],
    );

    await connection.commit();

    return {
      message: "Token refreshed",
      token: nextAccessToken,
      refreshToken: nextRefreshToken,
      role: user.role_name,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

// Revokes a refresh token represented by the plain token value from cookie.
exports.revokeRefreshToken = async (refreshToken) => {
  if (!refreshToken) return;

  const hashedRefreshToken = hashRefreshToken(refreshToken);

  await db.promise().query(
    `
    UPDATE refresh_tokens
    SET is_revoked = true
    WHERE token = ?
    `,
    [hashedRefreshToken],
  );
};