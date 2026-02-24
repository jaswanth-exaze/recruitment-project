/**
 * Platform Admin dashboard script.
 * Handles section switching, KPI loading, companies, users, audit logs, and auth session flow.
 *
 * Beginner Reading Guide:
 * 1) `PLATFORM_ADMIN_CONFIG` defines endpoint map and platform roles.
 * 2) `adminState` stores current section rows, pages, and profile.
 * 3) Shared helpers provide formatting, pagination, and auth handling.
 * 4) `apiRequest()` is the centralized backend API wrapper.
 * 5) Feature blocks: dashboard, companies, users, activity, contacts, profile.
 * 6) `open*` functions switch sections and load data.
 * 7) `initPlatformAdminDashboard()` starts the page.
 */

/* =========================================================
   PLATFORM ADMIN DASHBOARD SCRIPT
   ========================================================= */

/* =========================================================
   CONFIG & SHARED STATE
   ========================================================= */

const PLATFORM_ADMIN_CONFIG = {
  useApi: true,
  apiBase: String(window.PLATFORM_ADMIN_API_BASE_URL || window.API_BASE || window.location.origin || "http://localhost:3000").replace(
    /\/+$/,
    "",
  ),
  tryApiPrefixFallback: false,
  pageSize: 10,
  tokenKeys: ["token", "accessToken", "authToken", "jwtToken"],
  allRoles: ["PlatformAdmin", "CompanyAdmin", "HR", "HiringManager", "Interviewer", "Candidate"],
  endpoints: {
    authLogout: "/auth/logout",
    authProfile: "/auth/profile",
    getAuditTrail: "/platform-admin/audit",
    listContactRequests: "/platform-admin/contact-requests",
    insertAuditLog: "/platform-admin/audit-logs",
    insertBackgroundJob: "/platform-admin/background-jobs",
    completeBackgroundJob: "/platform-admin/background-jobs/:id/complete",
    failBackgroundJob: "/platform-admin/background-jobs/:id/fail",
    getPendingJobs: "/platform-admin/background-jobs/pending",
    listActiveCompanies: "/platform-admin/companies",
    createCompany: "/platform-admin/companies",
    deactivateCompany: "/platform-admin/companies/:id",
    getCompanyById: "/platform-admin/companies/:id",
    updateCompany: "/platform-admin/companies/:id",
    activateCompany: "/platform-admin/companies/:id/activate",
    countActiveCompanies: "/platform-admin/companies/count",
    getMyProfile: "/platform-admin/profile",
    updateMyProfile: "/platform-admin/profile",
    listUsersByRole: "/platform-admin/users",
    createUser: "/platform-admin/users",
    deactivateUser: "/platform-admin/users/:id",
    getUserById: "/platform-admin/users/:id",
    updateUser: "/platform-admin/users/:id",
    activateUser: "/platform-admin/users/:id/activate",
    countUsersByRole: "/platform-admin/users/count"
  }
};

const adminState = {
  currentView: "dashboard",
  companiesLoaded: false,
  usersLoaded: false,
  activityLoaded: false,
  contactsLoaded: false,
  companyMsgTimer: null,
  userMsgTimer: null,
  currentProfile: null,
  usersRows: [],
  usersPage: 1,
  auditRows: [],
  auditPage: 1,
  contactRows: [],
  contactPage: 1,
  pipelineChart: null,
  sourceChart: null
};

const viewMeta = {
  dashboard: {
    title: "Platform Admin Dashboard",
    subtitle: "Governance, subscriptions, and global recruitment activity.",
    searchPlaceholder: "Search companies or users"
  },
  companies: {
    title: "Companies",
    subtitle: "Manage companies and control activation/deactivation access.",
    searchPlaceholder: "Search company name or domain"
  },
  users: {
    title: "Users",
    subtitle: "View all users first, then filter by role and company if needed.",
    searchPlaceholder: "Search user name or email"
  },
  activity: {
    title: "Activity Log",
    subtitle: "View all logs first, then filter by entity and entity id.",
    searchPlaceholder: "Search activity actions"
  },
  contacts: {
    title: "Contact Requests",
    subtitle: "View website contact submissions and filter by email/company.",
    searchPlaceholder: "Search contact requests"
  },
  profile: {
    title: "My Profile",
    subtitle: "View your account details and manage session controls.",
    searchPlaceholder: "Search companies or users"
  }
};

const ui = {
  navLinks: document.querySelectorAll("[data-admin-nav]"),
  sections: document.querySelectorAll("[data-admin-view]"),
  headerTitle: document.querySelector("[data-admin-header-title]"),
  headerSubtitle: document.querySelector("[data-admin-header-subtitle]"),
  searchInput: document.querySelector("[data-admin-search]"),

  kpiActiveCompanies: document.querySelector("[data-kpi-active-companies]"),
  kpiActiveUsers: document.querySelector("[data-kpi-active-users]"),
  kpiPendingJobs: document.querySelector("[data-kpi-pending-jobs]"),

  companyForm: document.querySelector("[data-company-form]"),
  companyList: document.querySelector("[data-company-list]"),
  companyStatusFilter: document.querySelector("[data-company-status-filter]"),
  companyLoadBtn: document.querySelector("[data-company-load]"),
  companyMsg: document.querySelector("[data-company-msg]"),

  userList: document.querySelector("[data-user-list]"),
  userRoleFilter: document.querySelector("[data-user-role-filter]"),
  userCompanyFilter: document.querySelector("[data-user-company-filter]"),
  userStatusFilter: document.querySelector("[data-user-status-filter]"),
  userLoadBtn: document.querySelector("[data-user-load]"),
  userMsg: document.querySelector("[data-user-msg]"),
  usersPrevBtn: document.querySelector("[data-users-prev]"),
  usersNextBtn: document.querySelector("[data-users-next]"),
  usersPageMeta: document.querySelector("[data-users-page-meta]"),

  activityList: document.querySelector("[data-activity-list]"),
  auditEntityInput: document.querySelector("[data-audit-entity]"),
  auditEntityIdInput: document.querySelector("[data-audit-id]"),
  auditLoadBtn: document.querySelector("[data-audit-load]"),
  auditPrevBtn: document.querySelector("[data-audit-prev]"),
  auditNextBtn: document.querySelector("[data-audit-next]"),
  auditPageMeta: document.querySelector("[data-audit-page-meta]"),

  contactList: document.querySelector("[data-contact-list]"),
  contactEmailFilter: document.querySelector("[data-contact-email-filter]"),
  contactCompanyFilter: document.querySelector("[data-contact-company-filter]"),
  contactLoadBtn: document.querySelector("[data-contact-load]"),
  contactPrevBtn: document.querySelector("[data-contact-prev]"),
  contactNextBtn: document.querySelector("[data-contact-next]"),
  contactPageMeta: document.querySelector("[data-contact-page-meta]"),

  profileName: document.querySelector("[data-admin-profile-name]"),
  profileAvatar: document.querySelector("[data-admin-profile-avatar]"),
  profileEmail: document.querySelector("[data-admin-profile-email]"),
  profileRole: document.querySelector("[data-admin-profile-role]"),
  profileCompany: document.querySelector("[data-admin-profile-company]"),
  profileLastLogin: document.querySelector("[data-admin-profile-last-login]"),
  profileCompletion: document.querySelector("[data-admin-profile-completion]"),
  profileEditForm: document.querySelector("[data-admin-profile-form]"),
  profileEditFirstName: document.querySelector("[data-admin-edit-first-name]"),
  profileEditLastName: document.querySelector("[data-admin-edit-last-name]"),
  profileEditEmail: document.querySelector("[data-admin-edit-email]"),
  profileSaveBtn: document.querySelector("[data-admin-profile-save]"),
  profileStatus: document.querySelector("[data-admin-profile-status]"),
  profileReloadBtn: document.querySelector("[data-admin-reload-profile]")
};

