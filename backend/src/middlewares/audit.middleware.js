const db = require("../config/db");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const REDACT_KEYS = new Set([
  "password",
  "password_hash",
  "token",
  "refresh_token",
  "refreshToken",
  "authToken",
]);

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0) return null;
  return Math.trunc(parsed);
}

function pickFirstIdFromObject(value) {
  if (!value || typeof value !== "object") return null;
  const candidateKeys = [
    "id",
    "application_id",
    "job_id",
    "offer_id",
    "interview_id",
    "scorecard_id",
    "user_id",
    "company_id",
  ];
  for (let i = 0; i < candidateKeys.length; i += 1) {
    const id = parsePositiveInt(value[candidateKeys[i]]);
    if (id) return id;
  }

  if (value.data && typeof value.data === "object") {
    const nested = pickFirstIdFromObject(value.data);
    if (nested) return nested;
  }

  return null;
}

function sanitizeForAudit(value, depth = 0) {
  if (value === null || value === undefined) return value;

  if (depth > 3) return "[truncated]";

  if (Array.isArray(value)) {
    const limited = value.slice(0, 20).map((item) => sanitizeForAudit(item, depth + 1));
    if (value.length > 20) limited.push(`[+${value.length - 20} more]`);
    return limited;
  }

  if (typeof value === "object") {
    const output = {};
    const entries = Object.entries(value).slice(0, 40);
    entries.forEach(([key, val]) => {
      if (REDACT_KEYS.has(String(key))) {
        output[key] = "[redacted]";
      } else {
        output[key] = sanitizeForAudit(val, depth + 1);
      }
    });
    if (Object.keys(value).length > 40) {
      output.__truncated_keys__ = Object.keys(value).length - 40;
    }
    return output;
  }

  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}...[truncated]` : value;
  }

  return value;
}

function inferEntityType(req) {
  const parts = String(req.path || "")
    .split("/")
    .filter(Boolean);
  if (!parts.length) return "system";

  if (parts[0] === "auth") {
    if (parts[1] === "signup" || parts[1] === "profile") return "users";
    return "auth";
  }

  if (parts[0] === "contact-requests") return "contact_requests";
  if (parts.length >= 2) return String(parts[1]).replace(/-/g, "_");

  return String(parts[0]).replace(/-/g, "_");
}

function inferEntityId(req, responseBody) {
  const paramId = parsePositiveInt(req.params?.id);
  if (paramId) return paramId;

  const bodyId = pickFirstIdFromObject(responseBody);
  if (bodyId) return bodyId;

  const reqBodyId = pickFirstIdFromObject(req.body);
  if (reqBodyId) return reqBodyId;

  const verifyTokenId = parsePositiveInt(req.query?.token);
  if (verifyTokenId) return verifyTokenId;

  const queryId = parsePositiveInt(req.query?.id);
  if (queryId) return queryId;

  const segments = String(req.path || "")
    .split("/")
    .filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segmentId = parsePositiveInt(segments[i]);
    if (segmentId) return segmentId;
  }

  return 0;
}

async function querySingleCompanyId(sql, params) {
  const [rows] = await db.promise().query(sql, params);
  const row = rows[0];
  if (!row) return null;
  return parsePositiveInt(row.company_id);
}

async function resolveCompanyId(req, entityType, entityId) {
  const actorCompany = parsePositiveInt(req.user?.company_id);
  if (actorCompany) return actorCompany;

  const requestCompany =
    parsePositiveInt(req.body?.company_id) ||
    parsePositiveInt(req.query?.company_id) ||
    parsePositiveInt(req.params?.company_id);
  if (requestCompany) return requestCompany;

  const requestJobId = parsePositiveInt(req.body?.job_id) || parsePositiveInt(req.query?.job_id);
  if (requestJobId) {
    const jobCompany = await querySingleCompanyId(
      `SELECT company_id FROM job_requisitions WHERE id = ? LIMIT 1`,
      [requestJobId],
    );
    if (jobCompany) return jobCompany;
  }

  if (!entityId) return null;

  if (entityType === "companies") return entityId;

  if (entityType === "users") {
    return querySingleCompanyId(`SELECT company_id FROM users WHERE id = ? LIMIT 1`, [entityId]);
  }

  if (entityType === "jobs" || entityType === "job_requisitions") {
    return querySingleCompanyId(`SELECT company_id FROM job_requisitions WHERE id = ? LIMIT 1`, [entityId]);
  }

  if (entityType === "applications") {
    return querySingleCompanyId(
      `SELECT j.company_id
       FROM applications a
       JOIN job_requisitions j ON a.job_id = j.id
       WHERE a.id = ?
       LIMIT 1`,
      [entityId],
    );
  }

  if (entityType === "offers") {
    return querySingleCompanyId(
      `SELECT j.company_id
       FROM offers o
       JOIN applications a ON o.application_id = a.id
       JOIN job_requisitions j ON a.job_id = j.id
       WHERE o.id = ?
       LIMIT 1`,
      [entityId],
    );
  }

  if (entityType === "interviews") {
    return querySingleCompanyId(
      `SELECT j.company_id
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN job_requisitions j ON a.job_id = j.id
       WHERE i.id = ?
       LIMIT 1`,
      [entityId],
    );
  }

  if (entityType === "scorecards") {
    return querySingleCompanyId(
      `SELECT j.company_id
       FROM scorecards s
       JOIN interviews i ON s.interview_id = i.id
       JOIN applications a ON i.application_id = a.id
       JOIN job_requisitions j ON a.job_id = j.id
       WHERE s.id = ?
       LIMIT 1`,
      [entityId],
    );
  }

  if (entityType === "job_approvals") {
    return querySingleCompanyId(
      `SELECT j.company_id
       FROM job_approvals ja
       JOIN job_requisitions j ON ja.job_id = j.id
       WHERE ja.id = ?
       LIMIT 1`,
      [entityId],
    );
  }

  if (entityType === "candidate_profiles") {
    return querySingleCompanyId(
      `SELECT j.company_id
       FROM applications a
       JOIN job_requisitions j ON a.job_id = j.id
       WHERE a.candidate_id = ?
       ORDER BY a.updated_at DESC
       LIMIT 1`,
      [entityId],
    );
  }

  if (entityType === "verify_email") {
    return querySingleCompanyId(
      `SELECT j.company_id
       FROM applications a
       JOIN job_requisitions j ON a.job_id = j.id
       WHERE a.candidate_id = ?
       ORDER BY a.updated_at DESC
       LIMIT 1`,
      [entityId],
    );
  }

  return null;
}

function resolveClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || null;
}

function humanize(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSentence(value) {
  const text = humanize(value);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function singularize(value) {
  const word = String(value || "").trim();
  if (!word) return "record";
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function idSuffix(entityId) {
  return entityId ? ` #${entityId}` : "";
}

