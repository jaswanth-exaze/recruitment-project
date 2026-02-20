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

exports.getJobById = async (id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `
      SELECT j.*, c.name AS company_name, u.first_name AS creator_first, u.last_name AS creator_last
      FROM job_requisitions j
      JOIN companies c ON j.company_id = c.id
      JOIN users u ON j.created_by = u.id
      WHERE j.id = ? AND j.company_id = ?
      LIMIT 1
    `,
    [id, companyId],
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

exports.updateJob = async (id, payload, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const { title, description, requirements, location, employment_type, positions_count } = payload;
  const [result] = await db.promise().query(
    `
      UPDATE job_requisitions
      SET title = ?, description = ?, requirements = ?, location = ?, employment_type = ?, positions_count = ?, updated_at = NOW()
      WHERE id = ? AND company_id = ? AND status IN ('draft', 'pending')
    `,
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
  if (!approverId) {
    throw new Error("approver_id is required");
  }
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
      `
        UPDATE job_requisitions
        SET status = 'pending', updated_at = NOW()
        WHERE id = ? AND company_id = ?
      `,
      [jobId, companyId],
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

exports.getCandidateProfile = async (userId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `
      SELECT cp.user_id, u.first_name, u.last_name, u.email, cp.phone, cp.address, cp.resume_url, cp.profile_data, cp.is_verified, cp.updated_at
      FROM candidate_profiles cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.user_id = ?
        AND EXISTS (
          SELECT 1
          FROM applications a
          JOIN job_requisitions j ON a.job_id = j.id
          WHERE a.candidate_id = cp.user_id AND j.company_id = ?
        )
      LIMIT 1
    `,
    [userId, companyId],
  );

  if (!rows.length) return null;
  rows[0].profile_data = parseJsonField(rows[0].profile_data);
  return rows[0];
};

exports.updateCandidateProfile = async (userId, payload, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const { phone, address, profile_data } = payload;
  const [result] = await db.promise().query(
    `
      UPDATE candidate_profiles
      SET phone = ?, address = ?, profile_data = ?, updated_at = NOW()
      WHERE user_id = ?
        AND EXISTS (
          SELECT 1
          FROM applications a
          JOIN job_requisitions j ON a.job_id = j.id
          WHERE a.candidate_id = candidate_profiles.user_id AND j.company_id = ?
        )
    `,
    [phone || null, address || null, profile_data ? JSON.stringify(profile_data) : null, userId, companyId],
  );
  return result.affectedRows;
};

exports.uploadResume = async (userId, resumeUrl, companyId) => {
  if (!resumeUrl) {
    throw new Error("resume_url is required");
  }
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `
      UPDATE candidate_profiles
      SET resume_url = ?, updated_at = NOW()
      WHERE user_id = ?
        AND EXISTS (
          SELECT 1
          FROM applications a
          JOIN job_requisitions j ON a.job_id = j.id
          WHERE a.candidate_id = candidate_profiles.user_id AND j.company_id = ?
        )
    `,
    [resumeUrl, userId, companyId],
  );
  return result.affectedRows;
};

exports.listApplicationsForJob = async (jobId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `
      SELECT a.*, u.first_name, u.last_name, u.email, cp.resume_url
      FROM applications a
      JOIN job_requisitions j ON a.job_id = j.id
      JOIN users u ON a.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      WHERE a.job_id = ? AND j.company_id = ?
      ORDER BY a.applied_at DESC
    `,
    [jobId, companyId],
  );
  return rows;
};

exports.moveApplicationStage = async (id, status, current_stage_id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `
      UPDATE applications a
      JOIN job_requisitions j ON a.job_id = j.id
      SET a.status = ?, a.current_stage_id = ?, a.updated_at = NOW()
      WHERE a.id = ? AND j.company_id = ?
    `,
    [status, current_stage_id || null, id, companyId],
  );
  return result.affectedRows;
};

exports.screenDecision = async (id, status, companyId) => {
  if (!["rejected", "interview"].includes(status)) {
    throw new Error("status must be rejected or interview");
  }
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `
      UPDATE applications a
      JOIN job_requisitions j ON a.job_id = j.id
      SET a.status = ?, a.screening_decision_at = NOW(), a.updated_at = NOW()
      WHERE a.id = ? AND j.company_id = ?
    `,
    [status, id, companyId],
  );
  return result.affectedRows;
};

