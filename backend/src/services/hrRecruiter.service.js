const db = require("../config/db");
const fs = require("fs/promises");
const { notifyApplicationStatusChange } = require("./applicationStatusNotification.service");
const {
  sendInterviewAssignedEmail,
  sendCandidateInterviewInvitationEmail,
  sendJobApprovalRequestEmail,
  sendOfferLetterSentToCandidateEmail,
} = require("./recruitmentEmail.service");
const { generateOfferLetterPdf, buildOfferLetterLinks } = require("../utils/offerLetterPdf.util");
const { createInterviewGoogleMeet } = require("../utils/googleCalendar.util");

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

function parseDateTimeInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeDurationMinutes(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 480) {
    throw new Error("duration_minutes must be an integer between 1 and 480");
  }
  return parsed;
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
    department,
    experience_level,
    salary_min,
    salary_max,
    application_deadline,
    positions_count,
  } = payload;

  if (!company_id || !created_by || !title) {
    throw new Error("company_id, created_by and title are required");
  }

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
    await sendJobApprovalRequestEmail({ jobId, approverId, companyId });
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

exports.listApplications = async ({ job_id }, companyId) => {
  if (!companyId) throw new Error("company_id is required");

  const where = ["j.company_id = ?"];
  const params = [companyId];

  if (job_id) {
    where.push("a.job_id = ?");
    params.push(job_id);
  }

  const [rows] = await db.promise().query(
    `
      SELECT a.*, j.company_id, j.title AS job_title, j.positions_count AS openings_left, u.first_name, u.last_name, u.email, cp.resume_url
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

exports.listCandidates = async ({ job_id }, companyId) => {
  if (!companyId) throw new Error("company_id is required");

  const where = ["j.company_id = ?"];
  const params = [companyId];

  if (job_id) {
    where.push("a.job_id = ?");
    params.push(job_id);
  }

  const [rows] = await db.promise().query(
    `
      SELECT
        u.id AS candidate_id,
        j.company_id,
        u.first_name,
        u.last_name,
        u.email,
        cp.phone,
        cp.address,
        cp.profile_data,
        cp.resume_url,
        cp.is_verified,
        MAX(a.applied_at) AS last_applied_at,
        COUNT(DISTINCT a.id) AS applications_count
      FROM applications a
      JOIN job_requisitions j ON a.job_id = j.id
      JOIN users u ON a.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      WHERE ${where.join(" AND ")}
      GROUP BY
        u.id,
        j.company_id,
        u.first_name,
        u.last_name,
        u.email,
        cp.phone,
        cp.address,
        cp.profile_data,
        cp.resume_url,
        cp.is_verified
      ORDER BY last_applied_at DESC
    `,
    params,
  );
  rows.forEach((row) => {
    row.profile_data = parseJsonField(row.profile_data);
  });
  return rows;
};

exports.listInterviewers = async (companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `
      SELECT id, company_id, first_name, last_name, email
      FROM users
      WHERE role = 'Interviewer' AND company_id = ? AND is_active = 1
      ORDER BY last_name, first_name
    `,
    [companyId],
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
  if (result.affectedRows) {
    await notifyApplicationStatusChange({
      applicationId: id,
      companyId,
      status,
      triggeredBy: "HR Recruiter",
    });
  }
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
  if (result.affectedRows) {
    await notifyApplicationStatusChange({
      applicationId: id,
      companyId,
      status,
      triggeredBy: "HR Recruiter",
    });
  }
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

exports.scheduleInterview = async (payload, companyId, actor = {}) => {
  const { application_id, interviewer_id, scheduled_at, duration_minutes, meeting_link, notes } = payload;
  if (!application_id || !interviewer_id || !scheduled_at) {
    throw new Error("application_id, interviewer_id and scheduled_at are required");
  }
  if (!companyId) throw new Error("company_id is required");

  const scheduledAt = parseDateTimeInput(scheduled_at);
  if (!scheduledAt) {
    throw new Error("scheduled_at must be a valid date or datetime");
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("Interviews cannot be scheduled for a date or time that has already passed");
  }

  const normalizedDuration = normalizeDurationMinutes(duration_minutes);
  const normalizedMeetingLink = String(meeting_link || "").trim();
  if (normalizedMeetingLink) {
    try {
      const meetingLinkUrl = new URL(normalizedMeetingLink);
      if (!["http:", "https:"].includes(meetingLinkUrl.protocol)) {
        throw new Error("meeting_link must use http or https");
      }
    } catch (err) {
      throw new Error("meeting_link must be a valid URL");
    }
  }

  const [interviewerRows] = await db.promise().query(
    `
      SELECT id, email, first_name, last_name
      FROM users
      WHERE id = ? AND company_id = ? AND role = 'Interviewer' AND is_active = 1
      LIMIT 1
    `,
    [interviewer_id, companyId],
  );
  if (!interviewerRows.length) {
    throw new Error("interviewer_id must be an active Interviewer from your company");
  }

  const [applicationRows] = await db.promise().query(
    `
      SELECT
        a.id,
        a.status,
        candidate.email AS candidate_email,
        j.title AS job_title,
        c.name AS company_name
      FROM applications a
      JOIN job_requisitions j ON a.job_id = j.id
      JOIN users candidate ON a.candidate_id = candidate.id
      LEFT JOIN companies c ON c.id = j.company_id
      WHERE a.id = ? AND j.company_id = ?
      LIMIT 1
    `,
    [application_id, companyId],
  );
  const application = applicationRows[0];
  if (!application) {
    throw new Error("application_id must be in interview stage and belong to your company");
  }
  if (String(application.status || "").trim().toLowerCase() !== "interview") {
    throw new Error("application_id must be in interview stage and belong to your company");
  }

  const [pendingInterviewRows] = await db.promise().query(
    `SELECT id FROM interviews WHERE application_id = ? AND status = 'scheduled' LIMIT 1`,
    [application_id],
  );
  if (pendingInterviewRows.length) {
    throw new Error("A scheduled interview already exists for this application");
  }

  let resolvedMeetingLink = normalizedMeetingLink;
  if (!resolvedMeetingLink) {
    try {
      const generatedMeeting = await createInterviewGoogleMeet({
        organizerEmail: String(actor?.email || "").trim(),
        candidateEmail: String(application.candidate_email || "").trim(),
        interviewerEmail: String(interviewerRows[0].email || "").trim(),
        scheduledAt: String(scheduled_at).trim(),
        durationMinutes: normalizedDuration || 60,
        jobTitle: String(application.job_title || "").trim(),
        companyName: String(application.company_name || "").trim(),
        applicationId: application_id,
        notes: String(notes || "").trim(),
      });
      resolvedMeetingLink = generatedMeeting.meetingLink;
    } catch (error) {
      throw new Error(`Failed to auto-generate interview link: ${error.message || "Google Calendar error"}`);
    }
  }

  const [result] = await db.promise().query(
    `
      INSERT INTO interviews (application_id, interviewer_id, scheduled_at, duration_minutes, meeting_link, status, notes, created_at, updated_at)
      SELECT a.id, ?, ?, ?, ?, 'scheduled', ?, NOW(), NOW()
      FROM applications a
      JOIN job_requisitions j ON a.job_id = j.id
      WHERE a.id = ? AND j.company_id = ? AND a.status = 'interview'
    `,
    [
      interviewer_id,
      String(scheduled_at).trim(),
      normalizedDuration,
      resolvedMeetingLink || null,
      notes || null,
      application_id,
      companyId,
    ],
  );
  if (!result.affectedRows) {
    throw new Error("application_id must be in interview stage and belong to your company");
  }
  await sendInterviewAssignedEmail({ interviewId: result.insertId, companyId });
  await sendCandidateInterviewInvitationEmail({ interviewId: result.insertId, companyId });
  return { id: result.insertId };
};

exports.getInterviews = async ({ application_id, interviewer_id }, companyId) => {
  if (!companyId) throw new Error("company_id is required");

  let rows = [];

  if (application_id || interviewer_id) {
    const where = ["j.company_id = ?"];
    const params = [companyId];

    if (application_id) {
      where.push("i.application_id = ?");
      params.push(application_id);
    }

    if (interviewer_id) {
      where.push("i.interviewer_id = ?");
      params.push(interviewer_id);
    }

    const [interviewRows] = await db.promise().query(
      `
        SELECT
          i.*,
          a.job_id,
          a.status AS application_status,
          a.candidate_id,
          j.title AS job_title,
          candidate.first_name AS candidate_first,
          candidate.last_name AS candidate_last,
          candidate.email AS candidate_email,
          cp.phone AS candidate_phone,
          cp.address AS candidate_address,
          cp.profile_data AS candidate_profile_data,
          s.id AS scorecard_id,
          s.recommendation AS scorecard_recommendation,
          s.ratings AS scorecard_ratings,
          s.comments AS scorecard_comments,
          s.is_final AS scorecard_is_final,
          s.submitted_at AS scorecard_submitted_at,
          interviewer.first_name AS interviewer_first,
          interviewer.last_name AS interviewer_last
        FROM interviews i
        JOIN applications a ON i.application_id = a.id
        JOIN job_requisitions j ON a.job_id = j.id
        JOIN users interviewer ON i.interviewer_id = interviewer.id
        JOIN users candidate ON a.candidate_id = candidate.id
        LEFT JOIN candidate_profiles cp ON candidate.id = cp.user_id
        LEFT JOIN scorecards s ON s.id = (
          SELECT s2.id
          FROM scorecards s2
          WHERE s2.interview_id = i.id AND s2.is_final = 1
          ORDER BY COALESCE(s2.submitted_at, s2.updated_at, s2.created_at) DESC, s2.id DESC
          LIMIT 1
        )
        WHERE ${where.join(" AND ")}
        ORDER BY i.scheduled_at DESC
      `,
      params,
    );
    rows = interviewRows;
  } else {
    const [upcomingRows] = await db.promise().query(
      `
        SELECT
          i.id,
          a.id AS application_id,
          i.interviewer_id,
          i.scheduled_at,
          COALESCE(i.status, a.status) AS status,
          i.notes,
          a.job_id,
          a.status AS application_status,
          a.candidate_id,
          j.title AS job_title,
          candidate.first_name AS candidate_first,
          candidate.last_name AS candidate_last,
          candidate.email AS candidate_email,
          cp.phone AS candidate_phone,
          cp.address AS candidate_address,
          cp.profile_data AS candidate_profile_data,
          s.id AS scorecard_id,
          s.recommendation AS scorecard_recommendation,
          s.ratings AS scorecard_ratings,
          s.comments AS scorecard_comments,
          s.is_final AS scorecard_is_final,
          s.submitted_at AS scorecard_submitted_at,
          interviewer.first_name AS interviewer_first,
          interviewer.last_name AS interviewer_last
        FROM applications a
        JOIN job_requisitions j ON a.job_id = j.id
        JOIN users candidate ON a.candidate_id = candidate.id
        LEFT JOIN interviews i ON i.id = (
          SELECT i2.id
          FROM interviews i2
          WHERE i2.application_id = a.id
          ORDER BY i2.created_at DESC
          LIMIT 1
        )
        LEFT JOIN users interviewer ON i.interviewer_id = interviewer.id
        LEFT JOIN candidate_profiles cp ON candidate.id = cp.user_id
        LEFT JOIN scorecards s ON s.id = (
          SELECT s2.id
          FROM scorecards s2
          WHERE s2.interview_id = i.id AND s2.is_final = 1
          ORDER BY COALESCE(s2.submitted_at, s2.updated_at, s2.created_at) DESC, s2.id DESC
          LIMIT 1
        )
        WHERE j.company_id = ? AND a.status IN ('interview', 'interview score submited')
        ORDER BY COALESCE(i.scheduled_at, a.updated_at) DESC
      `,
      [companyId],
    );
    rows = upcomingRows;
  }

  rows.forEach((row) => {
    row.candidate_profile_data = parseJsonField(row.candidate_profile_data);
    row.scorecard_ratings = parseJsonField(row.scorecard_ratings);
  });

  return rows;
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

exports.finalDecision = async (id, status, companyId) => {
  if (!["selected", "rejected"].includes(status)) {
    throw new Error("status must be selected or rejected");
  }
  if (!companyId) throw new Error("company_id is required");

  const [result] = await db.promise().query(
    `
      UPDATE applications a
      JOIN job_requisitions j ON a.job_id = j.id
      SET a.status = ?, a.final_decision_at = NOW(), a.updated_at = NOW()
      WHERE a.id = ? AND j.company_id = ? AND a.status = 'interview score submited'
    `,
    [status, id, companyId],
  );

  if (result.affectedRows) {
    await notifyApplicationStatusChange({
      applicationId: id,
      companyId,
      status,
      triggeredBy: "HR Recruiter",
    });
  }

  return result.affectedRows;
};

exports.listOfferEligibleApplications = async ({ job_id }, companyId) => {
  if (!companyId) throw new Error("company_id is required");

  const where = ["j.company_id = ?", "a.status IN ('interview score submited', 'selected')"];
  const params = [companyId];

  if (job_id) {
    where.push("a.job_id = ?");
    params.push(job_id);
  }

  const [rows] = await db.promise().query(
    `
      SELECT
        a.id AS application_id,
        a.job_id,
        a.status,
        a.updated_at,
        j.title AS job_title,
        u.id AS candidate_id,
        u.first_name AS candidate_first,
        u.last_name AS candidate_last,
        u.email AS candidate_email
      FROM applications a
      JOIN job_requisitions j ON a.job_id = j.id
      JOIN users u ON a.candidate_id = u.id
      WHERE ${where.join(" AND ")}
      ORDER BY a.updated_at DESC
    `,
    params,
  );

  return rows;
};

exports.createOfferDraft = async (payload, companyId) => {
  const { application_id, created_by } = payload;
  const offerDetails = normalizeOfferDetails(payload.offer_details);

  if (!application_id || !created_by) {
    throw new Error("application_id and created_by are required");
  }
  if (!companyId) throw new Error("company_id is required");

  const connection = await db.promise().getConnection();
  let generatedPdfPath = null;

  try {
    await connection.beginTransaction();

    const [contextRows] = await connection.query(
      `
        SELECT
          a.id AS application_id,
          a.status AS application_status,
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
          recruiter.first_name AS recruiter_first_name,
          recruiter.last_name AS recruiter_last_name,
          recruiter.email AS recruiter_email
        FROM applications a
        JOIN job_requisitions j ON a.job_id = j.id
        JOIN companies c ON j.company_id = c.id
        JOIN users candidate ON a.candidate_id = candidate.id
        LEFT JOIN users recruiter ON recruiter.id = ? AND recruiter.company_id = j.company_id
        WHERE a.id = ? AND j.company_id = ? AND a.status IN ('interview score submited', 'selected')
        LIMIT 1
      `,
      [created_by, application_id, companyId],
    );

    const context = contextRows[0];
    if (!context) {
      throw new Error("Only interview score submitted/selected applications from your company can receive offers");
    }

    const [insertResult] = await connection.query(
      `
        INSERT INTO offers (application_id, created_by, status, offer_details, created_at, updated_at)
        SELECT a.id, ?, 'draft', ?, NOW(), NOW()
        FROM applications a
        JOIN job_requisitions j ON a.job_id = j.id
        WHERE a.id = ? AND j.company_id = ? AND a.status IN ('interview score submited', 'selected')
      `,
      [created_by, offerDetails === null ? null : JSON.stringify(offerDetails), application_id, companyId],
    );

    if (!insertResult.affectedRows) {
      throw new Error("Only interview score submitted/selected applications from your company can receive offers");
    }

    const offerId = insertResult.insertId;
    const { absolutePath, relativePath } = await generateOfferLetterPdf({
      offerId,
      companyName: context.company_name,
      companyDomain: context.company_domain,
      companyLogoUrl: context.company_logo_url,
      candidateName: fullName(context.candidate_first_name, context.candidate_last_name, "Candidate"),
      candidateEmail: context.candidate_email,
      recruiterName: fullName(context.recruiter_first_name, context.recruiter_last_name, "HR Team"),
      recruiterEmail: context.recruiter_email,
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
    `
      SELECT o.document_url, o.esign_link
      FROM offers o
      JOIN applications a ON o.application_id = a.id
      JOIN job_requisitions j ON a.job_id = j.id
      WHERE o.id = ? AND j.company_id = ? AND a.status IN ('interview score submited', 'selected')
      LIMIT 1
    `,
    [id, companyId],
  );

  if (!existingRows.length) return 0;

  const finalDocumentUrl = providedDocumentUrl || existingRows[0].document_url || null;
  const finalEsignLink =
    providedEsignLink
    || existingRows[0].esign_link
    || (finalDocumentUrl ? `${finalDocumentUrl}#candidate-esign-${id}` : null);

  const [result] = await db.promise().query(
    `
      UPDATE offers o
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
      WHERE o.id = ? AND j.company_id = ? AND a.status IN ('interview score submited', 'selected')
    `,
    [finalDocumentUrl, finalEsignLink, id, companyId],
  );

  if (result.affectedRows) {
    await sendOfferLetterSentToCandidateEmail({
      offerId: id,
      companyId,
      triggeredBy: "HR Recruiter",
    });
  }

  return result.affectedRows;
};
