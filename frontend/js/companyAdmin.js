/**
 * Company Admin dashboard script.
 * Handles section switching, profile updates, and company admin APIs.
 *
 * Beginner Reading Guide:
 * 1) `COMPANY_ADMIN_CONFIG` defines endpoint map and API base.
 * 2) `companyState` stores current section data and selected rows.
 * 3) Helper functions format data, build URLs, and show messages.
 * 4) `apiRequest()` is the central HTTP helper with fallback handling.
 * 5) Domain sections are grouped as users, jobs, applications, offers, activity.
 * 6) `open*` functions control section loading.
 * 7) `initCompanyAdminDashboard()` starts everything.
 */

// 1) Config and state.
const COMPANY_ADMIN_CONFIG = {
  useApi: true,
  apiBase: String(window.COMPANY_ADMIN_API_BASE_URL || window.API_BASE || window.location.origin || "http://localhost:3000").replace(
    /\/+$/,
    "",
  ),
  tryApiPrefixFallback: false,
  tokenKeys: ["token", "accessToken", "authToken", "jwtToken"],
  managedRoles: ["HR", "HiringManager", "Interviewer"],
  endpoints: {
    authLogout: "/auth/logout",
    authProfile: "/auth/profile",
    getAuditTrail: "/company-admin/audit",
    getMyProfile: "/company-admin/profile",
    updateMyProfile: "/company-admin/profile",
    listUsersByRole: "/company-admin/users",
    createUser: "/company-admin/users",
    deactivateUser: "/company-admin/users/:id",
    getUserById: "/company-admin/users/:id",
    updateUser: "/company-admin/users/:id",
    activateUser: "/company-admin/users/:id/activate",
    countUsersByRole: "/company-admin/users/count",
    listJobs: "/company-admin/jobs",
    createJobDraft: "/company-admin/jobs",
    getJobById: "/company-admin/jobs/:id",
    updateJob: "/company-admin/jobs/:id",
    submitJob: "/company-admin/jobs/:id/submit",
    publishJob: "/company-admin/jobs/:id/publish",
    closeJob: "/company-admin/jobs/:id/close",
    listApplications: "/company-admin/applications",
    moveApplicationStage: "/company-admin/applications/:id/move-stage",
    screenDecision: "/company-admin/applications/:id/screen",
    finalDecision: "/company-admin/applications/:id/final-decision",
    recommendOffer: "/company-admin/applications/:id/recommend-offer",
    applicationStats: "/company-admin/applications/stats",
    getOffers: "/company-admin/offers",
    createOfferDraft: "/company-admin/offers",
    sendOffer: "/company-admin/offers/:id/send"
  }
};

const COMPANY_LOGO_FALLBACKS = {
  infosys: "https://upload.wikimedia.org/wikipedia/commons/9/95/Infosys_logo.svg",
  tcs: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/TCS_Logo_%28cropped%29.jpg/640px-TCS_Logo_%28cropped%29.jpg",
  wipro: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Wipro_Primary_Logo_Color_RGB.svg",
};

const companyState = {
  currentView: "dashboard",
  currentProfile: null,
  usersLoaded: false,
  jobsLoaded: false,
  applicationsLoaded: false,
  offersLoaded: false,
  activityLoaded: false,
  usersRows: [],
  selectedUser: null,
  jobsRows: [],
  selectedJob: null,
  applicationRows: [],
  currentApplicationJobId: "",
  activeApplicationId: "",
  offerRows: [],
  currentOfferApplicationId: "",
  auditRows: [],
  redirecting: false,
  pipelineChart: null,
  sourceChart: null
};

const viewMeta = {
  dashboard: {
    title: "Company Admin Dashboard",
    subtitle: "Manage team access, jobs, and recruitment progress.",
    searchPlaceholder: "Search jobs, users, or applications"
  },
  users: {
    title: "Users",
    subtitle: "Add HR, HiringManager, Interviewer and manage activation.",
    searchPlaceholder: "Search users by name or email"
  },
  jobs: {
    title: "Jobs",
    subtitle: "Create draft jobs, update, submit, publish, and close.",
    searchPlaceholder: "Search jobs by title or location"
  },
  applications: {
    title: "Applications",
    subtitle: "View all applications first, then filter by job if needed.",
    searchPlaceholder: "Search applications by candidate"
  },
  offers: {
    title: "Offers",
    subtitle: "View all offers first, then filter by application if needed.",
    searchPlaceholder: "Search offers by application"
  },
  activity: {
    title: "Activity",
    subtitle: "View logs for your company only. Load all first, then filter by entity and id.",
    searchPlaceholder: "Search audit actions"
  },
  profile: {
    title: "Profile",
    subtitle: "View and edit your company admin profile.",
    searchPlaceholder: "Search jobs, users, or applications"
  }
};

