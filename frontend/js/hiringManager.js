/**
 * Hiring Manager dashboard script.
 * Handles approvals, jobs, final candidate decisions, profile, and auth flow.
 */

// 1) Config and state.
const HM_CONFIG = {
  useApi: true,
  apiBase: String(window.HIRING_MANAGER_API_BASE_URL || window.API_BASE || "http://localhost:3000").replace(
    /\/+$/,
    "",
  ),
  tryApiPrefixFallback: false,
  tokenKeys: ["token", "accessToken", "authToken", "jwtToken"],
  endpoints: {
    authLogout: "/auth/logout",
    getMyProfile: "/hiring-manager/profile",
    updateMyProfile: "/hiring-manager/profile",
    listPendingApprovals: "/hiring-manager/job-approvals",
    listJobs: "/hiring-manager/jobs",
    listApplications: "/hiring-manager/applications",
    approveJob: "/hiring-manager/jobs/:id/approve",
    rejectJob: "/hiring-manager/jobs/:id/reject",
    getJobById: "/hiring-manager/jobs/:id",
    finalDecision: "/hiring-manager/applications/:id/final-decision"
  }
};

const hmState = {
  currentView: "dashboard",
  currentProfile: null,
  selectedJob: null,
  approvalsRows: [],
  approvalsLoaded: false,
  jobsRows: [],
  jobsLoaded: false,
  decisionsRows: [],
  decisionsLoaded: false
};

const hmViewMeta = {
  dashboard: {
    title: "Hiring Manager Dashboard",
    subtitle: "Approve jobs and take final candidate decisions.",
    searchPlaceholder: "Search approvals or jobs"
  },
  approvals: {
    title: "Approvals",
    subtitle: "Review pending approval requests and approve or reject.",
    searchPlaceholder: "Search approvals"
  },
  jobs: {
    title: "Jobs",
    subtitle: "View all jobs in your company and open details without entering job id.",
    searchPlaceholder: "Search jobs"
  },
  decisions: {
    title: "Final Decisions",
    subtitle: "Approve offer-accepted applications to hired or rejected.",
    searchPlaceholder: "Search applications by id"
  },
  profile: {
    title: "Profile",
    subtitle: "View and update your hiring manager profile.",
    searchPlaceholder: "Search approvals or jobs"
  }
};

const ui = {
  navLinks: document.querySelectorAll("[data-hm-nav]"),
  sections: document.querySelectorAll("[data-hm-view]"),
  headerTitle: document.querySelector("[data-hm-header-title]"),
  headerSubtitle: document.querySelector("[data-hm-header-subtitle]"),
  topCompanyName: document.querySelector("[data-hm-top-company]"),
  searchInput: document.querySelector("[data-hm-search]"),

  kpiPendingApprovals: document.querySelector("[data-hm-kpi-pending-approvals]"),
  kpiPublished: document.querySelector("[data-hm-kpi-published]"),
  kpiClosed: document.querySelector("[data-hm-kpi-closed]"),

  approvalLoadBtn: document.querySelector("[data-hm-approval-load]"),
  approvalList: document.querySelector("[data-hm-approval-list]"),
  approvalMsg: document.querySelector("[data-hm-approval-msg]"),

  jobsLoadBtn: document.querySelector("[data-hm-jobs-load]"),
  jobList: document.querySelector("[data-hm-job-list]"),
  jobTitle: document.querySelector("[data-hm-job-title]"),
  jobStatus: document.querySelector("[data-hm-job-status]"),
  jobCompany: document.querySelector("[data-hm-job-company]"),
  jobLocation: document.querySelector("[data-hm-job-location]"),
  jobPositions: document.querySelector("[data-hm-job-positions]"),
  selectedJobId: document.querySelector("[data-hm-selected-job-id]"),
  jobMsg: document.querySelector("[data-hm-job-msg]"),

  finalDecisionForm: document.querySelector("[data-hm-final-decision-form]"),
  decisionJobId: document.querySelector("[data-hm-decision-job-id]"),
  decisionLoadBtn: document.querySelector("[data-hm-decision-load]"),
  decisionList: document.querySelector("[data-hm-decision-list]"),
  applicationId: document.querySelector("[data-hm-application-id]"),
  decisionStatus: document.querySelector("[data-hm-decision-status]"),
  finalDecisionBtn: document.querySelector("[data-hm-final-decision-btn]"),
  finalDecisionMsg: document.querySelector("[data-hm-final-decision-msg]"),

  profileName: document.querySelector("[data-hm-profile-name]"),
  profileEmail: document.querySelector("[data-hm-profile-email]"),
  profileRole: document.querySelector("[data-hm-profile-role]"),
  profileCompany: document.querySelector("[data-hm-profile-company]"),
  profileLastLogin: document.querySelector("[data-hm-profile-last-login]"),
  profileForm: document.querySelector("[data-hm-profile-form]"),
  profileFirstName: document.querySelector("[data-hm-edit-first-name]"),
  profileLastName: document.querySelector("[data-hm-edit-last-name]"),
  profileEditEmail: document.querySelector("[data-hm-edit-email]"),
  profileSaveBtn: document.querySelector("[data-hm-profile-save]"),
  profileStatus: document.querySelector("[data-hm-profile-status]"),
  reloadProfileBtn: document.querySelector("[data-hm-reload-profile]"),
  logoutBtn: document.querySelector("[data-hm-logout]")
};

