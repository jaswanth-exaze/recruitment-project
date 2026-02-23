const nodemailer = require("nodemailer");

let transporter = null;
let missingConfigLogged = false;
let disabledLogged = false;

const EMAIL_TONES = {
  default: {
    accent: "#1d4ed8",
    accentDark: "#1e3a8a",
    soft: "#dbeafe",
    text: "#1e3a8a",
  },
  success: {
    accent: "#15803d",
    accentDark: "#14532d",
    soft: "#dcfce7",
    text: "#14532d",
  },
  warning: {
    accent: "#b45309",
    accentDark: "#78350f",
    soft: "#fef3c7",
    text: "#78350f",
  },
  danger: {
    accent: "#b91c1c",
    accentDark: "#7f1d1d",
    soft: "#fee2e2",
    text: "#7f1d1d",
  },
  info: {
    accent: "#0f766e",
    accentDark: "#134e4a",
    soft: "#ccfbf1",
    text: "#134e4a",
  },
};

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function getMailConfig() {
  return {
    enabled: toBoolean(process.env.EMAIL_NOTIFICATIONS_ENABLED, true),
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: toBoolean(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  };
}

function hasRequiredConfig(config) {
  return Boolean(config.host && config.port && config.user && config.pass && config.from);
}

function getTransporter(config) {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
  return transporter;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeHtmlWithBreaks(value) {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function resolveTone(tone) {
  const key = String(tone || "default").trim().toLowerCase();
  return EMAIL_TONES[key] || EMAIL_TONES.default;
}

function normalizeHighlights(highlights) {
  if (!Array.isArray(highlights)) return [];
  return highlights
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeDetailRows(detailRows) {
  if (!Array.isArray(detailRows)) return [];
  return detailRows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const label = String(row.label || "").trim();
      const value = String(row.value ?? "").trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter(Boolean);
}

function renderHighlights(highlights, tone) {
  if (!highlights.length) return "";
  const items = highlights
    .map(
      (item) =>
        `<li style="margin:0 0 8px 0;padding:0 0 0 2px;color:#1f2937;font-size:14px;line-height:1.5;">${escapeHtml(item)}</li>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0 0;">
      <tr>
        <td style="padding:16px 18px;border-radius:12px;background:${tone.soft};border:1px solid ${tone.accent}22;">
          <p style="margin:0 0 10px 0;font-size:13px;font-weight:700;letter-spacing:0.4px;color:${tone.text};text-transform:uppercase;">
            Next Steps
          </p>
          <ul style="margin:0;padding:0 0 0 18px;">
            ${items}
          </ul>
        </td>
      </tr>
    </table>
  `;
}

function renderDetailRows(detailRows) {
  if (!detailRows.length) return "";
  const rows = detailRows
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;width:34%;vertical-align:top;font-size:13px;font-weight:600;color:#475569;">
            ${escapeHtml(row.label)}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:14px;color:#111827;">
            ${escapeHtmlWithBreaks(row.value)}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0 0;border-collapse:collapse;">
      ${rows}
    </table>
  `;
}

function renderCtaButton({ ctaLabel, ctaUrl, accent }) {
  if (!ctaLabel || !ctaUrl || !isHttpUrl(ctaUrl)) return "";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0 0;">
      <tr>
        <td align="center" style="border-radius:999px;background:${accent};">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
            ${escapeHtml(ctaLabel)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

exports.buildRecruitmentEmailHtml = (options = {}) => {
  const {
    preheader,
    title,
    subtitle,
    greeting,
    summary,
    details,
    highlights,
    note,
    footerText,
    companyName,
    statusLabel,
    tone = "default",
    ctaLabel,
    ctaUrl,
  } = options;

  const resolvedTone = resolveTone(tone);
  const safeCompanyName = String(companyName || "HireFlow").trim() || "HireFlow";
  const safeTitle = String(title || "Recruitment Platform Notification").trim();
  const safePreheader = String(preheader || safeTitle || "Notification from HireFlow").trim();
  const safeSubtitle = String(subtitle || "").trim();
  const safeGreeting = String(greeting || "").trim();
  const safeSummary = String(summary || "").trim();
  const safeNote = String(note || "").trim();
  const safeFooter = String(footerText || `Best regards,\n${safeCompanyName} Team`).trim();
  const safeStatusLabel = String(statusLabel || "").trim();
  const normalizedDetails = normalizeDetailRows(details);
  const normalizedHighlights = normalizeHighlights(highlights);

  const statusPill = safeStatusLabel
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 2px 0;">
        <tr>
          <td style="display:inline-block;padding:6px 12px;border-radius:999px;background:${resolvedTone.soft};color:${resolvedTone.text};font-size:12px;font-weight:700;letter-spacing:0.2px;text-transform:uppercase;">
            ${escapeHtml(safeStatusLabel)}
          </td>
        </tr>
      </table>
    `
    : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${escapeHtml(safeTitle)}</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f6fb;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden;mso-hide:all;">
          ${escapeHtml(safePreheader)}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:20px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border-radius:18px;overflow:hidden;background:#ffffff;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:26px 30px;background:${resolvedTone.accent};background-image:linear-gradient(135deg,${resolvedTone.accent},${resolvedTone.accentDark});">
                    <p style="margin:0;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;color:#e2e8f0;font-weight:700;">
                      ${escapeHtml(safeCompanyName)}
                    </p>
                    <h1 style="margin:8px 0 0 0;font-size:24px;line-height:1.25;color:#ffffff;">
                      ${escapeHtml(safeTitle)}
                    </h1>
                    ${
                      safeSubtitle
                        ? `<p style="margin:10px 0 0 0;font-size:14px;line-height:1.45;color:#e0f2fe;">${escapeHtml(safeSubtitle)}</p>`
                        : ""
                    }
                  </td>
                </tr>
                <tr>
                  <td style="padding:26px 30px 30px 30px;">
                    ${
                      safeGreeting
                        ? `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.55;color:#111827;">${escapeHtml(safeGreeting)}</p>`
                        : ""
                    }
                    ${
                      safeSummary
                        ? `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#1f2937;">${escapeHtmlWithBreaks(safeSummary)}</p>`
                        : ""
                    }
                    ${statusPill}
                    ${renderDetailRows(normalizedDetails)}
                    ${renderHighlights(normalizedHighlights, resolvedTone)}
                    ${
                      safeNote
                        ? `<p style="margin:18px 0 0 0;font-size:14px;line-height:1.55;color:#374151;">${escapeHtmlWithBreaks(safeNote)}</p>`
                        : ""
                    }
                    ${renderCtaButton({ ctaLabel, ctaUrl, accent: resolvedTone.accent })}
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 30px 22px 30px;background:#f8fafc;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                      ${escapeHtmlWithBreaks(safeFooter)}
                    </p>
                    <p style="margin:10px 0 0 0;font-size:11px;line-height:1.5;color:#94a3b8;">
                      This is an automated email from ${escapeHtml(safeCompanyName)} recruitment workflow.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

exports.sendEmail = async ({ to, subject, text, html }) => {
  if (!to || !subject) return false;

  const config = getMailConfig();

  if (!config.enabled) {
    if (!disabledLogged) {
      disabledLogged = true;
      console.warn("Email notifications are disabled. Set EMAIL_NOTIFICATIONS_ENABLED=true to enable.");
    }
    return false;
  }

  if (!hasRequiredConfig(config)) {
    if (!missingConfigLogged) {
      missingConfigLogged = true;
      console.warn(
        "SMTP is not fully configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
      );
    }
    return false;
  }

  try {
    const mailer = getTransporter(config);
    await mailer.sendMail({
      from: config.from,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error("Failed to send email notification:", err.message);
    return false;
  }
};