/* =========================================================
   BASIC HELPERS
   ========================================================= */

function firstValue(record, keys, fallback = "") {
  for (let i = 0; i < keys.length; i += 1) {
    const value = record?.[keys[i]];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return fallback;
}

function setActiveNav(viewKey) {
  ui.navLinks.forEach((link) => link.classList.remove("active"));
  const target = document.querySelector(`[data-admin-nav="${viewKey}"]`);
  if (target) target.classList.add("active");
}

function profileSuffixText() {
  const profile = adminState.currentProfile;
  if (!profile) return "";

  const firstName = String(profile.first_name || "").trim();
  const lastName = String(profile.last_name || "").trim();
  const name = `${firstName} ${lastName}`.trim();
  const role = String(profile.role || "").trim();

  if (!name && !role) return "";
  if (name && role) return ` Signed in as ${name} (${role}).`;
  return ` Signed in as ${name || role}.`;
}

function renderHeaderSubtitle(baseSubtitle) {
  if (!ui.headerSubtitle) return;

  const subtitle = String(baseSubtitle || "").trim();
  ui.headerSubtitle.textContent = subtitle;

  const profile = adminState.currentProfile;
  if (!profile) return;

  const firstName = String(profile.first_name || "").trim();
  const lastName = String(profile.last_name || "").trim();
  const name = `${firstName} ${lastName}`.trim();
  const role = String(profile.role || "").trim();
  if (!name && !role) return;

  ui.headerSubtitle.textContent = "";
  ui.headerSubtitle.append(document.createTextNode(`${subtitle} Signed in as `));

  const chip = document.createElement("span");
  chip.className = "dash-user-chip";
  chip.textContent = name || role;
  ui.headerSubtitle.append(chip);

  if (name && role) {
    ui.headerSubtitle.append(document.createTextNode(` (${role}).`));
  } else {
    ui.headerSubtitle.append(document.createTextNode("."));
  }
}

function showSection(viewKey) {
  ui.sections.forEach((sec) => {
    sec.classList.toggle("d-none", sec.dataset.adminView !== viewKey);
  });

  setActiveNav(viewKey);
  adminState.currentView = viewKey;

  const meta = viewMeta[viewKey];
  if (!meta) return;

  if (ui.headerTitle) ui.headerTitle.textContent = meta.title;
  renderHeaderSubtitle(meta.subtitle);
  if (ui.searchInput) ui.searchInput.placeholder = meta.searchPlaceholder;
}

function getStoredToken() {
  if (window.PLATFORM_ADMIN_TOKEN) return String(window.PLATFORM_ADMIN_TOKEN);

  for (let i = 0; i < PLATFORM_ADMIN_CONFIG.tokenKeys.length; i += 1) {
    const key = PLATFORM_ADMIN_CONFIG.tokenKeys[i];
    const localToken = localStorage.getItem(key);
    if (localToken) return localToken;
    const sessionToken = sessionStorage.getItem(key);
    if (sessionToken) return sessionToken;
  }
  return "";
}

function setStoredToken(token) {
  const safeToken = String(token || "");
  PLATFORM_ADMIN_CONFIG.tokenKeys.forEach((key) => {
    localStorage.setItem(key, safeToken);
    sessionStorage.setItem(key, safeToken);
  });
}

function clearAuthStorage() {
  localStorage.clear();
  sessionStorage.clear();
}

function getAuthHeader() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeArrayResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  return [];
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

function isActive(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "active" || normalized === "enabled";
}

function createStatusBadge(value) {
  const badge = document.createElement("span");
  badge.className = `badge status-badge ${isActive(value) ? "status-badge-active" : "status-badge-inactive"}`;
  badge.textContent = isActive(value) ? "Active" : "Inactive";
  return badge;
}

function getCompanyIdFromRecord(company) {
  const id = Number(firstValue(company, ["id"], ""));
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

function createCompanyActionButton(company) {
  const isCompanyActive = isActive(firstValue(company, ["is_active", "status"], 1));
  const companyId = getCompanyIdFromRecord(company);
  const button = document.createElement("button");

  button.type = "button";
  button.className = `btn btn-sm ${isCompanyActive ? "btn-outline-danger" : "btn-outline-success"}`;
  button.dataset.companyToggle = companyId ? String(companyId) : "";
  button.dataset.nextState = isCompanyActive ? "deactivate" : "activate";
  button.textContent = isCompanyActive ? "Deactivate" : "Activate";

  if (!companyId) {
    button.disabled = true;
    button.title = "Company id is missing";
  }

  return button;
}

function createCompanyTableRow(company) {
  const tr = document.createElement("tr");

  const idCell = document.createElement("td");
  idCell.textContent = firstValue(company, ["id"], "N/A");
  tr.appendChild(idCell);

  const nameCell = document.createElement("td");
  nameCell.textContent = firstValue(company, ["name"], "N/A");
  tr.appendChild(nameCell);

  const domainCell = document.createElement("td");
  domainCell.textContent = firstValue(company, ["domain"], "N/A");
  tr.appendChild(domainCell);

  const adminCell = document.createElement("td");
  adminCell.textContent = firstValue(company, ["company_admin_email", "admin_email"], "-");
  tr.appendChild(adminCell);

  const statusCell = document.createElement("td");
  statusCell.appendChild(createStatusBadge(firstValue(company, ["is_active", "status"], 1)));
  tr.appendChild(statusCell);

  const createdCell = document.createElement("td");
  createdCell.textContent = formatDate(firstValue(company, ["created_at"], ""));
  tr.appendChild(createdCell);

  const actionCell = document.createElement("td");
  actionCell.appendChild(createCompanyActionButton(company));
  tr.appendChild(actionCell);

  return tr;
}

function setKpiText(element, value) {
  if (!element) return;
  element.textContent = value === undefined || value === null ? "--" : String(value);
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

function monthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getLastMonthRange(totalMonths = 6) {
  const now = new Date();
  const months = [];
  for (let i = totalMonths - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleString(undefined, { month: "short", year: "2-digit" }),
    });
  }
  return months;
}

function countRowsByMonth(rows, dateField, monthKeys) {
  const map = {};
  monthKeys.forEach((key) => {
    map[key] = 0;
  });

  (rows || []).forEach((row) => {
    const key = monthKey(firstValue(row, [dateField], ""));
    if (key && Object.prototype.hasOwnProperty.call(map, key)) {
      map[key] += 1;
    }
  });

  return monthKeys.map((key) => map[key] || 0);
}

function renderDashboardCharts(companies, users) {
  if (typeof window.Chart === "undefined") return;

  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeUsers = Array.isArray(users) ? users : [];

  const pipelineCanvas = document.getElementById("pipelineChart");
  if (pipelineCanvas) {
    const months = getLastMonthRange(6);
    const monthKeys = months.map((item) => item.key);
    const labels = months.map((item) => item.label);

    const companySeries = countRowsByMonth(safeCompanies, "created_at", monthKeys);
    const userSeries = countRowsByMonth(safeUsers, "created_at", monthKeys);

    destroyChart(adminState.pipelineChart);
    adminState.pipelineChart = new window.Chart(pipelineCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Companies Onboarded",
            data: companySeries,
            borderColor: "#2f7a5b",
            backgroundColor: "rgba(47, 122, 91, 0.16)",
            fill: true,
            tension: 0.35,
          },
          {
            label: "Users Added",
            data: userSeries,
            borderColor: "#4167df",
            backgroundColor: "rgba(65, 103, 223, 0.14)",
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
    const roleLabels = PLATFORM_ADMIN_CONFIG.allRoles.map((role) => role.replace(/([a-z])([A-Z])/g, "$1 $2"));
    const roleCounts = PLATFORM_ADMIN_CONFIG.allRoles.map((role) => (
      safeUsers.filter(
        (user) => String(firstValue(user, ["role"], "")).trim() === role && isActive(firstValue(user, ["is_active"], 1)),
      ).length
    ));

    destroyChart(adminState.sourceChart);
    adminState.sourceChart = new window.Chart(sourceCanvas, {
      type: "doughnut",
      data: {
        labels: roleLabels,
        datasets: [
          {
            data: roleCounts,
            backgroundColor: ["#2f7a5b", "#4167df", "#3da9fc", "#6c8eff", "#9ec5ff", "#c9d6ff"],
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

function profileInitials(record, fallback = "PA") {
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

function setProfileStatus(text, type) {
  if (!ui.profileStatus) return;
  ui.profileStatus.textContent = text || "";
  ui.profileStatus.classList.remove("text-success", "text-danger", "text-secondary");

  if (type === "success") {
    ui.profileStatus.classList.add("text-success");
    return;
  }
  if (type === "error") {
    ui.profileStatus.classList.add("text-danger");
    return;
  }
  ui.profileStatus.classList.add("text-secondary");
}

function renderProfilePanel() {
  const profile = adminState.currentProfile;
  if (!profile) {
    if (ui.profileAvatar) ui.profileAvatar.textContent = "PA";
    if (ui.profileName) ui.profileName.textContent = "N/A";
    if (ui.profileEmail) ui.profileEmail.textContent = "N/A";
    if (ui.profileRole) ui.profileRole.textContent = "N/A";
    if (ui.profileCompany) ui.profileCompany.textContent = "N/A";
    if (ui.profileLastLogin) ui.profileLastLogin.textContent = "N/A";
    if (ui.profileCompletion) ui.profileCompletion.textContent = "--";
    if (ui.profileEditFirstName) ui.profileEditFirstName.value = "";
    if (ui.profileEditLastName) ui.profileEditLastName.value = "";
    if (ui.profileEditEmail) ui.profileEditEmail.value = "";
    return;
  }

  if (ui.profileAvatar) ui.profileAvatar.textContent = profileInitials(profile, "PA");
  if (ui.profileName) ui.profileName.textContent = fullName(profile);
  if (ui.profileEmail) ui.profileEmail.textContent = firstValue(profile, ["email"], "N/A");
  if (ui.profileRole) ui.profileRole.textContent = firstValue(profile, ["role"], "N/A");
  if (ui.profileCompany) ui.profileCompany.textContent = firstValue(profile, ["company_id"], "N/A");
  if (ui.profileLastLogin) ui.profileLastLogin.textContent = formatDateTime(firstValue(profile, ["last_login_at"], ""));
  if (ui.profileCompletion) ui.profileCompletion.textContent = accountProfileCompletion(profile);
  if (ui.profileEditFirstName) ui.profileEditFirstName.value = firstValue(profile, ["first_name"], "");
  if (ui.profileEditLastName) ui.profileEditLastName.value = firstValue(profile, ["last_name"], "");
  if (ui.profileEditEmail) ui.profileEditEmail.value = firstValue(profile, ["email"], "");
}

function showCompanyStatus(text, type) {
  if (!ui.companyMsg) return;

  ui.companyMsg.textContent = text;
  ui.companyMsg.classList.remove("d-none", "text-success", "text-danger", "text-secondary");
  if (type === "error") {
    ui.companyMsg.classList.add("text-danger");
  } else if (type === "info") {
    ui.companyMsg.classList.add("text-secondary");
  } else {
    ui.companyMsg.classList.add("text-success");
  }

  if (adminState.companyMsgTimer) {
    window.clearTimeout(adminState.companyMsgTimer);
  }

  adminState.companyMsgTimer = window.setTimeout(() => {
    ui.companyMsg?.classList.add("d-none");
  }, 2400);
}

function showUserStatus(text, type) {
  if (!ui.userMsg) return;

  ui.userMsg.textContent = text;
  ui.userMsg.classList.remove("d-none", "text-success", "text-danger", "text-secondary");
  if (type === "error") {
    ui.userMsg.classList.add("text-danger");
  } else if (type === "info") {
    ui.userMsg.classList.add("text-secondary");
  } else {
    ui.userMsg.classList.add("text-success");
  }

  if (adminState.userMsgTimer) {
    window.clearTimeout(adminState.userMsgTimer);
  }

  adminState.userMsgTimer = window.setTimeout(() => {
    ui.userMsg?.classList.add("d-none");
  }, 2400);
}

function showTableMessage(tbody, colSpan, text) {
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-secondary py-3">${text}</td></tr>`;
}

function paginateRows(rows, page, pageSize) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeTotalPages = Math.max(1, Math.ceil(safeRows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    totalPages: safeTotalPages,
    pagedRows: safeRows.slice(start, start + pageSize)
  };
}

function updatePager(metaEl, prevBtn, nextBtn, page, totalPages) {
  if (metaEl) metaEl.textContent = `Page ${page} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = page <= 1;
  if (nextBtn) nextBtn.disabled = page >= totalPages;
}

function deriveNameFromEmail(email) {
  const localPart = String(email || "").split("@")[0].trim();
  const parts = localPart.split(/[._-]+/).filter(Boolean);
  const toTitleCase = (text) => {
    const str = String(text || "").trim();
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };
  return {
    first_name: toTitleCase(parts[0] || "Company"),
    last_name: toTitleCase(parts.slice(1).join(" ") || "Admin")
  };
}

function buildPathWithId(path, id) {
  return path.replace(":id", encodeURIComponent(String(id)));
}

function buildUrlCandidates(path, queryObj) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const base = PLATFORM_ADMIN_CONFIG.apiBase;

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

  if (PLATFORM_ADMIN_CONFIG.tryApiPrefixFallback) {
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

/* =========================================================
   REQUEST CORE
   ========================================================= */

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

/* =========================================================
   AUTH API LAYER
   ========================================================= */

const authApi = {
  logout() {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.authLogout, {
      method: "POST",
      body: {},
      useAuthHeader: false
    });
  },

  profile() {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.authProfile);
  }
};

/* =========================================================
   PLATFORM ADMIN API LAYER
   ========================================================= */

const platformAdminApi = {
  getAuditTrail(entity, id) {
    const query = {};
    if (entity) query.entity = entity;
    if (id) query.id = id;

    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.getAuditTrail, {
      query
    });
  },

  insertAuditLog(payload) {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.insertAuditLog, {
      method: "POST",
      body: payload
    });
  },

  insertBackgroundJob(payload) {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.insertBackgroundJob, {
      method: "POST",
      body: payload
    });
  },

  completeBackgroundJob(id) {
    return apiRequest(buildPathWithId(PLATFORM_ADMIN_CONFIG.endpoints.completeBackgroundJob, id), {
      method: "POST",
      body: {}
    });
  },

  failBackgroundJob(id, errorMessage) {
    return apiRequest(buildPathWithId(PLATFORM_ADMIN_CONFIG.endpoints.failBackgroundJob, id), {
      method: "POST",
      body: { error_message: errorMessage || "" }
    });
  },

  getPendingJobs() {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.getPendingJobs);
  },

  listActiveCompanies(statusFilter = null) {
    const query = {};
    if (statusFilter !== null && statusFilter !== undefined && String(statusFilter).trim() !== "") {
      query.is_active = String(statusFilter).trim();
    }
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.listActiveCompanies, {
      query
    });
  },

  createCompany(payload) {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.createCompany, {
      method: "POST",
      body: payload
    });
  },

  deactivateCompany(id) {
    return apiRequest(buildPathWithId(PLATFORM_ADMIN_CONFIG.endpoints.deactivateCompany, id), {
      method: "DELETE",
      body: {}
    });
  },

  getCompanyById(id) {
    return apiRequest(buildPathWithId(PLATFORM_ADMIN_CONFIG.endpoints.getCompanyById, id));
  },

  updateCompany(id, payload) {
    return apiRequest(buildPathWithId(PLATFORM_ADMIN_CONFIG.endpoints.updateCompany, id), {
      method: "PUT",
      body: payload
    });
  },

  activateCompany(id) {
    return apiRequest(buildPathWithId(PLATFORM_ADMIN_CONFIG.endpoints.activateCompany, id), {
      method: "POST",
      body: {}
    });
  },

  countActiveCompanies() {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.countActiveCompanies);
  },

  getMyProfile() {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.getMyProfile);
  },

  updateMyProfile(payload) {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.updateMyProfile, {
      method: "PUT",
      body: payload
    });
  },

  listUsersByRole(role, companyId = null, statusFilter = null) {
    const query = { role };
    if (companyId) query.company_id = companyId;
    if (statusFilter !== null && statusFilter !== undefined && String(statusFilter).trim() !== "") {
      query.is_active = String(statusFilter).trim();
    }
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.listUsersByRole, {
      query
    });
  },

  createUser(payload) {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.createUser, {
      method: "POST",
      body: payload
    });
  },

  deactivateUser(id) {
    return apiRequest(buildPathWithId(PLATFORM_ADMIN_CONFIG.endpoints.deactivateUser, id), {
      method: "DELETE",
      body: {}
    });
  },

  getUserById(id) {
    return apiRequest(buildPathWithId(PLATFORM_ADMIN_CONFIG.endpoints.getUserById, id));
  },

  updateUser(id, payload) {
    return apiRequest(buildPathWithId(PLATFORM_ADMIN_CONFIG.endpoints.updateUser, id), {
      method: "PUT",
      body: payload
    });
  },

  activateUser(id) {
    return apiRequest(buildPathWithId(PLATFORM_ADMIN_CONFIG.endpoints.activateUser, id), {
      method: "POST",
      body: {}
    });
  },

  countUsersByRole(role) {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.countUsersByRole, {
      query: { role }
    });
  },

  listContactRequests(query = {}) {
    return apiRequest(PLATFORM_ADMIN_CONFIG.endpoints.listContactRequests, {
      query
    });
  }
};

/* =========================================================
   PROFILE / SESSION
   ========================================================= */

async function loadAuthProfile() {
  if (!PLATFORM_ADMIN_CONFIG.useApi) return false;

  try {
    const payload = await authApi.profile();
    adminState.currentProfile = payload?.profile || payload || null;
    renderProfilePanel();

    if (adminState.currentProfile?.role) {
      localStorage.setItem("userRole", String(adminState.currentProfile.role));
      sessionStorage.setItem("userRole", String(adminState.currentProfile.role));
    }
    return true;
  } catch (error) {
    console.error("Profile load error:", error);

    clearAuthStorage();
    window.location.href = "../public/login.html";
    return false;
  }
}

async function performLogout() {
  try {
    if (PLATFORM_ADMIN_CONFIG.useApi) {
      await authApi.logout();
    }
  } catch (error) {
    console.error("Logout API error:", error);
  } finally {
    clearAuthStorage();
    window.location.href = "../public/login.html";
  }
}

/* =========================================================
   DASHBOARD KPI LOAD
   ========================================================= */

async function loadDashboardKpis() {
  if (!PLATFORM_ADMIN_CONFIG.useApi) return;

  const [companiesCountResult, pendingJobsResult, companiesListResult, usersRowsResult] = await Promise.allSettled([
    platformAdminApi.countActiveCompanies(),
    platformAdminApi.getPendingJobs(),
    platformAdminApi.listActiveCompanies(),
    loadUsersAllRoles()
  ]);

  const companies = companiesListResult.status === "fulfilled"
    ? normalizeArrayResponse(companiesListResult.value)
    : [];

  const users = usersRowsResult.status === "fulfilled"
    ? usersRowsResult.value
    : [];

  if (companiesCountResult.status === "fulfilled") {
    setKpiText(ui.kpiActiveCompanies, firstValue(companiesCountResult.value, ["total"], "--"));
  } else if (companies.length) {
    const activeCompanies = companies.filter((row) => isActive(firstValue(row, ["is_active"], 1))).length;
    setKpiText(ui.kpiActiveCompanies, activeCompanies);
  }

  if (users.length) {
    const activeUsers = users.filter((row) => isActive(firstValue(row, ["is_active"], 1))).length;
    setKpiText(ui.kpiActiveUsers, activeUsers);
  } else {
    setKpiText(ui.kpiActiveUsers, "--");
  }

  if (pendingJobsResult.status === "fulfilled") {
    setKpiText(ui.kpiPendingJobs, normalizeArrayResponse(pendingJobsResult.value).length);
  } else {
    setKpiText(ui.kpiPendingJobs, "--");
  }

  renderDashboardCharts(companies, users);
}

/* =========================================================
   COMPANIES SECTION
   ========================================================= */

function renderCompanyRows(companies) {
  if (!ui.companyList) return;

  if (!companies.length) {
    showTableMessage(ui.companyList, 7, "No companies found");
    return;
  }

  ui.companyList.innerHTML = "";

  companies.forEach((company) => {
    ui.companyList.appendChild(createCompanyTableRow(company));
  });
}

function prependCompanyRow(company) {
  if (!ui.companyList) return;
  ui.companyList.prepend(
    createCompanyTableRow({
      ...company,
      created_at: firstValue(company, ["created_at"], new Date().toISOString())
    }),
  );
}

async function loadCompanies() {
  if (!PLATFORM_ADMIN_CONFIG.useApi) return;
  const statusFilter = selectedActiveFilter(ui.companyStatusFilter);

  try {
    const payload = await platformAdminApi.listActiveCompanies(statusFilter);
    renderCompanyRows(normalizeArrayResponse(payload));
  } catch (error) {
    console.error("Companies load error:", error);
    showTableMessage(ui.companyList, 7, error.message || "Failed to load companies");
  }
}

async function handleCreateCompanySubmit(event) {
  event.preventDefault();
  if (!ui.companyForm) return;

  const formData = new FormData(ui.companyForm);
  const name = String(formData.get("name") || "").trim();
  const domain = String(formData.get("domain") || "").trim();
  const companyAdminEmail = String(formData.get("company_admin_email") || "").trim();
  const companyAdminPassword = String(formData.get("company_admin_password") || "").trim();

  if (!name || !companyAdminEmail || !companyAdminPassword) {
    showCompanyStatus("Company name, admin email, and admin password are required.", "error");
    return;
  }

  try {
    if (PLATFORM_ADMIN_CONFIG.useApi) {
      const companyResult = await platformAdminApi.createCompany({
        name,
        domain: domain || null
      });

      const companyId = Number(firstValue(companyResult, ["id"], ""));
      if (!companyId || Number.isNaN(companyId)) {
        throw new Error("Company created but company id was not returned.");
      }

      const inferredName = deriveNameFromEmail(companyAdminEmail);
      await platformAdminApi.createUser({
        company_id: companyId,
        email: companyAdminEmail,
        password: companyAdminPassword,
        first_name: inferredName.first_name,
        last_name: inferredName.last_name,
        role: "CompanyAdmin"
      });

      await loadCompanies();
      await loadUserCompanyFilterOptions();
      await loadDashboardKpis();
      showCompanyStatus("Company and CompanyAdmin created successfully.", "success");
    } else {
      prependCompanyRow({
        id: `tmp-${Date.now()}`,
        name,
        domain,
        company_admin_email: companyAdminEmail,
        is_active: 1,
        created_at: new Date().toISOString()
      });
      showCompanyStatus("Company added (local mode).", "success");
    }

    ui.companyForm.reset();
  } catch (error) {
    console.error("Create company flow error:", error);
    showCompanyStatus(error.message || "Failed to create company and admin.", "error");
  }
}

async function handleCompanyActionClick(event) {
  const button = event.target.closest("[data-company-toggle]");
  if (!button) return;

  const companyId = Number(button.dataset.companyToggle || "");
  const nextState = String(button.dataset.nextState || "").trim().toLowerCase();
  if (!companyId || Number.isNaN(companyId) || !["activate", "deactivate"].includes(nextState)) return;

  const row = button.closest("tr");
  const companyName = String(row?.children?.[1]?.textContent || "").trim() || `Company #${companyId}`;
  const actionVerb = nextState === "deactivate" ? "deactivate" : "activate";
  const defaultLabel = nextState === "deactivate" ? "Deactivate" : "Activate";
  if (button.dataset.inlineConfirm !== "1") {
    button.dataset.inlineConfirm = "1";
    button.textContent = `Confirm ${defaultLabel}`;
    showCompanyStatus(`Click again to ${actionVerb} ${companyName}.`, "info");
    window.setTimeout(() => {
      if (!button.isConnected) return;
      if (button.dataset.inlineConfirm !== "1") return;
      button.dataset.inlineConfirm = "";
      button.textContent = defaultLabel;
    }, 4500);
    return;
  }

  button.dataset.inlineConfirm = "";
  button.disabled = true;
  button.textContent = nextState === "deactivate" ? "Deactivating..." : "Activating...";

  try {
    if (nextState === "deactivate") {
      await platformAdminApi.deactivateCompany(companyId);
    } else {
      await platformAdminApi.activateCompany(companyId);
    }

    await loadCompanies();
    await loadUserCompanyFilterOptions();
    await loadDashboardKpis();
    showCompanyStatus(
      `Company ${nextState === "deactivate" ? "deactivated" : "activated"} successfully.`,
      "success",
    );
  } catch (error) {
    console.error("Company status update error:", error);
    showCompanyStatus(error.message || "Failed to update company status.", "error");
  } finally {
    button.disabled = false;
    button.textContent = defaultLabel;
  }
}

/* =========================================================
   USERS SECTION
   ========================================================= */

function getUserIdFromRecord(user) {
  const id = Number(firstValue(user, ["id"], ""));
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

function createUserActionButton(user) {
  const isUserActive = isActive(firstValue(user, ["is_active", "status"], 1));
  const userId = getUserIdFromRecord(user);
  const currentUserId = Number(firstValue(adminState.currentProfile, ["id"], ""));
  const isSelf = Boolean(userId && Number.isFinite(currentUserId) && userId === currentUserId);
  const button = document.createElement("button");

  button.type = "button";
  button.className = `btn btn-sm ${isUserActive ? "btn-outline-danger" : "btn-outline-success"}`;
  button.dataset.userToggle = userId ? String(userId) : "";
  button.dataset.nextState = isUserActive ? "deactivate" : "activate";
  button.textContent = isUserActive ? "Deactivate" : "Activate";

  if (!userId || isSelf) {
    button.disabled = true;
    if (isSelf) button.textContent = "Current User";
  }

  return button;
}

function selectedCompanyFilterId() {
  const raw = String(ui.userCompanyFilter?.value || "all").trim().toLowerCase();
  if (!raw || raw === "all") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function selectedActiveFilter(selectElement) {
  const normalized = String(selectElement?.value || "all").trim().toLowerCase();
  if (!normalized || normalized === "all") return null;
  if (["1", "true", "active", "enabled"].includes(normalized)) return "1";
  if (["0", "false", "inactive", "disabled"].includes(normalized)) return "0";
  return null;
}

function companyDisplayName(user) {
  const companyName = firstValue(user, ["company_name"], "").trim();
  if (companyName) return companyName;
  const companyId = firstValue(user, ["company_id"], "").trim();
  if (companyId) return `Company #${companyId}`;
  return "-";
}

async function loadUserCompanyFilterOptions() {
  if (!PLATFORM_ADMIN_CONFIG.useApi || !ui.userCompanyFilter) return;
  const currentValue = String(ui.userCompanyFilter.value || "all");

  try {
    const payload = await platformAdminApi.listActiveCompanies();
    const rows = normalizeArrayResponse(payload);

    ui.userCompanyFilter.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All Companies";
    ui.userCompanyFilter.appendChild(allOption);

    rows.forEach((company) => {
      const companyId = Number(firstValue(company, ["id"], ""));
      if (!Number.isFinite(companyId) || companyId <= 0) return;

      const option = document.createElement("option");
      option.value = String(Math.trunc(companyId));
      const label = firstValue(company, ["name"], `Company #${companyId}`);
      option.textContent = isActive(firstValue(company, ["is_active"], 1)) ? label : `${label} (Inactive)`;
      ui.userCompanyFilter.appendChild(option);
    });

    const hasCurrentValue = Array.from(ui.userCompanyFilter.options).some((opt) => opt.value === currentValue);
    ui.userCompanyFilter.value = hasCurrentValue ? currentValue : "all";
  } catch (error) {
    console.error("Company filter load error:", error);
  }
}

function renderUsersCurrentPage() {
  if (!ui.userList) return;

  const { page, totalPages, pagedRows } = paginateRows(
    adminState.usersRows,
    adminState.usersPage,
    PLATFORM_ADMIN_CONFIG.pageSize,
  );
  adminState.usersPage = page;

  if (!pagedRows.length) {
    showTableMessage(ui.userList, 8, "No users found");
    updatePager(ui.usersPageMeta, ui.usersPrevBtn, ui.usersNextBtn, page, totalPages);
    return;
  }

  ui.userList.innerHTML = "";

  pagedRows.forEach((user) => {
    const tr = document.createElement("tr");

    const idCell = document.createElement("td");
    idCell.textContent = firstValue(user, ["id"], "N/A");
    tr.appendChild(idCell);

    const nameCell = document.createElement("td");
    const fullName = `${firstValue(user, ["first_name"], "")} ${firstValue(user, ["last_name"], "")}`.trim();
    nameCell.textContent = fullName || firstValue(user, ["name"], "N/A");
    tr.appendChild(nameCell);

    const emailCell = document.createElement("td");
    emailCell.textContent = firstValue(user, ["email"], "N/A");
    tr.appendChild(emailCell);

    const roleCell = document.createElement("td");
    roleCell.textContent = firstValue(user, ["role"], "N/A");
    tr.appendChild(roleCell);

    const companyCell = document.createElement("td");
    companyCell.textContent = companyDisplayName(user);
    tr.appendChild(companyCell);

    const statusCell = document.createElement("td");
    statusCell.appendChild(createStatusBadge(firstValue(user, ["is_active", "status"], 1)));
    tr.appendChild(statusCell);

    const createdCell = document.createElement("td");
    createdCell.textContent = formatDate(firstValue(user, ["created_at"], ""));
    tr.appendChild(createdCell);

    const actionCell = document.createElement("td");
    actionCell.appendChild(createUserActionButton(user));
    tr.appendChild(actionCell);

    ui.userList.appendChild(tr);
  });

  updatePager(ui.usersPageMeta, ui.usersPrevBtn, ui.usersNextBtn, page, totalPages);
}

async function loadUsersAllRoles(companyId = null, statusFilter = null) {
  const calls = PLATFORM_ADMIN_CONFIG.allRoles.map(
    (role) => platformAdminApi.listUsersByRole(role, companyId, statusFilter),
  );
  const results = await Promise.allSettled(calls);
  const combined = [];

  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    combined.push(...normalizeArrayResponse(result.value));
  });

  return dedupeById(combined);
}

async function loadUsersByRole() {
  if (!PLATFORM_ADMIN_CONFIG.useApi) return;

  const selectedRole = String(ui.userRoleFilter?.value || "all").trim();
  const companyId = selectedCompanyFilterId();
  const statusFilter = selectedActiveFilter(ui.userStatusFilter);

  try {
    let rows = [];

    if (selectedRole === "all") {
      rows = await loadUsersAllRoles(companyId, statusFilter);
    } else {
      const payload = await platformAdminApi.listUsersByRole(selectedRole, companyId, statusFilter);
      rows = normalizeArrayResponse(payload);
    }

    adminState.usersRows = rows;
    adminState.usersPage = 1;
    renderUsersCurrentPage();
  } catch (error) {
    console.error("Users load error:", error);
    adminState.usersRows = [];
    adminState.usersPage = 1;
    showTableMessage(ui.userList, 8, error.message || "Failed to load users");
    updatePager(ui.usersPageMeta, ui.usersPrevBtn, ui.usersNextBtn, 1, 1);
  }
}

async function handleUserActionClick(event) {
  const button = event.target.closest("[data-user-toggle]");
  if (!button) return;

  const userId = Number(button.dataset.userToggle || "");
  const nextState = String(button.dataset.nextState || "").trim().toLowerCase();
  if (!userId || Number.isNaN(userId) || !["activate", "deactivate"].includes(nextState)) return;

  const row = button.closest("tr");
  const userName = String(row?.children?.[1]?.textContent || "").trim() || `User #${userId}`;
  const actionVerb = nextState === "deactivate" ? "deactivate" : "activate";
  const defaultLabel = nextState === "deactivate" ? "Deactivate" : "Activate";
  if (button.dataset.inlineConfirm !== "1") {
    button.dataset.inlineConfirm = "1";
    button.textContent = `Confirm ${defaultLabel}`;
    showUserStatus(`Click again to ${actionVerb} ${userName}.`, "info");
    window.setTimeout(() => {
      if (!button.isConnected) return;
      if (button.dataset.inlineConfirm !== "1") return;
      button.dataset.inlineConfirm = "";
      button.textContent = defaultLabel;
    }, 4500);
    return;
  }

  button.dataset.inlineConfirm = "";
  button.disabled = true;
  button.textContent = nextState === "deactivate" ? "Deactivating..." : "Activating...";

  try {
    if (nextState === "deactivate") {
      await platformAdminApi.deactivateUser(userId);
    } else {
      await platformAdminApi.activateUser(userId);
    }

    await loadUsersByRole();
    await loadDashboardKpis();
    showUserStatus(
      `User ${nextState === "deactivate" ? "deactivated" : "activated"} successfully.`,
      "success",
    );
  } catch (error) {
    console.error("User status update error:", error);
    showUserStatus(error.message || "Failed to update user status.", "error");
  } finally {
    button.disabled = false;
    button.textContent = defaultLabel;
  }
}

/* =========================================================
   AUDIT TRAIL SECTION
   ========================================================= */

function renderAuditCurrentPage() {
  if (!ui.activityList) return;

  const { page, totalPages, pagedRows } = paginateRows(
    adminState.auditRows,
    adminState.auditPage,
    PLATFORM_ADMIN_CONFIG.pageSize,
  );
  adminState.auditPage = page;

  if (!pagedRows.length) {
    showTableMessage(ui.activityList, 8, "No audit logs found");
    updatePager(ui.auditPageMeta, ui.auditPrevBtn, ui.auditNextBtn, page, totalPages);
    return;
  }

  ui.activityList.innerHTML = "";

  pagedRows.forEach((log) => {
    const details = log?.new_data && typeof log.new_data === "object" ? log.new_data : {};
    const actorName = firstValue(log, ["actor_name"], "").trim();
    const actorEmail = firstValue(log, ["actor_email"], "").trim();
    const actorText = actorName || actorEmail || firstValue(log, ["user_id"], "System");
    const routeText = String(details.route || details.path || "").trim();
    const statusCode = String(details.status_code || "").trim();
    const detailText = [statusCode ? `HTTP ${statusCode}` : "", routeText].filter(Boolean).join(" | ") || "-";

    const tr = document.createElement("tr");

    const idCell = document.createElement("td");
    idCell.textContent = firstValue(log, ["id"], "N/A");
    tr.appendChild(idCell);

    const actionCell = document.createElement("td");
    actionCell.textContent = formatAuditAction(firstValue(log, ["action"], "N/A"));
    tr.appendChild(actionCell);

    const actorCell = document.createElement("td");
    actorCell.textContent = actorText;
    tr.appendChild(actorCell);

    const companyCell = document.createElement("td");
    companyCell.textContent = firstValue(log, ["company_id"], "-");
    tr.appendChild(companyCell);

    const entityCell = document.createElement("td");
    entityCell.textContent = firstValue(log, ["entity_type"], "N/A");
    tr.appendChild(entityCell);

    const entityIdCell = document.createElement("td");
    entityIdCell.textContent = firstValue(log, ["entity_id"], "N/A");
    tr.appendChild(entityIdCell);

    const detailsCell = document.createElement("td");
    detailsCell.textContent = detailText;
    tr.appendChild(detailsCell);

    const timeCell = document.createElement("td");
    timeCell.textContent = formatDateTime(firstValue(log, ["created_at"], ""));
    tr.appendChild(timeCell);

    ui.activityList.appendChild(tr);
  });

  updatePager(ui.auditPageMeta, ui.auditPrevBtn, ui.auditNextBtn, page, totalPages);
}

async function loadAuditTrail() {
  if (!PLATFORM_ADMIN_CONFIG.useApi) return;

  const entity = String(ui.auditEntityInput?.value || "").trim();
  const id = String(ui.auditEntityIdInput?.value || "").trim();
  const hasNoFilter = !entity && !id;

  if ((entity && !id) || (!entity && id)) {
    adminState.auditRows = [];
    adminState.auditPage = 1;
    showTableMessage(ui.activityList, 8, "Enter both entity and entity id to filter");
    updatePager(ui.auditPageMeta, ui.auditPrevBtn, ui.auditNextBtn, 1, 1);
    return;
  }

  try {
    showTableMessage(ui.activityList, 8, "Loading audit logs...");
    const payload = await platformAdminApi.getAuditTrail(entity || undefined, id || undefined);
    adminState.auditRows = normalizeArrayResponse(payload);
    adminState.auditPage = 1;
    renderAuditCurrentPage();
  } catch (error) {
    console.error("Audit load error:", error);
    adminState.auditRows = [];
    adminState.auditPage = 1;
    const fallbackMsg = "Failed to load audit logs";
    const backendNeedsRestartMsg =
      "Backend still requires entity and id. Restart backend to use all-logs default mode.";
    const message = hasNoFilter && Number(error?.status || 0) === 400
      ? backendNeedsRestartMsg
      : (error.message || fallbackMsg);
    showTableMessage(ui.activityList, 8, message);
    updatePager(ui.auditPageMeta, ui.auditPrevBtn, ui.auditNextBtn, 1, 1);
  }
}

/* =========================================================
   CONTACT REQUESTS SECTION
   ========================================================= */

function renderContactCurrentPage() {
  if (!ui.contactList) return;

  const { page, totalPages, pagedRows } = paginateRows(
    adminState.contactRows,
    adminState.contactPage,
    PLATFORM_ADMIN_CONFIG.pageSize,
  );
  adminState.contactPage = page;

  if (!pagedRows.length) {
    showTableMessage(ui.contactList, 8, "No contact requests found");
    updatePager(ui.contactPageMeta, ui.contactPrevBtn, ui.contactNextBtn, page, totalPages);
    return;
  }

  ui.contactList.innerHTML = "";

  pagedRows.forEach((request) => {
    const tr = document.createElement("tr");

    const cells = [
      firstValue(request, ["id"], "N/A"),
      firstValue(request, ["full_name"], "N/A"),
      firstValue(request, ["work_email"], "N/A"),
      firstValue(request, ["company_name"], "N/A"),
      firstValue(request, ["role"], "N/A"),
      firstValue(request, ["message"], "N/A"),
      isActive(firstValue(request, ["agreed_to_contact"], 0)) ? "Yes" : "No",
      formatDateTime(firstValue(request, ["created_at"], "")),
    ];

    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    ui.contactList.appendChild(tr);
  });

  updatePager(ui.contactPageMeta, ui.contactPrevBtn, ui.contactNextBtn, page, totalPages);
}

async function loadContactRequests() {
  if (!PLATFORM_ADMIN_CONFIG.useApi) return;

  const workEmail = String(ui.contactEmailFilter?.value || "").trim();
  const companyName = String(ui.contactCompanyFilter?.value || "").trim();
  const query = {};
  if (workEmail) query.work_email = workEmail;
  if (companyName) query.company_name = companyName;

  try {
    showTableMessage(ui.contactList, 8, "Loading contact requests...");
    const payload = await platformAdminApi.listContactRequests(query);
    adminState.contactRows = normalizeArrayResponse(payload);
    adminState.contactPage = 1;
    renderContactCurrentPage();
  } catch (error) {
    console.error("Contact requests load error:", error);
    adminState.contactRows = [];
    adminState.contactPage = 1;
    showTableMessage(ui.contactList, 8, error.message || "Failed to load contact requests");
    updatePager(ui.contactPageMeta, ui.contactPrevBtn, ui.contactNextBtn, 1, 1);
  }
}

/* =========================================================
   VIEW OPENERS
   ========================================================= */

async function openDashboard() {
  showSection("dashboard");
  await loadDashboardKpis();
}

async function openCompanies() {
  showSection("companies");
  if (PLATFORM_ADMIN_CONFIG.useApi && !adminState.companiesLoaded) {
    adminState.companiesLoaded = true;
    await loadCompanies();
  }
}

async function openUsers() {
  showSection("users");
  if (PLATFORM_ADMIN_CONFIG.useApi) {
    await loadUserCompanyFilterOptions();
  }
  if (PLATFORM_ADMIN_CONFIG.useApi && !adminState.usersLoaded) {
    adminState.usersLoaded = true;
    await loadUsersByRole();
  }
}

async function openActivity() {
  showSection("activity");
  if (PLATFORM_ADMIN_CONFIG.useApi && !adminState.activityLoaded) {
    adminState.activityLoaded = true;
    await loadAuditTrail();
  }
}

async function openContacts() {
  showSection("contacts");
  if (PLATFORM_ADMIN_CONFIG.useApi && !adminState.contactsLoaded) {
    adminState.contactsLoaded = true;
    await loadContactRequests();
  }
}

async function reloadAdminProfile() {
  if (!PLATFORM_ADMIN_CONFIG.useApi) return;
  setProfileStatus("Loading profile...", "info");

  try {
    const loaded = await loadAuthProfile();
    if (!loaded) return;
    renderProfilePanel();
    setProfileStatus("Profile loaded from API.", "success");
  } catch (error) {
    setProfileStatus(error.message || "Unable to load profile.", "error");
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

async function submitProfileUpdate(event) {
  event.preventDefault();
  if (!PLATFORM_ADMIN_CONFIG.useApi) return;

  const firstName = String(ui.profileEditFirstName?.value || "").trim();
  const lastName = String(ui.profileEditLastName?.value || "").trim();
  const email = String(ui.profileEditEmail?.value || "").trim();

  if (!firstName || !lastName || !email) {
    setProfileStatus("First name, last name, and email are required.", "error");
    return;
  }

  if (!isValidEmail(email)) {
    setProfileStatus("Enter a valid email address.", "error");
    return;
  }

  const payload = {
    first_name: firstName,
    last_name: lastName,
    email
  };

  const initialBtnText = ui.profileSaveBtn?.textContent || "Save Profile";
  if (ui.profileSaveBtn) {
    ui.profileSaveBtn.disabled = true;
    ui.profileSaveBtn.textContent = "Saving...";
  }

  setProfileStatus("Updating profile...", "info");

  try {
    const result = await platformAdminApi.updateMyProfile(payload);
    const updatedProfile = result?.data || result?.profile || null;

    if (updatedProfile && typeof updatedProfile === "object") {
      adminState.currentProfile = {
        ...(adminState.currentProfile || {}),
        ...updatedProfile
      };
    } else {
      adminState.currentProfile = {
        ...(adminState.currentProfile || {}),
        ...payload
      };
    }

    renderProfilePanel();
    showSection(adminState.currentView || "profile");
    setProfileStatus(result?.message || "Profile updated successfully.", "success");
  } catch (error) {
    setProfileStatus(error.message || "Failed to update profile.", "error");
  } finally {
    if (ui.profileSaveBtn) {
      ui.profileSaveBtn.disabled = false;
      ui.profileSaveBtn.textContent = initialBtnText;
    }
  }
}

async function openProfile() {
  showSection("profile");
  renderProfilePanel();
  await reloadAdminProfile();
}

/* =========================================================
   NAVIGATION & EVENT WIRING
   ========================================================= */

async function handleLogoutClick(event) {
  event.preventDefault();
  if (!window.confirm("Do you want to log out?")) return;
  await performLogout();
}

function bindNavigation() {
  ui.navLinks.forEach((link) => {
    const section = link.dataset.adminNav;
    if (!section) return;

    if (section === "logout") {
      link.addEventListener("click", handleLogoutClick);
      return;
    }

    link.addEventListener("click", async (event) => {
      event.preventDefault();

      if (section === "dashboard") await openDashboard();
      if (section === "companies") await openCompanies();
      if (section === "users") await openUsers();
      if (section === "activity") await openActivity();
      if (section === "contacts") await openContacts();
      if (section === "profile") await openProfile();

      if (window.innerWidth < 992) {
        document.body.classList.remove("dashboard-sidebar-open");
      }
    });
  });
}

function bindPaginationButtons() {
  if (ui.usersPrevBtn) {
    ui.usersPrevBtn.addEventListener("click", () => {
      adminState.usersPage = Math.max(1, adminState.usersPage - 1);
      renderUsersCurrentPage();
    });
  }

  if (ui.usersNextBtn) {
    ui.usersNextBtn.addEventListener("click", () => {
      adminState.usersPage += 1;
      renderUsersCurrentPage();
    });
  }

  if (ui.auditPrevBtn) {
    ui.auditPrevBtn.addEventListener("click", () => {
      adminState.auditPage = Math.max(1, adminState.auditPage - 1);
      renderAuditCurrentPage();
    });
  }

  if (ui.auditNextBtn) {
    ui.auditNextBtn.addEventListener("click", () => {
      adminState.auditPage += 1;
      renderAuditCurrentPage();
    });
  }

  if (ui.contactPrevBtn) {
    ui.contactPrevBtn.addEventListener("click", () => {
      adminState.contactPage = Math.max(1, adminState.contactPage - 1);
      renderContactCurrentPage();
    });
  }

  if (ui.contactNextBtn) {
    ui.contactNextBtn.addEventListener("click", () => {
      adminState.contactPage += 1;
      renderContactCurrentPage();
    });
  }
}

function bindActionButtons() {
  if (ui.companyForm) {
    ui.companyForm.addEventListener("submit", handleCreateCompanySubmit);
  }

  if (ui.companyList) {
    ui.companyList.addEventListener("click", async (event) => {
      await handleCompanyActionClick(event);
    });
  }

  if (ui.companyLoadBtn) {
    ui.companyLoadBtn.addEventListener("click", async () => {
      adminState.companiesLoaded = true;
      await loadCompanies();
      await loadUserCompanyFilterOptions();
      await loadDashboardKpis();
    });
  }

  if (ui.profileEditForm) {
    ui.profileEditForm.addEventListener("submit", submitProfileUpdate);
  }

  if (ui.userLoadBtn) {
    ui.userLoadBtn.addEventListener("click", async () => {
      await loadUsersByRole();
      await loadDashboardKpis();
    });
  }

  if (ui.userList) {
    ui.userList.addEventListener("click", async (event) => {
      await handleUserActionClick(event);
    });
  }

  if (ui.auditLoadBtn) {
    ui.auditLoadBtn.addEventListener("click", async () => {
      await loadAuditTrail();
    });
  }

  if (ui.contactLoadBtn) {
    ui.contactLoadBtn.addEventListener("click", async () => {
      adminState.contactsLoaded = true;
      await loadContactRequests();
    });
  }

  if (ui.profileReloadBtn) {
    ui.profileReloadBtn.addEventListener("click", async () => {
      await reloadAdminProfile();
    });
  }

  bindPaginationButtons();
}

/* =========================================================
   INIT
   ========================================================= */

async function initPlatformAdminDashboard() {
  if (!ui.navLinks.length || !ui.sections.length) return;

  bindNavigation();
  bindActionButtons();

  const sessionReady = await loadAuthProfile();
  if (!sessionReady) return;
  await openDashboard();
}

document.addEventListener("DOMContentLoaded", () => {
  initPlatformAdminDashboard();
});

// Exposed for manual testing from browser console.
window.platformAdminApi = {
  config: PLATFORM_ADMIN_CONFIG,
  auth: authApi,
  ...platformAdminApi,
  openDashboard,
  openCompanies,
  openUsers,
  openActivity,
  openContacts,
  openProfile,
  loadDashboardKpis,
  loadCompanies,
  loadUsersByRole,
  loadAuditTrail,
  loadContactRequests,
  performLogout
};