// 2) Shared helpers.
function firstValue(record, keys, fallback = "") {
  for (let i = 0; i < keys.length; i += 1) {
    const value = record?.[keys[i]];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return fallback;
}

function normalizeArrayResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  return [];
}

function buildPathWithId(path, id) {
  return path.replace(":id", encodeURIComponent(String(id)));
}

function setText(element, value) {
  if (!element) return;
  element.textContent = value === undefined || value === null || value === "" ? "N/A" : String(value);
}

function setMessage(element, text, type = "info") {
  if (!element) return;
  element.textContent = text || "";
  element.classList.remove("text-secondary", "text-success", "text-danger");
  if (type === "success") {
    element.classList.add("text-success");
    return;
  }
  if (type === "error") {
    element.classList.add("text-danger");
    return;
  }
  element.classList.add("text-secondary");
}

function showTableMessage(tbody, colSpan, text) {
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-secondary py-3">${text}</td></tr>`;
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function fullName(record) {
  const first = firstValue(record, ["first_name"], "");
  const last = firstValue(record, ["last_name"], "");
  const name = `${first} ${last}`.trim();
  return name || firstValue(record, ["name"], "N/A");
}

function getStoredToken() {
  if (window.HIRING_MANAGER_TOKEN) return String(window.HIRING_MANAGER_TOKEN);
  for (let i = 0; i < HM_CONFIG.tokenKeys.length; i += 1) {
    const key = HM_CONFIG.tokenKeys[i];
    const localToken = localStorage.getItem(key);
    if (localToken) return localToken;
    const sessionToken = sessionStorage.getItem(key);
    if (sessionToken) return sessionToken;
  }
  return "";
}

function getAuthHeader() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearAuthStorage() {
  HM_CONFIG.tokenKeys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  localStorage.removeItem("role");
  localStorage.removeItem("userRole");
  sessionStorage.removeItem("role");
  sessionStorage.removeItem("userRole");
}

function redirectToLogin(message) {
  localStorage.setItem("sessionExpiredMessage", message || "Login session expired. Please log in again.");
  clearAuthStorage();
  window.location.href = "../public/login.html";
}

function buildUrlCandidates(path, queryObj) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const base = HM_CONFIG.apiBase;
  const params = new URLSearchParams();

  if (queryObj && typeof queryObj === "object") {
    Object.keys(queryObj).forEach((key) => {
      const value = queryObj[key];
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });
  }

  const query = params.toString();
  const candidates = [];
  const add = (url) => {
    const finalUrl = query ? `${url}?${query}` : url;
    if (!candidates.includes(finalUrl)) candidates.push(finalUrl);
  };

  add(`${base}${cleanPath}`);

  if (HM_CONFIG.tryApiPrefixFallback) {
    if (base.endsWith("/api")) {
      add(`${base.replace(/\/api$/, "")}${cleanPath}`);
    } else {
      add(`${base}/api${cleanPath}`);
    }
  }

  return candidates;
}

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function preferNon404Error(currentError, incomingError) {
  if (!currentError) return incomingError;
  const currentStatus = Number(currentError.status || 0);
  const incomingStatus = Number(incomingError?.status || 0);
  if (currentStatus === 404 && incomingStatus && incomingStatus !== 404) {
    return incomingError;
  }
  return currentError;
}

