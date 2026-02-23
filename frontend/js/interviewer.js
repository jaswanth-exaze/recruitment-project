/**
 * Interviewer dashboard script.
 * Handles dashboard KPIs, interviews, scorecards, profile management, and logout.
 */

const INTERVIEWER_CONFIG = {
  useApi: true,
  apiBase: String(window.INTERVIEWER_API_BASE_URL || window.API_BASE || "http://localhost:3000").replace(/\/+$/, ""),
  tryApiPrefixFallback: false,
  tokenKeys: ["token", "accessToken", "authToken", "jwtToken"],
  endpoints: {
    authLogout: "/auth/logout",
    getMyProfile: "/interviewer/profile",
    updateMyProfile: "/interviewer/profile",
    getInterviews: "/interviewer/interviews",
    updateInterview: "/interviewer/interviews/:id",
    getScorecards: "/interviewer/scorecards",
    submitScorecard: "/interviewer/scorecards",
    finalizeScorecard: "/interviewer/scorecards/:id/finalize"
  }
};

const intState = {
  currentView: "dashboard",
  currentProfile: null,
  interviewsRows: [],
  scorecardsRows: [],
  interviewsLoaded: false,
  sessionCompletedCount: 0
};

const intViewMeta = {
  dashboard: {
    title: "Interviewer Dashboard",
    subtitle: "Track assigned interviews and submit scorecards.",
    searchPlaceholder: "Search interviews or candidates"
  },
  interviews: {
    title: "My Interviews",
    subtitle: "View and update assigned interview records.",
    searchPlaceholder: "Search interviews"
  },
  scorecards: {
    title: "Scorecards",
    subtitle: "Submit and finalize scorecards by interview.",
    searchPlaceholder: "Search scorecards by interview"
  },
  profile: {
    title: "Profile",
    subtitle: "View and update your interviewer profile.",
    searchPlaceholder: "Search interviews or candidates"
  }
};

const ui = {
  navLinks: document.querySelectorAll("[data-int-nav]"),
  sections: document.querySelectorAll("[data-int-view]"),
  headerTitle: document.querySelector("[data-int-header-title]"),
  headerSubtitle: document.querySelector("[data-int-header-subtitle]"),
  searchInput: document.querySelector("[data-int-search]"),

  kpiScheduled: document.querySelector("[data-int-kpi-scheduled]"),
  kpiCompleted: document.querySelector("[data-int-kpi-completed]"),

  interviewsLoadBtn: document.querySelector("[data-int-interviews-load]"),
  interviewList: document.querySelector("[data-int-interview-list]"),
  interviewMsg: document.querySelector("[data-int-interview-msg]"),

  scorecardCreateForm: document.querySelector("[data-int-scorecard-create-form]"),
  scorecardCreateMsg: document.querySelector("[data-int-scorecard-create-msg]"),
  scorecardInterviewId: document.querySelector("[data-int-scorecard-interview-id]"),
  scorecardsLoadBtn: document.querySelector("[data-int-scorecards-load]"),
  scorecardList: document.querySelector("[data-int-scorecard-list]"),
  scorecardMsg: document.querySelector("[data-int-scorecard-msg]"),

  profileName: document.querySelector("[data-int-profile-name]"),
  profileEmail: document.querySelector("[data-int-profile-email]"),
  profileRole: document.querySelector("[data-int-profile-role]"),
  profileCompany: document.querySelector("[data-int-profile-company]"),
  profileLastLogin: document.querySelector("[data-int-profile-last-login]"),
  profileForm: document.querySelector("[data-int-profile-form]"),
  profileFirstName: document.querySelector("[data-int-edit-first-name]"),
  profileLastName: document.querySelector("[data-int-edit-last-name]"),
  profileEditEmail: document.querySelector("[data-int-edit-email]"),
  profileSaveBtn: document.querySelector("[data-int-profile-save]"),
  profileStatus: document.querySelector("[data-int-profile-status]"),
  reloadProfileBtn: document.querySelector("[data-int-reload-profile]"),
  logoutBtn: document.querySelector("[data-int-logout]")
};

