const db = require("../config/db");
const fs = require("fs/promises");
const { hashPassword } = require("../utils/password.util");
const { notifyApplicationStatusChange } = require("./applicationStatusNotification.service");
const {
  sendJobApprovalRequestEmail,
  sendTeamMemberCredentialsEmail,
  sendOfferLetterSentToCandidateEmail,
} = require("./recruitmentEmail.service");
const { generateOfferLetterPdf, buildOfferLetterLinks } = require("../utils/offerLetterPdf.util");

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

function normalizeOfferDetails(value) {
  if (value === null || value === undefined || value === "") return null;
  return parseJsonField(value);
}

function fullName(firstName, lastName, fallback = "N/A") {
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || fallback;
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

exports.listUsersByRole = async (role, companyId, { includeInactive = false, isActive = null } = {}) => {
  if (!companyId) throw new Error("company_id is required");
  const validRole = assertManagedRole(role);
  const where = ["role = ?", "company_id = ?"];
  const params = [validRole, companyId];
  const parsedIsActive = parseIsActiveFilter(isActive);

  if (parsedIsActive !== null) {
    where.push("is_active = ?");
    params.push(parsedIsActive);
  } else if (!includeInactive) {
    where.push("is_active = 1");
  }

  const [rows] = await db.promise().query(
    `SELECT id, company_id, email, first_name, last_name, role, is_active, created_at FROM users WHERE ${where.join(" AND ")} ORDER BY last_name, first_name`,
    params,
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

  await sendTeamMemberCredentialsEmail({
    email,
    firstName: first_name,
    lastName: last_name,
    role: validRole,
    password,
    companyId: resolvedCompanyId,
  });

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
    `
      SELECT
        j.id,
        j.title,
        j.description,
        j.location,
        j.employment_type,
        j.department,
        j.experience_level,
        j.salary_min,
        j.salary_max,
        j.application_deadline,
        j.status,
        j.positions_count,
        j.created_at,
        c.name AS company_name
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
    `SELECT j.*, c.name AS company_name, u.first_name AS creator_first, u.last_name AS creator_last FROM job_requisitions j JOIN companies c ON j.company_id = c.id JOIN users u ON j.created_by = u.id WHERE j.id = ? AND j.company_id = ? LIMIT 1`,
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
    department,
    experience_level,
    salary_min,
    salary_max,
    application_deadline,
    positions_count,
  } = payload;
  if (!company_id || !created_by || !title) throw new Error("company_id, created_by and title are required");
  const [result] = await db.promise().query(
    `
      INSERT INTO job_requisitions (
        company_id,
        created_by,
        title,
        description,
        requirements,
        location,
        employment_type,
        department,
        experience_level,
        salary_min,
        salary_max,
        application_deadline,
        status,
        positions_count,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, NOW(), NOW())
    `,
    [
      company_id,
      created_by,
      title,
      description || null,
      requirements || null,
      location || null,
      employment_type || "Full-time",
      department || null,
      experience_level || null,
      salary_min || null,
      salary_max || null,
      application_deadline || null,
      positions_count || 1,
    ],
  );
  return { id: result.insertId };
};

exports.updateJob = async (id, payload, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const {
    title,
    description,
    requirements,
    location,
    employment_type,
    department,
    experience_level,
    salary_min,
    salary_max,
    application_deadline,
    positions_count,
  } = payload;
  const [result] = await db.promise().query(
    `
      UPDATE job_requisitions
      SET
        title = ?,
        description = ?,
        requirements = ?,
        location = ?,
        employment_type = ?,
        department = ?,
        experience_level = ?,
        salary_min = ?,
        salary_max = ?,
        application_deadline = ?,
        positions_count = ?,
        updated_at = NOW()
      WHERE id = ? AND company_id = ? AND status IN ('draft', 'pending')
    `,
    [
      title,
      description || null,
      requirements || null,
      location || null,
      employment_type || "Full-time",
      department || null,
      experience_level || null,
      salary_min || null,
      salary_max || null,
      application_deadline || null,
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
    await sendJobApprovalRequestEmail({ jobId, approverId, companyId });
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

  const where = ["j.company_id = ?"];
  const params = [companyId];
  if (jobId) {
    where.push("a.job_id = ?");
    params.push(jobId);
  }

  const [rows] = await db.promise().query(
    `
      SELECT a.*, u.first_name, u.last_name, u.email, cp.resume_url
      FROM applications a
      JOIN job_requisitions j ON a.job_id = j.id
      JOIN users u ON a.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      WHERE ${where.join(" AND ")}
      ORDER BY a.applied_at DESC
    `,
    params,
  );
  return rows;
};

exports.moveApplicationStage = async (id, status, current_stage_id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE applications a JOIN job_requisitions j ON a.job_id = j.id SET a.status = ?, a.current_stage_id = ?, a.updated_at = NOW() WHERE a.id = ? AND j.company_id = ?`,
    [status, current_stage_id || null, id, companyId],
  );
  if (result.affectedRows) {
    await notifyApplicationStatusChange({
      applicationId: id,
      companyId,
      status,
      triggeredBy: "Company Admin",
    });
  }
  return result.affectedRows;
};

exports.screenDecision = async (id, status, companyId) => {
  if (!["rejected", "interview"].includes(status)) throw new Error("status must be rejected or interview");
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE applications a JOIN job_requisitions j ON a.job_id = j.id SET a.status = ?, a.screening_decision_at = NOW(), a.updated_at = NOW() WHERE a.id = ? AND j.company_id = ?`,
    [status, id, companyId],
  );
  if (result.affectedRows) {
    await notifyApplicationStatusChange({
      applicationId: id,
      companyId,
      status,
      triggeredBy: "Company Admin",
    });
  }
  return result.affectedRows;
};

exports.finalDecision = async (id, status, companyId) => {
  if (!["selected", "rejected"].includes(status)) throw new Error("status must be selected or rejected");
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE applications a JOIN job_requisitions j ON a.job_id = j.id SET a.status = ?, a.final_decision_at = NOW(), a.updated_at = NOW() WHERE a.id = ? AND j.company_id = ?`,
    [status, id, companyId],
  );
  if (result.affectedRows) {
    await notifyApplicationStatusChange({
      applicationId: id,
      companyId,
      status,
      triggeredBy: "Company Admin",
    });
  }
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

  const where = ["j.company_id = ?"];
  const params = [companyId];
  if (jobId) {
    where.push("a.job_id = ?");
    params.push(jobId);
  }

  const [rows] = await db.promise().query(
    `
      SELECT a.status, COUNT(*) AS count
      FROM applications a
      JOIN job_requisitions j ON a.job_id = j.id
      WHERE ${where.join(" AND ")}
      GROUP BY a.status
    `,
    params,
  );
  return rows;
};

