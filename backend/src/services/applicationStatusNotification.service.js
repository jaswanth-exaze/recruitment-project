const db = require("../config/db");
const { sendEmail, buildRecruitmentEmailHtml } = require("../utils/email.util");

function toStatusLabel(status) {
  const value = String(status || "").trim();
  if (!value) return "Updated";
  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function loginUrl() {
  return (
    process.env.FRONTEND_LOGIN_URL ||
    process.env.APP_LOGIN_URL ||
    process.env.LOGIN_URL ||
    ""
  );
}

function canUseCta(url) {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function statusTone(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["hired", "selected", "offer_accepted"].includes(normalized)) return "success";
  if (["rejected"].includes(normalized)) return "danger";
  if (["interview", "interview_score_submitted", "offer_letter_sent"].includes(normalized)) return "warning";
  return "info";
}

function statusSpecificLine(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "hired") {
    return "Congratulations! You have been hired.";
  }
  if (normalized === "offer_letter_sent") {
    return "Your offer letter is available in your candidate portal.";
  }
  return "";
}

async function getApplicationEmailContext(applicationId, companyId) {
  const params = [applicationId];
  const companySql = companyId ? " AND j.company_id = ?" : "";
  if (companyId) params.push(companyId);

  const [rows] = await db.promise().query(
    `
      SELECT
        a.id AS application_id,
        a.status,
        a.applied_at,
        a.updated_at,
        u.email AS candidate_email,
        u.first_name AS candidate_first_name,
        u.last_name AS candidate_last_name,
        j.title AS job_title,
        c.name AS company_name
      FROM applications a
      JOIN users u ON a.candidate_id = u.id
      JOIN job_requisitions j ON a.job_id = j.id
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE a.id = ?${companySql}
      LIMIT 1
    `,
    params,
  );

  return rows[0] || null;
}

exports.notifyApplicationStatusChange = async ({ applicationId, companyId, status, triggeredBy }) => {
  if (!applicationId) return false;

  try {
    const context = await getApplicationEmailContext(applicationId, companyId);
    if (!context || !context.candidate_email) return false;

    const resolvedStatus = String(status || context.status || "").trim();
    const statusLabel = toStatusLabel(resolvedStatus);
    const jobTitle = context.job_title || "Untitled Job";
    const companyName = context.company_name || "your company";
    const candidateName = [context.candidate_first_name, context.candidate_last_name].filter(Boolean).join(" ").trim() || "Candidate";

    const subject = `Application Status Update: ${statusLabel}`;

    const actorText = triggeredBy ? `Updated by: ${triggeredBy}.` : "";
    const specificLine = statusSpecificLine(resolvedStatus);
    const updatedAt = context.updated_at ? new Date(context.updated_at).toLocaleString() : "";
    const url = loginUrl();

    const text = [
      `Hello ${candidateName},`,
      "",
      `Your application (#${context.application_id}) for "${jobTitle}" at ${companyName} has been updated.`,
      `Current status: ${statusLabel}.`,
      specificLine,
      actorText.trim(),
      "",
      "Please log in to your candidate dashboard for more details.",
      "",
      "Thanks,",
      `${companyName} Hiring Team`,
    ]
      .filter(Boolean)
      .join("\n");

    const html = buildRecruitmentEmailHtml({
      preheader: `Application #${context.application_id} status changed`,
      title: "Application Status Updated",
      subtitle: `Current status: ${statusLabel}`,
      greeting: `Hello ${candidateName},`,
      summary: `Your application for "${jobTitle}" at ${companyName} has been updated.`,
      details: [
        { label: "Application ID", value: context.application_id },
        { label: "Job Title", value: jobTitle },
        { label: "Company", value: companyName },
        { label: "Current Status", value: statusLabel },
        ...(updatedAt ? [{ label: "Updated At", value: updatedAt }] : []),
        ...(actorText ? [{ label: "Updated By", value: triggeredBy }] : []),
      ],
      highlights: [
        specificLine || "Please check your dashboard for the latest progress and next steps.",
      ],
      statusLabel,
      tone: statusTone(resolvedStatus),
      companyName,
      footerText: `Thanks,\n${companyName} Hiring Team`,
      ctaLabel: canUseCta(url) ? "Open Candidate Dashboard" : "",
      ctaUrl: canUseCta(url) ? url : "",
    });

    return sendEmail({
      to: context.candidate_email,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("Failed to notify application status change:", err.message);
    return false;
  }
};

exports.notifyApplicationSubmitted = async ({ applicationId, companyId }) => {
  if (!applicationId) return false;

  try {
    const context = await getApplicationEmailContext(applicationId, companyId);
    if (!context || !context.candidate_email) return false;

    const jobTitle = context.job_title || "Untitled Job";
    const companyName = context.company_name || "the company";
    const candidateName =
      [context.candidate_first_name, context.candidate_last_name].filter(Boolean).join(" ").trim() || "Candidate";

    const subject = "Application Submitted Successfully";
    const appliedAt = context.applied_at ? new Date(context.applied_at).toLocaleString() : "";
    const url = loginUrl();

    const text = [
      `Hello ${candidateName},`,
      "",
      `Your application (#${context.application_id}) for "${jobTitle}" at ${companyName} was submitted successfully.`,
      `Current status: ${toStatusLabel(context.status || "applied")}.`,
      appliedAt ? `Applied at: ${appliedAt}.` : "",
      "We will review your profile and update your application status soon.",
      "",
      "Thanks,",
      `${companyName} Hiring Team`,
    ].join("\n");

    const html = buildRecruitmentEmailHtml({
      preheader: `Application #${context.application_id} submitted`,
      title: "Application Submitted",
      subtitle: "Your job application is now in review",
      greeting: `Hello ${candidateName},`,
      summary: `Your application for "${jobTitle}" at ${companyName} was submitted successfully.`,
      details: [
        { label: "Application ID", value: context.application_id },
        { label: "Job Title", value: jobTitle },
        { label: "Company", value: companyName },
        { label: "Status", value: toStatusLabel(context.status || "applied") },
        ...(appliedAt ? [{ label: "Applied At", value: appliedAt }] : []),
      ],
      highlights: [
        "Your profile will be reviewed by the recruitment team.",
        "You will receive further updates as your application progresses.",
      ],
      tone: "success",
      companyName,
      footerText: `Thanks,\n${companyName} Hiring Team`,
      ctaLabel: canUseCta(url) ? "View Application" : "",
      ctaUrl: canUseCta(url) ? url : "",
    });

    return sendEmail({
      to: context.candidate_email,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("Failed to notify application submission:", err.message);
    return false;
  }
};
