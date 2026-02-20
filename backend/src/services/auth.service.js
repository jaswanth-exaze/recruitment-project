const crypto = require("crypto");
const db = require("../config/db");
const { comparePassword } = require("../utils/password.util");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt.util");

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
}

exports.login = async ({ email, password }) => {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const [rows] = await db.promise().query(
    `
      SELECT id, company_id, email, first_name, last_name, role, password_hash, is_active, last_login_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email],
  );

  if (!rows.length || !rows[0].is_active) {
    throw new Error("Invalid credentials");
  }

  const user = rows[0];
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

  await db.promise().query(
    `
      INSERT INTO refresh_tokens (user_id, token, expires_at, is_revoked, created_at)
      VALUES (?, ?, ?, false, NOW())
    `,
    [user.id, hashRefreshToken(refreshToken), refreshExpiryDate()],
  );

  await db.promise().query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [
    user.id,
  ]);

  return {
    message: "Login successful",
    token,
    refreshToken,
    role: user.role,
  };
};

exports.getProfile = async (userId) => {
  const [rows] = await db.promise().query(
    `
      SELECT id, company_id, email, first_name, last_name, role, is_active, last_login_at, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );

  if (!rows.length) {
    throw new Error("User not found");
  }

  return rows[0];
};

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

    if (new Date(tokenRows[0].expires_at) <= new Date()) {
      throw new Error("Refresh token expired");
    }

    const [userRows] = await connection.query(
      `
        SELECT id, company_id, role, is_active
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [decoded.user_id],
    );

    if (!userRows.length || !userRows[0].is_active) {
      throw new Error("User not found or inactive");
    }

    const user = userRows[0];

    const nextAccessToken = generateAccessToken({
      user_id: user.id,
      role: user.role,
      company_id: user.company_id,
    });
    const nextRefreshToken = generateRefreshToken({ user_id: user.id });

    await connection.query(
      `
        UPDATE refresh_tokens
        SET is_revoked = true
        WHERE id = ?
      `,
      [tokenRows[0].id],
    );

    await connection.query(
      `
        INSERT INTO refresh_tokens (user_id, token, expires_at, is_revoked, created_at)
        VALUES (?, ?, ?, false, NOW())
      `,
      [user.id, hashRefreshToken(nextRefreshToken), refreshExpiryDate()],
    );

    await connection.commit();

    return {
      message: "Token refreshed",
      token: nextAccessToken,
      refreshToken: nextRefreshToken,
      role: user.role,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.revokeRefreshToken = async (refreshToken) => {
  if (!refreshToken) return;
  await db.promise().query(
    `
      UPDATE refresh_tokens
      SET is_revoked = true
      WHERE token = ?
    `,
    [hashRefreshToken(refreshToken)],
  );
};
