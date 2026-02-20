
/**
 * Candidate dashboard script.
 */

const CANDIDATE_CONFIG = {
  apiBase: String(window.CANDIDATE_API_BASE_URL || window.API_BASE || "http://localhost:3000").replace(/\/+$/, ""),
  tryApiPrefixFallback: false,
  tokenKeys: ["token", "accessToken", "authToken", "jwtToken"],
  endpoints: {
    authLogout: "/auth/logout",
    getMyProfile: "/candidate/profile",
    updateMyProfile: "/candidate/profile",
    getCandidateProfile: "/candidate/me/profile",
    updateCandidateProfile: "/candidate/me/profile",
    uploadResume: "/candidate/me/resume",
    listJobs: "/candidate/jobs",
    getJobById: "/candidate/jobs/:id",
    applyForJob: "/candidate/applications",
    listMyApplications: "/candidate/my-applications",
    listSavedJobs: "/candidate/saved-jobs",
    saveJob: "/candidate/saved-jobs",
    unsaveJob: "/candidate/saved-jobs",
    getOffers: "/candidate/offers",
    acceptOffer: "/candidate/offers/:id/accept",
    declineOffer: "/candidate/offers/:id/decline",
  },
};

const candState = {
  currentView: "dashboard",
  currentProfile: null,
  currentCandidateProfile: null,
  selectedJob: null,
  applicationsRows: [],
  savedRows: [],
  offersRows: [],
  jobsLoaded: false,
  applicationsLoaded: false,
  savedLoaded: false,
  offersLoadedApplicationId: "",
};

const viewMeta = {
  dashboard: { title: "Candidate Dashboard", subtitle: "Monitor applications, saved jobs, and offer responses.", search: "Search jobs or companies" },
  jobs: { title: "Jobs", subtitle: "Browse available roles, view details, and apply instantly.", search: "Search jobs by title or location" },
  applications: { title: "My Applications", subtitle: "Track your submitted applications and current status.", search: "Search applications" },
  saved: { title: "Saved Jobs", subtitle: "Manage your saved jobs and remove what you no longer need.", search: "Search saved jobs" },
  offers: { title: "Offers", subtitle: "Load offers by application and accept or decline.", search: "Search offers by id" },
  profile: { title: "Profile", subtitle: "Update account details and candidate profile information.", search: "Search jobs or applications" },
};

const ui = {
  navLinks: document.querySelectorAll("[data-cand-nav]"),
  sections: document.querySelectorAll("[data-cand-view]"),
  headerTitle: document.querySelector("[data-cand-header-title]"),
  headerSubtitle: document.querySelector("[data-cand-header-subtitle]"),
  searchInput: document.querySelector("[data-cand-search]"),

  kpiActiveApps: document.querySelector("[data-cand-kpi-active-apps]"),
  kpiSavedJobs: document.querySelector("[data-cand-kpi-saved-jobs]"),
  kpiOffers: document.querySelector("[data-cand-kpi-offers]"),
  kpiProfile: document.querySelector("[data-cand-kpi-profile]"),

  jobStatus: document.querySelector("[data-cand-job-status]"),
  jobsLoadBtn: document.querySelector("[data-cand-jobs-load]"),
  jobList: document.querySelector("[data-cand-job-list]"),
  jobMsg: document.querySelector("[data-cand-job-msg]"),
  selectedJobTitle: document.querySelector("[data-cand-selected-job-title]"),
  selectedJobDescription: document.querySelector("[data-cand-selected-job-description]"),
  selectedJobRequirements: document.querySelector("[data-cand-selected-job-requirements]"),
  selectedJobEmployment: document.querySelector("[data-cand-selected-job-employment]"),

  appsLoadBtn: document.querySelector("[data-cand-apps-load]"),
  appList: document.querySelector("[data-cand-app-list]"),
  appMsg: document.querySelector("[data-cand-app-msg]"),

  saveJobForm: document.querySelector("[data-cand-save-job-form]"),
  saveJobId: document.querySelector("[data-cand-save-job-id]"),
  saveMsg: document.querySelector("[data-cand-save-msg]"),
  savedLoadBtn: document.querySelector("[data-cand-saved-load]"),
  savedList: document.querySelector("[data-cand-saved-list]"),
  savedMsg: document.querySelector("[data-cand-saved-msg]"),

  offerApplicationId: document.querySelector("[data-cand-offer-application-id]"),
  offersLoadBtn: document.querySelector("[data-cand-offers-load]"),
  offerList: document.querySelector("[data-cand-offer-list]"),
  offerMsg: document.querySelector("[data-cand-offer-msg]"),

  profileName: document.querySelector("[data-cand-profile-name]"),
  profileEmail: document.querySelector("[data-cand-profile-email]"),
  profileRole: document.querySelector("[data-cand-profile-role]"),
  profileLastLogin: document.querySelector("[data-cand-profile-last-login]"),
  profileForm: document.querySelector("[data-cand-profile-form]"),
  profileFirstName: document.querySelector("[data-cand-edit-first-name]"),
  profileLastName: document.querySelector("[data-cand-edit-last-name]"),
  profileEditEmail: document.querySelector("[data-cand-edit-email]"),
  profileSaveBtn: document.querySelector("[data-cand-profile-save]"),
  profileStatus: document.querySelector("[data-cand-profile-status]"),

  cpPhone: document.querySelector("[data-cand-cp-phone]"),
  cpAddress: document.querySelector("[data-cand-cp-address]"),
  cpResume: document.querySelector("[data-cand-cp-resume]"),
  cpVerified: document.querySelector("[data-cand-cp-verified]"),
  cpForm: document.querySelector("[data-cand-cp-form]"),
  cpEditPhone: document.querySelector("[data-cand-cp-edit-phone]"),
  cpEditAddress: document.querySelector("[data-cand-cp-edit-address]"),
  cpEditData: document.querySelector("[data-cand-cp-edit-data]"),
  cpResumeUrl: document.querySelector("[data-cand-cp-resume-url]"),
  cpUploadResumeBtn: document.querySelector("[data-cand-cp-upload-resume]"),

  reloadProfileBtn: document.querySelector("[data-cand-reload-profile]"),
  logoutBtn: document.querySelector("[data-cand-logout]"),
};