const ui = {
  navLinks: document.querySelectorAll("[data-company-nav]"),
  sections: document.querySelectorAll("[data-company-view]"),
  headerTitle: document.querySelector("[data-company-header-title]"),
  headerSubtitle: document.querySelector("[data-company-header-subtitle]"),
  topCompanyName: document.querySelector("[data-company-top-company]"),
  topCompanyLogo: document.querySelector("[data-company-brand-logo]"),
  searchInput: document.querySelector("[data-company-search]"),

  kpiHr: document.querySelector("[data-company-kpi-hr]"),
  kpiManagers: document.querySelector("[data-company-kpi-managers]"),
  kpiInterviewers: document.querySelector("[data-company-kpi-interviewers]"),
  kpiOpenJobs: document.querySelector("[data-company-kpi-open-jobs]"),

  userCreateForm: document.querySelector("[data-company-user-create-form]"),
  userCreateMsg: document.querySelector("[data-company-user-create-msg]"),
  userRoleFilter: document.querySelector("[data-company-user-role-filter]"),
  userStatusFilter: document.querySelector("[data-company-user-status-filter]"),
  userLoadBtn: document.querySelector("[data-company-user-load]"),
  userLoadIdInput: document.querySelector("[data-company-user-id-input]"),
  userLoadIdBtn: document.querySelector("[data-company-user-load-id]"),
  userList: document.querySelector("[data-company-user-list]"),
  userEditId: document.querySelector("[data-company-user-edit-id]"),
  userEditForm: document.querySelector("[data-company-user-edit-form]"),
  userEditFirstName: document.querySelector("[data-company-user-edit-first-name]"),
  userEditLastName: document.querySelector("[data-company-user-edit-last-name]"),
  userEditEmail: document.querySelector("[data-company-user-edit-email]"),
  userEditRole: document.querySelector("[data-company-user-edit-role]"),
  userSaveBtn: document.querySelector("[data-company-user-save]"),
  userToggleBtn: document.querySelector("[data-company-user-toggle]"),
  userClearBtn: document.querySelector("[data-company-user-clear]"),
  userEditMsg: document.querySelector("[data-company-user-edit-msg]"),

  jobCreateForm: document.querySelector("[data-company-job-create-form]"),
  jobCreateMsg: document.querySelector("[data-company-job-create-msg]"),
  jobStatusFilter: document.querySelector("[data-company-job-status-filter]"),
  jobApproverId: document.querySelector("[data-company-job-approver-id]"),
  jobLoadBtn: document.querySelector("[data-company-job-load]"),
  jobList: document.querySelector("[data-company-job-list]"),
  jobEditId: document.querySelector("[data-company-job-edit-id]"),
  jobEditForm: document.querySelector("[data-company-job-edit-form]"),
  jobEditTitle: document.querySelector("[data-company-job-edit-title]"),
  jobEditLocation: document.querySelector("[data-company-job-edit-location]"),
  jobEditPositions: document.querySelector("[data-company-job-edit-positions]"),
  jobEditDescription: document.querySelector("[data-company-job-edit-description]"),
  jobEditRequirements: document.querySelector("[data-company-job-edit-requirements]"),
  jobEditType: document.querySelector("[data-company-job-edit-type]"),
  jobSaveBtn: document.querySelector("[data-company-job-save]"),
  jobPublishBtn: document.querySelector("[data-company-job-publish]"),
  jobSubmitBtn: document.querySelector("[data-company-job-submit]"),
  jobCloseBtn: document.querySelector("[data-company-job-close]"),
  jobClearBtn: document.querySelector("[data-company-job-clear]"),
  jobEditMsg: document.querySelector("[data-company-job-edit-msg]"),

  appJobIdInput: document.querySelector("[data-company-app-job-id]"),
  appLoadBtn: document.querySelector("[data-company-app-load]"),
  appList: document.querySelector("[data-company-app-list]"),
  appStats: document.querySelector("[data-company-app-stats]"),
  appMsg: document.querySelector("[data-company-app-msg]"),
  appActionId: document.querySelector("[data-company-app-action-id]"),
  appMoveStatus: document.querySelector("[data-company-app-move-status]"),
  appMoveStage: document.querySelector("[data-company-app-move-stage]"),
  appMoveApplyBtn: document.querySelector("[data-company-app-move-apply]"),
  appScreenInterviewBtn: document.querySelector("[data-company-app-screen-interview]"),
  appScreenRejectBtn: document.querySelector("[data-company-app-screen-reject]"),
  appFinalSelectBtn: document.querySelector("[data-company-app-final-select]"),
  appFinalRejectBtn: document.querySelector("[data-company-app-final-reject]"),
  appRecommendBtn: document.querySelector("[data-company-app-recommend]"),
  appActionClearBtn: document.querySelector("[data-company-app-action-clear]"),

  offerCreateForm: document.querySelector("[data-company-offer-create-form]"),
  offerCreateBtn: document.querySelector("[data-company-offer-create-btn]"),
  offerCreateMsg: document.querySelector("[data-company-offer-create-msg]"),
  offerApplicationIdInput: document.querySelector("[data-company-offer-application-id]"),
  offerLoadBtn: document.querySelector("[data-company-offer-load]"),
  offerList: document.querySelector("[data-company-offer-list]"),
  offerSendForm: document.querySelector("[data-company-offer-send-form]"),
  offerSendId: document.querySelector("[data-company-offer-send-id]"),
  offerSendDocument: document.querySelector("[data-company-offer-send-document]"),
  offerSendEsign: document.querySelector("[data-company-offer-send-esign]"),
  offerSendBtn: document.querySelector("[data-company-offer-send-btn]"),
  offerSendMsg: document.querySelector("[data-company-offer-send-msg]"),

  auditEntityInput: document.querySelector("[data-company-audit-entity]"),
  auditEntityIdInput: document.querySelector("[data-company-audit-id]"),
  auditLoadBtn: document.querySelector("[data-company-audit-load]"),
  auditList: document.querySelector("[data-company-audit-list]"),
  auditMsg: document.querySelector("[data-company-audit-msg]"),

  profileName: document.querySelector("[data-company-profile-name]"),
  profileAvatar: document.querySelector("[data-company-profile-avatar]"),
  profileEmail: document.querySelector("[data-company-profile-email]"),
  profileRole: document.querySelector("[data-company-profile-role]"),
  profileCompany: document.querySelector("[data-company-profile-company]"),
  profileLastLogin: document.querySelector("[data-company-profile-last-login]"),
  profileCompletion: document.querySelector("[data-company-profile-completion]"),
  profileForm: document.querySelector("[data-company-profile-form]"),
  profileFirstName: document.querySelector("[data-company-edit-first-name]"),
  profileLastName: document.querySelector("[data-company-edit-last-name]"),
  profileEditEmail: document.querySelector("[data-company-edit-email]"),
  profileSaveBtn: document.querySelector("[data-company-profile-save]"),
  profileStatus: document.querySelector("[data-company-profile-status]"),
  reloadProfileBtn: document.querySelector("[data-company-reload-profile]")
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

function isActive(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "active" || normalized === "enabled";
}

function selectedActiveFilter(selectElement) {
  const normalized = String(selectElement?.value || "all").trim().toLowerCase();
  if (!normalized || normalized === "all") return null;
  if (["1", "true", "active", "enabled"].includes(normalized)) return "1";
  if (["0", "false", "inactive", "disabled"].includes(normalized)) return "0";
  return null;
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function destroyChart(chartInstance) {
  if (chartInstance && typeof chartInstance.destroy === "function") {
    chartInstance.destroy();
  }
}

function toWeekKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function getLastWeekRange(totalWeeks = 6) {
  const now = new Date();
  const base = new Date(now);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  base.setHours(0, 0, 0, 0);

  const weeks = [];
  for (let i = totalWeeks - 1; i >= 0; i -= 1) {
    const weekStart = new Date(base);
    weekStart.setDate(base.getDate() - (i * 7));
    weeks.push({
      key: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`,
      label: weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    });
  }
  return weeks;
}

function parseApplicationDataValue(raw) {
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

function renderDashboardCharts(jobs, applications) {
  if (typeof window.Chart === "undefined") return;

  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeApplications = Array.isArray(applications) ? applications : [];

  const pipelineCanvas = document.getElementById("pipelineChart");
  if (pipelineCanvas) {
    const weeks = getLastWeekRange(6);
    const weekKeys = weeks.map((w) => w.key);
    const labels = weeks.map((w) => w.label);

    const allApplications = Object.fromEntries(weekKeys.map((key) => [key, 0]));
    const progressedApplications = Object.fromEntries(weekKeys.map((key) => [key, 0]));
    const progressedStatuses = new Set([
      "interview",
      "interview score submited",
      "selected",
      "offer_letter_sent",
      "offer accecepted",
      "hired",
    ]);

    safeApplications.forEach((row) => {
      const key = toWeekKey(firstValue(row, ["applied_at", "created_at"], ""));
      if (!key || !Object.prototype.hasOwnProperty.call(allApplications, key)) return;
      allApplications[key] += 1;
      const status = String(firstValue(row, ["status"], "")).trim().toLowerCase();
      if (progressedStatuses.has(status)) {
        progressedApplications[key] += 1;
      }
    });

    destroyChart(companyState.pipelineChart);
    companyState.pipelineChart = new window.Chart(pipelineCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Applications Received",
            data: weekKeys.map((key) => allApplications[key] || 0),
            borderColor: "#4167df",
            backgroundColor: "rgba(65, 103, 223, 0.14)",
            fill: true,
            tension: 0.35,
          },
          {
            label: "Moved to Advanced Stages",
            data: weekKeys.map((key) => progressedApplications[key] || 0),
            borderColor: "#2f7a5b",
            backgroundColor: "rgba(47, 122, 91, 0.14)",
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  const sourceCanvas = document.getElementById("sourceChart");
  if (sourceCanvas) {
    const sourceMap = {};
    safeApplications.forEach((row) => {
      const payload = parseApplicationDataValue(row?.application_data);
      const source = String(payload?.source || "unknown").trim().toLowerCase() || "unknown";
      sourceMap[source] = (sourceMap[source] || 0) + 1;
    });

    const entries = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const labels = entries.length ? entries.map(([key]) => key.replace(/_/g, " ")) : ["No data"];
    const values = entries.length ? entries.map(([, value]) => value) : [1];

    destroyChart(companyState.sourceChart);
    companyState.sourceChart = new window.Chart(sourceCanvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: ["#4167df", "#2f7a5b", "#3da9fc", "#6c8eff", "#8dc9b7", "#c9d6ff"],
            borderWidth: 1,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    });
  }

  if (!safeJobs.length && !safeApplications.length) {
    destroyChart(companyState.pipelineChart);
    destroyChart(companyState.sourceChart);
    companyState.pipelineChart = null;
    companyState.sourceChart = null;
  }
}

function formatAuditAction(action) {
  const raw = String(action || "").trim();
  if (!raw) return "N/A";

  const match = raw.match(/^(POST|PUT|PATCH|DELETE|GET)\s+\/(.+)$/i);
  if (!match) return raw;

  const method = String(match[1] || "").toUpperCase();
  const route = String(match[2] || "").split("?")[0];
  const words = route
    .split("/")
    .filter(Boolean)
    .filter((part) => !/^\d+$/.test(part))
    .map((part) => part.replace(/[-_]+/g, " "))
    .slice(-2);

  const label = words.join(" ").trim() || "record";
  const verbMap = {
    POST: "Created",
    PUT: "Updated",
    PATCH: "Updated",
    DELETE: "Deleted",
    GET: "Viewed",
  };

  return `${verbMap[method] || "Updated"} ${label}`;
}

function fullName(record) {
  const first = firstValue(record, ["first_name"], "");
  const last = firstValue(record, ["last_name"], "");
  const name = `${first} ${last}`.trim();
  return name || firstValue(record, ["name"], "N/A");
}

function profileInitials(record, fallback = "CA") {
  const first = firstValue(record, ["first_name"], "").trim();
  const last = firstValue(record, ["last_name"], "").trim();
  const joined = `${first} ${last}`.trim();
  if (joined) {
    const parts = joined.split(/\s+/).filter(Boolean);
    const a = parts[0]?.charAt(0) || "";
    const b = parts[1]?.charAt(0) || "";
    return (a + b || a).toUpperCase() || fallback;
  }
  const email = firstValue(record, ["email"], "").trim();
  if (email) return email.charAt(0).toUpperCase();
  return fallback;
}

function accountProfileCompletion(record) {
  if (!record || typeof record !== "object") return "--";
  const required = [
    firstValue(record, ["first_name"], ""),
    firstValue(record, ["last_name"], ""),
    firstValue(record, ["email"], ""),
  ];
  const completed = required.filter((value) => String(value || "").trim() !== "").length;
  return `${Math.round((completed / required.length) * 100)}%`;
}

function setText(element, value) {
  if (!element) return;
  element.textContent = value === undefined || value === null || value === "" ? "N/A" : String(value);
}

function displayStatusLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase();
  if (normalized === "interview score submited") return "interview score submitted";
  if (normalized === "offer accecepted") return "offer accepted";
  return raw.replace(/_/g, " ");
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

// 3) Page UI logic.
function setActiveNav(viewKey) {
  ui.navLinks.forEach((link) => link.classList.remove("active"));
  const target = document.querySelector(`[data-company-nav="${viewKey}"]`);
  if (target) target.classList.add("active");
}

function profileSuffixText() {
  const profile = companyState.currentProfile;
  if (!profile) return "";
  const name = fullName(profile);
  const role = firstValue(profile, ["role"], "");
  if (name === "N/A" && !role) return "";
  if (name !== "N/A" && role) return ` Signed in as ${name} (${role}).`;
  return ` Signed in as ${name !== "N/A" ? name : role}.`;
}

function renderHeaderSubtitle(baseSubtitle) {
  if (!ui.headerSubtitle) return;

  const subtitle = String(baseSubtitle || "").trim();
  ui.headerSubtitle.textContent = subtitle;

  const profile = companyState.currentProfile;
  if (!profile) return;
  const name = fullName(profile);
  const role = firstValue(profile, ["role"], "");
  if (name === "N/A" && !role) return;

  ui.headerSubtitle.textContent = "";
  ui.headerSubtitle.append(document.createTextNode(`${subtitle} Signed in as `));

  const chip = document.createElement("span");
  chip.className = "dash-user-chip";
  chip.textContent = name !== "N/A" ? name : role;
  ui.headerSubtitle.append(chip);

  if (name !== "N/A" && role) {
    ui.headerSubtitle.append(document.createTextNode(` (${role}).`));
  } else {
    ui.headerSubtitle.append(document.createTextNode("."));
  }
}

function resolveCompanyName(profile) {
  const companyName = firstValue(profile || {}, ["company_name"], "");
  if (companyName) return companyName;
  const companyId = firstValue(profile || {}, ["company_id"], "");
  if (companyId) return `Company #${companyId}`;
  return "N/A";
}

function resolveCompanyLogoUrl(profile) {
  const direct = firstValue(profile || {}, ["company_logo_url", "logo_url"], "").trim();
  if (direct) return direct;

  const companyName = firstValue(profile || {}, ["company_name"], "").toLowerCase();
  if (!companyName) return "";
  if (companyName.includes("infosys")) return COMPANY_LOGO_FALLBACKS.infosys;
  if (companyName.includes("wipro")) return COMPANY_LOGO_FALLBACKS.wipro;
  if (companyName.includes("tcs")) return COMPANY_LOGO_FALLBACKS.tcs;
  return "";
}

function renderTopCompanyName() {
  if (ui.topCompanyName) {
    ui.topCompanyName.textContent = `Company: ${resolveCompanyName(companyState.currentProfile)}`;
  }

  if (!ui.topCompanyLogo) return;
  const logoUrl = resolveCompanyLogoUrl(companyState.currentProfile);
  if (!logoUrl) {
    ui.topCompanyLogo.classList.add("d-none");
    ui.topCompanyLogo.removeAttribute("src");
    return;
  }

  ui.topCompanyLogo.src = logoUrl;
  ui.topCompanyLogo.alt = `${resolveCompanyName(companyState.currentProfile)} logo`;
  ui.topCompanyLogo.classList.remove("d-none");
}

function showSection(viewKey) {
  ui.sections.forEach((sec) => {
    sec.classList.toggle("d-none", sec.dataset.companyView !== viewKey);
  });

  setActiveNav(viewKey);
  companyState.currentView = viewKey;

  const meta = viewMeta[viewKey];
  if (!meta) return;
  if (ui.headerTitle) ui.headerTitle.textContent = meta.title;
  renderHeaderSubtitle(meta.subtitle);
  if (ui.searchInput) ui.searchInput.placeholder = meta.searchPlaceholder;
}

function getStoredToken() {
  if (window.COMPANY_ADMIN_TOKEN) return String(window.COMPANY_ADMIN_TOKEN);
  for (let i = 0; i < COMPANY_ADMIN_CONFIG.tokenKeys.length; i += 1) {
    const key = COMPANY_ADMIN_CONFIG.tokenKeys[i];
    const localToken = localStorage.getItem(key);
    if (localToken) return localToken;
    const sessionToken = sessionStorage.getItem(key);
    if (sessionToken) return sessionToken;
  }
  return "";
}

function clearAuthStorage() {
  COMPANY_ADMIN_CONFIG.tokenKeys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  localStorage.removeItem("role");
  localStorage.removeItem("userRole");
  sessionStorage.removeItem("role");
  sessionStorage.removeItem("userRole");
}

function redirectToLogin(message) {
  if (companyState.redirecting) return;
  companyState.redirecting = true;
  localStorage.setItem("sessionExpiredMessage", message || "Login session expired. Please log in again.");
  clearAuthStorage();
  window.location.href = "../public/login.html";
}

function getAuthHeader() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildUrlCandidates(path, queryObj) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const base = COMPANY_ADMIN_CONFIG.apiBase;
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

  if (COMPANY_ADMIN_CONFIG.tryApiPrefixFallback) {
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

  const buildRequestOptions = () => {
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
    while (true) {
      try {
        const response = await fetch(url, buildRequestOptions());
        const data = response.status === 204 ? null : await parseJsonSafely(response);

        if (response.ok) {
          return data;
        }

        const error = new Error(data?.message || `${method} ${url} failed with status ${response.status}`);
        error.status = response.status;
        error.url = url;

        if (response.status === 401) {
          redirectToLogin(data?.message || "Login session expired. Please log in again.");
        }

        lastError = preferNon404Error(lastError, error);
        if (response.status === 404) {
          break;
        }

        throw error;
      } catch (error) {
        lastError = preferNon404Error(lastError, error);
        break;
      }
    }
  }

  throw lastError || new Error("API request failed");
}

// 4) API layer.
const authApi = {
  logout() {
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.authLogout, {
      method: "POST",
      body: {},
      useAuthHeader: false
    });
  },

  profile() {
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.authProfile);
  }
};

const companyAdminApi = {
  getMyProfile() {
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.getMyProfile);
  },

  updateMyProfile(payload) {
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.updateMyProfile, {
      method: "PUT",
      body: payload
    });
  },

  getAuditTrail(entity, id) {
    const query = {};
    if (entity) query.entity = entity;
    if (id) query.id = id;
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.getAuditTrail, {
      query
    });
  },

  listUsersByRole(role, { includeInactive = true, isActive = null } = {}) {
    const query = { role, include_inactive: includeInactive ? "true" : "false" };
    if (isActive !== null && isActive !== undefined && String(isActive).trim() !== "") {
      query.is_active = String(isActive).trim();
    }
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.listUsersByRole, {
      query
    });
  },

  createUser(payload) {
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.createUser, {
      method: "POST",
      body: payload
    });
  },

  deactivateUser(id) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.deactivateUser, id), {
      method: "DELETE",
      body: {}
    });
  },

  getUserById(id) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.getUserById, id));
  },

  updateUser(id, payload) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.updateUser, id), {
      method: "PUT",
      body: payload
    });
  },

  activateUser(id) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.activateUser, id), {
      method: "POST",
      body: {}
    });
  },

  countUsersByRole(role) {
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.countUsersByRole, {
      query: { role }
    });
  },

  listJobs(query) {
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.listJobs, {
      query: query || {}
    });
  },

  createJobDraft(payload) {
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.createJobDraft, {
      method: "POST",
      body: payload
    });
  },

  getJobById(id) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.getJobById, id));
  },

  updateJob(id, payload) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.updateJob, id), {
      method: "PUT",
      body: payload
    });
  },

  submitJob(id, approverId) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.submitJob, id), {
      method: "POST",
      body: { approver_id: approverId }
    });
  },

  publishJob(id) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.publishJob, id), {
      method: "POST",
      body: {}
    });
  },

  closeJob(id) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.closeJob, id), {
      method: "POST",
      body: {}
    });
  },

  listApplications(jobId) {
    const query = {};
    if (jobId) query.job_id = jobId;
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.listApplications, {
      query
    });
  },

  moveApplicationStage(id, payload) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.moveApplicationStage, id), {
      method: "PUT",
      body: payload
    });
  },

  screenDecision(id, status) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.screenDecision, id), {
      method: "POST",
      body: { status }
    });
  },

  finalDecision(id, status) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.finalDecision, id), {
      method: "POST",
      body: { status }
    });
  },

  recommendOffer(id) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.recommendOffer, id), {
      method: "POST",
      body: {}
    });
  },

  applicationStats(jobId) {
    const query = {};
    if (jobId) query.job_id = jobId;
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.applicationStats, {
      query
    });
  },

  getOffers(applicationId) {
    const query = {};
    if (applicationId) query.application_id = applicationId;
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.getOffers, {
      query
    });
  },

  createOfferDraft(payload) {
    return apiRequest(COMPANY_ADMIN_CONFIG.endpoints.createOfferDraft, {
      method: "POST",
      body: payload
    });
  },

  sendOffer(id, payload) {
    return apiRequest(buildPathWithId(COMPANY_ADMIN_CONFIG.endpoints.sendOffer, id), {
      method: "PUT",
      body: payload
    });
  }
};

