/**
 * HR Recruiter dashboard script.
 * Covers jobs, applications, candidates, interviews, offers, profile, and session flows.
 */

// 1) Config and state.
const HR_CONFIG = {
  useApi: true,
  apiBase: String(window.HR_API_BASE_URL || window.API_BASE || "http://localhost:3000").replace(/\/+$/, ""),
  tryApiPrefixFallback: false,
  tokenKeys: ["token", "accessToken", "authToken", "jwtToken"],
  endpoints: {
    authLogout: "/auth/logout",
    authProfile: "/auth/profile",
    getMyProfile: "/hr-recruiter/profile",
    updateMyProfile: "/hr-recruiter/profile",
    listJobs: "/hr-recruiter/jobs",
    createJobDraft: "/hr-recruiter/jobs",
    getJobById: "/hr-recruiter/jobs/:id",
    updateJob: "/hr-recruiter/jobs/:id",
    submitJob: "/hr-recruiter/jobs/:id/submit",
    listApplications: "/hr-recruiter/applications",
    moveApplicationStage: "/hr-recruiter/applications/:id/move-stage",
    recommendOffer: "/hr-recruiter/applications/:id/recommend-offer",
    screenDecision: "/hr-recruiter/applications/:id/screen",
    listCandidates: "/hr-recruiter/candidates",
    getCandidateProfile: "/hr-recruiter/candidates/:id/profile",
    updateCandidateProfile: "/hr-recruiter/candidates/:id/profile",
    uploadResume: "/hr-recruiter/candidates/:id/resume",
    getInterviews: "/hr-recruiter/interviews",
    scheduleInterview: "/hr-recruiter/interviews",
    updateInterview: "/hr-recruiter/interviews/:id",
    createOfferDraft: "/hr-recruiter/offers",
    sendOffer: "/hr-recruiter/offers/:id/send"
  }
};

const hrState = {
  currentView: "dashboard",
  currentProfile: null,
  jobsLoaded: false,
  applicationsLoaded: false,
  candidatesLoaded: false,
  interviewsLoaded: false,
  offersLoaded: false,
  jobsRows: [],
  selectedJob: null,
  applicationRows: [],
  currentApplicationJobId: "",
  candidateRows: [],
  currentCandidateJobId: "",
  currentCandidateId: "",
  currentCandidate: null,
  interviewsRows: []
};

const hrViewMeta = {
  dashboard: {
    title: "HR Recruiter Dashboard",
    subtitle: "Manage jobs, candidates, interview flow, and offers.",
    searchPlaceholder: "Search jobs or candidates"
  },
  jobs: {
    title: "Jobs",
    subtitle: "Create drafts, update jobs, and submit for approval.",
    searchPlaceholder: "Search jobs by title"
  },
  applications: {
    title: "Applications",
    subtitle: "Move candidates across stages and recommend offers.",
    searchPlaceholder: "Search candidates"
  },
  candidates: {
    title: "Candidates",
    subtitle: "View and update candidate profiles and resume links.",
    searchPlaceholder: "Search candidates by id"
  },
  interviews: {
    title: "Interviews",
    subtitle: "Schedule interviews and update interview outcomes.",
    searchPlaceholder: "Search interviews"
  },
  offers: {
    title: "Offers",
    subtitle: "Create offer drafts and send final offers.",
    searchPlaceholder: "Search offers by id"
  },
  profile: {
    title: "My Profile",
    subtitle: "View and update your HR account profile.",
    searchPlaceholder: "Search jobs or candidates"
  }
};