function f(record, keys, fallback = "") {
  for (let i = 0; i < keys.length; i += 1) {
    const value = record?.[keys[i]];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return fallback;
}

function arr(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  return [];
}

function record(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (payload.profile && typeof payload.profile === "object" && !Array.isArray(payload.profile)) return payload.profile;
  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) return payload.data;
  return payload;
}

function build(path, id) {
  return path.replace(":id", encodeURIComponent(String(id)));
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value === undefined || value === null || value === "" ? "N/A" : String(value);
}

function setMsg(el, text, type = "info") {
  if (!el) return;
  el.textContent = text || "";
  el.classList.remove("text-secondary", "text-success", "text-danger");
  if (type === "success") return el.classList.add("text-success");
  if (type === "error") return el.classList.add("text-danger");
  el.classList.add("text-secondary");
}

function tableMsg(tbody, colSpan, text) {
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-secondary py-3">${text}</td></tr>`;
}

function fmtDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function toNum(value) {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function yesNo(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value === 1 ? "Yes" : "No";
  const v = String(value || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" ? "Yes" : "No";
}

function safeJsonString(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") {
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch (error) { return value; }
  }
  try { return JSON.stringify(value, null, 2); } catch (error) { return ""; }
}

function profileDataObject(profile) {
  const raw = profile?.profile_data;
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }
  return null;
}

function candidateField(profile, key, fallback = "N/A") {
  const direct = f(profile || {}, [key], "");
  if (direct) return direct;
  const dataObj = profileDataObject(profile);
  const fromData = f(dataObj || {}, [key], "");
  return fromData || fallback;
}

function parseJsonInput(rawText) {
  const value = String(rawText || "").trim();
  if (!value) return null;
  try { return JSON.parse(value); } catch (error) { throw new Error("Profile Data must be valid JSON"); }
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function fullName(user) {
  const first = f(user, ["first_name"], "");
  const last = f(user, ["last_name"], "");
  const name = `${first} ${last}`.trim();
  return name || f(user, ["name"], "N/A");
}

function getStoredToken() {
  if (window.CANDIDATE_TOKEN) return String(window.CANDIDATE_TOKEN);
  for (let i = 0; i < CANDIDATE_CONFIG.tokenKeys.length; i += 1) {
    const key = CANDIDATE_CONFIG.tokenKeys[i];
    const a = localStorage.getItem(key);
    if (a) return a;
    const b = sessionStorage.getItem(key);
    if (b) return b;
  }
  return "";
}

function authHeader() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearAuth() {
  CANDIDATE_CONFIG.tokenKeys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  localStorage.removeItem("role");
  localStorage.removeItem("userRole");
  sessionStorage.removeItem("role");
  sessionStorage.removeItem("userRole");
}

function toLogin(message) {
  localStorage.setItem("sessionExpiredMessage", message || "Login session expired. Please log in again.");
  clearAuth();
  window.location.href = "../public/login.html";
}

function urls(path, queryObj) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const params = new URLSearchParams();
  if (queryObj && typeof queryObj === "object") {
    Object.keys(queryObj).forEach((k) => {
      const v = queryObj[k];
      if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
    });
  }
  const q = params.toString();
  const out = [];
  const add = (url) => {
    const finalUrl = q ? `${url}?${q}` : url;
    if (!out.includes(finalUrl)) out.push(finalUrl);
  };
  add(`${CANDIDATE_CONFIG.apiBase}${cleanPath}`);
  if (CANDIDATE_CONFIG.tryApiPrefixFallback) {
    if (CANDIDATE_CONFIG.apiBase.endsWith("/api")) {
      add(`${CANDIDATE_CONFIG.apiBase.replace(/\/api$/, "")}${cleanPath}`);
    } else {
      add(`${CANDIDATE_CONFIG.apiBase}/api${cleanPath}`);
    }
  }
  return out;
}

