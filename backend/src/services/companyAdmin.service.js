const db = require("../config/db");
const { hashPassword } = require("../utils/password.util");

const MANAGED_ROLES = new Set(["HR", "HiringManager", "Interviewer"]);

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

function normalizeRole(role) {
  return String(role || "").trim();
}

function assertManagedRole(role) {
  const normalized = normalizeRole(role);
  if (!MANAGED_ROLES.has(normalized)) {
    throw new Error("role must be HR, HiringManager, or Interviewer");
  }
  return normalized;
}

async function getUserProfileById(userId) {
  const [rows] = await db.promise().query(
    `SELECT id, company_id, email, first_name, last_name, role, is_active, last_login_at, created_at, updated_at FROM users WHERE id = ? LIMIT 1`,
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

exports.listUsersByRole = async (role, companyId, includeInactive = false) => {
  if (!companyId) throw new Error("company_id is required");
  const validRole = assertManagedRole(role);
  const activeFilterSql = includeInactive ? "" : " AND is_active = 1";
  const [rows] = await db.promise().query(
    `SELECT id, company_id, email, first_name, last_name, role, is_active, created_at FROM users WHERE role = ? AND company_id = ?${activeFilterSql} ORDER BY last_name, first_name`,
    [validRole, companyId],
  );
  return rows;
};

exports.getUserById = async (id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `SELECT id, company_id, email, first_name, last_name, role, is_active, last_login_at, created_at, updated_at FROM users WHERE id = ? AND company_id = ? LIMIT 1`,
    [id, companyId],
  );
  return rows[0] || null;
};

exports.createUser = async (payload, companyId) => {
  const { company_id, email, password, first_name, last_name, role } = payload;
  const resolvedCompanyId = companyId || company_id;
  if (!email || !password || !first_name || !last_name || !role) {
    throw new Error("company_id(optional), email, password, first_name, last_name and role are required");
  }
  const validRole = assertManagedRole(role);
  if (!resolvedCompanyId) throw new Error("company_id is required");
  if (companyId && company_id && Number(company_id) !== Number(companyId)) {
    throw new Error("Cannot create users outside your company");
  }
  const passwordHash = await hashPassword(password);
  const [result] = await db.promise().query(
    `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [resolvedCompanyId, email, passwordHash, first_name, last_name, validRole],
  );
  return { id: result.insertId };
};

exports.updateUser = async (id, payload, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const { first_name, last_name, email, role, company_id } = payload;
  if (!first_name || !last_name || !email || !role) {
    throw new Error("first_name, last_name, email and role are required");
  }
  const validRole = assertManagedRole(role);
  if (company_id && Number(company_id) !== Number(companyId)) {
    throw new Error("Cannot move users outside your company");
  }
  const [result] = await db.promise().query(
    `UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, company_id = ?, updated_at = NOW() WHERE id = ? AND company_id = ?`,
    [first_name, last_name, email, validRole, companyId, id, companyId],
  );
  return result.affectedRows;
};

exports.deactivateUser = async (id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ? AND company_id = ?`,
    [id, companyId],
  );
  return result.affectedRows;
};

exports.activateUser = async (id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ? AND company_id = ?`,
    [id, companyId],
  );
  return result.affectedRows;
};

exports.countUsersByRole = async (role, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const validRole = assertManagedRole(role);
  const [rows] = await db.promise().query(
    `SELECT COUNT(*) AS total FROM users WHERE role = ? AND company_id = ? AND is_active = 1`,
    [validRole, companyId],
  );
  return rows[0];
};

exports.listJobs = async ({ status, company_id }, companyId) => {
  const where = [];
  const params = [];
  const resolvedCompanyId = companyId || company_id;
  if (!resolvedCompanyId) throw new Error("company_id is required");
  if (status) {
    where.push("j.status = ?");
    params.push(status);
  }
  where.push("j.company_id = ?");
  params.push(resolvedCompanyId);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await db.promise().query(
    `SELECT j.id, j.title, j.description, j.location, j.employment_type, j.status, j.positions_count, j.created_at, c.name AS company_name FROM job_requisitions j JOIN companies c ON j.company_id = c.id ${whereSql} ORDER BY j.created_at DESC`,
    params,
  );
  return rows;
};

exports.getJobById = async (id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `SELECT j.*, c.name AS company_name, u.first_name AS creator_first, u.last_name AS creator_last FROM job_requisitions j JOIN companies c ON j.company_id = c.id JOIN users u ON j.created_by = u.id WHERE j.id = ? AND j.company_id = ? LIMIT 1`,
    [id, companyId],
  );
  return rows[0] || null;
};

exports.createJobDraft = async (payload) => {
  const { company_id, created_by, title, description, requirements, location, employment_type, positions_count } = payload;
  if (!company_id || !created_by || !title) throw new Error("company_id, created_by and title are required");
  const [result] = await db.promise().query(
    `INSERT INTO job_requisitions (company_id, created_by, title, description, requirements, location, employment_type, status, positions_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, NOW(), NOW())`,
    [
      company_id,
      created_by,
      title,
      description || null,
      requirements || null,
      location || null,
      employment_type || "Full-time",
      positions_count || 1,
    ],
  );
  return { id: result.insertId };
};

exports.updateJob = async (id, payload, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const { title, description, requirements, location, employment_type, positions_count } = payload;
  const [result] = await db.promise().query(
    `UPDATE job_requisitions SET title = ?, description = ?, requirements = ?, location = ?, employment_type = ?, positions_count = ?, updated_at = NOW() WHERE id = ? AND company_id = ? AND status IN ('draft', 'pending')`,
    [
      title,
      description || null,
      requirements || null,
      location || null,
      employment_type || "Full-time",
      positions_count || 1,
      id,
      companyId,
    ],
  );
  return result.affectedRows;
};

exports.submitJob = async (jobId, approverId, companyId) => {
  if (!approverId) throw new Error("approver_id is required");
  if (!companyId) throw new Error("company_id is required");
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [approverRows] = await connection.query(
      `SELECT id FROM users WHERE id = ? AND company_id = ? LIMIT 1`,
      [approverId, companyId],
    );
    if (!approverRows.length) {
      await connection.rollback();
      throw new Error("approver_id is not part of your company");
    }

    const [jobResult] = await connection.query(
      `UPDATE job_requisitions SET status = 'pending', updated_at = NOW() WHERE id = ? AND company_id = ?`,
      [jobId, companyId],
    );
    if (!jobResult.affectedRows) {
      await connection.rollback();
      return 0;
    }
    await connection.query(
      `INSERT INTO job_approvals (job_id, approver_id, status, created_at, updated_at) VALUES (?, ?, 'pending', NOW(), NOW()) ON DUPLICATE KEY UPDATE status = 'pending', comments = NULL, approved_at = NULL, updated_at = NOW()`,
      [jobId, approverId],
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

exports.publishJob = async (id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE job_requisitions SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = ? AND company_id = ?`,
    [id, companyId],
  );
  return result.affectedRows;
};