function getCurrentCompanyId() {
  return toNumber(firstValue(companyState.currentProfile || {}, ["company_id"], ""));
}

function belongsToCurrentCompany(user) {
  const currentCompanyId = getCurrentCompanyId();
  const userCompanyId = toNumber(firstValue(user || {}, ["company_id"], ""));
  if (!currentCompanyId || !userCompanyId) return true;
  return currentCompanyId === userCompanyId;
}

function showTableMessage(tbody, colSpan, text) {
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-secondary py-3">${text}</td></tr>`;
}

function createStatusBadge(value) {
  const badge = document.createElement("span");
  badge.className = `badge status-badge ${isActive(value) ? "status-badge-active" : "status-badge-inactive"}`;
  badge.textContent = isActive(value) ? "Active" : "Inactive";
  return badge;
}

function renderProfilePanel() {
  const profile = companyState.currentProfile;
  if (!profile) {
    setText(ui.profileAvatar, "CA");
    setText(ui.profileName, "N/A");
    setText(ui.profileEmail, "N/A");
    setText(ui.profileRole, "N/A");
    setText(ui.profileCompany, "N/A");
    setText(ui.profileLastLogin, "N/A");
    setText(ui.profileCompletion, "--");
    if (ui.profileFirstName) ui.profileFirstName.value = "";
    if (ui.profileLastName) ui.profileLastName.value = "";
    if (ui.profileEditEmail) ui.profileEditEmail.value = "";
    renderTopCompanyName();
    return;
  }

  setText(ui.profileAvatar, profileInitials(profile, "CA"));
  setText(ui.profileName, fullName(profile));
  setText(ui.profileEmail, firstValue(profile, ["email"], "N/A"));
  setText(ui.profileRole, firstValue(profile, ["role"], "N/A"));
  setText(ui.profileCompany, firstValue(profile, ["company_id"], "N/A"));
  setText(ui.profileLastLogin, formatDateTime(firstValue(profile, ["last_login_at"], "")));
  setText(ui.profileCompletion, accountProfileCompletion(profile));

  if (ui.profileFirstName) ui.profileFirstName.value = firstValue(profile, ["first_name"], "");
  if (ui.profileLastName) ui.profileLastName.value = firstValue(profile, ["last_name"], "");
  if (ui.profileEditEmail) ui.profileEditEmail.value = firstValue(profile, ["email"], "");
  renderTopCompanyName();
}

function ensureCompanyAdminRole(profile) {
  const role = String(firstValue(profile || {}, ["role"], "")).trim();
  if (!role) return true;
  const isCompanyAdmin = role.toLowerCase() === "companyadmin";
  if (isCompanyAdmin) return true;
  redirectToLogin("You are not authorized to access Company Admin dashboard.");
  return false;
}

async function loadAuthProfile() {
  if (!COMPANY_ADMIN_CONFIG.useApi) return false;

  try {
    const payload = await companyAdminApi.getMyProfile();
    companyState.currentProfile = payload?.profile || payload || null;

    if (!ensureCompanyAdminRole(companyState.currentProfile)) {
      return false;
    }

    const role = firstValue(companyState.currentProfile, ["role"], "");
    if (role) {
      localStorage.setItem("role", role);
      localStorage.setItem("userRole", role);
      sessionStorage.setItem("role", role);
      sessionStorage.setItem("userRole", role);
    }

    renderProfilePanel();
    return true;
  } catch (error) {
    console.error("Profile load error:", error);

    try {
      const fallback = await authApi.profile();
      companyState.currentProfile = fallback?.profile || fallback || null;
      if (!ensureCompanyAdminRole(companyState.currentProfile)) {
        return false;
      }
      renderProfilePanel();
      return true;
    } catch (fallbackError) {
      console.error("Auth profile fallback failed:", fallbackError);
      redirectToLogin("Login session expired. Please log in again.");
      return false;
    }
  }
}

async function performLogout() {
  try {
    if (COMPANY_ADMIN_CONFIG.useApi) {
      await authApi.logout();
    }
  } catch (error) {
    console.error("Logout API error:", error);
  } finally {
    clearAuthStorage();
    window.location.href = "../public/login.html";
  }
}

function setKpiText(element, value) {
  if (!element) return;
  element.textContent = value === undefined || value === null ? "--" : String(value);
}

