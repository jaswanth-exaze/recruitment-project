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

exports.listPendingApprovals = async (approverId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `SELECT ja.*, j.title, j.created_by, u.first_name AS requester FROM job_approvals ja JOIN job_requisitions j ON ja.job_id = j.id JOIN users u ON j.created_by = u.id JOIN users approver ON ja.approver_id = approver.id WHERE ja.approver_id = ? AND ja.status = 'pending' AND j.company_id = ? AND approver.company_id = ?`,
    [approverId, companyId, companyId],
  );
  return rows;
};

exports.approveJob = async (jobId, approverId, comments, companyId) => {
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

    const [approvalResult] = await connection.query(
      `UPDATE job_approvals ja JOIN job_requisitions j ON ja.job_id = j.id SET ja.status = 'approved', ja.comments = ?, ja.approved_at = NOW(), ja.updated_at = NOW() WHERE ja.job_id = ? AND ja.approver_id = ? AND j.company_id = ?`,
      [comments || null, jobId, approverId, companyId],
    );
    if (!approvalResult.affectedRows) {
      await connection.rollback();
      return 0;
    }
    await connection.query(
      `UPDATE job_requisitions SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = ? AND company_id = ?`,
      [jobId, companyId],
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

exports.rejectJob = async (jobId, approverId, comments, companyId) => {
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

    const [approvalResult] = await connection.query(
      `UPDATE job_approvals ja JOIN job_requisitions j ON ja.job_id = j.id SET ja.status = 'rejected', ja.comments = ?, ja.updated_at = NOW() WHERE ja.job_id = ? AND ja.approver_id = ? AND j.company_id = ?`,
      [comments || null, jobId, approverId, companyId],
    );
    if (!approvalResult.affectedRows) {
      await connection.rollback();
      return 0;
    }
    await connection.query(`UPDATE job_requisitions SET status = 'rejected', updated_at = NOW() WHERE id = ? AND company_id = ?`, [
      jobId,
      companyId,
    ]);
    await connection.commit();
    return 1;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.finalDecision = async (id, status, companyId) => {
  if (!["selected", "rejected"].includes(status)) {
    throw new Error("status must be selected or rejected");
  }
  if (!companyId) throw new Error("company_id is required");
  const [result] = await db.promise().query(
    `UPDATE applications a JOIN job_requisitions j ON a.job_id = j.id SET a.status = ?, a.final_decision_at = NOW(), a.updated_at = NOW() WHERE a.id = ? AND j.company_id = ?`,
    [status, id, companyId],
  );
  return result.affectedRows;
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

exports.getJobById = async (id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `SELECT j.*, c.name AS company_name, u.first_name AS creator_first, u.last_name AS creator_last FROM job_requisitions j JOIN companies c ON j.company_id = c.id JOIN users u ON j.created_by = u.id WHERE j.id = ? AND j.company_id = ? LIMIT 1`,
    [id, companyId],
  );
  return rows[0] || null;
};
