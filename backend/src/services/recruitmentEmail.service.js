const db = require("../config/db");
const { sendEmail, buildRecruitmentEmailHtml } = require("../utils/email.util");

function fullName(firstName, lastName, fallback = "User") {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || fallback;
}

function loginUrl() {
  return (
    process.env.FRONTEND_LOGIN_URL ||
    process.env.APP_LOGIN_URL ||
    process.env.LOGIN_URL ||
    "your login page"
  );
}

function canUseCta(url) {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function safeJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

function formatRatingsSummary(ratings) {
  const parsed = safeJson(ratings);
  if (!parsed || typeof parsed !== "object") return "N/A";
  const entries = Object.entries(parsed);
  if (!entries.length) return "N/A";
  return entries
    .map(([key, value]) => `${String(key).replace(/_/g, " ")}: ${value}`)
    .join(", ");
}

async function getCompanyName(companyId) {
  if (!companyId) return "";
  const [rows] = await db.promise().query(`SELECT name FROM companies WHERE id = ? LIMIT 1`, [companyId]);
  return rows[0]?.name || "";
}

async function listActiveUsersByRole(companyId, role) {
  if (!companyId || !role) return [];
  const [rows] = await db.promise().query(
    `
      SELECT id, email, first_name, last_name
      FROM users
      WHERE company_id = ? AND role = ? AND is_active = 1
      ORDER BY id
    `,
    [companyId, role],
  );
  return rows;
}

exports.sendCandidateSignupWelcomeEmail = async ({ email, firstName, lastName }) => {
  if (!email) return false;
  try {
    const candidateName = fullName(firstName, lastName, "Candidate");
    const subject = "Welcome to HireFlow - Signup Successful";
    const text = [
      `Hello ${candidateName},`,
      "",
      "Thank you for signing up on HireFlow.",
      "Your candidate account is ready, and you can now apply for jobs from your dashboard.",
      "",
      `Login: ${loginUrl()}`,
      "",
      "Best regards,",
      "HireFlow Team",
    ].join("\n");
    const url = loginUrl();
    const html = buildRecruitmentEmailHtml({
      preheader: "Welcome to HireFlow",
      title: "Signup Successful",
      subtitle: "Your candidate profile is now active",
      greeting: `Hello ${candidateName},`,
      summary:
        "Thank you for signing up on HireFlow. Your candidate account is ready, and you can now apply for jobs from your dashboard.",
      details: [{ label: "Login", value: url }],
      highlights: [
        "Complete your profile details for better visibility.",
        "Apply to open roles directly from your candidate portal.",
      ],
      tone: "success",
      companyName: "HireFlow",
      footerText: "Best regards,\nHireFlow Team",
      ctaLabel: canUseCta(url) ? "Open Candidate Login" : "",
      ctaUrl: canUseCta(url) ? url : "",
    });
    return sendEmail({ to: email, subject, text, html });
  } catch (err) {
    console.error("Failed to send candidate signup email:", err.message);
    return false;
  }
};

exports.sendCompanyAdminOnboardingEmail = async ({
  email,
  firstName,
  lastName,
  password,
  companyId,
  companyName,
}) => {
  if (!email || !password) return false;
  try {
    const resolvedCompanyName = companyName || (await getCompanyName(companyId)) || "your company";
    const adminName = fullName(firstName, lastName, "Company Admin");
    const subject = `Company Listed Successfully: ${resolvedCompanyName}`;
    const text = [
      `Hello ${adminName},`,
      "",
      `${resolvedCompanyName} has been successfully listed on HireFlow.`,
      "Your Company Admin account credentials are:",
      `Email: ${email}`,
      `Password: ${password}`,
      "",
      `Login: ${loginUrl()}`,
      "Please change your password after first login.",
      "",
      "Best regards,",
      "HireFlow Team",
    ].join("\n");
    const url = loginUrl();
    const html = buildRecruitmentEmailHtml({
      preheader: `Company listed: ${resolvedCompanyName}`,
      title: "Company Listed Successfully",
      subtitle: `${resolvedCompanyName} is now active on HireFlow`,
      greeting: `Hello ${adminName},`,
      summary:
        "Your company was listed successfully and your Company Admin account has been created.",
      details: [
        { label: "Company", value: resolvedCompanyName },
        { label: "Role", value: "Company Admin" },
        { label: "Email", value: email },
        { label: "Temporary Password", value: password },
        { label: "Login", value: url },
      ],
      highlights: [
        "Sign in and update your temporary password immediately.",
        "Set up your hiring team users and access controls.",
      ],
      note: "Please change your password after first login.",
      tone: "success",
      companyName: "HireFlow",
      footerText: "Best regards,\nHireFlow Team",
      ctaLabel: canUseCta(url) ? "Open Login" : "",
      ctaUrl: canUseCta(url) ? url : "",
    });
    return sendEmail({ to: email, subject, text, html });
  } catch (err) {
    console.error("Failed to send company admin onboarding email:", err.message);
    return false;
  }
};

exports.sendTeamMemberCredentialsEmail = async ({
  email,
  firstName,
  lastName,
  role,
  password,
  companyId,
  companyName,
}) => {
  if (!email || !password || !role) return false;
  try {
    const resolvedCompanyName = companyName || (await getCompanyName(companyId)) || "your company";
    const userName = fullName(firstName, lastName, "User");
    const subject = `Your HireFlow ${role} Account Credentials`;
    const text = [
      `Hello ${userName},`,
      "",
      `An account has been created for you as ${role} at ${resolvedCompanyName}.`,
      "Your login credentials are:",
      `Email: ${email}`,
      `Password: ${password}`,
      "",
      `Login: ${loginUrl()}`,
      "Please change your password after first login.",
      "",
      "Best regards,",
      `${resolvedCompanyName} Hiring Team`,
    ].join("\n");
    const url = loginUrl();
    const html = buildRecruitmentEmailHtml({
      preheader: `Your ${role} account is ready`,
      title: "Account Credentials",
      subtitle: `${resolvedCompanyName} recruitment workspace access`,
      greeting: `Hello ${userName},`,
      summary: `An account has been created for you as ${role} at ${resolvedCompanyName}.`,
      details: [
        { label: "Company", value: resolvedCompanyName },
        { label: "Role", value: role },
        { label: "Email", value: email },
        { label: "Temporary Password", value: password },
        { label: "Login", value: url },
      ],
      highlights: [
        "Use these credentials for your first login.",
        "Change your password immediately after sign-in.",
      ],
      note: "Please change your password after first login.",
      tone: "info",
      companyName: resolvedCompanyName,
      footerText: `Best regards,\n${resolvedCompanyName} Hiring Team`,
      ctaLabel: canUseCta(url) ? "Open Login" : "",
      ctaUrl: canUseCta(url) ? url : "",
    });
    return sendEmail({ to: email, subject, text, html });
  } catch (err) {
    console.error("Failed to send team member credentials email:", err.message);
    return false;
  }
};

exports.sendJobApprovalRequestEmail = async ({ jobId, approverId, companyId }) => {
  if (!jobId || !approverId || !companyId) return false;
  try {
    const [rows] = await db.promise().query(
      `
        SELECT
          j.id AS job_id,
          j.title AS job_title,
          requester.first_name AS requester_first_name,
          requester.last_name AS requester_last_name,
          approver.email AS approver_email,
          approver.first_name AS approver_first_name,
          approver.last_name AS approver_last_name,
          c.name AS company_name
        FROM job_requisitions j
        JOIN users requester ON requester.id = j.created_by
        JOIN users approver ON approver.id = ?
        LEFT JOIN companies c ON c.id = j.company_id
        WHERE j.id = ? AND j.company_id = ? AND approver.company_id = j.company_id
        LIMIT 1
      `,
      [approverId, jobId, companyId],
    );

    const context = rows[0];
    if (!context || !context.approver_email) return false;

    const approverName = fullName(context.approver_first_name, context.approver_last_name, "Hiring Manager");
    const requesterName = fullName(context.requester_first_name, context.requester_last_name, "HR Recruiter");
    const companyName = context.company_name || "your company";
    const subject = `Job Approval Required: #${context.job_id} - ${context.job_title}`;
    const text = [
      `Hello ${approverName},`,
      "",
      `A job requisition requires your approval at ${companyName}.`,
      `Job ID: ${context.job_id}`,
      `Job Title: ${context.job_title}`,
      `Requested by: ${requesterName}`,
      "",
      "Please review and take action from your Hiring Manager dashboard.",
      "",
      "Best regards,",
      `${companyName} Hiring Team`,
    ].join("\n");
    const url = loginUrl();
    const html = buildRecruitmentEmailHtml({
      preheader: `Approval required for Job #${context.job_id}`,
      title: "Job Approval Required",
      subtitle: "A requisition is waiting for your decision",
      greeting: `Hello ${approverName},`,
      summary: `A job requisition requires your approval at ${companyName}.`,
      details: [
        { label: "Job ID", value: context.job_id },
        { label: "Job Title", value: context.job_title || "N/A" },
        { label: "Requested By", value: requesterName },
      ],
      highlights: [
        "Review role details, budget, and openings.",
        "Approve or reject from your Hiring Manager dashboard.",
      ],
      tone: "warning",
      companyName,
      footerText: `Best regards,\n${companyName} Hiring Team`,
      ctaLabel: canUseCta(url) ? "Review Requisition" : "",
      ctaUrl: canUseCta(url) ? url : "",
    });
    return sendEmail({ to: context.approver_email, subject, text, html });
  } catch (err) {
    console.error("Failed to send job approval request email:", err.message);
    return false;
  }
};

exports.sendJobApprovalDecisionEmail = async ({
  jobId,
  approverId,
  companyId,
  decision,
  comments,
}) => {
  if (!jobId || !approverId || !companyId || !decision) return false;
  try {
    const [rows] = await db.promise().query(
      `
        SELECT
          j.id AS job_id,
          j.title AS job_title,
          requester.email AS requester_email,
          requester.first_name AS requester_first_name,
          requester.last_name AS requester_last_name,
          approver.first_name AS approver_first_name,
          approver.last_name AS approver_last_name,
          c.name AS company_name
        FROM job_requisitions j
        JOIN users requester ON requester.id = j.created_by
        JOIN users approver ON approver.id = ?
        LEFT JOIN companies c ON c.id = j.company_id
        WHERE j.id = ? AND j.company_id = ? AND approver.company_id = j.company_id
        LIMIT 1
      `,
      [approverId, jobId, companyId],
    );

    const context = rows[0];
    if (!context || !context.requester_email) return false;

    const requesterName = fullName(context.requester_first_name, context.requester_last_name, "Requester");
    const approverName = fullName(context.approver_first_name, context.approver_last_name, "Hiring Manager");
    const companyName = context.company_name || "your company";
    const normalizedDecision = String(decision).trim().toLowerCase();
    const decisionLabel = normalizedDecision === "approved" ? "Approved" : "Rejected";

    const subject = `Job ${decisionLabel}: #${context.job_id} - ${context.job_title}`;
    const lines = [
      `Hello ${requesterName},`,
      "",
      `Your job approval request has been ${decisionLabel.toLowerCase()} by ${approverName}.`,
      `Job ID: ${context.job_id}`,
      `Job Title: ${context.job_title}`,
    ];
    if (comments) {
      lines.push(`Comments: ${comments}`);
    }
    lines.push("", "Best regards,", `${companyName} Hiring Team`);
    const text = lines.join("\n");
    const url = loginUrl();
    const html = buildRecruitmentEmailHtml({
      preheader: `Job #${context.job_id} ${decisionLabel}`,
      title: `Job ${decisionLabel}`,
      subtitle: "Approval workflow has been completed",
      greeting: `Hello ${requesterName},`,
      summary: `Your job approval request has been ${decisionLabel.toLowerCase()} by ${approverName}.`,
      details: [
        { label: "Job ID", value: context.job_id },
        { label: "Job Title", value: context.job_title || "N/A" },
        { label: "Decision", value: decisionLabel },
        ...(comments ? [{ label: "Comments", value: comments }] : []),
      ],
      statusLabel: decisionLabel,
      tone: normalizedDecision === "approved" ? "success" : "danger",
      companyName,
      footerText: `Best regards,\n${companyName} Hiring Team`,
      ctaLabel: canUseCta(url) ? "Open Dashboard" : "",
      ctaUrl: canUseCta(url) ? url : "",
    });
    return sendEmail({ to: context.requester_email, subject, text, html });
  } catch (err) {
    console.error("Failed to send job approval decision email:", err.message);
    return false;
  }
};

exports.sendInterviewAssignedEmail = async ({ interviewId, companyId }) => {
  if (!interviewId || !companyId) return false;
  try {
    const [rows] = await db.promise().query(
      `
        SELECT
          i.id AS interview_id,
          i.application_id,
          i.scheduled_at,
          i.meeting_link,
          i.notes,
          interviewer.email AS interviewer_email,
          interviewer.first_name AS interviewer_first_name,
          interviewer.last_name AS interviewer_last_name,
          candidate.first_name AS candidate_first_name,
          candidate.last_name AS candidate_last_name,
          j.title AS job_title,
          c.name AS company_name
        FROM interviews i
        JOIN applications a ON i.application_id = a.id
        JOIN users interviewer ON i.interviewer_id = interviewer.id
        JOIN users candidate ON a.candidate_id = candidate.id
        JOIN job_requisitions j ON a.job_id = j.id
        LEFT JOIN companies c ON c.id = j.company_id
        WHERE i.id = ? AND j.company_id = ?
        LIMIT 1
      `,
      [interviewId, companyId],
    );

    const context = rows[0];
    if (!context || !context.interviewer_email) return false;

    const interviewerName = fullName(
      context.interviewer_first_name,
      context.interviewer_last_name,
      "Interviewer",
    );
    const candidateName = fullName(
      context.candidate_first_name,
      context.candidate_last_name,
      "Candidate",
    );
    const companyName = context.company_name || "your company";
    const subject = `Interview Assigned: Application #${context.application_id}`;
    const lines = [
      `Hello ${interviewerName},`,
      "",
      "A new interview has been assigned to you.",
      `Interview ID: ${context.interview_id}`,
      `Application ID: ${context.application_id}`,
      `Candidate: ${candidateName}`,
      `Job: ${context.job_title || "N/A"}`,
      `Scheduled At: ${context.scheduled_at || "N/A"}`,
    ];
    if (context.meeting_link) lines.push(`Meeting Link: ${context.meeting_link}`);
    if (context.notes) lines.push(`Notes: ${context.notes}`);
    lines.push("", "Best regards,", `${companyName} Hiring Team`);
    const text = lines.join("\n");
    const url = loginUrl();
    const html = buildRecruitmentEmailHtml({
      preheader: `Interview assigned for Application #${context.application_id}`,
      title: "Interview Assignment",
      subtitle: "A new interview is scheduled for you",
      greeting: `Hello ${interviewerName},`,
      summary: "A new interview has been assigned to you.",
      details: [
        { label: "Interview ID", value: context.interview_id },
        { label: "Application ID", value: context.application_id },
        { label: "Candidate", value: candidateName },
        { label: "Job", value: context.job_title || "N/A" },
        { label: "Scheduled At", value: formatDateTime(context.scheduled_at) },
        ...(context.meeting_link ? [{ label: "Meeting Link", value: context.meeting_link }] : []),
        ...(context.notes ? [{ label: "Notes", value: context.notes }] : []),
      ],
      highlights: [
        "Review candidate application before the interview.",
        "Submit scorecard after completion to update HR.",
      ],
      tone: "info",
      companyName,
      footerText: `Best regards,\n${companyName} Hiring Team`,
      ctaLabel: canUseCta(url) ? "Open Interview Dashboard" : "",
      ctaUrl: canUseCta(url) ? url : "",
    });

    return sendEmail({ to: context.interviewer_email, subject, text, html });
  } catch (err) {
    console.error("Failed to send interview assignment email:", err.message);
    return false;
  }
};

exports.sendScoreSubmittedToHrEmail = async ({ scorecardId, companyId }) => {
  if (!scorecardId || !companyId) return false;
  try {
    const [rows] = await db.promise().query(
      `
        SELECT
          s.id AS scorecard_id,
          s.recommendation,
          s.ratings,
          a.id AS application_id,
          candidate.first_name AS candidate_first_name,
          candidate.last_name AS candidate_last_name,
          interviewer.first_name AS interviewer_first_name,
          interviewer.last_name AS interviewer_last_name,
          j.title AS job_title,
          c.name AS company_name
        FROM scorecards s
        JOIN interviews i ON s.interview_id = i.id
        JOIN applications a ON i.application_id = a.id
        JOIN users candidate ON a.candidate_id = candidate.id
        JOIN users interviewer ON s.interviewer_id = interviewer.id
        JOIN job_requisitions j ON a.job_id = j.id
        LEFT JOIN companies c ON c.id = j.company_id
        WHERE s.id = ? AND j.company_id = ?
        LIMIT 1
      `,
      [scorecardId, companyId],
    );
    const context = rows[0];
    if (!context) return false;

    const hrUsers = await listActiveUsersByRole(companyId, "HR");
    if (!hrUsers.length) return false;

    const candidateName = fullName(
      context.candidate_first_name,
      context.candidate_last_name,
      "Candidate",
    );
    const interviewerName = fullName(
      context.interviewer_first_name,
      context.interviewer_last_name,
      "Interviewer",
    );
    const ratingsSummary = formatRatingsSummary(context.ratings);
    const companyName = context.company_name || "your company";
    const subject = `Interview Score Submitted: Application #${context.application_id}`;

    await Promise.all(
      hrUsers.map((hr) => {
        const hrName = fullName(hr.first_name, hr.last_name, "HR");
        const text = [
          `Hello ${hrName},`,
          "",
          "An interviewer has finalized a scorecard.",
          `Application ID: ${context.application_id}`,
          `Candidate: ${candidateName}`,
          `Job: ${context.job_title || "N/A"}`,
          `Interviewer: ${interviewerName}`,
          `Recommendation: ${context.recommendation || "N/A"}`,
          `Ratings: ${ratingsSummary}`,
          "",
          "Please review in your HR dashboard.",
          "",
          "Best regards,",
          `${companyName} Hiring Team`,
        ].join("\n");
        const url = loginUrl();
        const html = buildRecruitmentEmailHtml({
          preheader: `Score submitted for Application #${context.application_id}`,
          title: "Interview Score Submitted",
          subtitle: "Scorecard has been finalized",
          greeting: `Hello ${hrName},`,
          summary: "An interviewer has finalized a scorecard.",
          details: [
            { label: "Application ID", value: context.application_id },
            { label: "Candidate", value: candidateName },
            { label: "Job", value: context.job_title || "N/A" },
            { label: "Interviewer", value: interviewerName },
            { label: "Recommendation", value: context.recommendation || "N/A" },
            { label: "Ratings Summary", value: ratingsSummary },
          ],
          highlights: ["Review score details and take final candidate action from HR dashboard."],
          tone: "warning",
          companyName,
          footerText: `Best regards,\n${companyName} Hiring Team`,
          ctaLabel: canUseCta(url) ? "Review in HR Dashboard" : "",
          ctaUrl: canUseCta(url) ? url : "",
        });
        return sendEmail({ to: hr.email, subject, text, html });
      }),
    );
    return true;
  } catch (err) {
    console.error("Failed to send score submitted email to HR:", err.message);
    return false;
  }
};

exports.sendOfferAcceptedToHiringManagersEmail = async ({ applicationId, companyId }) => {
  if (!applicationId || !companyId) return false;
  try {
    const [rows] = await db.promise().query(
      `
        SELECT
          a.id AS application_id,
          candidate.first_name AS candidate_first_name,
          candidate.last_name AS candidate_last_name,
          j.title AS job_title,
          c.name AS company_name
        FROM applications a
        JOIN users candidate ON a.candidate_id = candidate.id
        JOIN job_requisitions j ON a.job_id = j.id
        LEFT JOIN companies c ON c.id = j.company_id
        WHERE a.id = ? AND j.company_id = ?
        LIMIT 1
      `,
      [applicationId, companyId],
    );
    const context = rows[0];
    if (!context) return false;

    const managers = await listActiveUsersByRole(companyId, "HiringManager");
    if (!managers.length) return false;

    const candidateName = fullName(
      context.candidate_first_name,
      context.candidate_last_name,
      "Candidate",
    );
    const companyName = context.company_name || "your company";
    const subject = `Offer Accepted: Application #${context.application_id}`;

    await Promise.all(
      managers.map((manager) => {
        const managerName = fullName(manager.first_name, manager.last_name, "Hiring Manager");
        const text = [
          `Hello ${managerName},`,
          "",
          "A candidate has accepted the offer letter.",
          `Application ID: ${context.application_id}`,
          `Candidate: ${candidateName}`,
          `Job: ${context.job_title || "N/A"}`,
          "",
          "Please review and provide final hiring decision in your dashboard.",
          "",
          "Best regards,",
          `${companyName} Hiring Team`,
        ].join("\n");
        const url = loginUrl();
        const html = buildRecruitmentEmailHtml({
          preheader: `Offer accepted for Application #${context.application_id}`,
          title: "Offer Accepted",
          subtitle: "Final hiring decision required",
          greeting: `Hello ${managerName},`,
          summary: "A candidate has accepted the offer letter.",
          details: [
            { label: "Application ID", value: context.application_id },
            { label: "Candidate", value: candidateName },
            { label: "Job", value: context.job_title || "N/A" },
          ],
          highlights: [
            "Open your dashboard and submit final hiring decision.",
            "Decision will finalize candidate status and close workflow.",
          ],
          tone: "success",
          companyName,
          footerText: `Best regards,\n${companyName} Hiring Team`,
          ctaLabel: canUseCta(url) ? "Open Hiring Manager Dashboard" : "",
          ctaUrl: canUseCta(url) ? url : "",
        });
        return sendEmail({ to: manager.email, subject, text, html });
      }),
    );

    return true;
  } catch (err) {
    console.error("Failed to send offer accepted email to hiring managers:", err.message);
    return false;
  }
};