/* SHARED HELPERS */
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
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function setText(element, value) {
  if (!element) return;
  element.textContent = value === undefined || value === null || value === "" ? "N/A" : String(value);
}

function setMessage(element, text, type = "info") {
  if (!element) return;
  element.textContent = text || "";
  element.classList.remove("text-secondary", "text-success", "text-danger");
  if (type === "success") return element.classList.add("text-success");
  if (type === "error") return element.classList.add("text-danger");
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

/* API + AUTH CORE */
function getStoredToken() {
  if (window.INTERVIEWER_TOKEN) return String(window.INTERVIEWER_TOKEN);

  for (let i = 0; i < INTERVIEWER_CONFIG.tokenKeys.length; i += 1) {
    const key = INTERVIEWER_CONFIG.tokenKeys[i];
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
  INTERVIEWER_CONFIG.tokenKeys.forEach((key) => {
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
  const base = INTERVIEWER_CONFIG.apiBase;
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

  if (INTERVIEWER_CONFIG.tryApiPrefixFallback) {
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
  if (currentStatus === 404 && incomingStatus && incomingStatus !== 404) return incomingError;
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

const interviewerApi = {
  logout() {
    return apiRequest(INTERVIEWER_CONFIG.endpoints.authLogout, {
      method: "POST",
      body: {},
      useAuthHeader: false
    });
  },

  getMyProfile() {
    return apiRequest(INTERVIEWER_CONFIG.endpoints.getMyProfile);
  },

  updateMyProfile(payload) {
    return apiRequest(INTERVIEWER_CONFIG.endpoints.updateMyProfile, {
      method: "PUT",
      body: payload
    });
  },

  getInterviews() {
    return apiRequest(INTERVIEWER_CONFIG.endpoints.getInterviews);
  },

  updateInterview(id, status, notes) {
    return apiRequest(buildPathWithId(INTERVIEWER_CONFIG.endpoints.updateInterview, id), {
      method: "PUT",
      body: { status, notes }
    });
  },

  getScorecards(interviewId) {
    return apiRequest(INTERVIEWER_CONFIG.endpoints.getScorecards, {
      query: { interview_id: interviewId }
    });
  },

  submitScorecard(payload) {
    return apiRequest(INTERVIEWER_CONFIG.endpoints.submitScorecard, {
      method: "POST",
      body: payload
    });
  },

  finalizeScorecard(id) {
    return apiRequest(buildPathWithId(INTERVIEWER_CONFIG.endpoints.finalizeScorecard, id), {
      method: "PUT",
      body: {}
    });
  }
};

/* SECTION TOGGLER */
function setActiveNav(key) {
  ui.navLinks.forEach((link) => link.classList.remove("active"));
  const target = document.querySelector(`[data-int-nav="${key}"]`);
  if (target) target.classList.add("active");
}

function profileSuffixText() {
  if (!intState.currentProfile) return "";

  const name = fullName(intState.currentProfile);
  const role = firstValue(intState.currentProfile, ["role"], "");

  if (name === "N/A" && !role) return "";
  if (name !== "N/A" && role) return ` Signed in as ${name} (${role}).`;
  return ` Signed in as ${name !== "N/A" ? name : role}.`;
}

function showSection(id) {
  ui.sections.forEach((sec) => {
    sec.classList.toggle("d-none", sec.dataset.intView !== id);
  });

  intState.currentView = id;
  setActiveNav(id);

  const meta = intViewMeta[id];
  if (!meta) return;

  if (ui.headerTitle) ui.headerTitle.textContent = meta.title;
  if (ui.headerSubtitle) ui.headerSubtitle.textContent = `${meta.subtitle}${profileSuffixText()}`;
  if (ui.searchInput) ui.searchInput.placeholder = meta.searchPlaceholder;
}

/* DASHBOARD */
async function loadDashboardKpis() {
  const interviews = Array.isArray(intState.interviewsRows) ? intState.interviewsRows : [];
  const scheduled = interviews.filter((row) => {
    const status = String(firstValue(row, ["status"], "")).trim().toLowerCase();
    return status === "scheduled";
  }).length;

  setText(ui.kpiScheduled, scheduled);
  setText(ui.kpiCompleted, intState.sessionCompletedCount);
}

async function openDashboard() {
  showSection("dashboard");
  await loadDashboardKpis();
}

/* INTERVIEWS */
async function openInterviews() {
  showSection("interviews");
  if (!intState.interviewsLoaded) {
    intState.interviewsLoaded = true;
    await loadInterviews();
  }
}

function renderInterviewRows(rows) {
  if (!ui.interviewList) return;

  if (!rows.length) {
    showTableMessage(ui.interviewList, 7, "No interviews found");
    return;
  }

  ui.interviewList.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const interviewId = firstValue(row, ["id"], "");

    const idCell = document.createElement("td");
    idCell.textContent = interviewId || "N/A";
    tr.appendChild(idCell);

    const appCell = document.createElement("td");
    appCell.textContent = firstValue(row, ["application_id"], "N/A");
    tr.appendChild(appCell);

    const candidateCell = document.createElement("td");
    const candidate = `${firstValue(row, ["candidate_first"], "")} ${firstValue(row, ["candidate_last"], "")}`.trim();
    candidateCell.textContent = candidate || "N/A";
    tr.appendChild(candidateCell);

    const roleCell = document.createElement("td");
    roleCell.textContent = firstValue(row, ["title"], "N/A");
    tr.appendChild(roleCell);

    const statusCell = document.createElement("td");
    statusCell.textContent = firstValue(row, ["status"], "N/A");
    tr.appendChild(statusCell);

    const scheduledCell = document.createElement("td");
    scheduledCell.textContent = formatDateTime(firstValue(row, ["scheduled_at"], ""));
    tr.appendChild(scheduledCell);

    const actionsCell = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline-brand btn-sm";
    btn.textContent = "Update";
    btn.dataset.interviewAction = "update";
    btn.dataset.interviewId = interviewId;
    btn.dataset.interviewStatus = firstValue(row, ["status"], "");
    btn.dataset.interviewNotes = firstValue(row, ["notes"], "");
    actionsCell.appendChild(btn);

    tr.appendChild(actionsCell);
    ui.interviewList.appendChild(tr);
  });
}

async function loadInterviews() {
  try {
    setMessage(ui.interviewMsg, "Loading interviews...", "info");
    const rows = normalizeArrayResponse(await interviewerApi.getInterviews());
    intState.interviewsRows = rows;
    renderInterviewRows(rows);
    setMessage(ui.interviewMsg, `Loaded ${rows.length} interview(s).`, "success");
    await loadDashboardKpis();
  } catch (error) {
    intState.interviewsRows = [];
    renderInterviewRows([]);
    setMessage(ui.interviewMsg, error.message || "Failed to load interviews.", "error");
  }
}

async function updateInterviewByPrompt(interviewId, currentStatus, currentNotes) {
  const status = window.prompt("Interview status:", currentStatus || "completed");
  if (!status) return;

  const notes = window.prompt("Interview notes:", currentNotes || "") || "";

  try {
    await interviewerApi.updateInterview(interviewId, status.trim(), notes.trim());
    if (status.trim().toLowerCase() === "completed") {
      intState.sessionCompletedCount += 1;
    }
    setMessage(ui.interviewMsg, "Interview updated.", "success");
    await loadInterviews();
  } catch (error) {
    setMessage(ui.interviewMsg, error.message || "Failed to update interview.", "error");
  }
}

/* SCORECARDS */
async function openScorecards() {
  showSection("scorecards");
}

function parseRatingsJson(rawText) {
  const value = String(rawText || "").trim();
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error("Ratings must be valid JSON");
  }
}

function renderScorecardRows(rows) {
  if (!ui.scorecardList) return;

  if (!rows.length) {
    showTableMessage(ui.scorecardList, 5, "No scorecards found");
    return;
  }

  ui.scorecardList.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const scorecardId = firstValue(row, ["id"], "");

    const idCell = document.createElement("td");
    idCell.textContent = scorecardId || "N/A";
    tr.appendChild(idCell);

    const recommendationCell = document.createElement("td");
    recommendationCell.textContent = firstValue(row, ["recommendation"], "N/A");
    tr.appendChild(recommendationCell);

    const finalCell = document.createElement("td");
    finalCell.textContent = firstValue(row, ["is_final"], "0") === "1" ? "Yes" : "No";
    tr.appendChild(finalCell);

    const submittedCell = document.createElement("td");
    submittedCell.textContent = formatDateTime(firstValue(row, ["submitted_at", "created_at"], ""));
    tr.appendChild(submittedCell);

    const actionsCell = document.createElement("td");
    const finalizeBtn = document.createElement("button");
    finalizeBtn.type = "button";
    finalizeBtn.className = "btn btn-outline-success btn-sm";
    finalizeBtn.textContent = "Finalize";
    finalizeBtn.dataset.scorecardAction = "finalize";
    finalizeBtn.dataset.scorecardId = scorecardId;
    finalizeBtn.disabled = firstValue(row, ["is_final"], "0") === "1";
    actionsCell.appendChild(finalizeBtn);

    tr.appendChild(actionsCell);
    ui.scorecardList.appendChild(tr);
  });
}

async function loadScorecards() {
  const interviewId = String(ui.scorecardInterviewId?.value || "").trim();
  if (!interviewId) {
    showTableMessage(ui.scorecardList, 5, "Enter interview_id to load scorecards.");
    setMessage(ui.scorecardMsg, "interview_id is required.", "error");
    return;
  }

  try {
    setMessage(ui.scorecardMsg, "Loading scorecards...", "info");
    const rows = normalizeArrayResponse(await interviewerApi.getScorecards(interviewId));
    intState.scorecardsRows = rows;
    renderScorecardRows(rows);
    setMessage(ui.scorecardMsg, `Loaded ${rows.length} scorecard(s).`, "success");
  } catch (error) {
    intState.scorecardsRows = [];
    renderScorecardRows([]);
    setMessage(ui.scorecardMsg, error.message || "Failed to load scorecards.", "error");
  }
}

async function submitScorecard(event) {
  event.preventDefault();
  if (!ui.scorecardCreateForm) return;

  const formData = new FormData(ui.scorecardCreateForm);
  const interviewId = toNumber(formData.get("interview_id"));
  const recommendation = String(formData.get("recommendation") || "").trim();

  if (!interviewId || !recommendation) {
    setMessage(ui.scorecardCreateMsg, "interview_id and recommendation are required.", "error");
    return;
  }

  let ratings = null;
  try {
    ratings = parseRatingsJson(formData.get("ratings"));
  } catch (error) {
    setMessage(ui.scorecardCreateMsg, error.message, "error");
    return;
  }

  try {
    setMessage(ui.scorecardCreateMsg, "Submitting scorecard...", "info");
    const result = await interviewerApi.submitScorecard({
      interview_id: interviewId,
      ratings,
      comments: String(formData.get("comments") || "").trim(),
      recommendation
    });

    ui.scorecardCreateForm.reset();
    setMessage(ui.scorecardCreateMsg, result?.message || "Scorecard submitted successfully.", "success");
    if (ui.scorecardInterviewId) ui.scorecardInterviewId.value = String(interviewId);
    await loadScorecards();
  } catch (error) {
    setMessage(ui.scorecardCreateMsg, error.message || "Failed to submit scorecard.", "error");
  }
}

async function finalizeScorecard(scorecardId) {
  if (!scorecardId) return;

  try {
    await interviewerApi.finalizeScorecard(scorecardId);
    setMessage(ui.scorecardMsg, "Scorecard finalized successfully.", "success");
    await loadScorecards();
  } catch (error) {
    setMessage(ui.scorecardMsg, error.message || "Failed to finalize scorecard.", "error");
  }
}

/* PROFILE */
function ensureRole(profile) {
  const role = String(firstValue(profile || {}, ["role"], "")).trim();
  if (!role) return true;
  if (role.toLowerCase() === "interviewer") return true;
  redirectToLogin("You are not authorized to access Interviewer dashboard.");
  return false;
}

function renderProfilePanel() {
  const profile = intState.currentProfile;

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

async function loadAuthProfile() {
  try {
    const payload = await interviewerApi.getMyProfile();
    intState.currentProfile = payload?.profile || payload || null;

    if (!ensureRole(intState.currentProfile)) return false;

    const role = firstValue(intState.currentProfile, ["role"], "");
    if (role) {
      localStorage.setItem("role", role);
      localStorage.setItem("userRole", role);
      sessionStorage.setItem("role", role);
      sessionStorage.setItem("userRole", role);
    }

    renderProfilePanel();
    return true;
  } catch (error) {
    console.error("Interviewer profile load error:", error);
    redirectToLogin("Login session expired. Please log in again.");
    return false;
  }
}

async function reloadProfile() {
  setMessage(ui.profileStatus, "Loading profile...", "info");

  try {
    const payload = await interviewerApi.getMyProfile();
    intState.currentProfile = payload?.profile || payload || null;
    renderProfilePanel();
    showSection(intState.currentView || "profile");
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
    const result = await interviewerApi.updateMyProfile({
      first_name: firstName,
      last_name: lastName,
      email
    });

    const updated = result?.data || result?.profile || null;
    intState.currentProfile = updated && typeof updated === "object"
      ? { ...(intState.currentProfile || {}), ...updated }
      : { ...(intState.currentProfile || {}), first_name: firstName, last_name: lastName, email };

    renderProfilePanel();
    showSection(intState.currentView || "profile");
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

async function performLogout() {
  try {
    await interviewerApi.logout();
  } catch (error) {
    console.error("Logout API error:", error);
  } finally {
    clearAuthStorage();
    window.location.href = "../public/login.html";
  }
}

async function openProfile() {
  showSection("profile");
  renderProfilePanel();
  await reloadProfile();
}

/* EVENT BINDINGS */
async function handleLogoutClick(event) {
  event.preventDefault();
  if (!window.confirm("Do you want to logout?")) return;
  await performLogout();
}

function bindNavigation() {
  ui.navLinks.forEach((link) => {
    const section = link.dataset.intNav;
    if (!section) return;

    if (section === "logout") {
      link.addEventListener("click", handleLogoutClick);
      return;
    }

    link.addEventListener("click", async (event) => {
      event.preventDefault();

      if (section === "dashboard") await openDashboard();
      if (section === "interviews") await openInterviews();
      if (section === "scorecards") await openScorecards();
      if (section === "profile") await openProfile();

      if (window.innerWidth < 992) {
        document.body.classList.remove("dashboard-sidebar-open");
      }
    });
  });
}

function bindActions() {
  if (ui.interviewsLoadBtn) {
    ui.interviewsLoadBtn.addEventListener("click", loadInterviews);
  }

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

  if (ui.scorecardCreateForm) {
    ui.scorecardCreateForm.addEventListener("submit", submitScorecard);
  }

  if (ui.scorecardsLoadBtn) {
    ui.scorecardsLoadBtn.addEventListener("click", loadScorecards);
  }

  if (ui.scorecardList) {
    ui.scorecardList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-scorecard-action]");
      if (!button) return;

      const action = String(button.dataset.scorecardAction || "").trim();
      const scorecardId = String(button.dataset.scorecardId || "").trim();
      if (action === "finalize") {
        finalizeScorecard(scorecardId);
      }
    });
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

/* INIT */
async function initInterviewerDashboard() {
  if (!ui.navLinks.length || !ui.sections.length) return;

  bindNavigation();
  bindActions();

  const sessionReady = await loadAuthProfile();
  if (!sessionReady) return;

  await openDashboard();
}

document.addEventListener("DOMContentLoaded", () => {
  initInterviewerDashboard();
});

window.interviewerApi = {
  config: INTERVIEWER_CONFIG,
  ...interviewerApi,
  openDashboard,
  openInterviews,
  openScorecards,
  openProfile,
  loadInterviews,
  loadScorecards,
  performLogout
};