exports.closeJob = async (id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE job_requisitions SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = ? AND company_id = ?`,
    [id, companyId],
  );
  return result.affectedRows;
};

exports.listApplicationsForJob = async (jobId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `SELECT a.*, u.first_name, u.last_name, u.email, cp.resume_url FROM applications a JOIN job_requisitions j ON a.job_id = j.id JOIN users u ON a.candidate_id = u.id LEFT JOIN candidate_profiles cp ON u.id = cp.user_id WHERE a.job_id = ? AND j.company_id = ? ORDER BY a.applied_at DESC`,
    [jobId, companyId],
  );
  return rows;
};

exports.moveApplicationStage = async (id, status, current_stage_id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE applications a JOIN job_requisitions j ON a.job_id = j.id SET a.status = ?, a.current_stage_id = ?, a.updated_at = NOW() WHERE a.id = ? AND j.company_id = ?`,
    [status, current_stage_id || null, id, companyId],
  );
  return result.affectedRows;
};

exports.screenDecision = async (id, status, companyId) => {
  if (!["rejected", "interview"].includes(status)) throw new Error("status must be rejected or interview");
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE applications a JOIN job_requisitions j ON a.job_id = j.id SET a.status = ?, a.screening_decision_at = NOW(), a.updated_at = NOW() WHERE a.id = ? AND j.company_id = ?`,
    [status, id, companyId],
  );
  return result.affectedRows;
};

exports.finalDecision = async (id, status, companyId) => {
  if (!["selected", "rejected"].includes(status)) throw new Error("status must be selected or rejected");
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE applications a JOIN job_requisitions j ON a.job_id = j.id SET a.status = ?, a.final_decision_at = NOW(), a.updated_at = NOW() WHERE a.id = ? AND j.company_id = ?`,
    [status, id, companyId],
  );
  return result.affectedRows;
};

exports.recommendOffer = async (id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE applications a JOIN job_requisitions j ON a.job_id = j.id SET a.offer_recommended = 1, a.updated_at = NOW() WHERE a.id = ? AND j.company_id = ?`,
    [id, companyId],
  );
  return result.affectedRows;
};

exports.applicationStats = async (jobId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `SELECT a.status, COUNT(*) AS count FROM applications a JOIN job_requisitions j ON a.job_id = j.id WHERE a.job_id = ? AND j.company_id = ? GROUP BY a.status`,
    [jobId, companyId],
  );
  return rows;
};

exports.createOfferDraft = async (payload, companyId) => {
  const { application_id, created_by, offer_details } = payload;
  if (!application_id || !created_by) throw new Error("application_id and created_by are required");
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `INSERT INTO offers (application_id, created_by, status, offer_details, created_at, updated_at)
     SELECT a.id, ?, 'draft', ?, NOW(), NOW()
     FROM applications a
     JOIN job_requisitions j ON a.job_id = j.id
     WHERE a.id = ? AND j.company_id = ?`,
    [created_by, offer_details ? JSON.stringify(offer_details) : null, application_id, companyId],
  );
  if (!result.affectedRows) {
    throw new Error("Application not found for your company");
  }
  return { id: result.insertId };
};

exports.sendOffer = async (id, payload, companyId) => {
  const { document_url, esign_link } = payload;
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE offers o
     JOIN applications a ON o.application_id = a.id
     JOIN job_requisitions j ON a.job_id = j.id
     SET o.status = 'sent', o.document_url = ?, o.esign_link = ?, o.sent_at = NOW(), o.updated_at = NOW()
     WHERE o.id = ? AND j.company_id = ?`,
    [document_url || null, esign_link || null, id, companyId],
  );
  return result.affectedRows;
};

exports.getOffersByApplication = async (applicationId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `SELECT o.* FROM offers o
     JOIN applications a ON o.application_id = a.id
     JOIN job_requisitions j ON a.job_id = j.id
     WHERE o.application_id = ? AND j.company_id = ?
     ORDER BY o.created_at DESC`,
    [applicationId, companyId],
  );
  rows.forEach((row) => {
    row.offer_details = parseJsonField(row.offer_details);
  });
  return rows;
};
