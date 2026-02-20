/**
 * Frontend auth helpers.
 * Basic token/session handling with simple refresh-on-401 behavior.
 */

const SESSION_EXPIRED_KEY = "sessionExpiredMessage";
let alreadyRedirected = false;

const API_BASE_URL = String(
  window.AUTH_API_BASE || window.API_BASE || window.API_BASE_URL || "http://localhost:3000",
).replace(/\/+$/, "");

const LOGIN_PATH = "../public/login.html";
const TOKEN_KEYS = ["token", "accessToken", "authToken", "jwtToken"];

function getApiUrl(path) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `${API_BASE_URL}/${cleanPath}`;
}

// Returns the JWT saved after login.
function getToken() {
  for (let i = 0; i < TOKEN_KEYS.length; i += 1) {
    const key = TOKEN_KEYS[i];
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;
  }
  return "";
}

function setToken(token) {
  const safeToken = String(token || "");
  TOKEN_KEYS.forEach((key) => {
    localStorage.setItem(key, safeToken);
    sessionStorage.setItem(key, safeToken);
  });
}

// Saves one-time message shown on login page after redirect.
function saveSessionMessage(message) {
  if (message) {
    localStorage.setItem(SESSION_EXPIRED_KEY, message);
  }
}

// Clears any previously stored session-expiry message.
function clearSessionExpiredMessage() {
  localStorage.removeItem(SESSION_EXPIRED_KEY);
}

// Removes client-side auth state.
function clearAuthState() {
  TOKEN_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  localStorage.removeItem("role");
  localStorage.removeItem("userRole");
  sessionStorage.removeItem("role");
  sessionStorage.removeItem("userRole");
}

// Clears auth state and sends user to login page.
function redirectToLogin(message) {
  if (alreadyRedirected) return;
  alreadyRedirected = true;

  saveSessionMessage(message || "Login session expired. Please log in again.");
  clearAuthState();
  window.location.href = LOGIN_PATH;
}

// Checks if URL is an auth endpoint where we should not attach bearer token.
function isAuthEndpoint(url) {
  return (
    url.includes("/auth/login")
    || url.includes("/auth/refresh")
    || url.includes("/auth/logout")
  );
}

// Checks if request is for backend API.
function isApiRequest(url) {
  return typeof url === "string" && (
    url.startsWith(API_BASE_URL)
    || url.startsWith(`${API_BASE_URL}/api`)
  );
}

// Adds credentials and optional bearer token to request options.
function buildRequestOptions(init, addBearerToken) {
  const options = { ...(init || {}), credentials: "include" };
  const headers = new Headers(options.headers || {});

  if (addBearerToken) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } else {
    headers.delete("Authorization");
  }

  options.headers = headers;
  return options;
}

// Reads backend message from error response, if available.
async function getErrorMessage(res) {
  try {
    const data = await res.clone().json();
    if (data && data.message) return data.message;
  } catch (err) {
    // Ignore parse failure and use default message.
  }

  return "Login session expired. Please log in again.";
}

// Installs one global fetch wrapper:
// - attaches credentials + bearer token
// - if 401 happens, tries refresh once and retries original request
function installAuthWrapper() {
  if (window.__authInterceptorInstalled) return;
  window.__authInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === "string" ? input : input.url;
    const apiCall = isApiRequest(requestUrl);
    const authCall = isAuthEndpoint(requestUrl || "");

    const requestOptions = apiCall
      ? buildRequestOptions(init, !authCall)
      : init;

    let response = await originalFetch(input, requestOptions);

    if (!apiCall || response.status !== 401 || authCall) {
      return response;
    }

    // Try to refresh access token using refresh-token cookie.
    const refreshOptions = buildRequestOptions(
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
      true,
    );

    const refreshRes = await originalFetch(getApiUrl("auth/refresh"), refreshOptions)
      .catch(() => null);

    if (refreshRes && refreshRes.ok) {
      const refreshData = await refreshRes.json().catch(() => null);
      if (refreshData && refreshData.token) {
        setToken(refreshData.token);
        if (refreshData.role) {
          localStorage.setItem("role", refreshData.role);
          localStorage.setItem("userRole", refreshData.role);
          sessionStorage.setItem("role", refreshData.role);
          sessionStorage.setItem("userRole", refreshData.role);
        }

        const retryOptions = buildRequestOptions(init, true);
        response = await originalFetch(input, retryOptions);
        return response;
      }
    }

    const message = await getErrorMessage(response);
    redirectToLogin(message);
    return response;
  };
}

// Enable wrapper as soon as this script loads.
installAuthWrapper();

// Protects dashboard pages by validating token presence and expected role.
function protectPage(role) {
  const token = getToken();
  const userRole = localStorage.getItem("role") || localStorage.getItem("userRole");

  if (!token || (role && userRole !== role)) {
    clearSessionExpiredMessage();
    clearAuthState();
    window.location.href = LOGIN_PATH;
  }
}

// Performs a full client-side logout and redirects to login.
async function logout() {
  try {
    const options = buildRequestOptions(
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
      false,
    );
    await fetch(getApiUrl("auth/logout"), options);
  } catch (err) {
    // Ignore backend logout failures and proceed with local cleanup.
  }

  clearSessionExpiredMessage();
  clearAuthState();
  window.location.href = LOGIN_PATH;
}

function bindDashboardAuthNav() {
  const logoutNav = document.querySelector('[data-auth-nav="logout"]');
  if (logoutNav) {
    logoutNav.addEventListener("click", async (event) => {
      event.preventDefault();
      if (!window.confirm("Do you want to logout?")) return;
      await logout();
    });
  }

  const profileNav = document.querySelector('[data-auth-nav="profile"]');
  if (profileNav) {
    profileNav.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        const res = await fetch(getApiUrl("auth/profile"), buildRequestOptions({}, true));
        if (!res.ok) {
          const message = await getErrorMessage(res);
          throw new Error(message);
        }
        const payload = await res.json().catch(() => null);
        const profile = payload?.profile || payload || {};
        const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "N/A";
        window.alert(
          `Name: ${name}\nEmail: ${profile.email || "N/A"}\nRole: ${profile.role || "N/A"}`,
        );
      } catch (error) {
        window.alert(error.message || "Unable to load profile.");
      }
    });
  }
}

bindDashboardAuthNav();

window.dashboardAuth = {
  getApiUrl,
  getToken,
  protectPage,
  logout,
  clearSessionExpiredMessage,
};