async function loadDashboardKpis() {
  if (!COMPANY_ADMIN_CONFIG.useApi) return;

  const [hrResult, managerResult, interviewerResult, jobsResult, applicationsResult] = await Promise.allSettled([
    companyAdminApi.countUsersByRole("HR"),
    companyAdminApi.countUsersByRole("HiringManager"),
    companyAdminApi.countUsersByRole("Interviewer"),
    companyAdminApi.listJobs(),
    companyAdminApi.listApplications()
  ]);

  let jobs = [];
  let applications = [];

  if (hrResult.status === "fulfilled") {
    setKpiText(ui.kpiHr, firstValue(hrResult.value, ["total"], "--"));
  } else {
    setKpiText(ui.kpiHr, "--");
  }

  if (managerResult.status === "fulfilled") {
    setKpiText(ui.kpiManagers, firstValue(managerResult.value, ["total"], "--"));
  } else {
    setKpiText(ui.kpiManagers, "--");
  }

  if (interviewerResult.status === "fulfilled") {
    setKpiText(ui.kpiInterviewers, firstValue(interviewerResult.value, ["total"], "--"));
  } else {
    setKpiText(ui.kpiInterviewers, "--");
  }

  if (jobsResult.status === "fulfilled") {
    jobs = normalizeArrayResponse(jobsResult.value);
    const openJobsCount = jobs.filter((job) => {
      const status = String(firstValue(job, ["status"], "")).toLowerCase();
      return status !== "closed";
    }).length;
    setKpiText(ui.kpiOpenJobs, openJobsCount);
  } else {
    setKpiText(ui.kpiOpenJobs, "--");
  }

  if (applicationsResult.status === "fulfilled") {
    applications = normalizeArrayResponse(applicationsResult.value);
  }

  renderDashboardCharts(jobs, applications);
}

function dedupeById(records) {
  const seen = new Set();
  const output = [];
  records.forEach((item) => {
    const id = firstValue(item, ["id"], "");
    if (!id || !seen.has(id)) {
      if (id) seen.add(id);
      output.push(item);
    }
  });
  return output;
}

async function filterUsersToCurrentCompany(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const currentCompanyId = getCurrentCompanyId();
  if (!currentCompanyId || !safeRows.length) return safeRows;

  const rowsWithCompany = safeRows.filter((row) => firstValue(row, ["company_id"], ""));
  if (rowsWithCompany.length === safeRows.length) {
    return safeRows.filter((row) => belongsToCurrentCompany(row));
  }

  const detailCalls = safeRows.map(async (row) => {
    const id = firstValue(row, ["id"], "");
    if (!id) return null;
    try {
      const detail = await companyAdminApi.getUserById(id);
      return detail && belongsToCurrentCompany(detail) ? detail : null;
    } catch (error) {
      return null;
    }
  });

  const settled = await Promise.allSettled(detailCalls);
  const filtered = [];
  settled.forEach((result) => {
    if (result.status !== "fulfilled") return;
    if (result.value) filtered.push(result.value);
  });
  return filtered;
}

function clearSelectedUser() {
  companyState.selectedUser = null;
  setText(ui.userEditId, "N/A");
  if (ui.userEditFirstName) ui.userEditFirstName.value = "";
  if (ui.userEditLastName) ui.userEditLastName.value = "";
  if (ui.userEditEmail) ui.userEditEmail.value = "";
  if (ui.userEditRole) ui.userEditRole.value = "HR";
  if (ui.userToggleBtn) {
    ui.userToggleBtn.disabled = true;
    ui.userToggleBtn.textContent = "Activate / Deactivate";
  }
}

function setSelectedUser(user) {
  if (!user || !belongsToCurrentCompany(user)) {
    clearSelectedUser();
    if (user && !belongsToCurrentCompany(user)) {
      setMessage(ui.userEditMsg, "This user does not belong to your company.", "error");
    }
    return;
  }

  companyState.selectedUser = { ...user };
  setText(ui.userEditId, firstValue(user, ["id"], "N/A"));
  if (ui.userEditFirstName) ui.userEditFirstName.value = firstValue(user, ["first_name"], "");
  if (ui.userEditLastName) ui.userEditLastName.value = firstValue(user, ["last_name"], "");
  if (ui.userEditEmail) ui.userEditEmail.value = firstValue(user, ["email"], "");
  if (ui.userEditRole) {
    const role = firstValue(user, ["role"], "HR");
    ui.userEditRole.value = COMPANY_ADMIN_CONFIG.managedRoles.includes(role) ? role : "HR";
  }

  if (ui.userToggleBtn) {
    const active = isActive(firstValue(user, ["is_active", "status"], 1));
    ui.userToggleBtn.disabled = false;
    ui.userToggleBtn.textContent = active ? "Deactivate User" : "Activate User";
  }
}

function renderUserRows(rows) {
  if (!ui.userList) return;
  if (!rows.length) {
    showTableMessage(ui.userList, 6, "No users found");
    return;
  }

  ui.userList.innerHTML = "";

  rows.forEach((user) => {
    const tr = document.createElement("tr");
    tr.dataset.userId = firstValue(user, ["id"], "");

    const idCell = document.createElement("td");
    idCell.textContent = firstValue(user, ["id"], "N/A");
    tr.appendChild(idCell);

    const nameCell = document.createElement("td");
    nameCell.textContent = fullName(user);
    tr.appendChild(nameCell);

    const emailCell = document.createElement("td");
    emailCell.textContent = firstValue(user, ["email"], "N/A");
    tr.appendChild(emailCell);

    const roleCell = document.createElement("td");
    roleCell.textContent = firstValue(user, ["role"], "N/A");
    tr.appendChild(roleCell);

    const statusCell = document.createElement("td");
    statusCell.appendChild(createStatusBadge(firstValue(user, ["is_active", "status"], 1)));
    tr.appendChild(statusCell);

    const actionCell = document.createElement("td");
    actionCell.className = "text-nowrap";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-outline-brand btn-sm me-2";
    editBtn.textContent = "Edit";
    editBtn.dataset.userAction = "edit";
    editBtn.dataset.userId = firstValue(user, ["id"], "");
    actionCell.appendChild(editBtn);

    const active = isActive(firstValue(user, ["is_active", "status"], 1));
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = active ? "btn btn-outline-danger btn-sm" : "btn btn-outline-success btn-sm";
    toggleBtn.textContent = active ? "Deactivate" : "Activate";
    toggleBtn.dataset.userAction = "toggle";
    toggleBtn.dataset.userId = firstValue(user, ["id"], "");
    toggleBtn.dataset.userActive = active ? "1" : "0";
    actionCell.appendChild(toggleBtn);

    tr.appendChild(actionCell);
    ui.userList.appendChild(tr);
  });
}

async function loadUsersByRole() {
  if (!COMPANY_ADMIN_CONFIG.useApi) return;
  const selectedRole = String(ui.userRoleFilter?.value || "all").trim();
  const statusFilter = selectedActiveFilter(ui.userStatusFilter);
  const includeInactive = statusFilter === null;

  try {
    let rows = [];

    if (selectedRole === "all") {
      const calls = COMPANY_ADMIN_CONFIG.managedRoles.map((role) => companyAdminApi.listUsersByRole(role, {
        includeInactive,
        isActive: statusFilter
      }));
      const results = await Promise.allSettled(calls);
      const combined = [];

      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        combined.push(...normalizeArrayResponse(result.value));
      });

      rows = dedupeById(combined);
    } else {
      rows = normalizeArrayResponse(await companyAdminApi.listUsersByRole(selectedRole, {
        includeInactive,
        isActive: statusFilter
      }));
    }

    rows = await filterUsersToCurrentCompany(rows);
    companyState.usersRows = rows;
    renderUserRows(rows);
  } catch (error) {
    console.error("Users load error:", error);
    companyState.usersRows = [];
    showTableMessage(ui.userList, 6, error.message || "Failed to load users");
  }
}