async function asJson(res) {
  try { return await res.json(); } catch (error) { return null; }
}

function preferErr(a, b) {
  if (!a) return b;
  const sa = Number(a.status || 0);
  const sb = Number(b?.status || 0);
  if (sa === 404 && sb && sb !== 404) return b;
  return a;
}

async function api(path, options = {}) {
  const method = options.method || "GET";
  const payload = options.body;
  const query = options.query || null;
  const useAuthHeader = options.useAuthHeader !== false;
  const baseHeaders = { ...(useAuthHeader ? authHeader() : {}), ...(options.headers || {}) };
  if (payload !== undefined && payload !== null && !baseHeaders["Content-Type"]) baseHeaders["Content-Type"] = "application/json";

  const req = () => {
    const out = { method, headers: { ...(useAuthHeader ? authHeader() : {}), ...baseHeaders }, credentials: "include" };
    if (payload !== undefined && payload !== null) out.body = JSON.stringify(payload);
    return out;
  };

  const candidates = urls(path, query);
  let lastError = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const url = candidates[i];
    try {
      const response = await fetch(url, req());
      const data = response.status === 204 ? null : await asJson(response);
      if (response.ok) return data;
      const error = new Error(data?.message || `${method} ${url} failed with status ${response.status}`);
      error.status = response.status;
      lastError = preferErr(lastError, error);
      if (response.status === 401) toLogin(data?.message || "Login session expired. Please log in again.");
      if (response.status !== 404) throw error;
    } catch (error) {
      lastError = preferErr(lastError, error);
    }
  }
  throw lastError || new Error("API request failed");
}

const candApi = {
  logout: () => api(CANDIDATE_CONFIG.endpoints.authLogout, { method: "POST", body: {}, useAuthHeader: false }),
  getMyProfile: () => api(CANDIDATE_CONFIG.endpoints.getMyProfile),
  updateMyProfile: (body) => api(CANDIDATE_CONFIG.endpoints.updateMyProfile, { method: "PUT", body }),
  getCandidateProfile: () => api(CANDIDATE_CONFIG.endpoints.getCandidateProfile),
  updateCandidateProfile: (body) => api(CANDIDATE_CONFIG.endpoints.updateCandidateProfile, { method: "PUT", body }),
  uploadResume: (resumeUrl) => api(CANDIDATE_CONFIG.endpoints.uploadResume, { method: "POST", body: { resume_url: resumeUrl } }),
  listJobs: (query = {}) => api(CANDIDATE_CONFIG.endpoints.listJobs, { query }),
  getJobById: (id) => api(build(CANDIDATE_CONFIG.endpoints.getJobById, id)),
  applyForJob: (jobId) => api(CANDIDATE_CONFIG.endpoints.applyForJob, { method: "POST", body: { job_id: jobId } }),
  listMyApplications: () => api(CANDIDATE_CONFIG.endpoints.listMyApplications),
  listSavedJobs: () => api(CANDIDATE_CONFIG.endpoints.listSavedJobs),
  saveJob: (jobId) => api(CANDIDATE_CONFIG.endpoints.saveJob, { method: "POST", body: { job_id: jobId } }),
  unsaveJob: (jobId) => api(CANDIDATE_CONFIG.endpoints.unsaveJob, { method: "DELETE", body: { job_id: jobId } }),
  getOffers: (applicationId) => api(CANDIDATE_CONFIG.endpoints.getOffers, { query: { application_id: applicationId } }),
  acceptOffer: (id) => api(build(CANDIDATE_CONFIG.endpoints.acceptOffer, id), { method: "POST", body: {} }),
  declineOffer: (id) => api(build(CANDIDATE_CONFIG.endpoints.declineOffer, id), { method: "POST", body: {} }),
};

function setActiveNav(viewKey) {
  ui.navLinks.forEach((link) => link.classList.remove("active"));
  const target = document.querySelector(`[data-cand-nav="${viewKey}"]`);
  if (target) target.classList.add("active");
}

function profileSuffix() {
  const p = candState.currentProfile;
  if (!p) return "";
  const name = fullName(p);
  const role = f(p, ["role"], "");
  if (name === "N/A" && !role) return "";
  if (name !== "N/A" && role) return ` Signed in as ${name} (${role}).`;
  return ` Signed in as ${name !== "N/A" ? name : role}.`;
}

function showSection(viewKey) {
  ui.sections.forEach((section) => section.classList.toggle("d-none", section.dataset.candView !== viewKey));
  candState.currentView = viewKey;
  setActiveNav(viewKey);
  const meta = viewMeta[viewKey];
  if (!meta) return;
  if (ui.headerTitle) ui.headerTitle.textContent = meta.title;
  if (ui.headerSubtitle) ui.headerSubtitle.textContent = `${meta.subtitle}${profileSuffix()}`;
  if (ui.searchInput) ui.searchInput.placeholder = meta.search;
}