function rolePrefix(pathPart) {
  const map = {
    "platform-admin": "Platform Admin",
    "company-admin": "Company Admin",
    "hr-recruiter": "HR Recruiter",
    "hiring-manager": "Hiring Manager",
    interviewer: "Interviewer",
    candidate: "Candidate",
    auth: "Authentication",
    "contact-requests": "Public Contact",
  };
  const label = map[pathPart] || toSentence(pathPart);
  return label ? `${label}: ` : "";
}

function normalizeStatusText(status) {
  const text = humanize(status).toLowerCase();
  return text || "";
}

function buildAction(req, entityType, entityId) {
  const pathOnly = String(req.originalUrl || req.path || "").split("?")[0];
  const segments = pathOnly.split("/").filter(Boolean);
  const area = segments[0] || "";
  const endpoint = segments[segments.length - 1] || "";
  const prefix = rolePrefix(area);

  const status = normalizeStatusText(req.body?.status);
  const entityLabel = humanize(singularize(entityType || segments[1] || "record"));
  const targetId = parsePositiveInt(req.params?.id) || entityId;
  const entityWithId = `${entityLabel}${idSuffix(targetId)}`.trim();

  if (area === "auth") {
    if (endpoint === "login") return "Authentication: User logged in";
    if (endpoint === "logout") return "Authentication: User logged out";
    if (endpoint === "signup") return "Authentication: Candidate signed up";
    if (endpoint === "refresh") return "Authentication: Access token refreshed";
  }

  if (area === "contact-requests" && req.method === "POST") {
    return "Public Contact: Contact request submitted";
  }

  if (endpoint === "activate") return `${prefix}Activated ${entityWithId}`;
  if (endpoint === "submit") return `${prefix}Submitted ${entityWithId} for approval`;
  if (endpoint === "publish") return `${prefix}Published ${entityWithId}`;
  if (endpoint === "close") return `${prefix}Closed ${entityWithId}`;
  if (endpoint === "send") return `${prefix}Sent ${entityWithId}`;
  if (endpoint === "accept") return `${prefix}Accepted ${entityWithId}`;
  if (endpoint === "decline") return `${prefix}Declined ${entityWithId}`;
  if (endpoint === "finalize") return `${prefix}Finalized ${entityWithId}`;
  if (endpoint === "recommend-offer") return `${prefix}Recommended offer for ${entityWithId}`;

  if (endpoint === "move-stage") {
    return status
      ? `${prefix}Moved ${entityWithId} to ${status}`
      : `${prefix}Moved stage for ${entityWithId}`;
  }

  if (endpoint === "screen") {
    return status
      ? `${prefix}Updated screening decision to ${status} for ${entityWithId}`
      : `${prefix}Updated screening decision for ${entityWithId}`;
  }

  if (endpoint === "final-decision") {
    return status
      ? `${prefix}Set final decision to ${status} for ${entityWithId}`
      : `${prefix}Set final decision for ${entityWithId}`;
  }

  if (entityLabel === "interview" && req.method === "POST") {
    const interviewAppId = parsePositiveInt(req.body?.application_id);
    if (interviewAppId) {
      return `${prefix}Scheduled interview for application #${interviewAppId}`;
    }
  }

  if (entityLabel === "scorecard" && req.method === "POST") {
    const interviewId = parsePositiveInt(req.body?.interview_id);
    if (interviewId) {
      return `${prefix}Submitted scorecard for interview #${interviewId}`;
    }
  }

  if (entityLabel === "verify email") {
    return `${prefix}Candidate email verified`;
  }

  if (req.method === "DELETE") {
    return `${prefix}Deactivated ${entityWithId}`;
  }

  const methodVerb = {
    POST: "Created",
    PUT: "Updated",
    PATCH: "Updated",
    GET: "Viewed",
  };
  const verb = methodVerb[req.method] || "Updated";
  if (status && ["PUT", "PATCH", "POST"].includes(req.method)) {
    return `${prefix}${verb} ${entityWithId} to ${status}`;
  }
  return `${prefix}${verb} ${entityWithId}`;
}

