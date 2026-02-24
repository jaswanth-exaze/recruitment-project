const db = require("../config/db");
const { hashPassword } = require("../utils/password.util");
const {
  sendCompanyAdminOnboardingEmail,
  sendTeamMemberCredentialsEmail,
} = require("./recruitmentEmail.service");

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

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0) return null;
  return Math.trunc(parsed);
}

function parseIsActiveFilter(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "active", "enabled"].includes(normalized)) return 1;
  if (["0", "false", "inactive", "disabled"].includes(normalized)) return 0;
  return null;
}

const AUDIT_LOG_SELECT_SQL = `
  SELECT
    al.id,
    al.user_id,
    CONCAT_WS(' ', actor.first_name, actor.last_name) AS actor_name,
    actor.email AS actor_email,
    actor.role AS actor_role,
    COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(al.new_data, '$.company_id')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(al.old_data, '$.company_id')), ''),
      CAST(actor.company_id AS CHAR)
    ) AS company_id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.old_data,
    al.new_data,
    al.ip_address,
    al.created_at
  FROM audit_logs al
  LEFT JOIN users actor ON al.user_id = actor.id
`;

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

exports.listActiveCompanies = async ({ isActive = null } = {}) => {
  const where = [];
  const params = [];
  const parsedIsActive = parseIsActiveFilter(isActive);

  if (parsedIsActive !== null) {
    where.push("c.is_active = ?");
    params.push(parsedIsActive);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await db.promise().query(
    `
      SELECT
        c.id,
        c.name,
        c.domain,
        c.is_active,
        c.created_at,
        c.updated_at,
        (
          SELECT u.email
          FROM users u
          WHERE u.company_id = c.id AND u.role = 'CompanyAdmin'
          ORDER BY u.id ASC
          LIMIT 1
        ) AS company_admin_email
      FROM companies c
      ${whereSql}
      ORDER BY c.is_active DESC, c.name ASC
    `,
    params,
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
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();

    const [companyRows] = await connection.query(
      `SELECT id FROM companies WHERE id = ? LIMIT 1 FOR UPDATE`,
      [id],
    );
    if (!companyRows.length) {
      await connection.rollback();
      return 0;
    }

    await connection.query(
      `UPDATE companies SET is_active = 0, updated_at = NOW() WHERE id = ?`,
      [id],
    );
    await connection.query(
      `UPDATE users SET is_active = 0, updated_at = NOW() WHERE company_id = ?`,
      [id],
    );

    await connection.commit();
    return 1;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.activateCompany = async (id) => {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();

    const [companyRows] = await connection.query(
      `SELECT id FROM companies WHERE id = ? LIMIT 1 FOR UPDATE`,
      [id],
    );
    if (!companyRows.length) {
      await connection.rollback();
      return 0;
    }

    await connection.query(
      `UPDATE companies SET is_active = 1, updated_at = NOW() WHERE id = ?`,
      [id],
    );
    await connection.query(
      `UPDATE users SET is_active = 1, updated_at = NOW() WHERE company_id = ?`,
      [id],
    );

    await connection.commit();
    return 1;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.listUsersByRole = async (role, { companyId = null, isActive = null } = {}) => {
  const where = ["u.role = ?"];
  const params = [role];

  const parsedCompanyId = parsePositiveInt(companyId);
  if (parsedCompanyId) {
    where.push("u.company_id = ?");
    params.push(parsedCompanyId);
  }

  const parsedIsActive = parseIsActiveFilter(isActive);
  if (parsedIsActive !== null) {
    where.push("u.is_active = ?");
    params.push(parsedIsActive);
  }

  const [rows] = await db.promise().query(
    `
      SELECT
        u.id,
        u.company_id,
        c.name AS company_name,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.is_active,
        u.created_at
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE ${where.join(" AND ")}
      ORDER BY u.is_active DESC, COALESCE(c.name, ''), u.last_name ASC, u.first_name ASC
    `,
    params,
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

  if (role === "CompanyAdmin") {
    await sendCompanyAdminOnboardingEmail({
      email,
      firstName: first_name,
      lastName: last_name,
      password,
      companyId: company_id || null,
    });
  } else if (["HR", "HiringManager", "Interviewer"].includes(role)) {
    await sendTeamMemberCredentialsEmail({
      email,
      firstName: first_name,
      lastName: last_name,
      role,
      password,
      companyId: company_id || null,
    });
  }

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
    `
      ${AUDIT_LOG_SELECT_SQL}
      WHERE al.entity_type = ? AND al.entity_id = ?
      ORDER BY al.created_at DESC
    `,
    [entityType, entityId],
  );
  rows.forEach((row) => {
    row.company_id = parsePositiveInt(row.company_id);
    row.old_data = parseJsonField(row.old_data);
    row.new_data = parseJsonField(row.new_data);
  });
  return rows;
};

exports.getAllAuditLogs = async () => {
  const [rows] = await db.promise().query(
    `
      ${AUDIT_LOG_SELECT_SQL}
      ORDER BY al.created_at DESC
    `,
  );
  rows.forEach((row) => {
    row.company_id = parsePositiveInt(row.company_id);
    row.old_data = parseJsonField(row.old_data);
    row.new_data = parseJsonField(row.new_data);
  });
  return rows;
};

exports.listContactRequests = async ({ work_email, company_name } = {}) => {
  const where = [];
  const params = [];

  if (work_email) {
    where.push("work_email LIKE ?");
    params.push(`%${String(work_email).trim()}%`);
  }
  if (company_name) {
    where.push("company_name LIKE ?");
    params.push(`%${String(company_name).trim()}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await db.promise().query(
    `
      SELECT
        id,
        full_name,
        work_email,
        company_name,
        role,
        message,
        agreed_to_contact,
        created_at
      FROM contact_requests
      ${whereSql}
      ORDER BY created_at DESC
    `,
    params,
  );

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