async function apiRequest(path, options = {}) {
  const method = options.method || "GET";
  const payload = options.body;
  const query = options.query || null;
  const useAuthHeader = options.useAuthHeader !== false;
  const baseHeaders = {
    ...(useAuthHeader ? getAuthHeader() : {}),
    ...(options.headers || {})
  };

  if (payload !== undefined && payload !== null && !baseHeaders["Content-Type"]) {
    baseHeaders["Content-Type"] = "application/json";
  }

  const requestOptions = () => {
    const req = {
      method,
      headers: {
        ...(useAuthHeader ? getAuthHeader() : {}),
        ...baseHeaders
      },
      credentials: "include"
    };

    if (payload !== undefined && payload !== null) {
      req.body = JSON.stringify(payload);
    }
    return req;
  };

  const candidates = buildUrlCandidates(path, query);
  let lastError = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const url = candidates[i];
    try {
      const response = await fetch(url, requestOptions());
      const data = response.status === 204 ? null : await parseJsonSafely(response);

      if (response.ok) return data;

      const error = new Error(data?.message || `${method} ${url} failed with status ${response.status}`);
      error.status = response.status;
      lastError = preferNon404Error(lastError, error);

      if (response.status === 401) {
        redirectToLogin(data?.message || "Login session expired. Please log in again.");
      }

      if (response.status !== 404) throw error;
    } catch (error) {
      lastError = preferNon404Error(lastError, error);
    }
  }

  throw lastError || new Error("API request failed");
}

// 3) API layer.
const hmApi = {
  logout() {
    return apiRequest(HM_CONFIG.endpoints.authLogout, {
      method: "POST",
      body: {},
      useAuthHeader: false
    });
  },

  getMyProfile() {
    return apiRequest(HM_CONFIG.endpoints.getMyProfile);
  },

  updateMyProfile(payload) {
    return apiRequest(HM_CONFIG.endpoints.updateMyProfile, {
      method: "PUT",
      body: payload
    });
  },

  listPendingApprovals() {
    return apiRequest(HM_CONFIG.endpoints.listPendingApprovals);
  },

  listJobs(query = {}) {
    return apiRequest(HM_CONFIG.endpoints.listJobs, { query });
  },

  listApplications(query = {}) {
    return apiRequest(HM_CONFIG.endpoints.listApplications, { query });
  },

  approveJob(jobId, payload) {
    return apiRequest(buildPathWithId(HM_CONFIG.endpoints.approveJob, jobId), {
      method: "POST",
      body: payload
    });
  },

  rejectJob(jobId, payload) {
    return apiRequest(buildPathWithId(HM_CONFIG.endpoints.rejectJob, jobId), {
      method: "POST",
      body: payload
    });
  },

  getJobById(jobId) {
    return apiRequest(buildPathWithId(HM_CONFIG.endpoints.getJobById, jobId));
  },

  finalDecision(applicationId, status) {
    return apiRequest(buildPathWithId(HM_CONFIG.endpoints.finalDecision, applicationId), {
      method: "POST",
      body: { status }
    });
  }
};

// 4) Page UI logic.
function setActiveNav(viewKey) {
  ui.navLinks.forEach((link) => link.classList.remove("active"));
  const target = document.querySelector(`[data-hm-nav="${viewKey}"]`);
  if (target) target.classList.add("active");
}

function profileSuffixText() {
  const profile = hmState.currentProfile;
  if (!profile) return "";
  const name = fullName(profile);
  const role = firstValue(profile, ["role"], "");
  if (name === "N/A" && !role) return "";
  if (name !== "N/A" && role) return ` Signed in as ${name} (${role}).`;
  return ` Signed in as ${name !== "N/A" ? name : role}.`;
}

function resolveCompanyName(profile) {
  const companyName = firstValue(profile || {}, ["company_name"], "");
  if (companyName) return companyName;
  const companyId = firstValue(profile || {}, ["company_id"], "");
  if (companyId) return `Company #${companyId}`;
  return "N/A";
}