const ui = {
  navLinks: document.querySelectorAll("[data-hr-nav]"),
  sections: document.querySelectorAll("[data-hr-view]"),
  headerTitle: document.querySelector("[data-hr-header-title]"),
  headerSubtitle: document.querySelector("[data-hr-header-subtitle]"),
  searchInput: document.querySelector("[data-hr-search]"),

  kpiOpenJobs: document.querySelector("[data-hr-kpi-open-jobs]"),
  kpiDraftJobs: document.querySelector("[data-hr-kpi-draft-jobs]"),
  kpiPendingJobs: document.querySelector("[data-hr-kpi-pending-jobs]"),
  kpiPublishedJobs: document.querySelector("[data-hr-kpi-published-jobs]"),

  jobCreateForm: document.querySelector("[data-hr-job-create-form]"),
  jobCreateMsg: document.querySelector("[data-hr-job-create-msg]"),
  jobStatusFilter: document.querySelector("[data-hr-job-status-filter]"),
  jobApproverId: document.querySelector("[data-hr-approver-id]"),
  jobLoadBtn: document.querySelector("[data-hr-job-load]"),
  jobList: document.querySelector("[data-hr-job-list]"),
  jobEditId: document.querySelector("[data-hr-job-edit-id]"),
  jobEditForm: document.querySelector("[data-hr-job-edit-form]"),
  jobEditTitle: document.querySelector("[data-hr-job-edit-title]"),
  jobEditLocation: document.querySelector("[data-hr-job-edit-location]"),
  jobEditPositions: document.querySelector("[data-hr-job-edit-positions]"),
  jobEditDescription: document.querySelector("[data-hr-job-edit-description]"),
  jobEditRequirements: document.querySelector("[data-hr-job-edit-requirements]"),
  jobEditType: document.querySelector("[data-hr-job-edit-type]"),
  jobSaveBtn: document.querySelector("[data-hr-job-save]"),
  jobSubmitBtn: document.querySelector("[data-hr-job-submit]"),
  jobClearBtn: document.querySelector("[data-hr-job-clear]"),
  jobEditMsg: document.querySelector("[data-hr-job-edit-msg]"),

  appJobId: document.querySelector("[data-hr-app-job-id]"),
  appLoadBtn: document.querySelector("[data-hr-app-load]"),
  appList: document.querySelector("[data-hr-app-list]"),
  appMsg: document.querySelector("[data-hr-app-msg]"),

  candidateJobIdInput: document.querySelector("[data-hr-candidate-job-id]"),
  candidateListLoadBtn: document.querySelector("[data-hr-candidate-list-load]"),
  candidateList: document.querySelector("[data-hr-candidate-list]"),
  candidateIdInput: document.querySelector("[data-hr-candidate-id]"),
  candidateLoadBtn: document.querySelector("[data-hr-candidate-load]"),
  candidateName: document.querySelector("[data-hr-candidate-name]"),
  candidateEmail: document.querySelector("[data-hr-candidate-email]"),
  candidatePhone: document.querySelector("[data-hr-candidate-phone]"),
  candidateAddress: document.querySelector("[data-hr-candidate-address]"),
  candidateResume: document.querySelector("[data-hr-candidate-resume]"),
  candidateVerified: document.querySelector("[data-hr-candidate-verified]"),
  candidateMsg: document.querySelector("[data-hr-candidate-msg]"),
  candidateUpdateForm: document.querySelector("[data-hr-candidate-update-form]"),
  candidateEditPhone: document.querySelector("[data-hr-candidate-edit-phone]"),
  candidateEditAddress: document.querySelector("[data-hr-candidate-edit-address]"),
  candidateEditData: document.querySelector("[data-hr-candidate-edit-data]"),
  resumeForm: document.querySelector("[data-hr-resume-form]"),
  resumeUrl: document.querySelector("[data-hr-resume-url]"),

  interviewCreateForm: document.querySelector("[data-hr-interview-create-form]"),
  interviewCreateMsg: document.querySelector("[data-hr-interview-create-msg]"),
  interviewLoadAppId: document.querySelector("[data-hr-interview-load-app-id]"),
  interviewLoadInterviewerId: document.querySelector("[data-hr-interview-load-interviewer-id]"),
  interviewLoadBtn: document.querySelector("[data-hr-interview-load]"),
  interviewList: document.querySelector("[data-hr-interview-list]"),
  interviewMsg: document.querySelector("[data-hr-interview-msg]"),

  offerCreateForm: document.querySelector("[data-hr-offer-create-form]"),
  offerCreateMsg: document.querySelector("[data-hr-offer-create-msg]"),
  offerSendForm: document.querySelector("[data-hr-offer-send-form]"),
  offerSendId: document.querySelector("[data-hr-offer-send-id]"),
  offerSendDoc: document.querySelector("[data-hr-offer-send-doc]"),
  offerSendEsign: document.querySelector("[data-hr-offer-send-esign]"),
  offerSendBtn: document.querySelector("[data-hr-offer-send-btn]"),
  offerSendMsg: document.querySelector("[data-hr-offer-send-msg]"),

  profileName: document.querySelector("[data-hr-profile-name]"),
  profileEmail: document.querySelector("[data-hr-profile-email]"),
  profileRole: document.querySelector("[data-hr-profile-role]"),
  profileCompany: document.querySelector("[data-hr-profile-company]"),
  profileLastLogin: document.querySelector("[data-hr-profile-last-login]"),
  profileForm: document.querySelector("[data-hr-profile-form]"),
  profileFirstName: document.querySelector("[data-hr-edit-first-name]"),
  profileLastName: document.querySelector("[data-hr-edit-last-name]"),
  profileEditEmail: document.querySelector("[data-hr-edit-email]"),
  profileSaveBtn: document.querySelector("[data-hr-profile-save]"),
  profileStatus: document.querySelector("[data-hr-profile-status]"),
  reloadProfileBtn: document.querySelector("[data-hr-reload-profile]"),
  profileLogoutBtn: document.querySelector("[data-hr-logout]")
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

function toNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
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

function fullName(record) {
  const first = firstValue(record, ["first_name"], "");
  const last = firstValue(record, ["last_name"], "");
  const name = `${first} ${last}`.trim();
  return name || firstValue(record, ["name"], "N/A");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function getStoredToken() {
  if (window.HR_TOKEN) return String(window.HR_TOKEN);
  for (let i = 0; i < HR_CONFIG.tokenKeys.length; i += 1) {
    const key = HR_CONFIG.tokenKeys[i];
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
  HR_CONFIG.tokenKeys.forEach((key) => {
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
  const base = HR_CONFIG.apiBase;
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

  if (HR_CONFIG.tryApiPrefixFallback) {
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

      if (response.ok) {
        return data;
      }

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
const hrApi = {
  logout() {
    return apiRequest(HR_CONFIG.endpoints.authLogout, {
      method: "POST",
      body: {},
      useAuthHeader: false
    });
  },

  getMyProfile() {
    return apiRequest(HR_CONFIG.endpoints.getMyProfile);
  },

  updateMyProfile(payload) {
    return apiRequest(HR_CONFIG.endpoints.updateMyProfile, {
      method: "PUT",
      body: payload
    });
  },

  listJobs(query = {}) {
    return apiRequest(HR_CONFIG.endpoints.listJobs, { query });
  },

  createJobDraft(payload) {
    return apiRequest(HR_CONFIG.endpoints.createJobDraft, {
      method: "POST",
      body: payload
    });
  },

  getJobById(id) {
    return apiRequest(buildPathWithId(HR_CONFIG.endpoints.getJobById, id));
  },

  updateJob(id, payload) {
    return apiRequest(buildPathWithId(HR_CONFIG.endpoints.updateJob, id), {
      method: "PUT",
      body: payload
    });
  },

  submitJob(id, approverId) {
    return apiRequest(buildPathWithId(HR_CONFIG.endpoints.submitJob, id), {
      method: "POST",
      body: { approver_id: approverId }
    });
  },

  listApplications(jobId) {
    const query = {};
    if (jobId) query.job_id = jobId;
    return apiRequest(HR_CONFIG.endpoints.listApplications, {
      query
    });
  },

  listCandidates(jobId) {
    const query = {};
    if (jobId) query.job_id = jobId;
    return apiRequest(HR_CONFIG.endpoints.listCandidates, {
      query
    });
  },

  moveApplicationStage(id, payload) {
    return apiRequest(buildPathWithId(HR_CONFIG.endpoints.moveApplicationStage, id), {
      method: "PUT",
      body: payload
    });
  },

  screenDecision(id, status) {
    return apiRequest(buildPathWithId(HR_CONFIG.endpoints.screenDecision, id), {
      method: "POST",
      body: { status }
    });
  },

  recommendOffer(id) {
    return apiRequest(buildPathWithId(HR_CONFIG.endpoints.recommendOffer, id), {
      method: "POST",
      body: {}
    });
  },

  getCandidateProfile(id) {
    return apiRequest(buildPathWithId(HR_CONFIG.endpoints.getCandidateProfile, id));
  },

  updateCandidateProfile(id, payload) {
    return apiRequest(buildPathWithId(HR_CONFIG.endpoints.updateCandidateProfile, id), {
      method: "PUT",
      body: payload
    });
  },

  uploadResume(id, resumeUrl) {
    return apiRequest(buildPathWithId(HR_CONFIG.endpoints.uploadResume, id), {
      method: "POST",
      body: { resume_url: resumeUrl }
    });
  },

  getInterviews(query) {
    return apiRequest(HR_CONFIG.endpoints.getInterviews, {
      query
    });
  },

  scheduleInterview(payload) {
    return apiRequest(HR_CONFIG.endpoints.scheduleInterview, {
      method: "POST",
      body: payload
    });
  },

  updateInterview(id, status, notes) {
    return apiRequest(buildPathWithId(HR_CONFIG.endpoints.updateInterview, id), {
      method: "PUT",
      body: { status, notes }
    });
  },

  createOfferDraft(payload) {
    return apiRequest(HR_CONFIG.endpoints.createOfferDraft, {
      method: "POST",
      body: payload
    });
  },

  sendOffer(id, payload) {
    return apiRequest(buildPathWithId(HR_CONFIG.endpoints.sendOffer, id), {
      method: "PUT",
      body: payload
    });
  }
};

// 4) Page UI logic.
function setActiveNav(viewKey) {
  ui.navLinks.forEach((link) => link.classList.remove("active"));
  const target = document.querySelector(`[data-hr-nav="${viewKey}"]`);
  if (target) target.classList.add("active");
}

function profileSuffixText() {
  const profile = hrState.currentProfile;
  if (!profile) return "";
  const name = fullName(profile);
  const role = firstValue(profile, ["role"], "");
  if (name === "N/A" && !role) return "";
  if (name !== "N/A" && role) return ` Signed in as ${name} (${role}).`;
  return ` Signed in as ${name !== "N/A" ? name : role}.`;
}

function showSection(viewKey) {
  ui.sections.forEach((sec) => {
    sec.classList.toggle("d-none", sec.dataset.hrView !== viewKey);
  });

  setActiveNav(viewKey);
  hrState.currentView = viewKey;

  const meta = hrViewMeta[viewKey];
  if (!meta) return;

  if (ui.headerTitle) ui.headerTitle.textContent = meta.title;
  if (ui.headerSubtitle) ui.headerSubtitle.textContent = `${meta.subtitle}${profileSuffixText()}`;
  if (ui.searchInput) ui.searchInput.placeholder = meta.searchPlaceholder;
}

function ensureRole(profile) {
  const role = String(firstValue(profile || {}, ["role"], "")).trim();
  if (!role) return true;
  if (role.toLowerCase() === "hr") return true;
  redirectToLogin("You are not authorized to access HR dashboard.");
  return false;
}

function renderProfilePanel() {
  const profile = hrState.currentProfile;
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

function setProfileStatus(text, type) {
  setMessage(ui.profileStatus, text, type);
}

async function loadAuthProfile() {
  if (!HR_CONFIG.useApi) return false;

  try {
    const payload = await hrApi.getMyProfile();
    hrState.currentProfile = payload?.profile || payload || null;

    if (!ensureRole(hrState.currentProfile)) {
      return false;
    }

    const role = firstValue(hrState.currentProfile, ["role"], "");
    if (role) {
      localStorage.setItem("role", role);
      localStorage.setItem("userRole", role);
      sessionStorage.setItem("role", role);
      sessionStorage.setItem("userRole", role);
    }

    renderProfilePanel();
    return true;
  } catch (error) {
    console.error("HR profile load error:", error);
    redirectToLogin("Login session expired. Please log in again.");
    return false;
  }
}

async function performLogout() {
  try {
    if (HR_CONFIG.useApi) {
      await hrApi.logout();
    }
  } catch (error) {
    console.error("Logout API error:", error);
  } finally {
    clearAuthStorage();
    window.location.href = "../public/login.html";
  }
}

function createStatusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  let cls = "text-bg-secondary";
  if (normalized === "published" || normalized === "active" || normalized === "completed") cls = "text-bg-success";
  if (normalized === "pending" || normalized === "scheduled") cls = "text-bg-warning";
  if (normalized === "draft") cls = "text-bg-info";
  if (normalized === "closed" || normalized === "rejected") cls = "text-bg-dark";

  const badge = document.createElement("span");
  badge.className = `badge ${cls}`;
  badge.textContent = status || "unknown";
  return badge;
}

function parseJsonInput(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error("Please provide valid JSON");
  }
}

function stringifiedJson(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
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

function candidateValue(profile, key, fallback = "N/A") {
  const direct = firstValue(profile || {}, [key], "");
  if (direct) return direct;
  const dataObj = profileDataObject(profile);
  const fromProfileData = firstValue(dataObj || {}, [key], "");
  return fromProfileData || fallback;
}

async function loadDashboardKpis() {
  try {
    const rows = normalizeArrayResponse(await hrApi.listJobs());
    const counts = {
      open: 0,
      draft: 0,
      pending: 0,
      published: 0
    };

    rows.forEach((job) => {
      const status = String(firstValue(job, ["status"], "")).toLowerCase();
      if (status !== "closed") counts.open += 1;
      if (status === "draft") counts.draft += 1;
      if (status === "pending") counts.pending += 1;
      if (status === "published") counts.published += 1;
    });

    setText(ui.kpiOpenJobs, counts.open);
    setText(ui.kpiDraftJobs, counts.draft);
    setText(ui.kpiPendingJobs, counts.pending);
    setText(ui.kpiPublishedJobs, counts.published);
  } catch (error) {
    setText(ui.kpiOpenJobs, "--");
    setText(ui.kpiDraftJobs, "--");
    setText(ui.kpiPendingJobs, "--");
    setText(ui.kpiPublishedJobs, "--");
  }
}

function setSelectedJob(job) {
  hrState.selectedJob = job ? { ...job } : null;
  setText(ui.jobEditId, firstValue(job || {}, ["id"], "N/A"));

  if (ui.jobEditTitle) ui.jobEditTitle.value = firstValue(job || {}, ["title"], "");
  if (ui.jobEditLocation) ui.jobEditLocation.value = firstValue(job || {}, ["location"], "");
  if (ui.jobEditPositions) ui.jobEditPositions.value = firstValue(job || {}, ["positions_count"], "1");
  if (ui.jobEditDescription) ui.jobEditDescription.value = firstValue(job || {}, ["description"], "");
  if (ui.jobEditRequirements) ui.jobEditRequirements.value = firstValue(job || {}, ["requirements"], "");
  if (ui.jobEditType) ui.jobEditType.value = firstValue(job || {}, ["employment_type"], "Full-time");
}

function clearSelectedJob() {
  setSelectedJob(null);
  setMessage(ui.jobEditMsg, "", "info");
}

function renderJobRows(rows) {
  if (!ui.jobList) return;
  if (!rows.length) {
    showTableMessage(ui.jobList, 5, "No jobs found");
    return;
  }

  ui.jobList.innerHTML = "";

  rows.forEach((job) => {
    const tr = document.createElement("tr");
    const jobId = firstValue(job, ["id"], "");

    const idCell = document.createElement("td");
    idCell.textContent = jobId || "N/A";
    tr.appendChild(idCell);

    const titleCell = document.createElement("td");
    titleCell.textContent = firstValue(job, ["title"], "N/A");
    tr.appendChild(titleCell);

    const statusCell = document.createElement("td");
    statusCell.appendChild(createStatusBadge(firstValue(job, ["status"], "")));
    tr.appendChild(statusCell);

    const locationCell = document.createElement("td");
    locationCell.textContent = firstValue(job, ["location"], "-");
    tr.appendChild(locationCell);

    const actionCell = document.createElement("td");
    actionCell.className = "text-nowrap";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-outline-brand btn-sm me-2";
    editBtn.textContent = "Edit";
    editBtn.dataset.jobAction = "edit";
    editBtn.dataset.jobId = jobId;
    actionCell.appendChild(editBtn);

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "btn btn-outline-warning btn-sm";
    submitBtn.textContent = "Submit";
    submitBtn.dataset.jobAction = "submit";
    submitBtn.dataset.jobId = jobId;
    actionCell.appendChild(submitBtn);

    tr.appendChild(actionCell);
    ui.jobList.appendChild(tr);
  });
}

async function loadJobs() {
  const status = String(ui.jobStatusFilter?.value || "all").trim();
  const query = {};
  if (status !== "all") query.status = status;

  try {
    const rows = normalizeArrayResponse(await hrApi.listJobs(query));
    hrState.jobsRows = rows;
    renderJobRows(rows);
  } catch (error) {
    hrState.jobsRows = [];
    showTableMessage(ui.jobList, 5, error.message || "Failed to load jobs");
  }
}

function jobCreatePayloadFromForm(form) {
  const formData = new FormData(form);
  return {
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    requirements: String(formData.get("requirements") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    employment_type: String(formData.get("employment_type") || "Full-time").trim() || "Full-time",
    positions_count: toNumber(formData.get("positions_count")) || 1
  };
}

async function submitCreateJob(event) {
  event.preventDefault();
  if (!ui.jobCreateForm) return;

  const payload = jobCreatePayloadFromForm(ui.jobCreateForm);
  if (!payload.title) {
    setMessage(ui.jobCreateMsg, "Job title is required.", "error");
    return;
  }

  payload.company_id = toNumber(firstValue(hrState.currentProfile || {}, ["company_id"], "")) || undefined;
  payload.created_by = toNumber(firstValue(hrState.currentProfile || {}, ["id"], "")) || undefined;

  try {
    setMessage(ui.jobCreateMsg, "Creating job draft...", "info");
    const result = await hrApi.createJobDraft(payload);
    ui.jobCreateForm.reset();
    setMessage(ui.jobCreateMsg, result?.message || "Job draft created successfully.", "success");
    await loadJobs();
    await loadDashboardKpis();

    const createdId = firstValue(result, ["id"], "");
    if (createdId) {
      try {
        setSelectedJob(await hrApi.getJobById(createdId));
      } catch (error) {
        // Keep create successful even if fetch fails.
      }
    }
  } catch (error) {
    setMessage(ui.jobCreateMsg, error.message || "Failed to create job.", "error");
  }
}

async function submitEditJob(event) {
  event.preventDefault();

  const jobId = firstValue(hrState.selectedJob || {}, ["id"], "");
  if (!jobId) {
    setMessage(ui.jobEditMsg, "Select a job first.", "error");
    return;
  }

  const payload = {
    title: String(ui.jobEditTitle?.value || "").trim(),
    description: String(ui.jobEditDescription?.value || "").trim(),
    requirements: String(ui.jobEditRequirements?.value || "").trim(),
    location: String(ui.jobEditLocation?.value || "").trim(),
    employment_type: String(ui.jobEditType?.value || "Full-time").trim() || "Full-time",
    positions_count: toNumber(ui.jobEditPositions?.value) || 1
  };

  if (!payload.title) {
    setMessage(ui.jobEditMsg, "Job title is required.", "error");
    return;
  }

  const initialText = ui.jobSaveBtn?.textContent || "Save Job";
  if (ui.jobSaveBtn) {
    ui.jobSaveBtn.disabled = true;
    ui.jobSaveBtn.textContent = "Saving...";
  }

  try {
    await hrApi.updateJob(jobId, payload);
    const refreshed = await hrApi.getJobById(jobId);
    setSelectedJob(refreshed);
    await loadJobs();
    await loadDashboardKpis();
    setMessage(ui.jobEditMsg, "Job updated successfully.", "success");
  } catch (error) {
    setMessage(ui.jobEditMsg, error.message || "Failed to update job.", "error");
  } finally {
    if (ui.jobSaveBtn) {
      ui.jobSaveBtn.disabled = false;
      ui.jobSaveBtn.textContent = initialText;
    }
  }
}

function getApproverId() {
  const fromInput = String(ui.jobApproverId?.value || "").trim();
  if (fromInput) return toNumber(fromInput);
  const prompted = window.prompt("Enter approver id:");
  if (!prompted) return null;
  return toNumber(prompted.trim());
}

async function submitJobForApproval(jobId) {
  if (!jobId) {
    setMessage(ui.jobEditMsg, "Select a job first.", "error");
    return;
  }

  const approverId = getApproverId();
  if (!approverId) {
    setMessage(ui.jobEditMsg, "Approver id is required.", "error");
    return;
  }

  try {
    await hrApi.submitJob(jobId, approverId);
    const refreshed = await hrApi.getJobById(jobId);
    setSelectedJob(refreshed);
    await loadJobs();
    await loadDashboardKpis();
    setMessage(ui.jobEditMsg, "Job submitted for approval.", "success");
  } catch (error) {
    setMessage(ui.jobEditMsg, error.message || "Failed to submit job.", "error");
  }
}

async function handleJobListClick(event) {
  const button = event.target.closest("button[data-job-action]");
  if (!button) return;

  const action = button.dataset.jobAction;
  const jobId = String(button.dataset.jobId || "").trim();

  if (action === "edit") {
    try {
      const job = await hrApi.getJobById(jobId);
      setSelectedJob(job);
      setMessage(ui.jobEditMsg, "Job loaded for editing.", "success");
    } catch (error) {
      setMessage(ui.jobEditMsg, error.message || "Failed to load job.", "error");
    }
    return;
  }

  if (action === "submit") {
    await submitJobForApproval(jobId);
  }
}

function renderApplicationRows(rows) {
  if (!ui.appList) return;
  if (!rows.length) {
    showTableMessage(ui.appList, 7, "No applications found");
    return;
  }

  ui.appList.innerHTML = "";

  rows.forEach((app) => {
    const tr = document.createElement("tr");
    const appId = firstValue(app, ["id"], "");

    const idCell = document.createElement("td");
    idCell.textContent = appId || "N/A";
    tr.appendChild(idCell);

    const jobIdCell = document.createElement("td");
    jobIdCell.textContent = firstValue(app, ["job_id"], "N/A");
    tr.appendChild(jobIdCell);

    const candidateCell = document.createElement("td");
    const candidateName = `${firstValue(app, ["first_name"], "")} ${firstValue(app, ["last_name"], "")}`.trim();
    const email = firstValue(app, ["email"], "");
    candidateCell.innerHTML = candidateName ? `${candidateName}<br /><small class="text-secondary">${email}</small>` : "N/A";
    tr.appendChild(candidateCell);

    const statusCell = document.createElement("td");
    statusCell.textContent = firstValue(app, ["status"], "N/A");
    tr.appendChild(statusCell);

    const stageCell = document.createElement("td");
    stageCell.textContent = firstValue(app, ["current_stage_id"], "-");
    tr.appendChild(stageCell);

    const resumeCell = document.createElement("td");
    const resumeUrl = firstValue(app, ["resume_url"], "");
    if (resumeUrl) {
      const link = document.createElement("a");
      link.href = resumeUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Resume";
      resumeCell.appendChild(link);
    } else {
      resumeCell.textContent = "-";
    }
    tr.appendChild(resumeCell);

    const actionCell = document.createElement("td");
    actionCell.className = "text-nowrap";

    const actions = [
      { action: "move", label: "Move" },
      { action: "screen", label: "Screen" },
      { action: "recommend", label: "Recommend" }
    ];

    actions.forEach((entry, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn btn-outline-brand btn-sm${index < actions.length - 1 ? " me-2" : ""}`;
      btn.textContent = entry.label;
      btn.dataset.appAction = entry.action;
      btn.dataset.appId = appId;
      btn.dataset.appStatus = firstValue(app, ["status"], "");
      btn.dataset.appStage = firstValue(app, ["current_stage_id"], "");
      actionCell.appendChild(btn);
    });

    tr.appendChild(actionCell);
    ui.appList.appendChild(tr);
  });
}

async function loadApplications() {
  const jobId = String(ui.appJobId?.value || "").trim();

  try {
    setMessage(ui.appMsg, "Loading applications...", "info");
    const rows = normalizeArrayResponse(await hrApi.listApplications(jobId));
    hrState.applicationRows = rows;
    hrState.currentApplicationJobId = jobId;
    renderApplicationRows(rows);
    const filterText = jobId ? ` for job #${jobId}` : "";
    setMessage(ui.appMsg, `Loaded ${rows.length} application(s)${filterText}.`, "success");
  } catch (error) {
    hrState.applicationRows = [];
    renderApplicationRows([]);
    setMessage(ui.appMsg, error.message || "Failed to load applications.", "error");
  }
}

async function handleApplicationAction(action, appId, currentStatus, currentStage) {
  if (!appId) return;

  try {
    if (action === "move") {
      const status = window.prompt("Enter status:", currentStatus || "interview");
      if (!status) return;
      const stageInput = window.prompt("Enter stage id:", currentStage || "");
      const stageId = stageInput ? toNumber(stageInput) : null;
      await hrApi.moveApplicationStage(appId, {
        status: status.trim(),
        current_stage_id: stageId
      });
      setMessage(ui.appMsg, "Application moved to new stage.", "success");
    }

    if (action === "screen") {
      const status = window.prompt("Screen status (interview/rejected):", "interview");
      if (!status) return;
      await hrApi.screenDecision(appId, status.trim());
      setMessage(ui.appMsg, "Screen decision updated.", "success");
    }

    if (action === "recommend") {
      await hrApi.recommendOffer(appId);
      setMessage(ui.appMsg, "Offer recommendation marked.", "success");
    }

    await loadApplications();
  } catch (error) {
    setMessage(ui.appMsg, error.message || "Failed to update application.", "error");
  }
}

function parseCandidateProfileData(value) {
  const input = String(value || "").trim();
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error("Profile Data must be valid JSON");
  }
}

function renderCandidateRows(rows) {
  if (!ui.candidateList) return;
  if (!rows.length) {
    showTableMessage(ui.candidateList, 7, "No candidates found");
    return;
  }

  ui.candidateList.innerHTML = "";

  rows.forEach((candidate) => {
    const tr = document.createElement("tr");
    const candidateId = firstValue(candidate, ["candidate_id", "id"], "");

    const idCell = document.createElement("td");
    idCell.textContent = candidateId || "N/A";
    tr.appendChild(idCell);

    const nameCell = document.createElement("td");
    const fullName = `${firstValue(candidate, ["first_name"], "")} ${firstValue(candidate, ["last_name"], "")}`.trim();
    nameCell.textContent = fullName || "N/A";
    tr.appendChild(nameCell);

    const emailCell = document.createElement("td");
    emailCell.textContent = firstValue(candidate, ["email"], "N/A");
    tr.appendChild(emailCell);

    const phoneCell = document.createElement("td");
    phoneCell.textContent = candidateValue(candidate, "phone", "-");
    tr.appendChild(phoneCell);

    const addressCell = document.createElement("td");
    addressCell.textContent = candidateValue(candidate, "address", "-");
    tr.appendChild(addressCell);

    const countCell = document.createElement("td");
    countCell.textContent = firstValue(candidate, ["applications_count"], "0");
    tr.appendChild(countCell);

    const actionCell = document.createElement("td");
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "btn btn-outline-brand btn-sm";
    openBtn.textContent = "Open";
    openBtn.dataset.candidateAction = "open";
    openBtn.dataset.candidateId = candidateId;
    actionCell.appendChild(openBtn);
    tr.appendChild(actionCell);

    ui.candidateList.appendChild(tr);
  });
}

async function loadCandidates() {
  const jobId = String(ui.candidateJobIdInput?.value || "").trim();

  try {
    setMessage(ui.candidateMsg, "Loading candidates...", "info");
    const rows = normalizeArrayResponse(await hrApi.listCandidates(jobId));
    hrState.candidateRows = rows;
    hrState.currentCandidateJobId = jobId;
    renderCandidateRows(rows);
    const filterText = jobId ? ` for job #${jobId}` : "";
    setMessage(ui.candidateMsg, `Loaded ${rows.length} candidate(s)${filterText}.`, "success");
  } catch (error) {
    hrState.candidateRows = [];
    renderCandidateRows([]);
    setMessage(ui.candidateMsg, error.message || "Failed to load candidates.", "error");
  }
}

async function handleCandidateListAction(event) {
  const button = event.target.closest("button[data-candidate-action]");
  if (!button) return;

  const action = String(button.dataset.candidateAction || "").trim();
  const candidateId = String(button.dataset.candidateId || "").trim();
  if (!candidateId || action !== "open") return;

  if (ui.candidateIdInput) ui.candidateIdInput.value = candidateId;
  await loadCandidateProfile();
}

function renderCandidateProfile(profile) {
  hrState.currentCandidate = profile || null;

  if (!profile) {
    setText(ui.candidateName, "N/A");
    setText(ui.candidateEmail, "N/A");
    setText(ui.candidatePhone, "N/A");
    setText(ui.candidateAddress, "N/A");
    setText(ui.candidateResume, "N/A");
    setText(ui.candidateVerified, "N/A");
    if (ui.candidateEditPhone) ui.candidateEditPhone.value = "";
    if (ui.candidateEditAddress) ui.candidateEditAddress.value = "";
    if (ui.candidateEditData) ui.candidateEditData.value = "";
    if (ui.resumeUrl) ui.resumeUrl.value = "";
    return;
  }

  const name = `${firstValue(profile, ["first_name"], "")} ${firstValue(profile, ["last_name"], "")}`.trim();
  setText(ui.candidateName, name || "N/A");
  setText(ui.candidateEmail, firstValue(profile, ["email"], "N/A"));
  const phone = candidateValue(profile, "phone", "N/A");
  const address = candidateValue(profile, "address", "N/A");
  setText(ui.candidatePhone, phone);
  setText(ui.candidateAddress, address);

  const resumeUrl = firstValue(profile, ["resume_url"], "");
  if (ui.candidateResume) {
    if (resumeUrl) {
      ui.candidateResume.innerHTML = `<a href="${resumeUrl}" target="_blank" rel="noreferrer">Open Resume</a>`;
    } else {
      ui.candidateResume.textContent = "N/A";
    }
  }

  setText(ui.candidateVerified, firstValue(profile, ["is_verified"], "0") === "1" ? "Yes" : "No");

  if (ui.candidateEditPhone) ui.candidateEditPhone.value = candidateValue(profile, "phone", "");
  if (ui.candidateEditAddress) ui.candidateEditAddress.value = candidateValue(profile, "address", "");
  if (ui.candidateEditData) ui.candidateEditData.value = stringifiedJson(profile.profile_data);
  if (ui.resumeUrl) ui.resumeUrl.value = resumeUrl;
}

async function loadCandidateProfile() {
  const candidateId = String(ui.candidateIdInput?.value || "").trim();
  if (!candidateId) {
    setMessage(ui.candidateMsg, "Candidate id is required.", "error");
    return;
  }

  try {
    setMessage(ui.candidateMsg, "Loading candidate profile...", "info");
    const profile = await hrApi.getCandidateProfile(candidateId);
    hrState.currentCandidateId = candidateId;
    renderCandidateProfile(profile);
    setMessage(ui.candidateMsg, "Candidate profile loaded.", "success");
  } catch (error) {
    renderCandidateProfile(null);
    setMessage(ui.candidateMsg, error.message || "Failed to load candidate profile.", "error");
  }
}

async function submitCandidateUpdate(event) {
  event.preventDefault();

  const candidateId = String(hrState.currentCandidateId || "").trim();
  if (!candidateId) {
    setMessage(ui.candidateMsg, "Load a candidate first.", "error");
    return;
  }

  let profileData = null;
  try {
    profileData = parseCandidateProfileData(ui.candidateEditData?.value || "");
  } catch (error) {
    setMessage(ui.candidateMsg, error.message, "error");
    return;
  }

  try {
    await hrApi.updateCandidateProfile(candidateId, {
      phone: String(ui.candidateEditPhone?.value || "").trim(),
      address: String(ui.candidateEditAddress?.value || "").trim(),
      profile_data: profileData
    });
    const refreshed = await hrApi.getCandidateProfile(candidateId);
    renderCandidateProfile(refreshed);
    setMessage(ui.candidateMsg, "Candidate profile updated.", "success");
  } catch (error) {
    setMessage(ui.candidateMsg, error.message || "Failed to update candidate profile.", "error");
  }
}

async function submitResumeUpdate(event) {
  event.preventDefault();

  const candidateId = String(hrState.currentCandidateId || "").trim();
  if (!candidateId) {
    setMessage(ui.candidateMsg, "Load a candidate first.", "error");
    return;
  }

  const resumeUrl = String(ui.resumeUrl?.value || "").trim();
  if (!resumeUrl) {
    setMessage(ui.candidateMsg, "Resume URL is required.", "error");
    return;
  }

  try {
    await hrApi.uploadResume(candidateId, resumeUrl);
    const refreshed = await hrApi.getCandidateProfile(candidateId);
    renderCandidateProfile(refreshed);
    setMessage(ui.candidateMsg, "Resume updated successfully.", "success");
  } catch (error) {
    setMessage(ui.candidateMsg, error.message || "Failed to update resume.", "error");
  }
}

function renderInterviewRows(rows) {
  if (!ui.interviewList) return;
  if (!rows.length) {
    showTableMessage(ui.interviewList, 10, "No interviews found");
    return;
  }

  ui.interviewList.innerHTML = "";

  rows.forEach((interview) => {
    const tr = document.createElement("tr");
    const interviewId = firstValue(interview, ["id"], "");

    const idCell = document.createElement("td");
    idCell.textContent = interviewId || "N/A";
    tr.appendChild(idCell);

    const appCell = document.createElement("td");
    appCell.textContent = firstValue(interview, ["application_id"], "N/A");
    tr.appendChild(appCell);

    const jobCell = document.createElement("td");
    jobCell.textContent = firstValue(interview, ["job_id"], "N/A");
    tr.appendChild(jobCell);

    const candidateCell = document.createElement("td");
    const candidateName = `${firstValue(interview, ["candidate_first"], "")} ${firstValue(interview, ["candidate_last"], "")}`.trim();
    const candidateEmail = firstValue(interview, ["candidate_email"], "");
    candidateCell.innerHTML = candidateName
      ? `${candidateName}<br /><small class="text-secondary">${candidateEmail}</small>`
      : "N/A";
    tr.appendChild(candidateCell);

    const candidateContactSource = {
      phone: firstValue(interview, ["candidate_phone"], ""),
      address: firstValue(interview, ["candidate_address"], ""),
      profile_data: interview?.candidate_profile_data || null,
    };

    const phoneCell = document.createElement("td");
    phoneCell.textContent = candidateValue(candidateContactSource, "phone", "-");
    tr.appendChild(phoneCell);

    const addressCell = document.createElement("td");
    addressCell.textContent = candidateValue(candidateContactSource, "address", "-");
    tr.appendChild(addressCell);

    const interviewerCell = document.createElement("td");
    const interviewerName = `${firstValue(interview, ["interviewer_first"], "")} ${firstValue(interview, ["interviewer_last"], "")}`.trim();
    interviewerCell.textContent = interviewerName || firstValue(interview, ["interviewer_id"], "N/A");
    tr.appendChild(interviewerCell);

    const statusCell = document.createElement("td");
    statusCell.appendChild(createStatusBadge(firstValue(interview, ["status"], "")));
    tr.appendChild(statusCell);

    const scheduledCell = document.createElement("td");
    scheduledCell.textContent = formatDateTime(firstValue(interview, ["scheduled_at"], ""));
    tr.appendChild(scheduledCell);

    const actionCell = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline-brand btn-sm";
    btn.textContent = "Update";
    btn.dataset.interviewAction = "update";
    btn.dataset.interviewId = interviewId;
    btn.dataset.interviewStatus = firstValue(interview, ["status"], "");
    btn.dataset.interviewNotes = firstValue(interview, ["notes"], "");
    actionCell.appendChild(btn);
    tr.appendChild(actionCell);

    ui.interviewList.appendChild(tr);
  });
}

async function loadInterviews() {
  const applicationId = String(ui.interviewLoadAppId?.value || "").trim();
  const interviewerId = String(ui.interviewLoadInterviewerId?.value || "").trim();

  const query = {};
  if (applicationId) query.application_id = applicationId;
  if (interviewerId) query.interviewer_id = interviewerId;

  try {
    setMessage(ui.interviewMsg, "Loading interviews...", "info");
    const rows = normalizeArrayResponse(await hrApi.getInterviews(query));
    hrState.interviewsRows = rows;
    renderInterviewRows(rows);
    const filters = [];
    if (applicationId) filters.push(`application #${applicationId}`);
    if (interviewerId) filters.push(`interviewer #${interviewerId}`);
    const filterText = filters.length ? ` for ${filters.join(", ")}` : "";
    setMessage(ui.interviewMsg, `Loaded ${rows.length} interview(s)${filterText}.`, "success");
  } catch (error) {
    hrState.interviewsRows = [];
    renderInterviewRows([]);
    setMessage(ui.interviewMsg, error.message || "Failed to load interviews.", "error");
  }
}

function toSqlDateTime(localValue) {
  if (!localValue) return "";
  return `${String(localValue).replace("T", " ")}:00`;
}

async function submitScheduleInterview(event) {
  event.preventDefault();
  if (!ui.interviewCreateForm) return;

  const formData = new FormData(ui.interviewCreateForm);
  const payload = {
    application_id: toNumber(formData.get("application_id")),
    interviewer_id: toNumber(formData.get("interviewer_id")),
    scheduled_at: toSqlDateTime(String(formData.get("scheduled_at") || "").trim()),
    duration_minutes: toNumber(formData.get("duration_minutes")) || null,
    meeting_link: String(formData.get("meeting_link") || "").trim(),
    notes: String(formData.get("notes") || "").trim()
  };

  if (!payload.application_id || !payload.interviewer_id || !payload.scheduled_at) {
    setMessage(ui.interviewCreateMsg, "application_id, interviewer_id and scheduled_at are required.", "error");
    return;
  }

  try {
    setMessage(ui.interviewCreateMsg, "Scheduling interview...", "info");
    const result = await hrApi.scheduleInterview(payload);
    ui.interviewCreateForm.reset();
    setMessage(ui.interviewCreateMsg, result?.message || "Interview scheduled successfully.", "success");

    if (ui.interviewLoadAppId) {
      ui.interviewLoadAppId.value = String(payload.application_id);
    }
    await loadInterviews();
  } catch (error) {
    setMessage(ui.interviewCreateMsg, error.message || "Failed to schedule interview.", "error");
  }
}

async function updateInterviewByPrompt(interviewId, currentStatus, currentNotes) {
  const status = window.prompt("Interview status:", currentStatus || "completed");
  if (!status) return;
  const notes = window.prompt("Interview notes:", currentNotes || "") || "";

  try {
    await hrApi.updateInterview(interviewId, status.trim(), notes.trim());
    setMessage(ui.interviewMsg, "Interview updated.", "success");
    await loadInterviews();
  } catch (error) {
    setMessage(ui.interviewMsg, error.message || "Failed to update interview.", "error");
  }
}

async function submitCreateOffer(event) {
  event.preventDefault();
  if (!ui.offerCreateForm) return;

  const formData = new FormData(ui.offerCreateForm);
  const applicationId = toNumber(formData.get("application_id"));
  const createdBy = toNumber(firstValue(hrState.currentProfile || {}, ["id"], ""));

  if (!applicationId) {
    setMessage(ui.offerCreateMsg, "application_id is required.", "error");
    return;
  }

  if (!createdBy) {
    setMessage(ui.offerCreateMsg, "Profile id missing. Reload profile and retry.", "error");
    return;
  }

  let offerDetails = null;
  try {
    offerDetails = parseJsonInput(formData.get("offer_details"));
  } catch (error) {
    setMessage(ui.offerCreateMsg, error.message, "error");
    return;
  }

  try {
    setMessage(ui.offerCreateMsg, "Creating offer draft...", "info");
    const result = await hrApi.createOfferDraft({
      application_id: applicationId,
      created_by: createdBy,
      offer_details: offerDetails
    });

    ui.offerCreateForm.reset();
    setMessage(ui.offerCreateMsg, result?.message || "Offer draft created.", "success");

    const offerId = firstValue(result, ["id"], "");
    if (offerId && ui.offerSendId) ui.offerSendId.value = offerId;
  } catch (error) {
    setMessage(ui.offerCreateMsg, error.message || "Failed to create offer draft.", "error");
  }
}

async function submitSendOffer(event) {
  event.preventDefault();

  const offerId = String(ui.offerSendId?.value || "").trim();
  if (!offerId) {
    setMessage(ui.offerSendMsg, "Offer id is required.", "error");
    return;
  }

  const initialText = ui.offerSendBtn?.textContent || "Send Offer";
  if (ui.offerSendBtn) {
    ui.offerSendBtn.disabled = true;
    ui.offerSendBtn.textContent = "Sending...";
  }

  try {
    await hrApi.sendOffer(offerId, {
      document_url: String(ui.offerSendDoc?.value || "").trim(),
      esign_link: String(ui.offerSendEsign?.value || "").trim()
    });
    setMessage(ui.offerSendMsg, "Offer sent successfully.", "success");
  } catch (error) {
    setMessage(ui.offerSendMsg, error.message || "Failed to send offer.", "error");
  } finally {
    if (ui.offerSendBtn) {
      ui.offerSendBtn.disabled = false;
      ui.offerSendBtn.textContent = initialText;
    }
  }
}

// 5) Profile and session actions.
async function reloadProfile() {
  setProfileStatus("Loading profile...", "info");
  try {
    const payload = await hrApi.getMyProfile();
    hrState.currentProfile = payload?.profile || payload || null;
    renderProfilePanel();
    showSection(hrState.currentView || "profile");
    setProfileStatus("Profile loaded from API.", "success");
  } catch (error) {
    setProfileStatus(error.message || "Failed to load profile.", "error");
  }
}

async function submitProfileUpdate(event) {
  event.preventDefault();

  const firstName = String(ui.profileFirstName?.value || "").trim();
  const lastName = String(ui.profileLastName?.value || "").trim();
  const email = String(ui.profileEditEmail?.value || "").trim();

  if (!firstName || !lastName || !email) {
    setProfileStatus("first_name, last_name and email are required.", "error");
    return;
  }

  if (!isValidEmail(email)) {
    setProfileStatus("Enter a valid email address.", "error");
    return;
  }

  const initialText = ui.profileSaveBtn?.textContent || "Save Profile";
  if (ui.profileSaveBtn) {
    ui.profileSaveBtn.disabled = true;
    ui.profileSaveBtn.textContent = "Saving...";
  }

  setProfileStatus("Updating profile...", "info");

  try {
    const result = await hrApi.updateMyProfile({
      first_name: firstName,
      last_name: lastName,
      email
    });

    const updated = result?.data || result?.profile || null;
    hrState.currentProfile = updated && typeof updated === "object"
      ? { ...(hrState.currentProfile || {}), ...updated }
      : { ...(hrState.currentProfile || {}), first_name: firstName, last_name: lastName, email };

    renderProfilePanel();
    showSection(hrState.currentView || "profile");
    setProfileStatus(result?.message || "Profile updated successfully.", "success");
  } catch (error) {
    setProfileStatus(error.message || "Failed to update profile.", "error");
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

async function openJobs() {
  showSection("jobs");
  if (!hrState.jobsLoaded) {
    hrState.jobsLoaded = true;
    await loadJobs();
  }
}

async function openApplications() {
  showSection("applications");
  if (!hrState.applicationsLoaded) {
    hrState.applicationsLoaded = true;
    await loadApplications();
  }
}

async function openCandidates() {
  showSection("candidates");
  if (!hrState.candidatesLoaded) {
    hrState.candidatesLoaded = true;
    await loadCandidates();
  }
}

async function openInterviews() {
  showSection("interviews");
  if (!hrState.interviewsLoaded) {
    hrState.interviewsLoaded = true;
    await loadInterviews();
  }
}

async function openOffers() {
  showSection("offers");
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
    const section = link.dataset.hrNav;
    if (!section) return;

    if (section === "logout") {
      link.addEventListener("click", handleLogoutClick);
      return;
    }

    link.addEventListener("click", async (event) => {
      event.preventDefault();

      if (section === "dashboard") await openDashboard();
      if (section === "jobs") await openJobs();
      if (section === "applications") await openApplications();
      if (section === "candidates") await openCandidates();
      if (section === "interviews") await openInterviews();
      if (section === "offers") await openOffers();
      if (section === "profile") await openProfile();

      if (window.innerWidth < 992) {
        document.body.classList.remove("dashboard-sidebar-open");
      }
    });
  });
}

function bindActions() {
  if (ui.jobCreateForm) ui.jobCreateForm.addEventListener("submit", submitCreateJob);
  if (ui.jobLoadBtn) ui.jobLoadBtn.addEventListener("click", async () => {
    await loadJobs();
    await loadDashboardKpis();
  });
  if (ui.jobList) ui.jobList.addEventListener("click", (event) => {
    handleJobListClick(event);
  });
  if (ui.jobEditForm) ui.jobEditForm.addEventListener("submit", submitEditJob);
  if (ui.jobSubmitBtn) ui.jobSubmitBtn.addEventListener("click", async () => {
    const jobId = firstValue(hrState.selectedJob || {}, ["id"], "");
    await submitJobForApproval(jobId);
  });
  if (ui.jobClearBtn) ui.jobClearBtn.addEventListener("click", clearSelectedJob);

  if (ui.appLoadBtn) ui.appLoadBtn.addEventListener("click", loadApplications);
  if (ui.appList) {
    ui.appList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-app-action]");
      if (!button) return;
      const action = String(button.dataset.appAction || "").trim();
      const appId = String(button.dataset.appId || "").trim();
      const currentStatus = String(button.dataset.appStatus || "").trim();
      const currentStage = String(button.dataset.appStage || "").trim();
      handleApplicationAction(action, appId, currentStatus, currentStage);
    });
  }

  if (ui.candidateListLoadBtn) ui.candidateListLoadBtn.addEventListener("click", loadCandidates);
  if (ui.candidateList) ui.candidateList.addEventListener("click", handleCandidateListAction);
  if (ui.candidateLoadBtn) ui.candidateLoadBtn.addEventListener("click", loadCandidateProfile);
  if (ui.candidateUpdateForm) ui.candidateUpdateForm.addEventListener("submit", submitCandidateUpdate);
  if (ui.resumeForm) ui.resumeForm.addEventListener("submit", submitResumeUpdate);

  if (ui.interviewCreateForm) ui.interviewCreateForm.addEventListener("submit", submitScheduleInterview);
  if (ui.interviewLoadBtn) ui.interviewLoadBtn.addEventListener("click", loadInterviews);
  if (ui.interviewList) {
    ui.interviewList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-interview-action]");
      if (!button) return;
      const interviewId = String(button.dataset.interviewId || "").trim();
      const status = String(button.dataset.interviewStatus || "").trim();
      const notes = String(button.dataset.interviewNotes || "").trim();
      updateInterviewByPrompt(interviewId, status, notes);
    });
  }

  if (ui.offerCreateForm) ui.offerCreateForm.addEventListener("submit", submitCreateOffer);
  if (ui.offerSendForm) ui.offerSendForm.addEventListener("submit", submitSendOffer);

  if (ui.profileForm) ui.profileForm.addEventListener("submit", submitProfileUpdate);
  if (ui.reloadProfileBtn) ui.reloadProfileBtn.addEventListener("click", reloadProfile);
  if (ui.profileLogoutBtn) {
    ui.profileLogoutBtn.addEventListener("click", async () => {
      if (!window.confirm("Do you want to logout?")) return;
      await performLogout();
    });
  }
}

// 7) Init.
async function initHrDashboard() {
  if (!ui.navLinks.length || !ui.sections.length) return;

  bindNavigation();
  bindActions();
  clearSelectedJob();
  renderCandidateProfile(null);

  const sessionReady = await loadAuthProfile();
  if (!sessionReady) return;

  await openDashboard();
}

document.addEventListener("DOMContentLoaded", () => {
  initHrDashboard();
});

window.hrRecruiterApi = {
  config: HR_CONFIG,
  ...hrApi,
  openDashboard,
  openJobs,
  openApplications,
  openCandidates,
  openInterviews,
  openOffers,
  openProfile,
  loadJobs,
  loadApplications,
  loadCandidateProfile,
  loadInterviews,
  performLogout
};