function shouldSkip(req, res) {
  const isVerifyEmailMutation = req.method === "GET" && req.path === "/candidate/verify-email";
  if (!MUTATING_METHODS.has(req.method) && !isVerifyEmailMutation) return true;
  if (res.statusCode < 200 || res.statusCode >= 400) return true;
  if (req.path === "/health") return true;
  return false;
}

async function insertAuditLog({
  userId,
  action,
  entityType,
  entityId,
  details,
  ipAddress,
}) {
  await db.promise().query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      userId || null,
      action,
      entityType,
      entityId || 0,
      null,
      JSON.stringify(details),
      ipAddress || null,
    ],
  );
}

function auditMutationMiddleware(req, res, next) {
  let responseBody = null;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = (payload) => {
    responseBody = payload;
    return originalJson(payload);
  };

  res.send = (payload) => {
    if (responseBody === null) {
      responseBody = payload;
    }
    return originalSend(payload);
  };

  res.on("finish", () => {
    setImmediate(async () => {
      try {
        if (shouldSkip(req, res)) return;

        const entityType = inferEntityType(req);
        const entityId = inferEntityId(req, responseBody);
        const companyId = await resolveCompanyId(req, entityType, entityId);
        const actorUserId = parsePositiveInt(req.user?.user_id);
        const actorRole = req.user?.role || null;
        const details = {
          company_id: companyId,
          actor_user_id: actorUserId,
          actor_role: actorRole,
          status_code: res.statusCode,
          route: String(req.originalUrl || req.path || "").split("?")[0],
          params: sanitizeForAudit(req.params || {}),
          query: sanitizeForAudit(req.query || {}),
          request_body: sanitizeForAudit(req.body || {}),
          response_body: sanitizeForAudit(responseBody),
        };

        await insertAuditLog({
          userId: actorUserId,
          action: buildAction(req, entityType, entityId),
          entityType,
          entityId,
          details,
          ipAddress: resolveClientIp(req),
        });
      } catch (err) {
        console.error("Audit log write failed:", err.message);
      }
    });
  });

  next();
}

module.exports = {
  auditMutationMiddleware,
};