exports.createOfferDraft = async (payload, companyId) => {
  const { application_id, created_by } = payload;
  const offerDetails = normalizeOfferDetails(payload.offer_details);
  if (!application_id || !created_by) throw new Error("application_id and created_by are required");
  if (!companyId) throw new Error("company_id is required");

  const connection = await db.promise().getConnection();
  let generatedPdfPath = null;

  try {
    await connection.beginTransaction();

    const [contextRows] = await connection.query(
      `
        SELECT
          a.id AS application_id,
          c.name AS company_name,
          c.domain AS company_domain,
          c.logo_url AS company_logo_url,
          j.title AS job_title,
          j.location AS job_location,
          j.employment_type,
          j.department,
          candidate.first_name AS candidate_first_name,
          candidate.last_name AS candidate_last_name,
          candidate.email AS candidate_email,
          creator.first_name AS creator_first_name,
          creator.last_name AS creator_last_name,
          creator.email AS creator_email
        FROM applications a
        JOIN job_requisitions j ON a.job_id = j.id
        JOIN companies c ON j.company_id = c.id
        JOIN users candidate ON a.candidate_id = candidate.id
        LEFT JOIN users creator ON creator.id = ? AND creator.company_id = j.company_id
        WHERE a.id = ? AND j.company_id = ?
        LIMIT 1
      `,
      [created_by, application_id, companyId],
    );
    const context = contextRows[0];
    if (!context) throw new Error("Application not found for your company");

    const [insertResult] = await connection.query(
      `
        INSERT INTO offers (application_id, created_by, status, offer_details, created_at, updated_at)
        SELECT a.id, ?, 'draft', ?, NOW(), NOW()
        FROM applications a
        JOIN job_requisitions j ON a.job_id = j.id
        WHERE a.id = ? AND j.company_id = ?
      `,
      [created_by, offerDetails === null ? null : JSON.stringify(offerDetails), application_id, companyId],
    );
    if (!insertResult.affectedRows) throw new Error("Application not found for your company");

    const offerId = insertResult.insertId;
    const { absolutePath, relativePath } = await generateOfferLetterPdf({
      offerId,
      companyName: context.company_name,
      companyDomain: context.company_domain,
      companyLogoUrl: context.company_logo_url,
      candidateName: fullName(context.candidate_first_name, context.candidate_last_name, "Candidate"),
      candidateEmail: context.candidate_email,
      recruiterName: fullName(context.creator_first_name, context.creator_last_name, "Company Admin"),
      recruiterEmail: context.creator_email,
      jobTitle: context.job_title,
      jobLocation: context.job_location,
      employmentType: context.employment_type,
      department: context.department,
      offerDetails: offerDetails && typeof offerDetails === "object" ? offerDetails : {},
    });
    generatedPdfPath = absolutePath;

    const { documentUrl, esignLink } = buildOfferLetterLinks(relativePath, offerId);
    await connection.query(
      `
        UPDATE offers
        SET document_url = ?, esign_link = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [documentUrl, esignLink, offerId],
    );

    await connection.commit();
    return {
      id: offerId,
      document_url: documentUrl,
      esign_link: esignLink,
    };
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (generatedPdfPath) {
      await fs.unlink(generatedPdfPath).catch(() => {});
    }
    throw error;
  } finally {
    connection.release();
  }
};

exports.sendOffer = async (id, payload, companyId) => {
  const providedDocumentUrl = String(payload?.document_url || "").trim();
  const providedEsignLink = String(payload?.esign_link || "").trim();
  if (!companyId) throw new Error("company_id is required");

  const [existingRows] = await db.promise().query(
    `SELECT o.document_url, o.esign_link
     FROM offers o
     JOIN applications a ON o.application_id = a.id
     JOIN job_requisitions j ON a.job_id = j.id
     WHERE o.id = ? AND j.company_id = ?
     LIMIT 1`,
    [id, companyId],
  );
  if (!existingRows.length) return 0;

  const finalDocumentUrl = providedDocumentUrl || existingRows[0].document_url || null;
  const finalEsignLink =
    providedEsignLink
    || existingRows[0].esign_link
    || (finalDocumentUrl ? `${finalDocumentUrl}#candidate-esign-${id}` : null);

  const [result] = await db.promise().query(
    `UPDATE offers o
     JOIN applications a ON o.application_id = a.id
     JOIN job_requisitions j ON a.job_id = j.id
     SET
       o.status = 'sent',
       o.document_url = ?,
       o.esign_link = ?,
       o.sent_at = NOW(),
       o.updated_at = NOW(),
       a.status = 'offer_letter_sent',
       a.updated_at = NOW()
     WHERE o.id = ? AND j.company_id = ?`,
    [finalDocumentUrl, finalEsignLink, id, companyId],
  );

  if (result.affectedRows) {
    await sendOfferLetterSentToCandidateEmail({
      offerId: id,
      companyId,
      triggeredBy: "Company Admin",
    });
  }

  return result.affectedRows;
};

exports.getOffersByApplication = async (applicationId, companyId) => {
  if (!companyId) throw new Error("company_id is required");

  const where = ["j.company_id = ?"];
  const params = [companyId];
  if (applicationId) {
    where.push("o.application_id = ?");
    params.push(applicationId);
  }

  const [rows] = await db.promise().query(
    `
      SELECT o.*
      FROM offers o
      JOIN applications a ON o.application_id = a.id
      JOIN job_requisitions j ON a.job_id = j.id
      WHERE ${where.join(" AND ")}
      ORDER BY o.created_at DESC
    `,
    params,
  );
  rows.forEach((row) => {
    row.offer_details = parseJsonField(row.offer_details);
  });
  return rows;
};

exports.getAuditTrail = async ({ entity_type, entity_id } = {}, companyId) => {
  if (!companyId) throw new Error("company_id is required");

  const where = [
    `(
      actor.company_id = ?
      OR JSON_UNQUOTE(JSON_EXTRACT(al.new_data, '$.company_id')) = ?
      OR JSON_UNQUOTE(JSON_EXTRACT(al.old_data, '$.company_id')) = ?
    )`,
  ];
  const params = [companyId, String(companyId), String(companyId)];

  if (entity_type) {
    where.push("al.entity_type = ?");
    params.push(entity_type);
  }
  if (entity_id) {
    where.push("al.entity_id = ?");
    params.push(entity_id);
  }

  const [rows] = await db.promise().query(
    `
      ${AUDIT_LOG_SELECT_SQL}
      WHERE ${where.join(" AND ")}
      ORDER BY al.created_at DESC
    `,
    params,
  );

  rows.forEach((row) => {
    row.company_id = parsePositiveInt(row.company_id);
    row.old_data = parseJsonField(row.old_data);
    row.new_data = parseJsonField(row.new_data);
  });

  return rows;
};
