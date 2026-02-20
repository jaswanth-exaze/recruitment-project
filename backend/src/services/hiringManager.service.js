const db = require("../config/db");

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

exports.listPendingApprovals = async (approverId) => {
  const [rows] = await db.promise().query(
    `SELECT ja.*, j.title, j.created_by, u.first_name AS requester FROM job_approvals ja JOIN job_requisitions j ON ja.job_id = j.id JOIN users u ON j.created_by = u.id WHERE ja.approver_id = ? AND ja.status = 'pending'`,
    [approverId],
  );
  return rows;
};

exports.approveJob = async (jobId, approverId, comments) => {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [approvalResult] = await connection.query(
      `UPDATE job_approvals SET status = 'approved', comments = ?, approved_at = NOW(), updated_at = NOW() WHERE job_id = ? AND approver_id = ?`,
      [comments || null, jobId, approverId],
    );
    if (!approvalResult.affectedRows) {
      await connection.rollback();
      return 0;
    }
    await connection.query(
      `UPDATE job_requisitions SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [jobId],
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

exports.rejectJob = async (jobId, approverId, comments) => {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [approvalResult] = await connection.query(
      `UPDATE job_approvals SET status = 'rejected', comments = ?, updated_at = NOW() WHERE job_id = ? AND approver_id = ?`,
      [comments || null, jobId, approverId],
    );
    if (!approvalResult.affectedRows) {
      await connection.rollback();
      return 0;
    }
    await connection.query(`UPDATE job_requisitions SET status = 'rejected', updated_at = NOW() WHERE id = ?`, [jobId]);
    await connection.commit();
    return 1;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.finalDecision = async (id, status) => {
  if (!["selected", "rejected"].includes(status)) {
    throw new Error("status must be selected or rejected");
  }
  const [result] = await db.promise().query(
    `UPDATE applications SET status = ?, final_decision_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [status, id],
  );
  return result.affectedRows;
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

exports.getJobById = async (id) => {
  const [rows] = await db.promise().query(
    `SELECT j.*, c.name AS company_name, u.first_name AS creator_first, u.last_name AS creator_last FROM job_requisitions j JOIN companies c ON j.company_id = c.id JOIN users u ON j.created_by = u.id WHERE j.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
};
