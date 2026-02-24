const db = require("../config/db");
const { notifyApplicationStatusChange } = require("./applicationStatusNotification.service");
const { sendJobApprovalDecisionEmail } = require("./recruitmentEmail.service");

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

exports.listPendingApprovals = async (approverId, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `SELECT ja.*, j.title, j.created_by, u.first_name AS requester FROM job_approvals ja JOIN job_requisitions j ON ja.job_id = j.id JOIN users u ON j.created_by = u.id JOIN users approver ON ja.approver_id = approver.id WHERE ja.approver_id = ? AND ja.status = 'pending' AND j.company_id = ? AND approver.company_id = ?`,
    [approverId, companyId, companyId],
  );
  return rows;
};

exports.listJobs = async (companyId, { status } = {}) => {
  if (!companyId) throw new Error("company_id is required");

  const where = ["j.company_id = ?"];
  const params = [companyId];
  if (status) {
    where.push("j.status = ?");
    params.push(status);
  }

  const [rows] = await db.promise().query(
    `
      SELECT
        j.id,
        j.company_id,
        j.created_by,
        j.title,
        j.description,
        j.requirements,
        j.location,
        j.employment_type,
        j.department,
        j.experience_level,
        j.salary_min,
        j.salary_max,
        j.application_deadline,
        j.status,
        j.published_at,
        j.closed_at,
        j.positions_count,
        j.created_at,
        j.updated_at,
        c.name AS company_name,
        u.first_name AS creator_first,
        u.last_name AS creator_last
      FROM job_requisitions j
      JOIN companies c ON j.company_id = c.id
      JOIN users u ON j.created_by = u.id
      WHERE ${where.join(" AND ")}
      ORDER BY j.created_at DESC
    `,
    params,
  );

  return rows;
};

exports.listOfferAcceptedApplications = async (companyId, { job_id } = {}) => {
  if (!companyId) throw new Error("company_id is required");

  const where = ["j.company_id = ?", "a.status = 'offer accecepted'"];
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
        a.applied_at,
        a.updated_at,
        j.positions_count AS openings_left,
        u.id AS candidate_id,
        u.first_name AS candidate_first_name,
        u.last_name AS candidate_last_name,
        u.email AS candidate_email,
        j.title AS job_title
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
    await sendJobApprovalDecisionEmail({
      jobId,
      approverId,
      companyId,
      decision: "approved",
      comments: comments || null,
    });
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
    await sendJobApprovalDecisionEmail({
      jobId,
      approverId,
      companyId,
      decision: "rejected",
      comments: comments || null,
    });
    return 1;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.finalDecision = async (id, status, companyId) => {
  if (!["hired", "rejected"].includes(status)) {
    throw new Error("status must be hired or rejected");
  }
  if (!companyId) throw new Error("company_id is required");
  const connection = await db.promise().getConnection();
  let txActive = false;

  try {
    await connection.beginTransaction();
    txActive = true;

    const [applicationRows] = await connection.query(
      `SELECT a.id, a.job_id, a.status, j.positions_count, j.status AS job_status
       FROM applications a
       JOIN job_requisitions j ON a.job_id = j.id
       WHERE a.id = ? AND j.company_id = ?
       LIMIT 1
       FOR UPDATE`,
      [id, companyId],
    );

    if (!applicationRows.length) {
      await connection.rollback();
      txActive = false;
      return 0;
    }

    const row = applicationRows[0];
    if (String(row.status || "").toLowerCase() !== "offer accecepted") {
      await connection.rollback();
      txActive = false;
      return 0;
    }

    if (status === "hired") {
      const openings = Number(row.positions_count || 0);
      if (openings <= 0) {
        await connection.query(
          `UPDATE job_requisitions
           SET status = 'closed',
               closed_at = COALESCE(closed_at, NOW()),
               updated_at = NOW()
           WHERE id = ? AND company_id = ? AND status <> 'closed'`,
          [row.job_id, companyId],
        );
        await connection.commit();
        txActive = false;
        throw new Error("No openings left for this job. Job is now closed.");
      }
    }

    const [applicationUpdate] = await connection.query(
      `UPDATE applications
       SET status = ?, final_decision_at = NOW(), updated_at = NOW()
       WHERE id = ? AND status = 'offer accecepted'`,
      [status, id],
    );

    if (!applicationUpdate.affectedRows) {
      await connection.rollback();
      txActive = false;
      return 0;
    }

    if (status === "hired") {
      const [jobUpdate] = await connection.query(
        `UPDATE job_requisitions
         SET positions_count = positions_count - 1,
             updated_at = NOW()
         WHERE id = ? AND company_id = ? AND positions_count > 0`,
        [row.job_id, companyId],
      );

      if (!jobUpdate.affectedRows) {
        await connection.rollback();
        txActive = false;
        throw new Error("Failed to update job openings for this hire.");
      }

      await connection.query(
        `UPDATE job_requisitions
         SET status = 'closed',
             closed_at = COALESCE(closed_at, NOW()),
             updated_at = NOW()
         WHERE id = ? AND company_id = ? AND positions_count <= 0 AND status <> 'closed'`,
        [row.job_id, companyId],
      );
    }

    await connection.commit();
    txActive = false;

    await notifyApplicationStatusChange({
      applicationId: id,
      companyId,
      status,
      triggeredBy: "Hiring Manager",
    });

    return applicationUpdate.affectedRows;
  } catch (err) {
    if (txActive) {
      await connection.rollback();
    }
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

exports.getJobById = async (id, companyId) => {
  if (!companyId) throw new Error("company_id is required");
  const [rows] = await db.promise().query(
    `SELECT j.*, c.name AS company_name, u.first_name AS creator_first, u.last_name AS creator_last FROM job_requisitions j JOIN companies c ON j.company_id = c.id JOIN users u ON j.created_by = u.id WHERE j.id = ? AND j.company_id = ? LIMIT 1`,
    [id, companyId],
  );
  return rows[0] || null;
};