async function loadSingleUserById() {
  const userId = String(ui.userLoadIdInput?.value || "").trim();
  if (!userId) {
    setMessage(ui.userEditMsg, "Enter a valid user id.", "error");
    return;
  }

  try {
    const user = await companyAdminApi.getUserById(userId);
    if (!belongsToCurrentCompany(user)) {
      setMessage(ui.userEditMsg, "This user does not belong to your company.", "error");
      return;
    }
    setSelectedUser(user);
    setMessage(ui.userEditMsg, "User loaded.", "success");
  } catch (error) {
    setMessage(ui.userEditMsg, error.message || "Failed to load user.", "error");
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

async function submitCreateUser(event) {
  event.preventDefault();
  if (!COMPANY_ADMIN_CONFIG.useApi || !ui.userCreateForm) return;

  const formData = new FormData(ui.userCreateForm);
  const firstName = String(formData.get("first_name") || "").trim();
  const lastName = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "HR").trim();

  if (!firstName || !lastName || !email || !password || !role) {
    setMessage(ui.userCreateMsg, "All fields are required.", "error");
    return;
  }

  if (!COMPANY_ADMIN_CONFIG.managedRoles.includes(role)) {
    setMessage(ui.userCreateMsg, "Role must be HR, HiringManager, or Interviewer.", "error");
    return;
  }

  if (!isValidEmail(email)) {
    setMessage(ui.userCreateMsg, "Enter a valid email address.", "error");
    return;
  }

  const companyId = getCurrentCompanyId();
  if (!companyId) {
    setMessage(ui.userCreateMsg, "Company id not found in profile.", "error");
    return;
  }

  try {
    setMessage(ui.userCreateMsg, "Creating user...", "info");
    const result = await companyAdminApi.createUser({
      company_id: companyId,
      first_name: firstName,
      last_name: lastName,
      email,
      password,
      role
    });

    ui.userCreateForm.reset();
    await loadUsersByRole();
    await loadDashboardKpis();
    setMessage(ui.userCreateMsg, result?.message || "User created successfully.", "success");

    const newUserId = firstValue(result, ["id"], "");
    if (newUserId) {
      try {
        const user = await companyAdminApi.getUserById(newUserId);
        setSelectedUser(user);
      } catch (error) {
        // Keep flow successful even if load-by-id fails.
      }
    }
  } catch (error) {
    setMessage(ui.userCreateMsg, error.message || "Failed to create user.", "error");
  }
}

async function submitEditUser(event) {
  event.preventDefault();
  if (!COMPANY_ADMIN_CONFIG.useApi) return;

  const selected = companyState.selectedUser;
  const selectedId = firstValue(selected || {}, ["id"], "");
  if (!selectedId) {
    setMessage(ui.userEditMsg, "Select a user first.", "error");
    return;
  }

  const firstName = String(ui.userEditFirstName?.value || "").trim();
  const lastName = String(ui.userEditLastName?.value || "").trim();
  const email = String(ui.userEditEmail?.value || "").trim();
  const role = String(ui.userEditRole?.value || "").trim();

  if (!firstName || !lastName || !email || !role) {
    setMessage(ui.userEditMsg, "All fields are required.", "error");
    return;
  }

  if (!isValidEmail(email)) {
    setMessage(ui.userEditMsg, "Enter a valid email address.", "error");
    return;
  }

  const companyId = getCurrentCompanyId();
  if (!companyId) {
    setMessage(ui.userEditMsg, "Company id not found in profile.", "error");
    return;
  }

  const initialText = ui.userSaveBtn?.textContent || "Save Changes";
  if (ui.userSaveBtn) {
    ui.userSaveBtn.disabled = true;
    ui.userSaveBtn.textContent = "Saving...";
  }

  try {
    await companyAdminApi.updateUser(selectedId, {
      first_name: firstName,
      last_name: lastName,
      email,
      role,
      company_id: companyId
    });

    const refreshed = await companyAdminApi.getUserById(selectedId);
    setSelectedUser(refreshed);
    await loadUsersByRole();
    await loadDashboardKpis();
    setMessage(ui.userEditMsg, "User updated successfully.", "success");
  } catch (error) {
    setMessage(ui.userEditMsg, error.message || "Failed to update user.", "error");
  } finally {
    if (ui.userSaveBtn) {
      ui.userSaveBtn.disabled = false;
      ui.userSaveBtn.textContent = initialText;
    }
  }
}

async function toggleSelectedUserActive() {
  if (!COMPANY_ADMIN_CONFIG.useApi) return;

  const selected = companyState.selectedUser;
  const selectedId = firstValue(selected || {}, ["id"], "");
  if (!selectedId) {
    setMessage(ui.userEditMsg, "Select a user first.", "error");
    return;
  }

  const currentlyActive = isActive(firstValue(selected, ["is_active", "status"], 1));
  const actionLabel = currentlyActive ? "deactivate" : "activate";

  try {
    if (currentlyActive) {
      await companyAdminApi.deactivateUser(selectedId);
    } else {
      await companyAdminApi.activateUser(selectedId);
    }

    const refreshed = await companyAdminApi.getUserById(selectedId);
    setSelectedUser(refreshed);
    await loadUsersByRole();
    await loadDashboardKpis();
    setMessage(ui.userEditMsg, `User ${actionLabel}d successfully.`, "success");
  } catch (error) {
    setMessage(ui.userEditMsg, error.message || `Failed to ${actionLabel} user.`, "error");
  }
}

async function handleUserTableAction(event) {
  const button = event.target.closest("button[data-user-action]");
  if (!button) return;

  const action = button.dataset.userAction;
  const userId = String(button.dataset.userId || "").trim();
  if (!userId) return;

  if (action === "edit") {
    try {
      const user = await companyAdminApi.getUserById(userId);
      if (!belongsToCurrentCompany(user)) {
        setMessage(ui.userEditMsg, "This user does not belong to your company.", "error");
        return;
      }
      setSelectedUser(user);
      setMessage(ui.userEditMsg, "User loaded for edit.", "success");
    } catch (error) {
      setMessage(ui.userEditMsg, error.message || "Failed to load user.", "error");
    }
    return;
  }

  if (action === "toggle") {
    try {
      const active = button.dataset.userActive === "1";
      if (active) {
        await companyAdminApi.deactivateUser(userId);
      } else {
        await companyAdminApi.activateUser(userId);
      }

      await loadUsersByRole();
      await loadDashboardKpis();
      if (companyState.selectedUser && String(companyState.selectedUser.id) === userId) {
        const refreshed = await companyAdminApi.getUserById(userId);
        setSelectedUser(refreshed);
      }
      setMessage(ui.userEditMsg, `User ${active ? "deactivated" : "activated"} successfully.`, "success");
    } catch (error) {
      setMessage(ui.userEditMsg, error.message || "Failed to update user status.", "error");
    }
  }
}

function clearSelectedJob() {
  companyState.selectedJob = null;
  setText(ui.jobEditId, "N/A");
  if (ui.jobEditTitle) ui.jobEditTitle.value = "";
  if (ui.jobEditLocation) ui.jobEditLocation.value = "";
  if (ui.jobEditPositions) ui.jobEditPositions.value = "1";
  if (ui.jobEditDescription) ui.jobEditDescription.value = "";
  if (ui.jobEditRequirements) ui.jobEditRequirements.value = "";
  if (ui.jobEditType) ui.jobEditType.value = "Full-time";
}

function setSelectedJob(job) {
  if (!job) {
    clearSelectedJob();
    return;
  }

  companyState.selectedJob = { ...job };
  setText(ui.jobEditId, firstValue(job, ["id"], "N/A"));
  if (ui.jobEditTitle) ui.jobEditTitle.value = firstValue(job, ["title"], "");
  if (ui.jobEditLocation) ui.jobEditLocation.value = firstValue(job, ["location"], "");
  if (ui.jobEditPositions) ui.jobEditPositions.value = firstValue(job, ["positions_count"], "1");
  if (ui.jobEditDescription) ui.jobEditDescription.value = firstValue(job, ["description"], "");
  if (ui.jobEditRequirements) ui.jobEditRequirements.value = firstValue(job, ["requirements"], "");
  if (ui.jobEditType) ui.jobEditType.value = firstValue(job, ["employment_type"], "Full-time");
}

function createJobStatusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  let className = "text-bg-secondary";
  if (normalized === "published") className = "text-bg-success";
  if (normalized === "pending") className = "text-bg-warning";
  if (normalized === "draft") className = "text-bg-info";
  if (normalized === "closed") className = "text-bg-dark";

  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = status || "unknown";
  return badge;
}