function ensureRole(profile) {
  const role = String(f(profile || {}, ["role"], "")).trim().toLowerCase();
  if (!role || role === "candidate") return true;
  toLogin("You are not authorized to access Candidate dashboard.");
  return false;
}

function renderAccountProfile() {
  const p = candState.currentProfile;
  if (!p) {
    setText(ui.profileName, "N/A");
    setText(ui.profileEmail, "N/A");
    setText(ui.profileRole, "N/A");
    setText(ui.profileLastLogin, "N/A");
    if (ui.profileFirstName) ui.profileFirstName.value = "";
    if (ui.profileLastName) ui.profileLastName.value = "";
    if (ui.profileEditEmail) ui.profileEditEmail.value = "";
    return;
  }
  setText(ui.profileName, fullName(p));
  setText(ui.profileEmail, f(p, ["email"], "N/A"));
  setText(ui.profileRole, f(p, ["role"], "N/A"));
  setText(ui.profileLastLogin, fmtDateTime(f(p, ["last_login_at"], "")));
  if (ui.profileFirstName) ui.profileFirstName.value = f(p, ["first_name"], "");
  if (ui.profileLastName) ui.profileLastName.value = f(p, ["last_name"], "");
  if (ui.profileEditEmail) ui.profileEditEmail.value = f(p, ["email"], "");
}

function renderCandidateProfile(profile) {
  candState.currentCandidateProfile = profile || null;
  if (!profile) {
    setText(ui.cpPhone, "N/A");
    setText(ui.cpAddress, "N/A");
    setText(ui.cpResume, "N/A");
    setText(ui.cpVerified, "N/A");
    if (ui.cpEditPhone) ui.cpEditPhone.value = "";
    if (ui.cpEditAddress) ui.cpEditAddress.value = "";
    if (ui.cpEditData) ui.cpEditData.value = "";
    if (ui.cpResumeUrl) ui.cpResumeUrl.value = "";
    return;
  }

  setText(ui.cpPhone, candidateField(profile, "phone", "N/A"));
  setText(ui.cpAddress, candidateField(profile, "address", "N/A"));
  setText(ui.cpVerified, yesNo(f(profile, ["is_verified"], "0")));

  const resume = f(profile, ["resume_url"], "");
  if (ui.cpResume) {
    ui.cpResume.textContent = "";
    if (!resume) {
      ui.cpResume.textContent = "N/A";
    } else {
      const a = document.createElement("a");
      a.href = resume;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = "Open Resume";
      ui.cpResume.appendChild(a);
    }
  }
  if (ui.cpEditPhone) ui.cpEditPhone.value = candidateField(profile, "phone", "");
  if (ui.cpEditAddress) ui.cpEditAddress.value = candidateField(profile, "address", "");
  if (ui.cpEditData) ui.cpEditData.value = safeJsonString(profile.profile_data);
  if (ui.cpResumeUrl) ui.cpResumeUrl.value = resume;
}

function setSelectedJob(job) {
  candState.selectedJob = job ? { ...job } : null;
  setText(ui.selectedJobTitle, f(job || {}, ["title"], "N/A"));
  setText(ui.selectedJobDescription, f(job || {}, ["description"], "N/A"));
  setText(ui.selectedJobRequirements, f(job || {}, ["requirements"], "N/A"));
  setText(ui.selectedJobEmployment, f(job || {}, ["employment_type"], "N/A"));
}

function profileStatus(text, type) {
  setMsg(ui.profileStatus, text, type);
}

async function loadAuthProfile() {
  try {
    const payload = await candApi.getMyProfile();
    candState.currentProfile = record(payload) || null;
    if (!ensureRole(candState.currentProfile)) return false;
    const role = f(candState.currentProfile, ["role"], "");
    if (role) {
      localStorage.setItem("role", role);
      localStorage.setItem("userRole", role);
      sessionStorage.setItem("role", role);
      sessionStorage.setItem("userRole", role);
    }
    renderAccountProfile();
    return true;
  } catch (error) {
    console.error("Candidate profile load error:", error);
    toLogin("Login session expired. Please log in again.");
    return false;
  }
}

async function loadCandidateSelfProfile() {
  const payload = await candApi.getCandidateProfile();
  const p = record(payload) || null;
  renderCandidateProfile(p);
  return p;
}

async function performLogout() {
  try {
    await candApi.logout();
  } catch (error) {
    console.error("Logout API error:", error);
  } finally {
    clearAuth();
    window.location.href = "../public/login.html";
  }
}

