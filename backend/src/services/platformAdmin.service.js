const db = require("../config/db");
const { hashPassword } = require("../utils/password.util");

function parseJsonField(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      return value;
    }
  }
  return value;
}

async function getUserProfileById(userId) {
  const [rows] = await db.promise().query(
    `
      SELECT id, company_id, email, first_name, last_name, role, is_active, last_login_at, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );
  return rows[0] || null;
}

exports.getMyProfile = async (userId) => getUserProfileById(userId);

exports.updateMyProfile = async (userId, body) => {
  const { first_name, last_name, email } = body;
  if (!first_name || !last_name || !email) {
    throw new Error("first_name, last_name and email are required");
  }
  await db.promise().query(
    `UPDATE users SET first_name = ?, last_name = ?, email = ?, updated_at = NOW() WHERE id = ?`,
    [first_name, last_name, email, userId],
  );
  return getUserProfileById(userId);
};

exports.listActiveCompanies = async () => {
  const [rows] = await db.promise().query(
    `SELECT id, name, domain, is_active, created_at FROM companies WHERE is_active = 1 ORDER BY name`,
  );
  return rows;
};

exports.getCompanyById = async (id) => {
  const [rows] = await db.promise().query(
    `SELECT id, name, domain, is_active, created_at, updated_at FROM companies WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
};

exports.countActiveCompanies = async () => {
  const [rows] = await db.promise().query(`SELECT COUNT(*) AS total FROM companies WHERE is_active = 1`);
  return rows[0];
};

exports.createCompany = async ({ name, domain }) => {
  if (!name) throw new Error("name is required");
  const [result] = await db.promise().query(
    `INSERT INTO companies (name, domain, is_active, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())`,
    [name, domain || null],
  );
  return { id: result.insertId };
};

exports.updateCompany = async (id, { name, domain }) => {
  if (!name) throw new Error("name is required");
  const [result] = await db.promise().query(
    `UPDATE companies SET name = ?, domain = ?, updated_at = NOW() WHERE id = ?`,
    [name, domain || null, id],
  );
  return result.affectedRows;
};

exports.deactivateCompany = async (id) => {
  const [result] = await db.promise().query(
    `UPDATE companies SET is_active = 0, updated_at = NOW() WHERE id = ?`,
    [id],
  );
  return result.affectedRows;
};

exports.activateCompany = async (id) => {
  const [result] = await db.promise().query(
    `UPDATE companies SET is_active = 1, updated_at = NOW() WHERE id = ?`,
    [id],
  );
  return result.affectedRows;
};

exports.listUsersByRole = async (role) => {
  const [rows] = await db.promise().query(
    `SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE role = ? AND is_active = 1 ORDER BY last_name, first_name`,
    [role],
  );
  return rows;
};

exports.getUserById = async (id) => {
  const [rows] = await db.promise().query(
    `SELECT id, company_id, email, first_name, last_name, role, is_active, last_login_at, created_at, updated_at FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
};

exports.createUser = async (payload) => {
  const { company_id, email, password, first_name, last_name, role } = payload;
  if (!email || !password || !first_name || !last_name || !role) {
    throw new Error("company_id(optional), email, password, first_name, last_name and role are required");
  }
  const passwordHash = await hashPassword(password);
  const [result] = await db.promise().query(
    `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [company_id || null, email, passwordHash, first_name, last_name, role],
  );
  return { id: result.insertId };
};

exports.updateUser = async (id, payload) => {
  const { first_name, last_name, email, role, company_id } = payload;
  if (!first_name || !last_name || !email || !role) {
    throw new Error("first_name, last_name, email and role are required");
  }
  const [result] = await db.promise().query(
    `UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, company_id = ?, updated_at = NOW() WHERE id = ?`,
    [first_name, last_name, email, role, company_id || null, id],
  );
  return result.affectedRows;
};

exports.deactivateUser = async (id) => {
  const [result] = await db.promise().query(
    `UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?`,
    [id],
  );
  return result.affectedRows;
};

exports.activateUser = async (id) => {
  const [result] = await db.promise().query(
    `UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?`,
    [id],
  );
  return result.affectedRows;
};

exports.countUsersByRole = async (role) => {
  const [rows] = await db.promise().query(
    `SELECT COUNT(*) AS total FROM users WHERE role = ? AND is_active = 1`,
    [role],
  );
  return rows[0];
};

exports.insertAuditLog = async (payload) => {
  const { user_id, action, entity_type, entity_id, old_data, new_data, ip_address } = payload;
  if (!action || !entity_type || !entity_id) {
    throw new Error("action, entity_type and entity_id are required");
  }
  const [result] = await db.promise().query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      user_id || null,
      action,
      entity_type,
      entity_id,
      old_data ? JSON.stringify(old_data) : null,
      new_data ? JSON.stringify(new_data) : null,
      ip_address || null,
    ],
  );
  return { id: result.insertId };
};

exports.getAuditTrail = async (entityType, entityId) => {
  const [rows] = await db.promise().query(
    `SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC`,
    [entityType, entityId],
  );
  rows.forEach((row) => {
    row.old_data = parseJsonField(row.old_data);
    row.new_data = parseJsonField(row.new_data);
  });
  return rows;
};

exports.insertBackgroundJob = async ({ job_type, payload, scheduled_at }) => {
  if (!job_type) throw new Error("job_type is required");
  const [result] = await db.promise().query(
    `INSERT INTO background_jobs (job_type, payload, status, scheduled_at, created_at) VALUES (?, ?, 'pending', COALESCE(?, NOW()), NOW())`,
    [job_type, payload ? JSON.stringify(payload) : null, scheduled_at || null],
  );
  return { id: result.insertId };
};

exports.getPendingJobs = async () => {
  const [rows] = await db.promise().query(
    `SELECT * FROM background_jobs WHERE status = 'pending' AND scheduled_at <= NOW() ORDER BY scheduled_at LIMIT 10`,
  );
  rows.forEach((row) => {
    row.payload = parseJsonField(row.payload);
  });
  return rows;
};

exports.completeBackgroundJob = async (id) => {
  const [result] = await db.promise().query(
    `UPDATE background_jobs SET status = 'completed', completed_at = NOW() WHERE id = ?`,
    [id],
  );
  return result.affectedRows;
};

exports.failBackgroundJob = async (id, errorMessage) => {
  const [result] = await db.promise().query(
    `UPDATE background_jobs SET status = 'failed', error_message = ?, retries = retries + 1 WHERE id = ?`,
    [errorMessage || null, id],
  );
  return result.affectedRows;
};