function renderJobRows(rows) {
  if (!ui.jobList) return;
  if (!rows.length) {
    showTableMessage(ui.jobList, 6, "No jobs found");
    return;
  }

  ui.jobList.innerHTML = "";

  rows.forEach((job) => {
    const jobId = firstValue(job, ["id"], "");
    const tr = document.createElement("tr");
    tr.dataset.jobId = jobId;

    const idCell = document.createElement("td");
    idCell.textContent = jobId || "N/A";
    tr.appendChild(idCell);

    const titleCell = document.createElement("td");
    titleCell.textContent = firstValue(job, ["title"], "N/A");
    tr.appendChild(titleCell);

    const statusCell = document.createElement("td");
    statusCell.appendChild(createJobStatusBadge(firstValue(job, ["status"], "")));
    tr.appendChild(statusCell);

    const locationCell = document.createElement("td");
    locationCell.textContent = firstValue(job, ["location"], "-");
    tr.appendChild(locationCell);

    const positionsCell = document.createElement("td");
    positionsCell.textContent = firstValue(job, ["positions_count"], "-");
    tr.appendChild(positionsCell);

    const actionCell = document.createElement("td");
    actionCell.className = "text-nowrap";

    const buttons = [
      { action: "edit", label: "Edit", cls: "btn-outline-brand" },
      { action: "publish", label: "Publish", cls: "btn-outline-success" },
      { action: "submit", label: "Submit", cls: "btn-outline-warning" },
      { action: "close", label: "Close", cls: "btn-outline-danger" }
    ];

    buttons.forEach((entry, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn ${entry.cls} btn-sm${index < buttons.length - 1 ? " me-2" : ""}`;
      btn.textContent = entry.label;
      btn.dataset.jobAction = entry.action;
      btn.dataset.jobId = jobId;
      actionCell.appendChild(btn);
    });

    tr.appendChild(actionCell);
    ui.jobList.appendChild(tr);
  });
}

async function loadJobs() {
  if (!COMPANY_ADMIN_CONFIG.useApi) return;
  const selectedStatus = String(ui.jobStatusFilter?.value || "all").trim();

  try {
    const query = {};
    if (selectedStatus && selectedStatus !== "all") {
      query.status = selectedStatus;
    }

    const rows = normalizeArrayResponse(await companyAdminApi.listJobs(query));
    companyState.jobsRows = rows;
    renderJobRows(rows);
  } catch (error) {
    console.error("Jobs load error:", error);
    companyState.jobsRows = [];
    showTableMessage(ui.jobList, 6, error.message || "Failed to load jobs");
  }
}

function parseJobPayload(formData) {
  return {
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    requirements: String(formData.get("requirements") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    employment_type: String(formData.get("employment_type") || "Full-time").trim() || "Full-time",
    positions_count: toNumber(formData.get("positions_count")) || 1,
    department: String(formData.get("department") || "").trim(),
    experience_level: String(formData.get("experience_level") || "").trim(),
    salary_min: toNumber(formData.get("salary_min")),
    salary_max: toNumber(formData.get("salary_max")),
    application_deadline: String(formData.get("application_deadline") || "").trim(),
  };
}

async function submitCreateJob(event) {
  event.preventDefault();
  if (!COMPANY_ADMIN_CONFIG.useApi || !ui.jobCreateForm) return;

  const payload = parseJobPayload(new FormData(ui.jobCreateForm));
  if (!payload.title) {
    setMessage(ui.jobCreateMsg, "Job title is required.", "error");
    return;
  }

  const profile = companyState.currentProfile || {};
  payload.company_id = toNumber(firstValue(profile, ["company_id"], "")) || undefined;
  payload.created_by = toNumber(firstValue(profile, ["id"], "")) || undefined;

  try {
    setMessage(ui.jobCreateMsg, "Creating job draft...", "info");
    const result = await companyAdminApi.createJobDraft(payload);
    ui.jobCreateForm.reset();
    await loadJobs();
    await loadDashboardKpis();
    setMessage(ui.jobCreateMsg, result?.message || "Job draft created successfully.", "success");

    const createdId = firstValue(result, ["id"], "");
    if (createdId) {
      try {
        const job = await companyAdminApi.getJobById(createdId);
        setSelectedJob(job);
      } catch (error) {
        // Keep create flow successful even if fetch-by-id fails.
      }
    }
  } catch (error) {
    setMessage(ui.jobCreateMsg, error.message || "Failed to create job.", "error");
  }
}

function collectEditJobPayload() {
  return {
    title: String(ui.jobEditTitle?.value || "").trim(),
    description: String(ui.jobEditDescription?.value || "").trim(),
    requirements: String(ui.jobEditRequirements?.value || "").trim(),
    location: String(ui.jobEditLocation?.value || "").trim(),
    employment_type: String(ui.jobEditType?.value || "Full-time").trim() || "Full-time",
    positions_count: toNumber(ui.jobEditPositions?.value) || 1
  };
}

async function submitEditJob(event) {
  event.preventDefault();
  if (!COMPANY_ADMIN_CONFIG.useApi) return;

  const selectedId = firstValue(companyState.selectedJob || {}, ["id"], "");
  if (!selectedId) {
    setMessage(ui.jobEditMsg, "Select a job first.", "error");
    return;
  }

  const payload = collectEditJobPayload();
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
    await companyAdminApi.updateJob(selectedId, payload);
    const refreshed = await companyAdminApi.getJobById(selectedId);
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
  const inputValue = String(ui.jobApproverId?.value || "").trim();
  return inputValue ? toNumber(inputValue) : null;
}

async function runJobAction(action, jobId) {
  if (!jobId) {
    setMessage(ui.jobEditMsg, "Job id is required.", "error");
    return;
  }

  try {
    if (action === "publish") {
      await companyAdminApi.publishJob(jobId);
      setMessage(ui.jobEditMsg, "Job published.", "success");
    }

    if (action === "close") {
      await companyAdminApi.closeJob(jobId);
      setMessage(ui.jobEditMsg, "Job closed.", "success");
    }

    if (action === "submit") {
      const approverId = getApproverId();
      if (!approverId) {
        setMessage(ui.jobEditMsg, "Approver id is required for submit.", "error");
        return;
      }
      await companyAdminApi.submitJob(jobId, approverId);
      setMessage(ui.jobEditMsg, "Job submitted for approval.", "success");
    }

    const refreshed = await companyAdminApi.getJobById(jobId);
    setSelectedJob(refreshed);
    await loadJobs();
    await loadDashboardKpis();
  } catch (error) {
    setMessage(ui.jobEditMsg, error.message || `Failed to ${action} job.`, "error");
  }
}

async function handleJobTableAction(event) {
  const button = event.target.closest("button[data-job-action]");
  if (!button) return;

  const action = button.dataset.jobAction;
  const jobId = String(button.dataset.jobId || "").trim();
  if (!jobId) return;

  if (action === "edit") {
    try {
      const job = await companyAdminApi.getJobById(jobId);
      setSelectedJob(job);
      setMessage(ui.jobEditMsg, "Job loaded for edit.", "success");
    } catch (error) {
      setMessage(ui.jobEditMsg, error.message || "Failed to load job.", "error");
    }
    return;
  }

  if (action === "publish" || action === "submit" || action === "close") {
    await runJobAction(action, jobId);
  }
}

function renderApplicationStats(rows) {
  if (!ui.appStats) return;
  const safeRows = Array.isArray(rows) ? rows : [];

  if (!safeRows.length) {
    ui.appStats.innerHTML = '<li class="list-group-item px-0 text-secondary">No stats found.</li>';
    return;
  }

  ui.appStats.innerHTML = "";
  safeRows.forEach((row) => {
    const li = document.createElement("li");
    li.className = "list-group-item px-0 d-flex justify-content-between align-items-center";
    const status = firstValue(row, ["status"], "unknown");
    const count = firstValue(row, ["count"], "0");
    li.innerHTML = `<span>${displayStatusLabel(status)}</span><span class="badge text-bg-primary rounded-pill">${count}</span>`;
    ui.appStats.appendChild(li);
  });
}

function renderApplicationRows(rows) {
  if (!ui.appList) return;
  if (!rows.length) {
    showTableMessage(ui.appList, 7, "No applications found");
    return;
  }

  ui.appList.innerHTML = "";

  rows.forEach((application) => {
    const applicationId = firstValue(application, ["id"], "");
    const tr = document.createElement("tr");
    tr.dataset.applicationId = applicationId;

    const idCell = document.createElement("td");
    idCell.textContent = applicationId || "N/A";
    tr.appendChild(idCell);

    const jobIdCell = document.createElement("td");
    jobIdCell.textContent = firstValue(application, ["job_id"], "N/A");
    tr.appendChild(jobIdCell);

    const candidateCell = document.createElement("td");
    const candidateName = `${firstValue(application, ["first_name"], "")} ${firstValue(application, ["last_name"], "")}`.trim();
    const email = firstValue(application, ["email"], "");
    candidateCell.innerHTML = candidateName ? `${candidateName}<br /><small class="text-secondary">${email}</small>` : "N/A";
    tr.appendChild(candidateCell);

    const statusCell = document.createElement("td");
    statusCell.textContent = displayStatusLabel(firstValue(application, ["status"], "N/A"));
    tr.appendChild(statusCell);

    const stageCell = document.createElement("td");
    stageCell.textContent = firstValue(application, ["current_stage_id"], "-");
    tr.appendChild(stageCell);

    const resumeCell = document.createElement("td");
    const resumeUrl = firstValue(application, ["resume_url"], "");
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

    const currentStatus = firstValue(application, ["status"], "");
    const offerRecommended = firstValue(application, ["offer_recommended"], "0");
    const actionDefs = getCompanyApplicationActions(currentStatus, offerRecommended);

    if (!actionDefs.length) {
      actionCell.innerHTML = '<span class="small text-secondary">No actions</span>';
      tr.appendChild(actionCell);
      ui.appList.appendChild(tr);
      return;
    }

    actionDefs.forEach((entry, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn btn-outline-brand btn-sm${index < actionDefs.length - 1 ? " me-2" : ""}`;
      btn.textContent = entry.label;
      btn.dataset.appAction = entry.action;
      btn.dataset.applicationId = applicationId;
      btn.dataset.applicationStatus = currentStatus;
      btn.dataset.applicationStage = firstValue(application, ["current_stage_id"], "");
      btn.dataset.applicationOfferRecommended = offerRecommended;
      actionCell.appendChild(btn);
    });

    tr.appendChild(actionCell);
    ui.appList.appendChild(tr);
  });
}

function normalizeApplicationStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function toBooleanFlag(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function getCompanyApplicationActions(statusValue, offerRecommendedValue) {
  const status = normalizeApplicationStatus(statusValue);
  const offerRecommended = toBooleanFlag(offerRecommendedValue);

  if (!status) {
    return [
      { action: "move", label: "Move" },
      { action: "screen", label: "Screen" }
    ];
  }

  if (["hired", "rejected", "offer_letter_sent", "offer accecepted"].includes(status)) {
    return [];
  }

  if (status === "selected") {
    return offerRecommended ? [] : [{ action: "recommend", label: "Recommend" }];
  }

  if (status === "interview score submited") {
    return [
      { action: "final", label: "Final" },
      ...(offerRecommended ? [] : [{ action: "recommend", label: "Recommend" }])
    ];
  }

  if (["applied", "screening"].includes(status)) {
    return [
      { action: "move", label: "Move" },
      { action: "screen", label: "Screen" }
    ];
  }

  if (status === "interview") {
    return [
      { action: "move", label: "Move" },
      { action: "final", label: "Final" }
    ];
  }

  return [{ action: "move", label: "Move" }];
}

async function loadApplicationsAndStats() {
  if (!COMPANY_ADMIN_CONFIG.useApi) return;

  const jobId = String(ui.appJobIdInput?.value || "").trim();

  try {
    setMessage(ui.appMsg, "Loading applications...", "info");
    const [applicationsPayload, statsPayload] = await Promise.all([
      companyAdminApi.listApplications(jobId),
      companyAdminApi.applicationStats(jobId)
    ]);

    const rows = normalizeArrayResponse(applicationsPayload);
    const statsRows = normalizeArrayResponse(statsPayload);
    companyState.applicationRows = rows;
    companyState.currentApplicationJobId = jobId;
    renderApplicationRows(rows);
    renderApplicationStats(statsRows);
    const filterText = jobId ? ` for job #${jobId}` : "";
    setMessage(ui.appMsg, `Loaded ${rows.length} application(s)${filterText}.`, "success");
  } catch (error) {
    companyState.applicationRows = [];
    renderApplicationRows([]);
    renderApplicationStats([]);
    setMessage(ui.appMsg, error.message || "Failed to load applications.", "error");
  }
}

function clearApplicationActionContext() {
  companyState.activeApplicationId = "";
  if (ui.appActionId) ui.appActionId.value = "";
  if (ui.appMoveStage) ui.appMoveStage.value = "";
}

function setApplicationActionContext(applicationId, currentStatus = "", currentStage = "") {
  companyState.activeApplicationId = String(applicationId || "").trim();
  if (ui.appActionId) ui.appActionId.value = companyState.activeApplicationId;
  if (ui.appMoveStatus) {
    const fallback = currentStatus || "interview";
    const hasOption = Array.from(ui.appMoveStatus.options).some((option) => option.value === fallback);
    ui.appMoveStatus.value = hasOption ? fallback : "interview";
  }
  if (ui.appMoveStage) ui.appMoveStage.value = currentStage || "";
}

function selectedApplicationId() {
  return String(ui.appActionId?.value || companyState.activeApplicationId || "").trim();
}

async function runMoveActionFromPanel() {
  const applicationId = selectedApplicationId();
  if (!applicationId) {
    setMessage(ui.appMsg, "Select an application using Move/Screen/Final in the table first.", "error");
    return;
  }

  const status = String(ui.appMoveStatus?.value || "").trim();
  if (!status) {
    setMessage(ui.appMsg, "Select a move status.", "error");
    return;
  }

  const stageRaw = String(ui.appMoveStage?.value || "").trim();
  const stageId = stageRaw ? toNumber(stageRaw) : null;
  if (stageRaw && stageId === null) {
    setMessage(ui.appMsg, "Stage id must be a valid number.", "error");
    return;
  }

  try {
    await companyAdminApi.moveApplicationStage(applicationId, {
      status,
      current_stage_id: stageId
    });
    setMessage(ui.appMsg, `Application #${applicationId} moved to "${status}".`, "success");
    await loadApplicationsAndStats();
  } catch (error) {
    setMessage(ui.appMsg, error.message || "Failed to move application.", "error");
  }
}

async function runScreenActionFromPanel(status) {
  const applicationId = selectedApplicationId();
  if (!applicationId) {
    setMessage(ui.appMsg, "Select an application using Screen in the table first.", "error");
    return;
  }

  try {
    await companyAdminApi.screenDecision(applicationId, status);
    setMessage(ui.appMsg, `Application #${applicationId} marked as "${status}".`, "success");
    await loadApplicationsAndStats();
  } catch (error) {
    setMessage(ui.appMsg, error.message || "Failed to update screen decision.", "error");
  }
}

async function runFinalActionFromPanel(status) {
  const applicationId = selectedApplicationId();
  if (!applicationId) {
    setMessage(ui.appMsg, "Select an application using Final in the table first.", "error");
    return;
  }

  try {
    await companyAdminApi.finalDecision(applicationId, status);
    setMessage(ui.appMsg, `Application #${applicationId} final decision set to "${status}".`, "success");
    await loadApplicationsAndStats();
  } catch (error) {
    setMessage(ui.appMsg, error.message || "Failed to update final decision.", "error");
  }
}

async function runRecommendActionFromPanel() {
  const applicationId = selectedApplicationId();
  if (!applicationId) {
    setMessage(ui.appMsg, "Select an application using Recommend in the table first.", "error");
    return;
  }

  try {
    await companyAdminApi.recommendOffer(applicationId);
    setMessage(ui.appMsg, `Offer recommendation marked for application #${applicationId}.`, "success");
    await loadApplicationsAndStats();
  } catch (error) {
    setMessage(ui.appMsg, error.message || "Failed to recommend offer.", "error");
  }
}

async function handleApplicationAction(action, applicationId, currentStatus, currentStage, offerRecommended) {
  if (!applicationId) return;
  const allowedActions = getCompanyApplicationActions(currentStatus, offerRecommended)
    .map((entry) => entry.action);
  if (!allowedActions.includes(action)) {
    setMessage(
      ui.appMsg,
      `Action "${action}" is not available for status "${currentStatus || "unknown"}".`,
      "info",
    );
    return;
  }

  if (action === "move") {
    setApplicationActionContext(applicationId, currentStatus, currentStage);
    setMessage(ui.appMsg, `Application #${applicationId} selected. Choose status/stage and click Apply Move.`, "info");
    return;
  }

  if (action === "screen") {
    setApplicationActionContext(applicationId, currentStatus || "interview", currentStage);
    setMessage(ui.appMsg, `Application #${applicationId} selected. Use Screen: Interview or Screen: Reject.`, "info");
    return;
  }

  if (action === "final") {
    setApplicationActionContext(applicationId, currentStatus, currentStage);
    setMessage(ui.appMsg, `Application #${applicationId} selected. Use Final: Select or Final: Reject.`, "info");
    return;
  }

  if (action === "recommend") {
    setApplicationActionContext(applicationId, currentStatus, currentStage);
    await runRecommendActionFromPanel();
  }
}

async function handleApplicationTableAction(event) {
  const button = event.target.closest("button[data-app-action]");
  if (!button) return;

  const action = button.dataset.appAction;
  const applicationId = String(button.dataset.applicationId || "").trim();
  const currentStatus = String(button.dataset.applicationStatus || "").trim();
  const currentStage = String(button.dataset.applicationStage || "").trim();
  const offerRecommended = String(button.dataset.applicationOfferRecommended || "").trim();

  await handleApplicationAction(action, applicationId, currentStatus, currentStage, offerRecommended);
}

function parseOfferDetails(rawText) {
  const value = String(rawText || "").trim();
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error("Offer details must be valid JSON");
  }
}