function renderJobRows(rows) {
  if (!ui.jobList) return;
  if (!rows.length) return tableMsg(ui.jobList, 6, "No jobs found");
  ui.jobList.innerHTML = "";

  rows.forEach((job) => {
    const tr = document.createElement("tr");
    const id = f(job, ["id"], "");
    const status = f(job, ["status"], "");
    const canApply = String(status).toLowerCase() === "published";

    const cells = [
      id || "N/A",
      f(job, ["title"], "N/A"),
      f(job, ["company_name"], "N/A"),
      status || "N/A",
      f(job, ["location"], "N/A"),
    ];

    cells.forEach((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });

    const actionTd = document.createElement("td");
    actionTd.className = "text-nowrap";
    const actions = [
      { action: "view", label: "View", cls: "btn-outline-brand", disabled: false },
      { action: "apply", label: "Apply", cls: "btn-outline-success", disabled: !canApply },
      { action: "save", label: "Save", cls: "btn-outline-secondary", disabled: false },
    ];
    actions.forEach((entry, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `btn ${entry.cls} btn-sm${i < actions.length - 1 ? " me-2" : ""}`;
      b.textContent = entry.label;
      b.dataset.jobAction = entry.action;
      b.dataset.jobId = id;
      b.disabled = entry.disabled;
      actionTd.appendChild(b);
    });
    tr.appendChild(actionTd);
    ui.jobList.appendChild(tr);
  });
}

async function loadJobs() {
  const status = String(ui.jobStatus?.value || "all").trim();
  const query = {};
  if (status && status !== "all") query.status = status;
  try {
    setMsg(ui.jobMsg, "Loading jobs...", "info");
    const rows = arr(await candApi.listJobs(query));
    renderJobRows(rows);
    setMsg(ui.jobMsg, `Loaded ${rows.length} job(s).`, "success");
  } catch (error) {
    renderJobRows([]);
    setMsg(ui.jobMsg, error.message || "Failed to load jobs.", "error");
  }
}

async function loadJobById(jobId, silent = false) {
  if (!jobId) return;
  try {
    if (!silent) setMsg(ui.jobMsg, "Loading job details...", "info");
    setSelectedJob(await candApi.getJobById(jobId));
    if (!silent) setMsg(ui.jobMsg, "Job details loaded.", "success");
  } catch (error) {
    if (!silent) setMsg(ui.jobMsg, error.message || "Failed to load job details.", "error");
  }
}

async function applyForJob(jobId) {
  if (!jobId) return;
  try {
    await candApi.applyForJob(toNum(jobId) || jobId);
    setMsg(ui.jobMsg, "Application submitted successfully.", "success");
    candState.applicationsLoaded = true;
    await loadApplications();
    await loadDashboardKpis();
  } catch (error) {
    setMsg(ui.jobMsg, error.message || "Failed to apply for job.", "error");
  }
}

async function saveJob(jobId, messageEl) {
  if (!jobId) return;
  try {
    await candApi.saveJob(toNum(jobId) || jobId);
    setMsg(messageEl, "Job saved successfully.", "success");
    candState.savedLoaded = true;
    await loadSavedJobs();
    await loadDashboardKpis();
  } catch (error) {
    setMsg(messageEl, error.message || "Failed to save job.", "error");
  }
}

