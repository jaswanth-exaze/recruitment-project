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

exports.getInterviews = async ({ application_id, interviewer_id }) => {
  if (application_id) {
    const [rows] = await db.promise().query(
      `SELECT i.*, u.first_name AS interviewer_first, u.last_name AS interviewer_last FROM interviews i JOIN users u ON i.interviewer_id = u.id WHERE i.application_id = ? ORDER BY i.scheduled_at`,
      [application_id],
    );
    return rows;
  }
  if (interviewer_id) {
    const [rows] = await db.promise().query(
      `SELECT i.*, a.candidate_id, u.first_name AS candidate_first, u.last_name AS candidate_last, j.title FROM interviews i JOIN applications a ON i.application_id = a.id JOIN users u ON a.candidate_id = u.id JOIN job_requisitions j ON a.job_id = j.id WHERE i.interviewer_id = ? AND i.status = 'scheduled' ORDER BY i.scheduled_at`,
      [interviewer_id],
    );
    return rows;
  }
  throw new Error("application_id or interviewer_id query param is required");
};

exports.updateInterview = async (id, status, notes) => {
  const [result] = await db.promise().query(
    `UPDATE interviews SET status = ?, notes = ?, updated_at = NOW() WHERE id = ?`,
    [status, notes || null, id],
  );
  return result.affectedRows;
};

exports.submitScorecard = async (payload) => {
  const { interview_id, interviewer_id, ratings, comments, recommendation } = payload;
  if (!interview_id || !interviewer_id || !recommendation) {
    throw new Error("interview_id, interviewer_id and recommendation are required");
  }
  const [result] = await db.promise().query(
    `INSERT INTO scorecards (interview_id, interviewer_id, ratings, comments, recommendation, is_final, submitted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW(), NOW())`,
    [interview_id, interviewer_id, ratings ? JSON.stringify(ratings) : null, comments || null, recommendation],
  );
  return { id: result.insertId };
};

exports.finalizeScorecard = async (id) => {
  const [result] = await db.promise().query(
    `UPDATE scorecards SET is_final = 1, updated_at = NOW() WHERE id = ?`,
    [id],
  );
  return result.affectedRows;
};

exports.getScorecardsByInterview = async (interviewId) => {
  const [rows] = await db.promise().query(
    `SELECT * FROM scorecards WHERE interview_id = ? ORDER BY created_at`,
    [interviewId],
  );
  rows.forEach((row) => {
    row.ratings = parseJsonField(row.ratings);
  });
  return rows;
};