function summarizeOfferDetails(details) {
  if (details === null || details === undefined) return "-";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch (error) {
    return String(details);
  }
}

function renderOfferRows(rows) {
  if (!ui.offerList) return;
  if (!rows.length) {
    showTableMessage(ui.offerList, 6, "No offers found");
    return;
  }

  ui.offerList.innerHTML = "";

  rows.forEach((offer) => {
    const offerId = firstValue(offer, ["id"], "");
    const tr = document.createElement("tr");

    const idCell = document.createElement("td");
    idCell.textContent = offerId || "N/A";
    tr.appendChild(idCell);

    const applicationCell = document.createElement("td");
    applicationCell.textContent = firstValue(offer, ["application_id"], "N/A");
    tr.appendChild(applicationCell);

    const statusCell = document.createElement("td");
    statusCell.textContent = displayStatusLabel(firstValue(offer, ["status"], "N/A"));
    tr.appendChild(statusCell);

    const detailsCell = document.createElement("td");
    detailsCell.textContent = summarizeOfferDetails(offer.offer_details);
    tr.appendChild(detailsCell);

    const sentAtCell = document.createElement("td");
    sentAtCell.textContent = formatDateTime(firstValue(offer, ["sent_at", "updated_at", "created_at"], ""));
    tr.appendChild(sentAtCell);

    const actionCell = document.createElement("td");
    actionCell.className = "text-nowrap";

    const prepareBtn = document.createElement("button");
    prepareBtn.type = "button";
    prepareBtn.className = "btn btn-outline-brand btn-sm";
    prepareBtn.textContent = "Prepare Send";
    prepareBtn.dataset.offerAction = "prepare-send";
    prepareBtn.dataset.offerId = offerId;
    actionCell.appendChild(prepareBtn);

    tr.appendChild(actionCell);
    ui.offerList.appendChild(tr);
  });
}

async function loadOffersByApplication() {
  if (!COMPANY_ADMIN_CONFIG.useApi) return;

  const applicationId = String(ui.offerApplicationIdInput?.value || "").trim();

  try {
    const rows = normalizeArrayResponse(await companyAdminApi.getOffers(applicationId));
    companyState.offerRows = rows;
    companyState.currentOfferApplicationId = applicationId;
    renderOfferRows(rows);
    const filterText = applicationId ? ` for application #${applicationId}` : "";
    setMessage(ui.offerSendMsg, `Loaded ${rows.length} offer(s)${filterText}.`, "success");
  } catch (error) {
    companyState.offerRows = [];
    renderOfferRows([]);
    setMessage(ui.offerSendMsg, error.message || "Failed to load offers.", "error");
  }
}

async function submitCreateOfferDraft(event) {
  if (event?.preventDefault) event.preventDefault();
  if (!COMPANY_ADMIN_CONFIG.useApi || !ui.offerCreateForm) return;

  const formData = new FormData(ui.offerCreateForm);
  const applicationId = toNumber(formData.get("application_id"));
  const createdBy = toNumber(firstValue(companyState.currentProfile || {}, ["id"], ""));

  if (!applicationId) {
    setMessage(ui.offerCreateMsg, "Application id is required.", "error");
    return;
  }
  if (!createdBy) {
    setMessage(ui.offerCreateMsg, "Profile id not available. Reload profile and retry.", "error");
    return;
  }

  let offerDetails = null;
  try {
    offerDetails = parseOfferDetails(formData.get("offer_details"));
  } catch (error) {
    setMessage(ui.offerCreateMsg, error.message, "error");
    return;
  }

  try {
    setMessage(ui.offerCreateMsg, "Creating offer draft...", "info");
    const result = await companyAdminApi.createOfferDraft({
      application_id: applicationId,
      created_by: createdBy,
      offer_details: offerDetails
    });

    ui.offerCreateForm.reset();
    setMessage(ui.offerCreateMsg, result?.message || "Offer draft created.", "success");

    const createdOfferId = firstValue(result, ["id"], "");
    if (createdOfferId && ui.offerSendId) {
      ui.offerSendId.value = createdOfferId;
    }
    if (ui.offerSendDocument) {
      ui.offerSendDocument.value = firstValue(result, ["document_url"], "");
    }
    if (ui.offerSendEsign) {
      ui.offerSendEsign.value = firstValue(result, ["esign_link"], "");
    }
    if (ui.offerSendMsg && (ui.offerSendDocument?.value || ui.offerSendEsign?.value)) {
      setMessage(ui.offerSendMsg, "Offer ID, document URL, and e-sign URL auto-filled from draft.", "info");
    }

    if (ui.offerApplicationIdInput) {
      ui.offerApplicationIdInput.value = String(applicationId);
    }
    await loadOffersByApplication();
  } catch (error) {
    setMessage(ui.offerCreateMsg, error.message || "Failed to create offer draft.", "error");
  }
}

function prepareSendOffer(offerId) {
  if (ui.offerSendId) ui.offerSendId.value = String(offerId || "");
  setMessage(ui.offerSendMsg, "Offer selected. Add document and e-sign links, then send.", "info");
}

async function submitSendOffer(event) {
  if (event?.preventDefault) event.preventDefault();
  if (!COMPANY_ADMIN_CONFIG.useApi) return;

  const offerId = String(ui.offerSendId?.value || "").trim();
  if (!offerId) {
    setMessage(ui.offerSendMsg, "Offer id is required.", "error");
    return;
  }

  const initialText = ui.offerSendBtn?.textContent || "Send Offer";
  const sendButton = ui.offerSendBtn;
  if (sendButton) {
    sendButton.disabled = true;
    sendButton.textContent = "Sending...";
  }

  try {
    await companyAdminApi.sendOffer(offerId, {
      document_url: String(ui.offerSendDocument?.value || "").trim(),
      esign_link: String(ui.offerSendEsign?.value || "").trim()
    });

    setMessage(ui.offerSendMsg, "Offer sent successfully.", "success");
    if (companyState.currentOfferApplicationId) {
      await loadOffersByApplication();
    }
  } catch (error) {
    setMessage(ui.offerSendMsg, error.message || "Failed to send offer.", "error");
  } finally {
    if (sendButton) {
      sendButton.disabled = false;
      sendButton.textContent = initialText;
    }
  }
}

function handleOfferTableAction(event) {
  const button = event.target.closest("button[data-offer-action]");
  if (!button) return;

  const action = button.dataset.offerAction;
  const offerId = String(button.dataset.offerId || "").trim();
  if (!offerId) return;

  if (action === "prepare-send") {
    prepareSendOffer(offerId);
  }
}

function renderAuditRows(rows) {
  if (!ui.auditList) return;

  if (!rows.length) {
    showTableMessage(ui.auditList, 7, "No audit logs found for your company");
    return;
  }

  ui.auditList.innerHTML = "";

  rows.forEach((log) => {
    const tr = document.createElement("tr");
    const details = log?.new_data && typeof log.new_data === "object" ? log.new_data : {};
    const actorName = firstValue(log, ["actor_name"], "").trim();
    const actorEmail = firstValue(log, ["actor_email"], "").trim();
    const actorText = actorName || actorEmail || firstValue(log, ["user_id"], "System");
    const routeText = String(details.route || details.path || "").trim();
    const statusCode = String(details.status_code || "").trim();
    const detailText = [statusCode ? `HTTP ${statusCode}` : "", routeText].filter(Boolean).join(" | ") || "-";

    const cells = [
      firstValue(log, ["id"], "N/A"),
      formatAuditAction(firstValue(log, ["action"], "N/A")),
      actorText,
      firstValue(log, ["entity_type"], "N/A"),
      firstValue(log, ["entity_id"], "N/A"),
      detailText,
      formatDateTime(firstValue(log, ["created_at"], "")),
    ];

    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    ui.auditList.appendChild(tr);
  });
}

