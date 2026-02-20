/**
 * Hiring Manager dashboard script.
 * Handles approvals, job actions, final candidate decisions, profile, and auth flow.
 */

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
    approveJob: "/hiring-manager/jobs/:id/approve",
    rejectJob: "/hiring-manager/jobs/:id/reject",
    publishJob: "/hiring-manager/jobs/:id/publish",
    closeJob: "/hiring-manager/jobs/:id/close",
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
  sessionPublishedCount: 0,
  sessionClosedCount: 0
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
    subtitle: "View job details and perform publish/close actions.",
    searchPlaceholder: "Search jobs by id"
  },
  decisions: {
    title: "Final Decisions",
    subtitle: "Set final selected/rejected decisions for applications.",
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
  searchInput: document.querySelector("[data-hm-search]"),

  kpiPendingApprovals: document.querySelector("[data-hm-kpi-pending-approvals]"),
  kpiPublished: document.querySelector("[data-hm-kpi-published]"),
  kpiClosed: document.querySelector("[data-hm-kpi-closed]"),

  approverIdInput: document.querySelector("[data-hm-approver-id]"),
  approvalLoadBtn: document.querySelector("[data-hm-approval-load]"),
  approvalList: document.querySelector("[data-hm-approval-list]"),
  approvalMsg: document.querySelector("[data-hm-approval-msg]"),

  jobIdInput: document.querySelector("[data-hm-job-id-input]"),
  jobLoadBtn: document.querySelector("[data-hm-job-load]"),
  jobTitle: document.querySelector("[data-hm-job-title]"),
  jobStatus: document.querySelector("[data-hm-job-status]"),
  jobCompany: document.querySelector("[data-hm-job-company]"),
  jobLocation: document.querySelector("[data-hm-job-location]"),
  jobPositions: document.querySelector("[data-hm-job-positions]"),
  selectedJobId: document.querySelector("[data-hm-selected-job-id]"),
  jobPublishBtn: document.querySelector("[data-hm-job-publish]"),
  jobCloseBtn: document.querySelector("[data-hm-job-close]"),
  approvalComments: document.querySelector("[data-hm-approval-comments]"),
  jobApproveBtn: document.querySelector("[data-hm-job-approve]"),
  jobRejectBtn: document.querySelector("[data-hm-job-reject]"),
  jobMsg: document.querySelector("[data-hm-job-msg]"),
  jobActionMsg: document.querySelector("[data-hm-job-action-msg]"),

  finalDecisionForm: document.querySelector("[data-hm-final-decision-form]"),
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

function toNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
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

  listPendingApprovals(approverId) {
    return apiRequest(HM_CONFIG.endpoints.listPendingApprovals, {
      query: approverId ? { approver_id: approverId } : {}
    });
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

  publishJob(jobId) {
    return apiRequest(buildPathWithId(HM_CONFIG.endpoints.publishJob, jobId), {
      method: "POST",
      body: {}
    });
  },

  closeJob(jobId) {
    return apiRequest(buildPathWithId(HM_CONFIG.endpoints.closeJob, jobId), {
      method: "POST",
      body: {}
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

function profileStatus(text, type) {
  setMessage(ui.profileStatus, text, type);
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

function approverIdOrMe() {
  const typed = String(ui.approverIdInput?.value || "").trim();
  if (typed) return toNumber(typed);
  return toNumber(firstValue(hmState.currentProfile || {}, ["id"], "")) || null;
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
    const rows = normalizeArrayResponse(await hmApi.listPendingApprovals(approverIdOrMe()));
    hmState.approvalsRows = rows;
    renderApprovalRows(rows);
    setMessage(ui.approvalMsg, `Loaded ${rows.length} pending approval(s).`, "success");
  } catch (error) {
    hmState.approvalsRows = [];
    renderApprovalRows([]);
    setMessage(ui.approvalMsg, error.message || "Failed to load approvals.", "error");
  }
}

async function loadJobById(jobId) {
  if (!jobId) {
    setMessage(ui.jobMsg, "Job id is required.", "error");
    return;
  }
  try {
    setMessage(ui.jobMsg, "Loading job...", "info");
    const job = await hmApi.getJobById(jobId);
    setSelectedJob(job);
    setMessage(ui.jobMsg, "Job loaded.", "success");
  } catch (error) {
    setSelectedJob(null);
    setMessage(ui.jobMsg, error.message || "Failed to load job.", "error");
  }
}

async function runApprovalAction(action, jobId, comments) {
  const approverId = approverIdOrMe();
  if (!jobId || !approverId) {
    setMessage(ui.approvalMsg, "Job id and approver id are required.", "error");
    return;
  }

  try {
    if (action === "approve") {
      await hmApi.approveJob(jobId, { approver_id: approverId, comments: comments || "" });
      setMessage(ui.approvalMsg, "Job approved.", "success");
    } else {
      await hmApi.rejectJob(jobId, { approver_id: approverId, comments: comments || "" });
      setMessage(ui.approvalMsg, "Job rejected.", "success");
    }
    await loadPendingApprovals();
    await loadDashboardKpis();
    await loadJobById(jobId);
  } catch (error) {
    setMessage(ui.approvalMsg, error.message || `Failed to ${action} job.`, "error");
  }
}

async function runJobAction(action, jobId) {
  if (!jobId) {
    setMessage(ui.jobActionMsg, "Select a job first.", "error");
    return;
  }

  try {
    if (action === "publish") {
      await hmApi.publishJob(jobId);
      hmState.sessionPublishedCount += 1;
      setMessage(ui.jobActionMsg, "Job published.", "success");
    }
    if (action === "close") {
      await hmApi.closeJob(jobId);
      hmState.sessionClosedCount += 1;
      setMessage(ui.jobActionMsg, "Job closed.", "success");
    }
    await loadJobById(jobId);
    await loadDashboardKpis();
  } catch (error) {
    setMessage(ui.jobActionMsg, error.message || `Failed to ${action} job.`, "error");
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
  setText(ui.kpiPublished, hmState.sessionPublishedCount);
  setText(ui.kpiClosed, hmState.sessionClosedCount);

  if (!hmState.approvalsLoaded) {
    try {
      const rows = normalizeArrayResponse(await hmApi.listPendingApprovals(approverIdOrMe()));
      hmState.approvalsRows = rows;
      hmState.approvalsLoaded = true;
    } catch (error) {
      hmState.approvalsRows = [];
    }
  }

  setText(ui.kpiPendingApprovals, hmState.approvalsRows.length);
}

async function reloadProfile() {
  profileStatus("Loading profile...", "info");
  try {
    const payload = await hmApi.getMyProfile();
    hmState.currentProfile = payload?.profile || payload || null;
    renderProfilePanel();
    showSection(hmState.currentView || "profile");
    profileStatus("Profile loaded from API.", "success");
  } catch (error) {
    profileStatus(error.message || "Failed to load profile.", "error");
  }
}

async function submitProfileUpdate(event) {
  event.preventDefault();
  const firstName = String(ui.profileFirstName?.value || "").trim();
  const lastName = String(ui.profileLastName?.value || "").trim();
  const email = String(ui.profileEditEmail?.value || "").trim();

  if (!firstName || !lastName || !email) {
    profileStatus("first_name, last_name and email are required.", "error");
    return;
  }

  if (!isValidEmail(email)) {
    profileStatus("Enter a valid email address.", "error");
    return;
  }

  const initialText = ui.profileSaveBtn?.textContent || "Save Profile";
  if (ui.profileSaveBtn) {
    ui.profileSaveBtn.disabled = true;
    ui.profileSaveBtn.textContent = "Saving...";
  }
  profileStatus("Updating profile...", "info");

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
    profileStatus(result?.message || "Profile updated successfully.", "success");
  } catch (error) {
    profileStatus(error.message || "Failed to update profile.", "error");
  } finally {
    if (ui.profileSaveBtn) {
      ui.profileSaveBtn.disabled = false;
      ui.profileSaveBtn.textContent = initialText;
    }
  }
}

async function openDashboard() {
  showSection("dashboard");
  await loadDashboardKpis();
}

async function openApprovals() {
  showSection("approvals");
  if (!hmState.approvalsLoaded) {
    hmState.approvalsLoaded = true;
    await loadPendingApprovals();
  }
}

async function openJobs() {
  showSection("jobs");
}

async function openDecisions() {
  showSection("decisions");
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
      hmState.approvalsLoaded = true;
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
        await loadJobById(jobId);
        return;
      }

      const comments = window.prompt(`Comments for ${action}:`, "") || "";
      await runApprovalAction(action, jobId, comments);
    });
  }

  if (ui.jobLoadBtn) {
    ui.jobLoadBtn.addEventListener("click", async () => {
      const jobId = String(ui.jobIdInput?.value || "").trim();
      await loadJobById(jobId);
    });
  }

  if (ui.jobPublishBtn) {
    ui.jobPublishBtn.addEventListener("click", async () => {
      const jobId = firstValue(hmState.selectedJob || {}, ["id"], "");
      await runJobAction("publish", jobId);
    });
  }

  if (ui.jobCloseBtn) {
    ui.jobCloseBtn.addEventListener("click", async () => {
      const jobId = firstValue(hmState.selectedJob || {}, ["id"], "");
      await runJobAction("close", jobId);
    });
  }

  if (ui.jobApproveBtn) {
    ui.jobApproveBtn.addEventListener("click", async () => {
      const jobId = firstValue(hmState.selectedJob || {}, ["id"], "");
      const comments = String(ui.approvalComments?.value || "").trim();
      await runApprovalAction("approve", jobId, comments);
    });
  }

  if (ui.jobRejectBtn) {
    ui.jobRejectBtn.addEventListener("click", async () => {
      const jobId = firstValue(hmState.selectedJob || {}, ["id"], "");
      const comments = String(ui.approvalComments?.value || "").trim();
      await runApprovalAction("reject", jobId, comments);
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

async function initHiringManagerDashboard() {
  if (!ui.navLinks.length || !ui.sections.length) return;

  bindNavigation();
  bindActions();
  setSelectedJob(null);

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
  loadJobById,
  performLogout
};