function renderTopCompanyName() {
  if (!ui.topCompanyName) return;
  ui.topCompanyName.textContent = `Company: ${resolveCompanyName(hmState.currentProfile)}`;
}

function showSection(viewKey) {
  ui.sections.forEach((sec) => {
    sec.classList.toggle("d-none", sec.dataset.hmView !== viewKey);
  });

  hmState.currentView = viewKey;
  setActiveNav(viewKey);

  const meta = hmViewMeta[viewKey];
  if (!meta) return;

  if (ui.headerTitle) ui.headerTitle.textContent = meta.title;
  if (ui.headerSubtitle) ui.headerSubtitle.textContent = `${meta.subtitle}${profileSuffixText()}`;
  if (ui.searchInput) ui.searchInput.placeholder = meta.searchPlaceholder;
}

function ensureRole(profile) {
  const role = String(firstValue(profile || {}, ["role"], "")).trim();
  if (!role) return true;
  if (role.toLowerCase() === "hiringmanager") return true;
  redirectToLogin("You are not authorized to access Hiring Manager dashboard.");
  return false;
}

function renderProfilePanel() {
  const profile = hmState.currentProfile;
  if (!profile) {
    setText(ui.profileName, "N/A");
    setText(ui.profileEmail, "N/A");
    setText(ui.profileRole, "N/A");
    setText(ui.profileCompany, "N/A");
    setText(ui.profileLastLogin, "N/A");
    if (ui.profileFirstName) ui.profileFirstName.value = "";
    if (ui.profileLastName) ui.profileLastName.value = "";
    if (ui.profileEditEmail) ui.profileEditEmail.value = "";
    renderTopCompanyName();
    return;
  }

  setText(ui.profileName, fullName(profile));
  setText(ui.profileEmail, firstValue(profile, ["email"], "N/A"));
  setText(ui.profileRole, firstValue(profile, ["role"], "N/A"));
  setText(ui.profileCompany, firstValue(profile, ["company_id"], "N/A"));
  setText(ui.profileLastLogin, formatDateTime(firstValue(profile, ["last_login_at"], "")));
  if (ui.profileFirstName) ui.profileFirstName.value = firstValue(profile, ["first_name"], "");
  if (ui.profileLastName) ui.profileLastName.value = firstValue(profile, ["last_name"], "");
  if (ui.profileEditEmail) ui.profileEditEmail.value = firstValue(profile, ["email"], "");
  renderTopCompanyName();
}

function setSelectedJob(job) {
  hmState.selectedJob = job ? { ...job } : null;

  setText(ui.selectedJobId, firstValue(job || {}, ["id"], "N/A"));
  setText(ui.jobTitle, firstValue(job || {}, ["title"], "N/A"));
  setText(ui.jobStatus, firstValue(job || {}, ["status"], "N/A"));
  setText(ui.jobCompany, firstValue(job || {}, ["company_name"], "N/A"));
  setText(ui.jobLocation, firstValue(job || {}, ["location"], "N/A"));
  setText(ui.jobPositions, firstValue(job || {}, ["positions_count"], "N/A"));
}

async function loadAuthProfile() {
  try {
    const payload = await hmApi.getMyProfile();
    hmState.currentProfile = payload?.profile || payload || null;

    if (!ensureRole(hmState.currentProfile)) return false;

    const role = firstValue(hmState.currentProfile, ["role"], "");
    if (role) {
      localStorage.setItem("role", role);
      localStorage.setItem("userRole", role);
      sessionStorage.setItem("role", role);
      sessionStorage.setItem("userRole", role);
    }
    renderProfilePanel();
    return true;
  } catch (error) {
    console.error("Hiring Manager profile load error:", error);
    redirectToLogin("Login session expired. Please log in again.");
    return false;
  }
}

async function performLogout() {
  try {
    await hmApi.logout();
  } catch (error) {
    console.error("Logout API error:", error);
  } finally {
    clearAuthStorage();
    window.location.href = "../public/login.html";
  }
}