async function loadAuditTrail() {
  if (!COMPANY_ADMIN_CONFIG.useApi) return;

  const entity = String(ui.auditEntityInput?.value || "").trim();
  const id = String(ui.auditEntityIdInput?.value || "").trim();

  if ((entity && !id) || (!entity && id)) {
    showTableMessage(ui.auditList, 7, "Enter both entity and entity id to filter");
    setMessage(ui.auditMsg, "Enter both entity and entity id to filter.", "error");
    return;
  }

  try {
    showTableMessage(ui.auditList, 7, "Loading audit logs...");
    const rows = normalizeArrayResponse(await companyAdminApi.getAuditTrail(entity || undefined, id || undefined));
    companyState.auditRows = rows;
    renderAuditRows(rows);
    setMessage(ui.auditMsg, `Loaded ${rows.length} audit log(s).`, "success");
  } catch (error) {
    companyState.auditRows = [];
    renderAuditRows([]);
    setMessage(ui.auditMsg, error.message || "Failed to load audit logs.", "error");
  }
}

async function reloadCompanyProfile() {
  if (!COMPANY_ADMIN_CONFIG.useApi) return;
  setMessage(ui.profileStatus, "Loading profile...", "info");

  try {
    const payload = await companyAdminApi.getMyProfile();
    companyState.currentProfile = payload?.profile || payload || null;
    renderProfilePanel();
    showSection(companyState.currentView || "profile");
    setMessage(ui.profileStatus, "Profile loaded from API.", "success");
  } catch (error) {
    setMessage(ui.profileStatus, error.message || "Failed to load profile.", "error");
  }
}

async function submitProfileUpdate(event) {
  event.preventDefault();
  if (!COMPANY_ADMIN_CONFIG.useApi) return;

  const firstName = String(ui.profileFirstName?.value || "").trim();
  const lastName = String(ui.profileLastName?.value || "").trim();
  const email = String(ui.profileEditEmail?.value || "").trim();

  if (!firstName || !lastName || !email) {
    setMessage(ui.profileStatus, "First name, last name and email are required.", "error");
    return;
  }

  if (!isValidEmail(email)) {
    setMessage(ui.profileStatus, "Enter a valid email address.", "error");
    return;
  }

  const payload = {
    first_name: firstName,
    last_name: lastName,
    email
  };

  const initialText = ui.profileSaveBtn?.textContent || "Save Profile";
  if (ui.profileSaveBtn) {
    ui.profileSaveBtn.disabled = true;
    ui.profileSaveBtn.textContent = "Saving...";
  }

  setMessage(ui.profileStatus, "Updating profile...", "info");

  try {
    const result = await companyAdminApi.updateMyProfile(payload);
    const updated = result?.data || result?.profile || null;

    companyState.currentProfile = updated && typeof updated === "object"
      ? { ...(companyState.currentProfile || {}), ...updated }
      : { ...(companyState.currentProfile || {}), ...payload };

    renderProfilePanel();
    showSection(companyState.currentView || "profile");
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

async function openDashboard() {
  showSection("dashboard");
  await loadDashboardKpis();
}

async function openUsers() {
  showSection("users");
  if (!companyState.usersLoaded) {
    companyState.usersLoaded = true;
    await loadUsersByRole();
  }
}

async function openJobs() {
  showSection("jobs");
  if (!companyState.jobsLoaded) {
    companyState.jobsLoaded = true;
    await loadJobs();
  }
}

async function openApplications() {
  showSection("applications");
  if (!companyState.applicationsLoaded) {
    companyState.applicationsLoaded = true;
    await loadApplicationsAndStats();
  }
}

async function openOffers() {
  showSection("offers");
  if (!companyState.offersLoaded) {
    companyState.offersLoaded = true;
    await loadOffersByApplication();
  }
}

async function openActivity() {
  showSection("activity");
  if (!companyState.activityLoaded) {
    companyState.activityLoaded = true;
    await loadAuditTrail();
  }
}

async function openProfile() {
  showSection("profile");
  renderProfilePanel();
  await reloadCompanyProfile();
}

// 5) Navigation and event bindings.
async function handleLogoutClick(event) {
  event.preventDefault();
  if (!window.confirm("Do you want to log out?")) return;
  await performLogout();
}

function bindNavigation() {
  ui.navLinks.forEach((link) => {
    const section = link.dataset.companyNav;
    if (!section) return;

    if (section === "logout") {
      link.addEventListener("click", handleLogoutClick);
      return;
    }

    link.addEventListener("click", async (event) => {
      event.preventDefault();

      if (section === "dashboard") await openDashboard();
      if (section === "users") await openUsers();
      if (section === "jobs") await openJobs();
      if (section === "applications") await openApplications();
      if (section === "offers") await openOffers();
      if (section === "activity") await openActivity();
      if (section === "profile") await openProfile();

      if (window.innerWidth < 992) {
        document.body.classList.remove("dashboard-sidebar-open");
      }
    });
  });
}

function bindActionButtons() {
  if (ui.userCreateForm) {
    ui.userCreateForm.addEventListener("submit", submitCreateUser);
  }

  if (ui.userLoadBtn) {
    ui.userLoadBtn.addEventListener("click", async () => {
      await loadUsersByRole();
      await loadDashboardKpis();
      setMessage(ui.userCreateMsg, "", "info");
    });
  }

  if (ui.userLoadIdBtn) {
    ui.userLoadIdBtn.addEventListener("click", async () => {
      await loadSingleUserById();
    });
  }

  if (ui.userEditForm) {
    ui.userEditForm.addEventListener("submit", submitEditUser);
  }

  if (ui.userToggleBtn) {
    ui.userToggleBtn.addEventListener("click", async () => {
      await toggleSelectedUserActive();
    });
  }

  if (ui.userClearBtn) {
    ui.userClearBtn.addEventListener("click", () => {
      clearSelectedUser();
      setMessage(ui.userEditMsg, "", "info");
    });
  }

  if (ui.userList) {
    ui.userList.addEventListener("click", (event) => {
      handleUserTableAction(event);
    });
  }

  if (ui.jobCreateForm) {
    ui.jobCreateForm.addEventListener("submit", submitCreateJob);
  }

  if (ui.jobLoadBtn) {
    ui.jobLoadBtn.addEventListener("click", async () => {
      await loadJobs();
      await loadDashboardKpis();
    });
  }

  if (ui.jobList) {
    ui.jobList.addEventListener("click", (event) => {
      handleJobTableAction(event);
    });
  }

  if (ui.jobEditForm) {
    ui.jobEditForm.addEventListener("submit", submitEditJob);
  }

  if (ui.jobPublishBtn) {
    ui.jobPublishBtn.addEventListener("click", async () => {
      const selectedId = firstValue(companyState.selectedJob || {}, ["id"], "");
      await runJobAction("publish", selectedId);
    });
  }

  if (ui.jobSubmitBtn) {
    ui.jobSubmitBtn.addEventListener("click", async () => {
      const selectedId = firstValue(companyState.selectedJob || {}, ["id"], "");
      await runJobAction("submit", selectedId);
    });
  }

  if (ui.jobCloseBtn) {
    ui.jobCloseBtn.addEventListener("click", async () => {
      const selectedId = firstValue(companyState.selectedJob || {}, ["id"], "");
      await runJobAction("close", selectedId);
    });
  }

  if (ui.jobClearBtn) {
    ui.jobClearBtn.addEventListener("click", () => {
      clearSelectedJob();
      setMessage(ui.jobEditMsg, "", "info");
    });
  }

  if (ui.appLoadBtn) {
    ui.appLoadBtn.addEventListener("click", async () => {
      companyState.applicationsLoaded = true;
      await loadApplicationsAndStats();
    });
  }

  if (ui.appMoveApplyBtn) ui.appMoveApplyBtn.addEventListener("click", runMoveActionFromPanel);
  if (ui.appScreenInterviewBtn) ui.appScreenInterviewBtn.addEventListener("click", () => runScreenActionFromPanel("interview"));
  if (ui.appScreenRejectBtn) ui.appScreenRejectBtn.addEventListener("click", () => runScreenActionFromPanel("rejected"));
  if (ui.appFinalSelectBtn) ui.appFinalSelectBtn.addEventListener("click", () => runFinalActionFromPanel("selected"));
  if (ui.appFinalRejectBtn) ui.appFinalRejectBtn.addEventListener("click", () => runFinalActionFromPanel("rejected"));
  if (ui.appRecommendBtn) ui.appRecommendBtn.addEventListener("click", runRecommendActionFromPanel);
  if (ui.appActionClearBtn) {
    ui.appActionClearBtn.addEventListener("click", () => {
      clearApplicationActionContext();
      setMessage(ui.appMsg, "Application action panel cleared.", "info");
    });
  }

  if (ui.appList) {
    ui.appList.addEventListener("click", (event) => {
      handleApplicationTableAction(event);
    });
  }

  if (ui.offerCreateForm) {
    ui.offerCreateForm.addEventListener("submit", submitCreateOfferDraft);
  }
  if (ui.offerCreateBtn) {
    ui.offerCreateBtn.addEventListener("click", submitCreateOfferDraft);
  }

  if (ui.offerLoadBtn) {
    ui.offerLoadBtn.addEventListener("click", async () => {
      companyState.offersLoaded = true;
      await loadOffersByApplication();
    });
  }

  if (ui.auditLoadBtn) {
    ui.auditLoadBtn.addEventListener("click", async () => {
      companyState.activityLoaded = true;
      await loadAuditTrail();
    });
  }

  if (ui.offerList) {
    ui.offerList.addEventListener("click", handleOfferTableAction);
  }

  if (ui.offerSendForm) {
    ui.offerSendForm.addEventListener("submit", submitSendOffer);
  }
  if (ui.offerSendBtn) {
    ui.offerSendBtn.addEventListener("click", submitSendOffer);
  }

  if (ui.profileForm) {
    ui.profileForm.addEventListener("submit", submitProfileUpdate);
  }

  if (ui.reloadProfileBtn) {
    ui.reloadProfileBtn.addEventListener("click", async () => {
      await reloadCompanyProfile();
    });
  }
}

// 6) Init.
async function initCompanyAdminDashboard() {
  if (!ui.navLinks.length || !ui.sections.length) return;

  bindNavigation();
  bindActionButtons();
  clearSelectedUser();
  clearSelectedJob();

  const sessionReady = await loadAuthProfile();
  if (!sessionReady) return;

  await openDashboard();
}

document.addEventListener("DOMContentLoaded", () => {
  initCompanyAdminDashboard();
});

window.companyAdminApi = {
  config: COMPANY_ADMIN_CONFIG,
  auth: authApi,
  ...companyAdminApi,
  openDashboard,
  openUsers,
  openJobs,
  openApplications,
  openOffers,
  openActivity,
  openProfile,
  loadDashboardKpis,
  loadUsersByRole,
  loadJobs,
  loadApplicationsAndStats,
  loadOffersByApplication,
  loadAuditTrail,
  performLogout
};
