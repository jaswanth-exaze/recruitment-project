const db = require("../config/db");
const { notifyApplicationStatusChange, notifyApplicationSubmitted } = require("./applicationStatusNotification.service");
const { sendOfferAcceptedToHiringManagersEmail } = require("./recruitmentEmail.service");

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

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseApplicationData(raw) {
  if (raw === null || raw === undefined || raw === "") return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (err) {
      throw new Error("application_data must be valid JSON");
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  throw new Error("application_data must be valid JSON");
}

function cleanApplicationData(data) {
  const output = {};
  Object.keys(data || {}).forEach((key) => {
    const value = data[key];
    if (value === null || value === undefined) return;
    if (typeof value === "string" && value.trim() === "") return;
    output[key] = value;
  });
  return output;
}

let applicationsHasDataColumnCache = null;

async function hasApplicationDataColumn() {
  if (applicationsHasDataColumnCache !== null) return applicationsHasDataColumnCache;
  try {
    const [rows] = await db.promise().query(`SHOW COLUMNS FROM applications LIKE 'application_data'`);
    applicationsHasDataColumnCache = rows.length > 0;
  } catch (err) {
    applicationsHasDataColumnCache = false;
  }
  return applicationsHasDataColumnCache;
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

exports.listJobs = async ({ company_id, company, location } = {}) => {
  const where = ["j.status = 'published'"];
  const params = [];

  if (company_id) {
    where.push("j.company_id = ?");
    params.push(company_id);
  }

  const companyFilter = String(company || "").trim();
  if (companyFilter) {
    where.push("c.name LIKE ?");
    params.push(`%${companyFilter}%`);
  }

  const locationFilter = String(location || "").trim();
  if (locationFilter) {
    where.push("j.location LIKE ?");
    params.push(`%${locationFilter}%`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const [rows] = await db.promise().query(
    `SELECT j.id, j.title, j.description, j.location, j.employment_type, j.status, j.positions_count, j.created_at, c.name AS company_name FROM job_requisitions j JOIN companies c ON j.company_id = c.id ${whereSql} ORDER BY j.created_at DESC`,
    params,
  );
  return rows;
};

exports.getJobById = async (id) => {
  const [rows] = await db.promise().query(
    `SELECT j.*, c.name AS company_name, u.first_name AS creator_first, u.last_name AS creator_last FROM job_requisitions j JOIN companies c ON j.company_id = c.id JOIN users u ON j.created_by = u.id WHERE j.id = ? AND j.status = 'published' LIMIT 1`,
    [id],
  );
  return rows[0] || null;
};

exports.applyForJob = async ({ job_id, candidate_id, source, referral_id, application_data, confirm_apply }) => {
  if (!job_id || !candidate_id) throw new Error("job_id and candidate_id are required");

  const isConfirmed = confirm_apply === undefined ? true : parseBoolean(confirm_apply);
  if (!isConfirmed) {
    throw new Error("Please confirm application submission");
  }

  const normalizedSource = String(source || "").trim().toLowerCase();
  const normalizedReferralId = String(referral_id || "").trim();
  if (normalizedSource === "referral" && !normalizedReferralId) {
    throw new Error("referral_id is required when source is referral");
  }

  const baseData = parseApplicationData(application_data);
  const mergedData = cleanApplicationData({
    ...baseData,
    source: normalizedSource || baseData.source || undefined,
    referral_id: normalizedSource === "referral" ? (normalizedReferralId || baseData.referral_id || undefined) : undefined,
    confirm_apply: isConfirmed,
  });
  if (!mergedData.submitted_at) {
    mergedData.submitted_at = new Date().toISOString();
  }

  const canStoreApplicationData = await hasApplicationDataColumn();
  const connection = await db.promise().getConnection();
  let txActive = false;
  try {
    await connection.beginTransaction();
    txActive = true;

    const [jobRows] = await connection.query(
      `SELECT id, status, positions_count
       FROM job_requisitions
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [job_id],
    );

    if (!jobRows.length) {
      throw new Error("Job not found");
    }

    const job = jobRows[0];
    const jobStatus = String(job.status || "").trim().toLowerCase();
    const openings = Number(job.positions_count || 0);

    if (openings <= 0) {
      await connection.rollback();
      txActive = false;
      await db.promise().query(
        `UPDATE job_requisitions
         SET status = 'closed',
             closed_at = COALESCE(closed_at, NOW()),
             updated_at = NOW()
         WHERE id = ? AND status <> 'closed'`,
        [job_id],
      );
      throw new Error("This job has no openings left and is now closed");
    }

    if (jobStatus !== "published") {
      throw new Error("This job is not open for applications");
    }

    let result;
    if (canStoreApplicationData) {
      [result] = await connection.query(
        `INSERT INTO applications (job_id, candidate_id, status, applied_at, application_data, created_at, updated_at) VALUES (?, ?, 'applied', NOW(), ?, NOW(), NOW())`,
        [job_id, candidate_id, Object.keys(mergedData).length ? JSON.stringify(mergedData) : null],
      );
    } else {
      [result] = await connection.query(
        `INSERT INTO applications (job_id, candidate_id, status, applied_at, created_at, updated_at) VALUES (?, ?, 'applied', NOW(), NOW(), NOW())`,
        [job_id, candidate_id],
      );
    }

    await connection.commit();
    txActive = false;

    await notifyApplicationSubmitted({ applicationId: result.insertId });
    return { id: result.insertId };
  } catch (err) {
    if (txActive) {
      await connection.rollback();
    }
    throw err;
  } finally {
    connection.release();
  }
};

exports.listApplicationsByCandidate = async (candidateId) => {
  const canStoreApplicationData = await hasApplicationDataColumn();
  const applicationDataSelect = canStoreApplicationData ? "" : ", NULL AS application_data";
  const [rows] = await db.promise().query(
    `SELECT a.*${applicationDataSelect}, j.title, j.company_id, c.name AS company_name FROM applications a JOIN job_requisitions j ON a.job_id = j.id JOIN companies c ON j.company_id = c.id WHERE a.candidate_id = ? ORDER BY a.applied_at DESC`,
    [candidateId],
  );
  rows.forEach((row) => {
    row.application_data = parseJsonField(row.application_data);
  });
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
    const applicationId = offerRows[0].application_id;
    const [applicationResult] = await connection.query(
      `UPDATE applications SET status = 'offer accecepted', updated_at = NOW() WHERE id = ? AND status = 'offer_letter_sent'`,
      [applicationId],
    );
    if (!applicationResult.affectedRows) {
      await connection.rollback();
      throw new Error("Application is not ready for offer acceptance");
    }
    await connection.commit();
    await notifyApplicationStatusChange({
      applicationId,
      status: "offer accecepted",
      triggeredBy: "Candidate",
    });
    const [companyRows] = await db.promise().query(
      `SELECT j.company_id
       FROM applications a
       JOIN job_requisitions j ON a.job_id = j.id
       WHERE a.id = ?
       LIMIT 1`,
      [applicationId],
    );
    const companyId = companyRows[0]?.company_id;
    if (companyId) {
      await sendOfferAcceptedToHiringManagersEmail({ applicationId, companyId });
    }
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
    const applicationId = offerRows[0].application_id;
    const [applicationResult] = await connection.query(
      `UPDATE applications SET status = 'rejected', updated_at = NOW() WHERE id = ? AND status IN ('offer_letter_sent', 'offer accecepted')`,
      [applicationId],
    );
    if (!applicationResult.affectedRows) {
      await connection.rollback();
      throw new Error("Application is not ready for offer rejection");
    }
    await connection.commit();
    await notifyApplicationStatusChange({
      applicationId,
      status: "rejected",
      triggeredBy: "Candidate",
    });
    return offerResult.affectedRows;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.getOffersForCandidate = async (candidateId, { application_id } = {}) => {
  if (!candidateId) throw new Error("candidate_id is required");

  const where = ["a.candidate_id = ?"];
  const params = [candidateId];
  if (application_id) {
    where.push("o.application_id = ?");
    params.push(application_id);
  }

  const [rows] = await db.promise().query(
    `
      SELECT
        o.*,
        a.id AS application_id,
        a.job_id,
        a.status AS application_status,
        j.title AS job_title,
        c.name AS company_name
      FROM offers o
      JOIN applications a ON o.application_id = a.id
      JOIN job_requisitions j ON a.job_id = j.id
      JOIN companies c ON j.company_id = c.id
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