exports.recommendOffer = async (id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `
      UPDATE applications a
      JOIN job_requisitions j ON a.job_id = j.id
      SET a.offer_recommended = 1, a.updated_at = NOW()
      WHERE a.id = ? AND j.company_id = ?
    `,
    [id, companyId],
  );
  return result.affectedRows;
};

exports.scheduleInterview = async (payload, companyId) => {
  const { application_id, interviewer_id, scheduled_at, duration_minutes, meeting_link, notes } = payload;
  if (!application_id || !interviewer_id || !scheduled_at) {
    throw new Error("application_id, interviewer_id and scheduled_at are required");
  }
  if (!companyId) throw new Error("company_id is required");

  const [interviewerRows] = await db.promise().query(
    `SELECT id FROM users WHERE id = ? AND company_id = ? LIMIT 1`,
    [interviewer_id, companyId],
  );
  if (!interviewerRows.length) {
    throw new Error("interviewer_id is not part of your company");
  }

  const [result] = await db.promise().query(
    `
      INSERT INTO interviews (application_id, interviewer_id, scheduled_at, duration_minutes, meeting_link, status, notes, created_at, updated_at)
      SELECT a.id, ?, ?, ?, ?, 'scheduled', ?, NOW(), NOW()
      FROM applications a
      JOIN job_requisitions j ON a.job_id = j.id
      WHERE a.id = ? AND j.company_id = ?
    `,
    [interviewer_id, scheduled_at, duration_minutes || null, meeting_link || null, notes || null, application_id, companyId],
  );
  if (!result.affectedRows) {
    throw new Error("application_id is not part of your company");
  }
  return { id: result.insertId };
};

exports.getInterviews = async ({ application_id, interviewer_id }, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  if (application_id) {
    const [rows] = await db.promise().query(
      `
        SELECT i.*, u.first_name AS interviewer_first, u.last_name AS interviewer_last
        FROM interviews i
        JOIN applications a ON i.application_id = a.id
        JOIN job_requisitions j ON a.job_id = j.id
        JOIN users u ON i.interviewer_id = u.id
        WHERE i.application_id = ? AND j.company_id = ?
        ORDER BY i.scheduled_at
      `,
      [application_id, companyId],
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
        JOIN users interviewer ON i.interviewer_id = interviewer.id
        WHERE i.interviewer_id = ? AND i.status = 'scheduled' AND j.company_id = ? AND interviewer.company_id = ?
        ORDER BY i.scheduled_at
      `,
      [interviewer_id, companyId, companyId],
    );
    return rows;
  }

  throw new Error("application_id or interviewer_id query param is required");
};

exports.updateInterview = async (id, status, notes, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `
      UPDATE interviews i
      JOIN applications a ON i.application_id = a.id
      JOIN job_requisitions j ON a.job_id = j.id
      SET i.status = ?, i.notes = ?, i.updated_at = NOW()
      WHERE i.id = ? AND j.company_id = ?
    `,
    [status, notes || null, id, companyId],
  );
  return result.affectedRows;
};

exports.createOfferDraft = async (payload, companyId) => {
  const { application_id, created_by, offer_details } = payload;
  if (!application_id || !created_by) {
    throw new Error("application_id and created_by are required");
  }
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `
      INSERT INTO offers (application_id, created_by, status, offer_details, created_at, updated_at)
      SELECT a.id, ?, 'draft', ?, NOW(), NOW()
      FROM applications a
      JOIN job_requisitions j ON a.job_id = j.id
      WHERE a.id = ? AND j.company_id = ?
    `,
    [created_by, offer_details ? JSON.stringify(offer_details) : null, application_id, companyId],
  );
  if (!result.affectedRows) {
    throw new Error("application_id is not part of your company");
  }
  return { id: result.insertId };
};

exports.sendOffer = async (id, payload, companyId) => {
  const { document_url, esign_link } = payload;
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `
      UPDATE offers o
      JOIN applications a ON o.application_id = a.id
      JOIN job_requisitions j ON a.job_id = j.id
      SET o.status = 'sent', o.document_url = ?, o.esign_link = ?, o.sent_at = NOW(), o.updated_at = NOW()
      WHERE o.id = ? AND j.company_id = ?
    `,
    [document_url || null, esign_link || null, id, companyId],
  );
  return result.affectedRows;
};
