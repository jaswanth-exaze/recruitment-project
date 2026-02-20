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
  const [result] = await db.promise().query(`UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?`, [id]);
  return result.affectedRows;
};

exports.activateUser = async (id) => {
  const [result] = await db.promise().query(`UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?`, [id]);
  return result.affectedRows;
};

exports.countUsersByRole = async (role) => {
  const [rows] = await db.promise().query(`SELECT COUNT(*) AS total FROM users WHERE role = ? AND is_active = 1`, [role]);
  return rows[0];
};

exports.listJobs = async ({ status, company_id }) => {
  const where = [];
  const params = [];
  if (status) {
    where.push("j.status = ?");
    params.push(status);
  }
  if (company_id) {
    where.push("j.company_id = ?");
    params.push(company_id);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await db.promise().query(
    `SELECT j.id, j.title, j.description, j.location, j.employment_type, j.status, j.positions_count, j.created_at, c.name AS company_name FROM job_requisitions j JOIN companies c ON j.company_id = c.id ${whereSql} ORDER BY j.created_at DESC`,
    params,
  );
  return rows;
};

exports.getJobById = async (id) => {
  const [rows] = await db.promise().query(
    `SELECT j.*, c.name AS company_name, u.first_name AS creator_first, u.last_name AS creator_last FROM job_requisitions j JOIN companies c ON j.company_id = c.id JOIN users u ON j.created_by = u.id WHERE j.id = ? LIMIT 1`,
    [id],
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

exports.updateJob = async (id, payload) => {
  const { title, description, requirements, location, employment_type, positions_count } = payload;
  const [result] = await db.promise().query(
    `UPDATE job_requisitions SET title = ?, description = ?, requirements = ?, location = ?, employment_type = ?, positions_count = ?, updated_at = NOW() WHERE id = ? AND status IN ('draft', 'pending')`,
    [title, description || null, requirements || null, location || null, employment_type || "Full-time", positions_count || 1, id],
  );
  return result.affectedRows;
};

exports.submitJob = async (jobId, approverId) => {
  if (!approverId) throw new Error("approver_id is required");
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [jobResult] = await connection.query(`UPDATE job_requisitions SET status = 'pending', updated_at = NOW() WHERE id = ?`, [jobId]);
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

exports.publishJob = async (id) => {
  const [result] = await db.promise().query(
    `UPDATE job_requisitions SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [id],
  );
  return result.affectedRows;
};

exports.closeJob = async (id) => {
  const [result] = await db.promise().query(
    `UPDATE job_requisitions SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [id],
  );
  return result.affectedRows;
};

exports.listApplicationsForJob = async (jobId) => {
  const [rows] = await db.promise().query(
    `SELECT a.*, u.first_name, u.last_name, u.email, cp.resume_url FROM applications a JOIN users u ON a.candidate_id = u.id LEFT JOIN candidate_profiles cp ON u.id = cp.user_id WHERE a.job_id = ? ORDER BY a.applied_at DESC`,
    [jobId],
  );
  return rows;
};

exports.moveApplicationStage = async (id, status, current_stage_id) => {
  const [result] = await db.promise().query(
    `UPDATE applications SET status = ?, current_stage_id = ?, updated_at = NOW() WHERE id = ?`,
    [status, current_stage_id || null, id],
  );
  return result.affectedRows;
};

exports.screenDecision = async (id, status) => {
  if (!["rejected", "interview"].includes(status)) throw new Error("status must be rejected or interview");
  const [result] = await db.promise().query(
    `UPDATE applications SET status = ?, screening_decision_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [status, id],
  );
  return result.affectedRows;
};

exports.finalDecision = async (id, status) => {
  if (!["selected", "rejected"].includes(status)) throw new Error("status must be selected or rejected");
  const [result] = await db.promise().query(
    `UPDATE applications SET status = ?, final_decision_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [status, id],
  );
  return result.affectedRows;
};

exports.recommendOffer = async (id) => {
  const [result] = await db.promise().query(
    `UPDATE applications SET offer_recommended = 1, updated_at = NOW() WHERE id = ?`,
    [id],
  );
  return result.affectedRows;
};

exports.applicationStats = async (jobId) => {
  const [rows] = await db.promise().query(
    `SELECT status, COUNT(*) AS count FROM applications WHERE job_id = ? GROUP BY status`,
    [jobId],
  );
  return rows;
};

exports.createOfferDraft = async (payload) => {
  const { application_id, created_by, offer_details } = payload;
  if (!application_id || !created_by) throw new Error("application_id and created_by are required");
  const [result] = await db.promise().query(
    `INSERT INTO offers (application_id, created_by, status, offer_details, created_at, updated_at) VALUES (?, ?, 'draft', ?, NOW(), NOW())`,
    [application_id, created_by, offer_details ? JSON.stringify(offer_details) : null],
  );
  return { id: result.insertId };
};

exports.sendOffer = async (id, payload) => {
  const { document_url, esign_link } = payload;
  const [result] = await db.promise().query(
    `UPDATE offers SET status = 'sent', document_url = ?, esign_link = ?, sent_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [document_url || null, esign_link || null, id],
  );
  return result.affectedRows;
};

exports.getOffersByApplication = async (applicationId) => {
  const [rows] = await db.promise().query(
    `SELECT * FROM offers WHERE application_id = ? ORDER BY created_at DESC`,
    [applicationId],
  );
  rows.forEach((row) => {
    row.offer_details = parseJsonField(row.offer_details);
  });
  return rows;
};
