const crypto = require("crypto");
const db = require("../config/db");
const { comparePassword, hashPassword } = require("../utils/password.util");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt.util");
const { sendCandidateSignupWelcomeEmail } = require("./recruitmentEmail.service");

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
      SELECT
        u.id,
        u.company_id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.password_hash,
        u.is_active,
        u.last_login_at,
        c.is_active AS company_is_active
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE u.email = ?
      LIMIT 1
    `,
    [email],
  );

  if (!rows.length || !rows[0].is_active) {
    throw new Error("Invalid credentials");
  }

  const user = rows[0];
  if (user.company_id && Number(user.company_is_active) !== 1) {
    throw new Error("Your company account is inactive. Contact Platform Admin.");
  }

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

exports.signupCandidate = async (payload) => {
  const { email, password, first_name, last_name, phone, address, profile_data } = payload || {};
  if (!email || !password || !first_name || !last_name) {
    throw new Error("email, password, first_name, and last_name are required");
  }

  let profileData = null;
  if (profile_data !== undefined && profile_data !== null && profile_data !== "") {
    if (typeof profile_data === "string") {
      try {
        profileData = JSON.parse(profile_data);
      } catch (error) {
        throw new Error("profile_data must be valid JSON");
      }
    } else if (typeof profile_data === "object") {
      profileData = profile_data;
    } else {
      throw new Error("profile_data must be valid JSON");
    }
  }

  const passwordHash = await hashPassword(password);
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [userResult] = await connection.query(
      `
        INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
        VALUES (NULL, ?, ?, ?, ?, 'Candidate', 1, NOW(), NOW())
      `,
      [email, passwordHash, first_name, last_name],
    );

    const userId = userResult.insertId;

    await connection.query(
      `
        INSERT INTO candidate_profiles (user_id, phone, address, resume_url, profile_data, is_verified, created_at, updated_at)
        VALUES (?, ?, ?, NULL, ?, 0, NOW(), NOW())
      `,
      [userId, phone || null, address || null, profileData ? JSON.stringify(profileData) : null],
    );

    const token = generateAccessToken({
      user_id: userId,
      role: "Candidate",
      company_id: null,
    });
    const refreshToken = generateRefreshToken({ user_id: userId });

    await connection.query(
      `
        INSERT INTO refresh_tokens (user_id, token, expires_at, is_revoked, created_at)
        VALUES (?, ?, ?, false, NOW())
      `,
      [userId, hashRefreshToken(refreshToken), refreshExpiryDate()],
    );

    await connection.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [userId]);

    await connection.commit();

    await sendCandidateSignupWelcomeEmail({
      email,
      firstName: first_name,
      lastName: last_name,
    });

    return {
      message: "Signup successful",
      token,
      refreshToken,
      role: "Candidate",
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.getProfile = async (userId) => {
  const [rows] = await db.promise().query(
    `
      SELECT
        u.id,
        u.company_id,
        c.name AS company_name,
        c.logo_url AS company_logo_url,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.is_active,
        u.last_login_at,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = ?
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
        SELECT
          u.id,
          u.company_id,
          u.role,
          u.is_active,
          c.is_active AS company_is_active
        FROM users u
        LEFT JOIN companies c ON c.id = u.company_id
        WHERE u.id = ?
        LIMIT 1
      `,
      [decoded.user_id],
    );

    if (!userRows.length || !userRows[0].is_active) {
      throw new Error("User not found or inactive");
    }

    const user = userRows[0];
    if (user.company_id && Number(user.company_is_active) !== 1) {
      throw new Error("Your company account is inactive. Contact Platform Admin.");
    }

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
