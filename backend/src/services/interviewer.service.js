const db = require("../config/db");
const { notifyApplicationStatusChange } = require("./applicationStatusNotification.service");
const { sendScoreSubmittedToHrEmail } = require("./recruitmentEmail.service");

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
      SELECT
        u.id,
        u.company_id,
        c.name AS company_name,
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

exports.getInterviews = async ({ application_id, interviewer_id }, companyId) => {
  if (!companyId) throw new Error("company_id is required");

  if (application_id) {
    const sql = interviewer_id
      ? `SELECT i.*, u.first_name AS interviewer_first, u.last_name AS interviewer_last
         FROM interviews i
         JOIN applications a ON i.application_id = a.id
         JOIN job_requisitions j ON a.job_id = j.id
         JOIN users u ON i.interviewer_id = u.id
         WHERE i.application_id = ? AND i.interviewer_id = ? AND j.company_id = ?
         ORDER BY i.scheduled_at`
      : `SELECT i.*, u.first_name AS interviewer_first, u.last_name AS interviewer_last
         FROM interviews i
         JOIN applications a ON i.application_id = a.id
         JOIN job_requisitions j ON a.job_id = j.id
         JOIN users u ON i.interviewer_id = u.id
         WHERE i.application_id = ? AND j.company_id = ?
         ORDER BY i.scheduled_at`;

    const params = interviewer_id ? [application_id, interviewer_id, companyId] : [application_id, companyId];
    const [rows] = await db.promise().query(sql, params);
    return rows;
  }

  const [rows] = await db.promise().query(
    `
      SELECT
        i.id,
        i.interviewer_id,
        i.scheduled_at,
        COALESCE(i.status, a.status) AS status,
        i.notes,
        a.id AS application_id,
        a.job_id,
        a.candidate_id,
        a.status AS application_status,
        a.updated_at AS application_updated_at,
        candidate.first_name AS candidate_first,
        candidate.last_name AS candidate_last,
        j.title,
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
      WHERE j.company_id = ? AND a.status = 'interview'
      ORDER BY COALESCE(i.scheduled_at, a.updated_at) DESC
    `,
    [companyId],
  );

  return rows;
};

exports.updateInterview = async (id, status, notes, interviewerId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  if (!interviewerId) throw new Error("interviewer_id is required");
  const [result] = await db.promise().query(
    `UPDATE interviews i
     JOIN applications a ON i.application_id = a.id
     JOIN job_requisitions j ON a.job_id = j.id
     SET i.status = ?, i.notes = ?, i.updated_at = NOW()
     WHERE i.id = ? AND i.interviewer_id = ? AND j.company_id = ?`,
    [status, notes || null, id, interviewerId, companyId],
  );
  return result.affectedRows;
};

exports.getPendingScorecardInterviews = async (interviewerId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  if (!interviewerId) throw new Error("interviewer_id is required");

  const [rows] = await db.promise().query(
    `
      SELECT
        i.id,
        i.application_id,
        i.interviewer_id,
        i.scheduled_at,
        i.status,
        a.job_id,
        j.title,
        candidate.first_name AS candidate_first,
        candidate.last_name AS candidate_last
      FROM interviews i
      JOIN applications a ON i.application_id = a.id
      JOIN job_requisitions j ON a.job_id = j.id
      JOIN users candidate ON a.candidate_id = candidate.id
      WHERE i.interviewer_id = ? AND j.company_id = ? AND i.status = 'scheduled'
      ORDER BY i.scheduled_at
    `,
    [interviewerId, companyId],
  );

  return rows;
};

exports.submitScorecard = async (payload, companyId) => {
  const { interview_id, interviewer_id, ratings, comments, recommendation } = payload;
  if (!interview_id || !interviewer_id || !recommendation) {
    throw new Error("interview_id, interviewer_id and recommendation are required");
  }
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `INSERT INTO scorecards (interview_id, interviewer_id, ratings, comments, recommendation, is_final, submitted_at, created_at, updated_at)
     SELECT i.id, ?, ?, ?, ?, 0, NOW(), NOW(), NOW()
     FROM interviews i
     JOIN applications a ON i.application_id = a.id
     JOIN job_requisitions j ON a.job_id = j.id
     WHERE i.id = ? AND i.interviewer_id = ? AND j.company_id = ? AND i.status = 'scheduled'`,
    [interviewer_id, ratings ? JSON.stringify(ratings) : null, comments || null, recommendation, interview_id, interviewer_id, companyId],
  );
  if (!result.affectedRows) {
    throw new Error("Only pending interviews can be scored");
  }
  return { id: result.insertId };
};