function renderApplicationRows(rows) {
  if (!ui.appList) return;
  if (!rows.length) return tableMsg(ui.appList, 5, "No applications found");
  ui.appList.innerHTML = "";
  rows.forEach((app) => {
    const tr = document.createElement("tr");
    const cells = [
      f(app, ["id"], "N/A"),
      f(app, ["title"], "N/A"),
      f(app, ["company_name"], "N/A"),
      f(app, ["status"], "N/A"),
      fmtDateTime(f(app, ["applied_at"], "")),
    ];
    cells.forEach((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    ui.appList.appendChild(tr);
  });
}

async function loadApplications() {
  try {
    setMsg(ui.appMsg, "Loading applications...", "info");
    candState.applicationsRows = arr(await candApi.listMyApplications());
    renderApplicationRows(candState.applicationsRows);
    setMsg(ui.appMsg, `Loaded ${candState.applicationsRows.length} application(s).`, "success");
  } catch (error) {
    candState.applicationsRows = [];
    renderApplicationRows([]);
    setMsg(ui.appMsg, error.message || "Failed to load applications.", "error");
  }
}

function renderSavedRows(rows) {
  if (!ui.savedList) return;
  if (!rows.length) return tableMsg(ui.savedList, 5, "No saved jobs found");
  ui.savedList.innerHTML = "";
  rows.forEach((job) => {
    const tr = document.createElement("tr");
    const id = f(job, ["id"], "");
    const cells = [id || "N/A", f(job, ["title"], "N/A"), f(job, ["company_name"], "N/A"), f(job, ["status"], "N/A")];
    cells.forEach((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });

    const actionTd = document.createElement("td");
    actionTd.className = "text-nowrap";

    const view = document.createElement("button");
    view.type = "button";
    view.className = "btn btn-outline-brand btn-sm me-2";
    view.textContent = "View";
    view.dataset.savedAction = "view";
    view.dataset.jobId = id;
    actionTd.appendChild(view);

    const unsave = document.createElement("button");
    unsave.type = "button";
    unsave.className = "btn btn-outline-danger btn-sm";
    unsave.textContent = "Unsave";
    unsave.dataset.savedAction = "unsave";
    unsave.dataset.jobId = id;
    actionTd.appendChild(unsave);

    tr.appendChild(actionTd);
    ui.savedList.appendChild(tr);
  });
}

async function loadSavedJobs() {
  try {
    setMsg(ui.savedMsg, "Loading saved jobs...", "info");
    candState.savedRows = arr(await candApi.listSavedJobs());
    renderSavedRows(candState.savedRows);
    setMsg(ui.savedMsg, `Loaded ${candState.savedRows.length} saved job(s).`, "success");
  } catch (error) {
    candState.savedRows = [];
    renderSavedRows([]);
    setMsg(ui.savedMsg, error.message || "Failed to load saved jobs.", "error");
  }
}

async function submitSaveJob(event) {
  event.preventDefault();
  const id = String(ui.saveJobId?.value || "").trim();
  if (!id) return setMsg(ui.saveMsg, "job_id is required.", "error");
  await saveJob(id, ui.saveMsg);
}

async function unsaveJob(jobId) {
  if (!jobId) return;
  try {
    await candApi.unsaveJob(toNum(jobId) || jobId);
    setMsg(ui.savedMsg, "Saved job removed.", "success");
    await loadSavedJobs();
    await loadDashboardKpis();
  } catch (error) {
    setMsg(ui.savedMsg, error.message || "Failed to unsave job.", "error");
  }
}

function offerDetailsText(value) {
  if (value === undefined || value === null || value === "") return "N/A";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function renderOfferRows(rows) {
  if (!ui.offerList) return;
  if (!rows.length) return tableMsg(ui.offerList, 5, "No offers found");
  ui.offerList.innerHTML = "";
  rows.forEach((offer) => {
    const tr = document.createElement("tr");
    const id = f(offer, ["id"], "");
    const status = String(f(offer, ["status"], "")).toLowerCase();
    const responded = status === "accepted" || status === "declined";

    const idTd = document.createElement("td");
    idTd.textContent = id || "N/A";
    tr.appendChild(idTd);

    const statusTd = document.createElement("td");
    statusTd.textContent = status || "N/A";
    tr.appendChild(statusTd);

    const detailsTd = document.createElement("td");
    detailsTd.textContent = offerDetailsText(offer.offer_details);
    tr.appendChild(detailsTd);

    const docTd = document.createElement("td");
    const docUrl = f(offer, ["document_url"], "");
    if (!docUrl) {
      docTd.textContent = "N/A";
    } else {
      const a = document.createElement("a");
      a.href = docUrl;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = "Open Offer";
      docTd.appendChild(a);
    }
    tr.appendChild(docTd);

    const actionTd = document.createElement("td");
    actionTd.className = "text-nowrap";
    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "btn btn-outline-success btn-sm me-2";
    accept.textContent = "Accept";
    accept.dataset.offerAction = "accept";
    accept.dataset.offerId = id;
    accept.disabled = responded;
    actionTd.appendChild(accept);
    const decline = document.createElement("button");
    decline.type = "button";
    decline.className = "btn btn-outline-danger btn-sm";
    decline.textContent = "Decline";
    decline.dataset.offerAction = "decline";
    decline.dataset.offerId = id;
    decline.disabled = responded;
    actionTd.appendChild(decline);
    tr.appendChild(actionTd);

    ui.offerList.appendChild(tr);
  });
}

async function loadOffers() {
  const applicationId = String(ui.offerApplicationId?.value || "").trim();
  if (!applicationId) {
    tableMsg(ui.offerList, 5, "Enter application_id to load offers.");
    return setMsg(ui.offerMsg, "application_id is required.", "error");
  }
  try {
    setMsg(ui.offerMsg, "Loading offers...", "info");
    candState.offersRows = arr(await candApi.getOffers(applicationId));
    candState.offersLoadedApplicationId = applicationId;
    renderOfferRows(candState.offersRows);
    setMsg(ui.offerMsg, `Loaded ${candState.offersRows.length} offer(s).`, "success");
    await loadDashboardKpis();
  } catch (error) {
    candState.offersRows = [];
    renderOfferRows([]);
    setMsg(ui.offerMsg, error.message || "Failed to load offers.", "error");
  }
}

async function handleOfferAction(action, offerId) {
  if (!offerId) return;
  try {
    if (action === "accept") {
      await candApi.acceptOffer(offerId);
      setMsg(ui.offerMsg, "Offer accepted successfully.", "success");
    }
    if (action === "decline") {
      await candApi.declineOffer(offerId);
      setMsg(ui.offerMsg, "Offer declined successfully.", "success");
    }
    if (candState.offersLoadedApplicationId) await loadOffers();
    candState.applicationsLoaded = true;
    await loadApplications();
    await loadDashboardKpis();
  } catch (error) {
    setMsg(ui.offerMsg, error.message || "Failed to update offer response.", "error");
  }
}

function profileCompletion(profile) {
  if (!profile || typeof profile !== "object") return "--";
  const fields = [
    candidateField(profile, "phone", ""),
    candidateField(profile, "address", ""),
    f(profile, ["resume_url"], ""),
    profile.profile_data,
  ];
  const done = fields.filter((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return String(v).trim() !== "";
  }).length;
  return `${Math.round((done / fields.length) * 100)}%`;
}

function isActiveApplication(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return false;
  return !["rejected", "hired", "withdrawn", "declined", "closed"].includes(normalized);
}

async function loadDashboardKpis() {
  const results = await Promise.allSettled([candApi.listMyApplications(), candApi.listSavedJobs(), candApi.getCandidateProfile()]);
  if (results[0].status === "fulfilled") candState.applicationsRows = arr(results[0].value);
  if (results[1].status === "fulfilled") candState.savedRows = arr(results[1].value);
  if (results[2].status === "fulfilled") renderCandidateProfile(record(results[2].value) || null);

  const activeApps = (candState.applicationsRows || []).filter((row) => isActiveApplication(f(row, ["status"], ""))).length;
  setText(ui.kpiActiveApps, activeApps);
  setText(ui.kpiSavedJobs, (candState.savedRows || []).length);
  setText(ui.kpiOffers, (candState.offersRows || []).length);
  setText(ui.kpiProfile, profileCompletion(candState.currentCandidateProfile));
}

async function reloadProfile() {
  profileStatus("Loading profile...", "info");
  try {
    const [account, candidate] = await Promise.all([candApi.getMyProfile(), candApi.getCandidateProfile()]);
    candState.currentProfile = record(account) || null;
    renderAccountProfile();
    renderCandidateProfile(record(candidate) || null);
    showSection(candState.currentView || "profile");
    profileStatus("Profile loaded from API.", "success");
    await loadDashboardKpis();
  } catch (error) {
    profileStatus(error.message || "Failed to load profile.", "error");
  }
}

async function submitProfileUpdate(event) {
  event.preventDefault();
  const firstName = String(ui.profileFirstName?.value || "").trim();
  const lastName = String(ui.profileLastName?.value || "").trim();
  const email = String(ui.profileEditEmail?.value || "").trim();
  if (!firstName || !lastName || !email) return profileStatus("first_name, last_name and email are required.", "error");
  if (!validEmail(email)) return profileStatus("Enter a valid email address.", "error");

  const initialText = ui.profileSaveBtn?.textContent || "Save Account Profile";
  if (ui.profileSaveBtn) {
    ui.profileSaveBtn.disabled = true;
    ui.profileSaveBtn.textContent = "Saving...";
  }
  profileStatus("Updating account profile...", "info");

  try {
    const result = await candApi.updateMyProfile({ first_name: firstName, last_name: lastName, email });
    const updated = record(result);
    candState.currentProfile = updated && typeof updated === "object"
      ? { ...(candState.currentProfile || {}), ...updated }
      : { ...(candState.currentProfile || {}), first_name: firstName, last_name: lastName, email };
    renderAccountProfile();
    showSection(candState.currentView || "profile");
    profileStatus(result?.message || "Account profile updated successfully.", "success");
  } catch (error) {
    profileStatus(error.message || "Failed to update account profile.", "error");
  } finally {
    if (ui.profileSaveBtn) {
      ui.profileSaveBtn.disabled = false;
      ui.profileSaveBtn.textContent = initialText;
    }
  }
}

async function submitCandidateProfileUpdate(event) {
  event.preventDefault();
  let profileData = null;
  try {
    profileData = parseJsonInput(ui.cpEditData?.value || "");
  } catch (error) {
    return profileStatus(error.message, "error");
  }
  try {
    profileStatus("Updating candidate profile...", "info");
    const result = await candApi.updateCandidateProfile({
      phone: String(ui.cpEditPhone?.value || "").trim(),
      address: String(ui.cpEditAddress?.value || "").trim(),
      profile_data: profileData,
    });
    await loadCandidateSelfProfile();
    profileStatus(result?.message || "Candidate profile updated successfully.", "success");
    await loadDashboardKpis();
  } catch (error) {
    profileStatus(error.message || "Failed to update candidate profile.", "error");
  }
}

async function submitResumeUpdate() {
  const resume = String(ui.cpResumeUrl?.value || "").trim();
  if (!resume) return profileStatus("resume_url is required.", "error");
  try {
    profileStatus("Updating resume...", "info");
    const result = await candApi.uploadResume(resume);
    await loadCandidateSelfProfile();
    profileStatus(result?.message || "Resume updated successfully.", "success");
    await loadDashboardKpis();
  } catch (error) {
    profileStatus(error.message || "Failed to update resume.", "error");
  }
}

async function openDashboard() {
  showSection("dashboard");
  await loadDashboardKpis();
}
async function openJobs() {
  showSection("jobs");
  if (!candState.jobsLoaded) {
    candState.jobsLoaded = true;
    await loadJobs();
  }
}
async function openApplications() {
  showSection("applications");
  if (!candState.applicationsLoaded) {
    candState.applicationsLoaded = true;
    await loadApplications();
  }
}
async function openSaved() {
  showSection("saved");
  if (!candState.savedLoaded) {
    candState.savedLoaded = true;
    await loadSavedJobs();
  }
}
async function openOffers() {
  showSection("offers");
}
async function openProfile() {
  showSection("profile");
  renderAccountProfile();
  renderCandidateProfile(candState.currentCandidateProfile);
  await reloadProfile();
}

async function handleLogoutClick(event) {
  event.preventDefault();
  if (!window.confirm("Do you want to logout?")) return;
  await performLogout();
}

function bindNavigation() {
  ui.navLinks.forEach((link) => {
    const section = link.dataset.candNav;
    if (!section) return;
    if (section === "logout") return link.addEventListener("click", handleLogoutClick);
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      if (section === "dashboard") await openDashboard();
      if (section === "jobs") await openJobs();
      if (section === "applications") await openApplications();
      if (section === "saved") await openSaved();
      if (section === "offers") await openOffers();
      if (section === "profile") await openProfile();
      if (window.innerWidth < 992) document.body.classList.remove("dashboard-sidebar-open");
    });
  });
}

function bindActions() {
  if (ui.jobsLoadBtn) {
    ui.jobsLoadBtn.addEventListener("click", async () => {
      candState.jobsLoaded = true;
      await loadJobs();
      await loadDashboardKpis();
    });
  }

  if (ui.jobList) {
    ui.jobList.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-job-action]");
      if (!button) return;
      const action = String(button.dataset.jobAction || "").trim();
      const jobId = String(button.dataset.jobId || "").trim();
      if (!jobId) return;
      if (action === "view") await loadJobById(jobId);
      if (action === "apply") await applyForJob(jobId);
      if (action === "save") await saveJob(jobId, ui.jobMsg);
    });
  }

  if (ui.appsLoadBtn) {
    ui.appsLoadBtn.addEventListener("click", async () => {
      candState.applicationsLoaded = true;
      await loadApplications();
      await loadDashboardKpis();
    });
  }

  if (ui.saveJobForm) ui.saveJobForm.addEventListener("submit", submitSaveJob);
  if (ui.savedLoadBtn) {
    ui.savedLoadBtn.addEventListener("click", async () => {
      candState.savedLoaded = true;
      await loadSavedJobs();
      await loadDashboardKpis();
    });
  }

  if (ui.savedList) {
    ui.savedList.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-saved-action]");
      if (!button) return;
      const action = String(button.dataset.savedAction || "").trim();
      const jobId = String(button.dataset.jobId || "").trim();
      if (!jobId) return;
      if (action === "view") {
        await loadJobById(jobId, true);
        await openJobs();
      }
      if (action === "unsave") await unsaveJob(jobId);
    });
  }

  if (ui.offersLoadBtn) ui.offersLoadBtn.addEventListener("click", loadOffers);
  if (ui.offerList) {
    ui.offerList.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-offer-action]");
      if (!button) return;
      const action = String(button.dataset.offerAction || "").trim();
      const offerId = String(button.dataset.offerId || "").trim();
      if (!offerId) return;
      await handleOfferAction(action, offerId);
    });
  }

  if (ui.profileForm) ui.profileForm.addEventListener("submit", submitProfileUpdate);
  if (ui.cpForm) ui.cpForm.addEventListener("submit", submitCandidateProfileUpdate);
  if (ui.cpUploadResumeBtn) ui.cpUploadResumeBtn.addEventListener("click", submitResumeUpdate);
  if (ui.reloadProfileBtn) ui.reloadProfileBtn.addEventListener("click", reloadProfile);
  if (ui.logoutBtn) {
    ui.logoutBtn.addEventListener("click", async () => {
      if (!window.confirm("Do you want to logout?")) return;
      await performLogout();
    });
  }
}

async function initCandidateDashboard() {
  if (!ui.navLinks.length || !ui.sections.length) return;
  bindNavigation();
  bindActions();
  setSelectedJob(null);
  renderAccountProfile();
  renderCandidateProfile(null);
  tableMsg(ui.jobList, 6, "Load jobs to see records");
  tableMsg(ui.appList, 5, "Load applications to see records");
  tableMsg(ui.savedList, 5, "Load saved jobs to see records");
  tableMsg(ui.offerList, 5, "Enter application_id and load offers");

  const ready = await loadAuthProfile();
  if (!ready) return;
  try {
    await loadCandidateSelfProfile();
  } catch (error) {
    profileStatus(error.message || "Failed to load candidate profile.", "error");
  }
  await openDashboard();
}

document.addEventListener("DOMContentLoaded", () => {
  initCandidateDashboard();
});

window.candidateApi = {
  config: CANDIDATE_CONFIG,
  ...candApi,
  openDashboard,
  openJobs,
  openApplications,
  openSaved,
  openOffers,
  openProfile,
  loadJobs,
  loadApplications,
  loadSavedJobs,
  loadOffers,
  reloadProfile,
  performLogout,
};
