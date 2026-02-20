const db = require("../config/db");

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

exports.getCandidateProfile = async (userId) => {
  const [rows] = await db.promise().query(
    `SELECT cp.user_id, u.first_name, u.last_name, u.email, cp.phone, cp.address, cp.resume_url, cp.profile_data, cp.is_verified, cp.updated_at FROM candidate_profiles cp JOIN users u ON cp.user_id = u.id WHERE cp.user_id = ? LIMIT 1`,
    [userId],
  );
  if (!rows.length) return null;
  rows[0].profile_data = parseJsonField(rows[0].profile_data);
  return rows[0];
};

exports.updateCandidateProfile = async (userId, payload) => {
  const { phone, address, profile_data } = payload;
  const [result] = await db.promise().query(
    `UPDATE candidate_profiles SET phone = ?, address = ?, profile_data = ?, updated_at = NOW() WHERE user_id = ?`,
    [phone || null, address || null, profile_data ? JSON.stringify(profile_data) : null, userId],
  );
  return result.affectedRows;
};

exports.uploadResume = async (userId, resumeUrl) => {
  if (!resumeUrl) throw new Error("resume_url is required");
  const [result] = await db.promise().query(
    `UPDATE candidate_profiles SET resume_url = ?, updated_at = NOW() WHERE user_id = ?`,
    [resumeUrl, userId],
  );
  return result.affectedRows;
};

exports.verifyCandidateEmail = async (userId) => {
  const [result] = await db.promise().query(
    `UPDATE candidate_profiles SET is_verified = 1, updated_at = NOW() WHERE user_id = ?`,
    [userId],
  );
  return result.affectedRows;
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

exports.applyForJob = async ({ job_id, candidate_id }) => {
  if (!job_id || !candidate_id) throw new Error("job_id and candidate_id are required");
  const [result] = await db.promise().query(
    `INSERT INTO applications (job_id, candidate_id, status, applied_at, created_at, updated_at) VALUES (?, ?, 'applied', NOW(), NOW(), NOW())`,
    [job_id, candidate_id],
  );
  return { id: result.insertId };
};

exports.listApplicationsByCandidate = async (candidateId) => {
  const [rows] = await db.promise().query(
    `SELECT a.*, j.title, j.company_id, c.name AS company_name FROM applications a JOIN job_requisitions j ON a.job_id = j.id JOIN companies c ON j.company_id = c.id WHERE a.candidate_id = ? ORDER BY a.applied_at DESC`,
    [candidateId],
  );
  return rows;
};

exports.saveJob = async (candidateId, jobId) => {
  const [result] = await db.promise().query(
    `INSERT INTO saved_jobs (candidate_id, job_id, saved_at) VALUES (?, ?, NOW())`,
    [candidateId, jobId],
  );
  return { id: result.insertId };
};

exports.unsaveJob = async (candidateId, jobId) => {
  const [result] = await db.promise().query(
    `DELETE FROM saved_jobs WHERE candidate_id = ? AND job_id = ?`,
    [candidateId, jobId],
  );
  return result.affectedRows;
};

exports.listSavedJobs = async (candidateId) => {
  const [rows] = await db.promise().query(
    `SELECT j.*, c.name AS company_name FROM saved_jobs sj JOIN job_requisitions j ON sj.job_id = j.id JOIN companies c ON j.company_id = c.id WHERE sj.candidate_id = ? ORDER BY sj.saved_at DESC`,
    [candidateId],
  );
  return rows;
};

exports.acceptOffer = async (id) => {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [offerRows] = await connection.query(`SELECT application_id FROM offers WHERE id = ? LIMIT 1`, [id]);
    if (!offerRows.length) {
      await connection.rollback();
      return 0;
    }
    const [offerResult] = await connection.query(
      `UPDATE offers SET status = 'accepted', responded_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [id],
    );
    await connection.query(`UPDATE applications SET status = 'hired', updated_at = NOW() WHERE id = ?`, [offerRows[0].application_id]);
    await connection.commit();
    return offerResult.affectedRows;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.declineOffer = async (id) => {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [offerRows] = await connection.query(`SELECT application_id FROM offers WHERE id = ? LIMIT 1`, [id]);
    if (!offerRows.length) {
      await connection.rollback();
      return 0;
    }
    const [offerResult] = await connection.query(
      `UPDATE offers SET status = 'declined', responded_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [id],
    );
    await connection.query(`UPDATE applications SET status = 'rejected', updated_at = NOW() WHERE id = ?`, [offerRows[0].application_id]);
    await connection.commit();
    return offerResult.affectedRows;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
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