exports.finalizeScorecard = async (id, interviewerId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  if (!interviewerId) throw new Error("interviewer_id is required");
  const connection = await db.promise().getConnection();
  let affectedRows = 0;
  let applicationId = null;

  try {
    await connection.beginTransaction();

    const [applicationRows] = await connection.query(
      `SELECT a.id AS application_id
       FROM scorecards s
       JOIN interviews i ON s.interview_id = i.id
       JOIN applications a ON i.application_id = a.id
       JOIN job_requisitions j ON a.job_id = j.id
       WHERE s.id = ? AND s.interviewer_id = ? AND i.interviewer_id = ? AND j.company_id = ? AND s.is_final = 0 AND i.status = 'scheduled' AND a.status = 'interview'
       LIMIT 1`,
      [id, interviewerId, interviewerId, companyId],
    );

    if (!applicationRows.length) {
      await connection.rollback();
      return 0;
    }

    applicationId = applicationRows[0].application_id;

    const [result] = await connection.query(
      `UPDATE scorecards s
       JOIN interviews i ON s.interview_id = i.id
       JOIN applications a ON i.application_id = a.id
       JOIN job_requisitions j ON a.job_id = j.id
       SET
         s.is_final = 1,
         s.updated_at = NOW(),
         i.status = 'completed',
         i.updated_at = NOW(),
         a.status = 'interview score submited',
         a.updated_at = NOW()
       WHERE s.id = ? AND s.interviewer_id = ? AND i.interviewer_id = ? AND j.company_id = ? AND s.is_final = 0 AND i.status = 'scheduled' AND a.status = 'interview'`,
      [id, interviewerId, interviewerId, companyId],
    );

    affectedRows = result.affectedRows;
    if (!affectedRows) {
      await connection.rollback();
      return 0;
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    if (
      err &&
      (err.code === "WARN_DATA_TRUNCATED" ||
        err.code === "ER_TRUNCATED_WRONG_VALUE" ||
        err.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD")
    ) {
      throw new Error(
        "applications.status must include 'interview score submited' before finalizing scorecards",
      );
    }
    throw err;
  } finally {
    connection.release();
  }

  await notifyApplicationStatusChange({
    applicationId,
    companyId,
    status: "interview score submited",
    triggeredBy: "Interviewer",
  });
  await sendScoreSubmittedToHrEmail({ scorecardId: id, companyId });

  return affectedRows;
};

exports.getScorecardsByInterview = async (interviewId, interviewerId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  if (!interviewerId) throw new Error("interviewer_id is required");

  const where = ["s.interviewer_id = ?", "i.interviewer_id = ?", "j.company_id = ?"];
  const params = [interviewerId, interviewerId, companyId];
  if (interviewId) {
    where.push("s.interview_id = ?");
    params.push(interviewId);
  }

  const [rows] = await db.promise().query(
    `
      SELECT
        s.*,
        i.application_id,
        i.scheduled_at,
        i.status AS interview_status,
        a.job_id,
        a.status AS application_status,
        j.title AS job_title,
        candidate.first_name AS candidate_first,
        candidate.last_name AS candidate_last
      FROM scorecards s
      JOIN interviews i ON s.interview_id = i.id
      JOIN applications a ON i.application_id = a.id
      JOIN job_requisitions j ON a.job_id = j.id
      JOIN users candidate ON a.candidate_id = candidate.id
      WHERE ${where.join(" AND ")}
      ORDER BY COALESCE(s.submitted_at, s.updated_at, s.created_at) DESC, s.id DESC
    `,
    params,
  );

  rows.forEach((row) => {
    row.ratings = parseJsonField(row.ratings);
  });
  return rows;
};