function renderApprovalRows(rows) {
  if (!ui.approvalList) return;
  if (!rows.length) {
    showTableMessage(ui.approvalList, 6, "No pending approvals");
    return;
  }

  ui.approvalList.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const jobId = firstValue(row, ["job_id", "id"], "");

    const jobIdCell = document.createElement("td");
    jobIdCell.textContent = jobId || "N/A";
    tr.appendChild(jobIdCell);

    const titleCell = document.createElement("td");
    titleCell.textContent = firstValue(row, ["title"], "N/A");
    tr.appendChild(titleCell);

    const requesterCell = document.createElement("td");
    requesterCell.textContent = firstValue(row, ["requester"], "N/A");
    tr.appendChild(requesterCell);

    const statusCell = document.createElement("td");
    statusCell.textContent = firstValue(row, ["status"], "N/A");
    tr.appendChild(statusCell);

    const createdCell = document.createElement("td");
    createdCell.textContent = formatDateTime(firstValue(row, ["created_at"], ""));
    tr.appendChild(createdCell);

    const actionsCell = document.createElement("td");
    actionsCell.className = "text-nowrap";

    const buttons = [
      { action: "view", label: "View", cls: "btn-outline-brand" },
      { action: "approve", label: "Approve", cls: "btn-outline-success" },
      { action: "reject", label: "Reject", cls: "btn-outline-danger" }
    ];

    buttons.forEach((entry, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn ${entry.cls} btn-sm${index < buttons.length - 1 ? " me-2" : ""}`;
      btn.textContent = entry.label;
      btn.dataset.approvalAction = entry.action;
      btn.dataset.jobId = jobId;
      actionsCell.appendChild(btn);
    });

    tr.appendChild(actionsCell);
    ui.approvalList.appendChild(tr);
  });
}

async function loadPendingApprovals() {
  try {
    setMessage(ui.approvalMsg, "Loading approvals...", "info");
    const rows = normalizeArrayResponse(await hmApi.listPendingApprovals());
    hmState.approvalsRows = rows;
    hmState.approvalsLoaded = true;
    renderApprovalRows(rows);
    setMessage(ui.approvalMsg, `Loaded ${rows.length} pending approval(s).`, "success");
  } catch (error) {
    hmState.approvalsRows = [];
    hmState.approvalsLoaded = false;
    renderApprovalRows([]);
    setMessage(ui.approvalMsg, error.message || "Failed to load approvals.", "error");
  }
}

function decisionCandidateLabel(row) {
  const first = firstValue(row, ["candidate_first_name"], "");
  const last = firstValue(row, ["candidate_last_name"], "");
  const name = `${first} ${last}`.trim() || "N/A";
  const email = firstValue(row, ["candidate_email"], "");
  return email ? `${name} (${email})` : name;
}

function renderDecisionRows(rows) {
  if (!ui.decisionList) return;
  if (!rows.length) {
    showTableMessage(ui.decisionList, 8, "No offer accecepted applications found");
    return;
  }

  ui.decisionList.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const applicationId = firstValue(row, ["application_id", "id"], "");

    const cells = [
      applicationId || "N/A",
      firstValue(row, ["job_id"], "N/A"),
      firstValue(row, ["job_title", "title"], "N/A"),
      decisionCandidateLabel(row),
      firstValue(row, ["openings_left", "positions_count"], "N/A"),
      firstValue(row, ["status"], "N/A"),
      formatDateTime(firstValue(row, ["updated_at"], ""))
    ];

    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    const actionTd = document.createElement("td");
    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "btn btn-outline-brand btn-sm";
    useBtn.textContent = "Use";
    useBtn.dataset.decisionUseApplicationId = applicationId;
    actionTd.appendChild(useBtn);
    tr.appendChild(actionTd);

    ui.decisionList.appendChild(tr);
  });
}

async function loadDecisionApplications(silent = false) {
  const jobId = String(ui.decisionJobId?.value || "").trim();
  const query = {};
  if (jobId) query.job_id = jobId;

  try {
    if (!silent) {
      setMessage(ui.finalDecisionMsg, "Loading offer accecepted applications...", "info");
    }
    const rows = normalizeArrayResponse(await hmApi.listApplications(query));
    hmState.decisionsRows = rows;
    hmState.decisionsLoaded = true;
    renderDecisionRows(rows);
    if (!silent) {
      setMessage(ui.finalDecisionMsg, `Loaded ${rows.length} offer accecepted application(s).`, "success");
    }
  } catch (error) {
    hmState.decisionsRows = [];
    renderDecisionRows([]);
    setMessage(ui.finalDecisionMsg, error.message || "Failed to load decision applications.", "error");
  }
}

function renderJobsRows(rows) {
  if (!ui.jobList) return;
  if (!rows.length) {
    showTableMessage(ui.jobList, 7, "No jobs found");
    return;
  }

  ui.jobList.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const jobId = firstValue(row, ["id"], "");
    const cells = [
      jobId || "N/A",
      firstValue(row, ["title"], "N/A"),
      firstValue(row, ["status"], "N/A"),
      firstValue(row, ["location"], "N/A"),
      firstValue(row, ["positions_count"], "N/A"),
      formatDateTime(firstValue(row, ["created_at"], "")),
    ];

    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    const actionTd = document.createElement("td");
    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "btn btn-outline-brand btn-sm";
    viewBtn.textContent = "View";
    viewBtn.dataset.hmJobAction = "view";
    viewBtn.dataset.jobId = jobId;
    actionTd.appendChild(viewBtn);
    tr.appendChild(actionTd);

    ui.jobList.appendChild(tr);
  });
}

async function loadJobs(silent = false) {
  try {
    if (!silent) setMessage(ui.jobMsg, "Loading jobs...", "info");
    const rows = normalizeArrayResponse(await hmApi.listJobs());
    hmState.jobsRows = rows;
    hmState.jobsLoaded = true;
    renderJobsRows(rows);
    if (hmState.selectedJob) {
      const selectedId = String(firstValue(hmState.selectedJob, ["id"], ""));
      const refreshed = rows.find((row) => String(firstValue(row, ["id"], "")) === selectedId);
      if (refreshed) setSelectedJob(refreshed);
    }
    if (!silent) setMessage(ui.jobMsg, `Loaded ${rows.length} job(s).`, "success");
  } catch (error) {
    hmState.jobsRows = [];
    hmState.jobsLoaded = false;
    renderJobsRows([]);
    setMessage(ui.jobMsg, error.message || "Failed to load jobs.", "error");
  }
}

async function loadJobById(jobId, silent = false) {
  if (!jobId) {
    if (!silent) setMessage(ui.jobMsg, "Job id is required.", "error");
    return;
  }
  try {
    if (!silent) setMessage(ui.jobMsg, "Loading job details...", "info");
    const job = await hmApi.getJobById(jobId);
    setSelectedJob(job);
    if (!silent) setMessage(ui.jobMsg, "Job details loaded.", "success");
  } catch (error) {
    if (!silent) {
      setSelectedJob(null);
      setMessage(ui.jobMsg, error.message || "Failed to load job details.", "error");
    }
  }
}

async function runApprovalAction(action, jobId, comments) {
  if (!jobId) {
    setMessage(ui.approvalMsg, "Job id is required.", "error");
    return;
  }

  try {
    if (action === "approve") {
      await hmApi.approveJob(jobId, { comments: comments || "" });
      setMessage(ui.approvalMsg, "Job approved.", "success");
    } else {
      await hmApi.rejectJob(jobId, { comments: comments || "" });
      setMessage(ui.approvalMsg, "Job rejected.", "success");
    }
    await loadPendingApprovals();
    await loadJobs(true);
    await loadDashboardKpis();
    if (String(firstValue(hmState.selectedJob || {}, ["id"], "")) === String(jobId)) {
      await loadJobById(jobId, true);
    }
  } catch (error) {
    setMessage(ui.approvalMsg, error.message || `Failed to ${action} job.`, "error");
  }
}

async function submitFinalDecision(event) {
  event.preventDefault();
  const applicationId = String(ui.applicationId?.value || "").trim();
  const status = String(ui.decisionStatus?.value || "").trim();

  if (!applicationId || !status) {
    setMessage(ui.finalDecisionMsg, "application id and status are required.", "error");
    return;
  }

  const initialText = ui.finalDecisionBtn?.textContent || "Submit Final Decision";
  if (ui.finalDecisionBtn) {
    ui.finalDecisionBtn.disabled = true;
    ui.finalDecisionBtn.textContent = "Submitting...";
  }

  try {
    await hmApi.finalDecision(applicationId, status);
    await loadDecisionApplications(true);
    setMessage(ui.finalDecisionMsg, "Final decision submitted successfully.", "success");
    if (ui.finalDecisionForm) ui.finalDecisionForm.reset();
  } catch (error) {
    setMessage(ui.finalDecisionMsg, error.message || "Failed to submit final decision.", "error");
  } finally {
    if (ui.finalDecisionBtn) {
      ui.finalDecisionBtn.disabled = false;
      ui.finalDecisionBtn.textContent = initialText;
    }
  }
}

async function loadDashboardKpis() {
  if (!hmState.approvalsLoaded) {
    try {
      const rows = normalizeArrayResponse(await hmApi.listPendingApprovals());
      hmState.approvalsRows = rows;
      hmState.approvalsLoaded = true;
    } catch (error) {
      hmState.approvalsRows = [];
      hmState.approvalsLoaded = false;
    }
  }

  if (!hmState.jobsLoaded) {
    try {
      const rows = normalizeArrayResponse(await hmApi.listJobs());
      hmState.jobsRows = rows;
      hmState.jobsLoaded = true;
    } catch (error) {
      hmState.jobsRows = [];
      hmState.jobsLoaded = false;
    }
  }

  const publishedCount = hmState.jobsRows.filter(
    (row) => String(firstValue(row, ["status"], "")).toLowerCase() === "published",
  ).length;
  const closedCount = hmState.jobsRows.filter(
    (row) => String(firstValue(row, ["status"], "")).toLowerCase() === "closed",
  ).length;

  setText(ui.kpiPendingApprovals, hmState.approvalsRows.length);
  setText(ui.kpiPublished, publishedCount);
  setText(ui.kpiClosed, closedCount);
}

// 5) Profile and session actions.
async function reloadProfile() {
  setMessage(ui.profileStatus, "Loading profile...", "info");
  try {
    const payload = await hmApi.getMyProfile();
    hmState.currentProfile = payload?.profile || payload || null;
    renderProfilePanel();
    showSection(hmState.currentView || "profile");
    setMessage(ui.profileStatus, "Profile loaded from API.", "success");
  } catch (error) {
    setMessage(ui.profileStatus, error.message || "Failed to load profile.", "error");
  }
}

async function submitProfileUpdate(event) {
  event.preventDefault();
  const firstName = String(ui.profileFirstName?.value || "").trim();
  const lastName = String(ui.profileLastName?.value || "").trim();
  const email = String(ui.profileEditEmail?.value || "").trim();

  if (!firstName || !lastName || !email) {
    setMessage(ui.profileStatus, "first_name, last_name and email are required.", "error");
    return;
  }

  if (!isValidEmail(email)) {
    setMessage(ui.profileStatus, "Enter a valid email address.", "error");
    return;
  }

  const initialText = ui.profileSaveBtn?.textContent || "Save Profile";
  if (ui.profileSaveBtn) {
    ui.profileSaveBtn.disabled = true;
    ui.profileSaveBtn.textContent = "Saving...";
  }
  setMessage(ui.profileStatus, "Updating profile...", "info");

  try {
    const result = await hmApi.updateMyProfile({
      first_name: firstName,
      last_name: lastName,
      email
    });
    const updated = result?.data || result?.profile || null;
    hmState.currentProfile = updated && typeof updated === "object"
      ? { ...(hmState.currentProfile || {}), ...updated }
      : { ...(hmState.currentProfile || {}), first_name: firstName, last_name: lastName, email };
    renderProfilePanel();
    showSection(hmState.currentView || "profile");
    setMessage(ui.profileStatus, result?.message || "Profile updated successfully.", "success");
  } catch (error) {
    setMessage(ui.profileStatus, error.message || "Failed to update profile.", "error");
  } finally {
    if (ui.profileSaveBtn) {
      ui.profileSaveBtn.disabled = false;
      ui.profileSaveBtn.textContent = initialText;
    }
  }
}

// 6) Section openers and bindings.
async function openDashboard() {
  showSection("dashboard");
  await loadDashboardKpis();
}

async function openApprovals() {
  showSection("approvals");
  if (!hmState.approvalsLoaded) {
    await loadPendingApprovals();
  }
}

async function openJobs() {
  showSection("jobs");
  if (!hmState.jobsLoaded) {
    await loadJobs();
  }
}

async function openDecisions() {
  showSection("decisions");
  if (!hmState.decisionsLoaded) {
    await loadDecisionApplications();
  }
}

async function openProfile() {
  showSection("profile");
  renderProfilePanel();
  await reloadProfile();
}

async function handleLogoutClick(event) {
  event.preventDefault();
  if (!window.confirm("Do you want to logout?")) return;
  await performLogout();
}

function bindNavigation() {
  ui.navLinks.forEach((link) => {
    const section = link.dataset.hmNav;
    if (!section) return;

    if (section === "logout") {
      link.addEventListener("click", handleLogoutClick);
      return;
    }

    link.addEventListener("click", async (event) => {
      event.preventDefault();

      if (section === "dashboard") await openDashboard();
      if (section === "approvals") await openApprovals();
      if (section === "jobs") await openJobs();
      if (section === "decisions") await openDecisions();
      if (section === "profile") await openProfile();

      if (window.innerWidth < 992) {
        document.body.classList.remove("dashboard-sidebar-open");
      }
    });
  });
}

function bindActions() {
  if (ui.approvalLoadBtn) {
    ui.approvalLoadBtn.addEventListener("click", async () => {
      await loadPendingApprovals();
      await loadDashboardKpis();
    });
  }

  if (ui.approvalList) {
    ui.approvalList.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-approval-action]");
      if (!button) return;

      const action = String(button.dataset.approvalAction || "").trim();
      const jobId = String(button.dataset.jobId || "").trim();
      if (!jobId) return;

      if (action === "view") {
        await openJobs();
        await loadJobById(jobId);
        return;
      }

      const comments = window.prompt(`Comments for ${action}:`, "") || "";
      await runApprovalAction(action, jobId, comments);
    });
  }

  if (ui.jobsLoadBtn) {
    ui.jobsLoadBtn.addEventListener("click", async () => {
      await loadJobs();
      await loadDashboardKpis();
    });
  }

  if (ui.jobList) {
    ui.jobList.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-hm-job-action]");
      if (!button) return;
      const action = String(button.dataset.hmJobAction || "").trim();
      const jobId = String(button.dataset.jobId || "").trim();
      if (action !== "view" || !jobId) return;
      await loadJobById(jobId);
    });
  }

  if (ui.decisionLoadBtn) {
    ui.decisionLoadBtn.addEventListener("click", async () => {
      await loadDecisionApplications();
    });
  }

  if (ui.decisionList) {
    ui.decisionList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-decision-use-application-id]");
      if (!button) return;
      const applicationId = String(button.dataset.decisionUseApplicationId || "").trim();
      if (!applicationId || !ui.applicationId) return;
      ui.applicationId.value = applicationId;
      setMessage(ui.finalDecisionMsg, `Application #${applicationId} selected for final decision.`, "info");
    });
  }

  if (ui.finalDecisionForm) {
    ui.finalDecisionForm.addEventListener("submit", submitFinalDecision);
  }

  if (ui.profileForm) {
    ui.profileForm.addEventListener("submit", submitProfileUpdate);
  }

  if (ui.reloadProfileBtn) {
    ui.reloadProfileBtn.addEventListener("click", reloadProfile);
  }

  if (ui.logoutBtn) {
    ui.logoutBtn.addEventListener("click", async () => {
      if (!window.confirm("Do you want to logout?")) return;
      await performLogout();
    });
  }
}

// 7) Init.
async function initHiringManagerDashboard() {
  if (!ui.navLinks.length || !ui.sections.length) return;

  bindNavigation();
  bindActions();
  setSelectedJob(null);
  if (ui.approvalList) showTableMessage(ui.approvalList, 6, "Load approvals to see records");
  if (ui.jobList) showTableMessage(ui.jobList, 7, "Open jobs to load records");
  if (ui.decisionList) showTableMessage(ui.decisionList, 8, "Open decisions to load offer accecepted applications");

  const sessionReady = await loadAuthProfile();
  if (!sessionReady) return;

  await openDashboard();
}

document.addEventListener("DOMContentLoaded", () => {
  initHiringManagerDashboard();
});

window.hiringManagerApi = {
  config: HM_CONFIG,
  ...hmApi,
  openDashboard,
  openApprovals,
  openJobs,
  openDecisions,
  openProfile,
  loadPendingApprovals,
  loadJobs,
  loadJobById,
  performLogout
};
