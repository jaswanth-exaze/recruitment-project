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

exports.getMyProfile = async (userId) => {
  return getUserProfileById(userId);
};

exports.updateMyProfile = async (userId, body) => {
  const { first_name, last_name, email } = body;
  if (!first_name || !last_name || !email) {
    throw new Error("first_name, last_name and email are required");
  }

  await db.promise().query(
    `
      UPDATE users
      SET first_name = ?, last_name = ?, email = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [first_name, last_name, email, userId],
  );

  return getUserProfileById(userId);
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
    `
      SELECT j.id, j.title, j.description, j.location, j.employment_type, j.status, j.positions_count, j.created_at, c.name AS company_name
      FROM job_requisitions j
      JOIN companies c ON j.company_id = c.id
      ${whereSql}
      ORDER BY j.created_at DESC
    `,
    params,
  );
  return rows;
};

exports.getJobById = async (id) => {
  const [rows] = await db.promise().query(
    `
      SELECT j.*, c.name AS company_name, u.first_name AS creator_first, u.last_name AS creator_last
      FROM job_requisitions j
      JOIN companies c ON j.company_id = c.id
      JOIN users u ON j.created_by = u.id
      WHERE j.id = ?
      LIMIT 1
    `,
    [id],
  );
  return rows[0] || null;
};

exports.createJobDraft = async (payload) => {
  const {
    company_id,
    created_by,
    title,
    description,
    requirements,
    location,
    employment_type,
    positions_count,
  } = payload;

  if (!company_id || !created_by || !title) {
    throw new Error("company_id, created_by and title are required");
  }

  const [result] = await db.promise().query(
    `
      INSERT INTO job_requisitions (company_id, created_by, title, description, requirements, location, employment_type, status, positions_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, NOW(), NOW())
    `,
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
    `
      UPDATE job_requisitions
      SET title = ?, description = ?, requirements = ?, location = ?, employment_type = ?, positions_count = ?, updated_at = NOW()
      WHERE id = ? AND status IN ('draft', 'pending')
    `,
    [
      title,
      description || null,
      requirements || null,
      location || null,
      employment_type || "Full-time",
      positions_count || 1,
      id,
    ],
  );
  return result.affectedRows;
};

exports.submitJob = async (jobId, approverId) => {
  if (!approverId) {
    throw new Error("approver_id is required");
  }
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [jobResult] = await connection.query(
      `
        UPDATE job_requisitions
        SET status = 'pending', updated_at = NOW()
        WHERE id = ?
      `,
      [jobId],
    );
    if (!jobResult.affectedRows) {
      await connection.rollback();
      return 0;
    }

    await connection.query(
      `
        INSERT INTO job_approvals (job_id, approver_id, status, created_at, updated_at)
        VALUES (?, ?, 'pending', NOW(), NOW())
        ON DUPLICATE KEY UPDATE status = 'pending', comments = NULL, approved_at = NULL, updated_at = NOW()
      `,
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

exports.getCandidateProfile = async (userId) => {
  const [rows] = await db.promise().query(
    `
      SELECT cp.user_id, u.first_name, u.last_name, u.email, cp.phone, cp.address, cp.resume_url, cp.profile_data, cp.is_verified, cp.updated_at
      FROM candidate_profiles cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  if (!rows.length) return null;
  rows[0].profile_data = parseJsonField(rows[0].profile_data);
  return rows[0];
};

exports.updateCandidateProfile = async (userId, payload) => {
  const { phone, address, profile_data } = payload;
  const [result] = await db.promise().query(
    `
      UPDATE candidate_profiles
      SET phone = ?, address = ?, profile_data = ?, updated_at = NOW()
      WHERE user_id = ?
    `,
    [phone || null, address || null, profile_data ? JSON.stringify(profile_data) : null, userId],
  );
  return result.affectedRows;
};

exports.uploadResume = async (userId, resumeUrl) => {
  if (!resumeUrl) {
    throw new Error("resume_url is required");
  }
  const [result] = await db.promise().query(
    `
      UPDATE candidate_profiles
      SET resume_url = ?, updated_at = NOW()
      WHERE user_id = ?
    `,
    [resumeUrl, userId],
  );
  return result.affectedRows;
};

exports.listApplicationsForJob = async (jobId) => {
  const [rows] = await db.promise().query(
    `
      SELECT a.*, u.first_name, u.last_name, u.email, cp.resume_url
      FROM applications a
      JOIN users u ON a.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      WHERE a.job_id = ?
      ORDER BY a.applied_at DESC
    `,
    [jobId],
  );
  return rows;
};

exports.moveApplicationStage = async (id, status, current_stage_id) => {
  const [result] = await db.promise().query(
    `
      UPDATE applications
      SET status = ?, current_stage_id = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [status, current_stage_id || null, id],
  );
  return result.affectedRows;
};

exports.screenDecision = async (id, status) => {
  if (!["rejected", "interview"].includes(status)) {
    throw new Error("status must be rejected or interview");
  }
  const [result] = await db.promise().query(
    `
      UPDATE applications
      SET status = ?, screening_decision_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `,
    [status, id],
  );
  return result.affectedRows;
};

exports.recommendOffer = async (id) => {
  const [result] = await db.promise().query(
    `
      UPDATE applications
      SET offer_recommended = 1, updated_at = NOW()
      WHERE id = ?
    `,
    [id],
  );
  return result.affectedRows;
};

exports.scheduleInterview = async (payload) => {
  const { application_id, interviewer_id, scheduled_at, duration_minutes, meeting_link, notes } = payload;
  if (!application_id || !interviewer_id || !scheduled_at) {
    throw new Error("application_id, interviewer_id and scheduled_at are required");
  }
  const [result] = await db.promise().query(
    `
      INSERT INTO interviews (application_id, interviewer_id, scheduled_at, duration_minutes, meeting_link, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'scheduled', ?, NOW(), NOW())
    `,
    [application_id, interviewer_id, scheduled_at, duration_minutes || null, meeting_link || null, notes || null],
  );
  return { id: result.insertId };
};

exports.getInterviews = async ({ application_id, interviewer_id }) => {
  if (application_id) {
    const [rows] = await db.promise().query(
      `
        SELECT i.*, u.first_name AS interviewer_first, u.last_name AS interviewer_last
        FROM interviews i
        JOIN users u ON i.interviewer_id = u.id
        WHERE i.application_id = ?
        ORDER BY i.scheduled_at
      `,
      [application_id],
    );
    return rows;
  }

  if (interviewer_id) {
    const [rows] = await db.promise().query(
      `
        SELECT i.*, a.candidate_id, u.first_name AS candidate_first, u.last_name AS candidate_last, j.title
        FROM interviews i
        JOIN applications a ON i.application_id = a.id
        JOIN users u ON a.candidate_id = u.id
        JOIN job_requisitions j ON a.job_id = j.id
        WHERE i.interviewer_id = ? AND i.status = 'scheduled'
        ORDER BY i.scheduled_at
      `,
      [interviewer_id],
    );
    return rows;
  }

  throw new Error("application_id or interviewer_id query param is required");
};

exports.updateInterview = async (id, status, notes) => {
  const [result] = await db.promise().query(
    `
      UPDATE interviews
      SET status = ?, notes = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [status, notes || null, id],
  );
  return result.affectedRows;
};

exports.createOfferDraft = async (payload) => {
  const { application_id, created_by, offer_details } = payload;
  if (!application_id || !created_by) {
    throw new Error("application_id and created_by are required");
  }
  const [result] = await db.promise().query(
    `
      INSERT INTO offers (application_id, created_by, status, offer_details, created_at, updated_at)
      VALUES (?, ?, 'draft', ?, NOW(), NOW())
    `,
    [application_id, created_by, offer_details ? JSON.stringify(offer_details) : null],
  );
  return { id: result.insertId };
};

exports.sendOffer = async (id, payload) => {
  const { document_url, esign_link } = payload;
  const [result] = await db.promise().query(
    `
      UPDATE offers
      SET status = 'sent', document_url = ?, esign_link = ?, sent_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `,
    [document_url || null, esign_link || null, id],
  );
  return result.affectedRows;
};
