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
  if (interviewer_id) {
    const [rows] = await db.promise().query(
      `SELECT i.*, a.candidate_id, u.first_name AS candidate_first, u.last_name AS candidate_last, j.title
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN users u ON a.candidate_id = u.id
       JOIN job_requisitions j ON a.job_id = j.id
       JOIN users interviewer ON i.interviewer_id = interviewer.id
       WHERE i.interviewer_id = ? AND i.status = 'scheduled' AND j.company_id = ? AND interviewer.company_id = ?
       ORDER BY i.scheduled_at`,
      [interviewer_id, companyId, companyId],
    );
    return rows;
  }
  throw new Error("application_id or interviewer_id query param is required");
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
     WHERE i.id = ? AND i.interviewer_id = ? AND j.company_id = ?`,
    [interviewer_id, ratings ? JSON.stringify(ratings) : null, comments || null, recommendation, interview_id, interviewer_id, companyId],
  );
  if (!result.affectedRows) {
    throw new Error("Interview not found for your company");
  }
  return { id: result.insertId };
};

exports.finalizeScorecard = async (id, interviewerId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  if (!interviewerId) throw new Error("interviewer_id is required");
  const [result] = await db.promise().query(
    `UPDATE scorecards s
     JOIN interviews i ON s.interview_id = i.id
     JOIN applications a ON i.application_id = a.id
     JOIN job_requisitions j ON a.job_id = j.id
     SET s.is_final = 1, s.updated_at = NOW()
     WHERE s.id = ? AND s.interviewer_id = ? AND i.interviewer_id = ? AND j.company_id = ?`,
    [id, interviewerId, interviewerId, companyId],
  );
  return result.affectedRows;
};

exports.getScorecardsByInterview = async (interviewId, interviewerId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  if (!interviewerId) throw new Error("interviewer_id is required");
  const [rows] = await db.promise().query(
    `SELECT s.* FROM scorecards s
     JOIN interviews i ON s.interview_id = i.id
     JOIN applications a ON i.application_id = a.id
     JOIN job_requisitions j ON a.job_id = j.id
     WHERE s.interview_id = ? AND s.interviewer_id = ? AND i.interviewer_id = ? AND j.company_id = ?
     ORDER BY s.created_at`,
    [interviewId, interviewerId, interviewerId, companyId],
  );
  rows.forEach((row) => {
    row.ratings = parseJsonField(row.ratings);
  });
  return rows;
};
