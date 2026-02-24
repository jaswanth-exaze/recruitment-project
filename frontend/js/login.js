/**
 * Login + signup page script.
 *
 * Beginner Reading Guide:
 * 1) Detect whether current page has login form and/or signup form.
 * 2) Build candidate backend endpoints with safe fallback ordering.
 * 3) Submit credentials and parse API response.
 * 4) Save token/role in storage and redirect to role dashboard.
 * 5) Show clear status messages for loading/success/error.
 */
(function initLogin() {
  // 1) Collect all elements first.
  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginButton = document.getElementById("loginButton");
  const loginMsg = document.getElementById("loginMsg");

  const signupForm = document.getElementById("signupForm");
  const signupFirstName = document.getElementById("signupFirstName");
  const signupLastName = document.getElementById("signupLastName");
  const signupEmail = document.getElementById("signupEmail");
  const signupPassword = document.getElementById("signupPassword");
  const signupPhone = document.getElementById("signupPhone");
  const signupAddress = document.getElementById("signupAddress");
  const signupButton = document.getElementById("signupButton");
  const signupMsg = document.getElementById("signupMsg");

  const SESSION_EXPIRED_KEY = "sessionExpiredMessage";

  const hasLoginForm = Boolean(
    loginForm && emailInput && passwordInput && loginButton && loginMsg,
  );
  const hasSignupForm = Boolean(
    signupForm &&
    signupFirstName &&
    signupLastName &&
    signupEmail &&
    signupPassword &&
    signupButton &&
    signupMsg,
  );
  if (!hasLoginForm && !hasSignupForm) return;

  // 2) Build API endpoints.
  function buildApiBaseCandidates() {
    const candidates = [];
    const add = (value) => {
      const normalized = String(value || "").trim().replace(/\/+$/, "");
      if (!normalized || candidates.includes(normalized)) return;
      candidates.push(normalized);
    };

    add(window.AUTH_API_BASE);
    add(window.API_BASE);
    add(window.API_BASE_URL);
    add(window.PUBLIC_API_BASE);

    const locationOrigin = String(window.location?.origin || "").trim();
    add(locationOrigin);

    // Common local backend ports when frontend runs from Live Server (e.g. 5500).
    try {
      const parsed = new URL(locationOrigin);
      add(`${parsed.protocol}//${parsed.hostname}:5000`);
      add(`${parsed.protocol}//${parsed.hostname}:3000`);
    } catch (error) {
      // Ignore URL parse issues and keep static fallbacks below.
    }

    add("http://localhost:5000");
    add("http://127.0.0.1:5000");
    add("http://localhost:3000");
    add("http://127.0.0.1:3000");

    return candidates;
  }

  function buildAuthEndpoints(path) {
    const endpoints = [];
    const addEndpoint = (url) => {
      if (!endpoints.includes(url)) endpoints.push(url);
    };

    const baseCandidates = buildApiBaseCandidates();
    for (let i = 0; i < baseCandidates.length; i += 1) {
      const baseUrl = baseCandidates[i];
      addEndpoint(`${baseUrl}${path}`);

      if (baseUrl.endsWith("/api")) {
        addEndpoint(`${baseUrl.replace(/\/api$/, "")}${path}`);
      } else {
        addEndpoint(`${baseUrl}/api${path}`);
      }
    }

    return endpoints;
  }

  const LOGIN_ENDPOINTS = buildAuthEndpoints("/auth/login");
  const SIGNUP_ENDPOINTS = buildAuthEndpoints("/auth/signup");

  // 3) Small UI helpers.
  function setMessage(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.classList.remove("text-secondary", "text-danger", "text-success");
    if (type === "error") return element.classList.add("text-danger");
    if (type === "success") return element.classList.add("text-success");
    element.classList.add("text-secondary");
  }

  function showStoredSessionMessage() {
    const message = String(
      localStorage.getItem(SESSION_EXPIRED_KEY) || "",
    ).trim();
    if (!message) return;
    setMessage(loginMsg, message, "error");
    localStorage.removeItem(SESSION_EXPIRED_KEY);
  }

  function setLoginLoading(isLoading) {
    if (!loginButton) return;
    loginButton.disabled = isLoading;
    loginButton.textContent = isLoading ? "Signing In..." : "Sign In";
  }

  function setSignupLoading(isLoading) {
    if (!signupButton) return;
    signupButton.disabled = isLoading;
    signupButton.textContent = isLoading
      ? "Creating..."
      : "Create Candidate Account";
  }

  // 4) Auth/session helpers.
  function normalizeRole(role) {
    return String(role || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  }

  function getRedirectPathByRole(role) {
    const normalized = normalizeRole(role);
    if (normalized === "platformadmin")
      return "../dashboards/platformAdmin.html";
    if (normalized === "companyadmin") return "../dashboards/companyAdmin.html";
    if (
      normalized === "hr" ||
      normalized === "hrrecruiter" ||
      normalized === "hrmanager"
    ) {
      return "../dashboards/hrRecruiter.html";
    }
    if (normalized === "hiringmanager")
      return "../dashboards/hiringManager.html";
    if (normalized === "interviewer") return "../dashboards/interviewer.html";
    if (normalized === "candidate") return "../dashboards/candidate.html";
    return "index.html";
  }

  function persistAuth(token, role) {
    const safeToken = String(token || "");
    const safeRole = String(role || "");
    const keys = ["token", "accessToken", "authToken", "jwtToken"];
    keys.forEach((key) => localStorage.setItem(key, safeToken));
    localStorage.setItem("userRole", safeRole);
    sessionStorage.setItem("token", safeToken);
    sessionStorage.setItem("userRole", safeRole);
  }

  // 5) Network helpers.
  async function parseResponse(response, fallbackLabel) {
    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }
    if (!response.ok) {
      const message =
        data?.message || `${fallbackLabel} failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data || {};
  }

  async function requestWithFallback(endpoints, payload, label) {
    let lastError = new Error(`Unable to reach ${label} endpoint`);
    const retryableStatus = new Set([404, 405]);

    for (let i = 0; i < endpoints.length; i += 1) {
      const endpoint = endpoints[i];
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (retryableStatus.has(response.status)) {
          lastError = new Error(
            `${label} endpoint not available at ${endpoint} (${response.status})`,
          );
          continue;
        }

        return await parseResponse(response, label);
      } catch (error) {
        lastError = error;
        if (
          Number(error?.status || 0) &&
          !retryableStatus.has(Number(error.status))
        ) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  // 6) Event handlers.
  if (hasLoginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        setMessage(loginMsg, "Email and password are required.", "error");
        return;
      }

      setLoginLoading(true);
      setMessage(loginMsg, "Authenticating...", "info");

      try {
        const result = await requestWithFallback(
          LOGIN_ENDPOINTS,
          { email, password },
          "Login",
        );
        const token = result.token;
        const role = result.role;
        if (!token) throw new Error("Token missing in login response");
        persistAuth(token, role);
        setMessage(
          loginMsg,
          result.message || "Login successful. Redirecting...",
          "success",
        );
        const redirectPath = getRedirectPathByRole(role);
        window.setTimeout(() => {
          window.location.href = redirectPath;
        }, 350);
      } catch (error) {
        console.error("Login error:", error);
        setMessage(
          loginMsg,
          error.message || "Unable to login. Please try again.",
          "error",
        );
      } finally {
        setLoginLoading(false);
      }
    });
  }

  if (hasSignupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const firstName = signupFirstName.value.trim();
      const lastName = signupLastName.value.trim();
      const email = signupEmail.value.trim();
      const password = signupPassword.value;
      const phone = String(signupPhone?.value || "").trim();
      const address = String(signupAddress?.value || "").trim();

      if (!firstName || !lastName || !email || !password) {
        setMessage(
          signupMsg,
          "first_name, last_name, email, and password are required.",
          "error",
        );
        return;
      }
      if (password.length < 8) {
        setMessage(
          signupMsg,
          "Password must be at least 8 characters.",
          "error",
        );
        return;
      }

      setSignupLoading(true);
      setMessage(signupMsg, "Creating candidate account...", "info");

      try {
        const result = await requestWithFallback(SIGNUP_ENDPOINTS, {
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          phone: phone || undefined,
          address: address || undefined,
        });

        const token = result.token;
        const role = result.role || "Candidate";
        if (!token) throw new Error("Token missing in signup response");

        persistAuth(token, role);
        setMessage(
          signupMsg,
          result.message || "Signup successful. Redirecting...",
          "success",
        );
        window.setTimeout(() => {
          window.location.href = getRedirectPathByRole(role);
        }, 350);
      } catch (error) {
        console.error("Signup error:", error);
        setMessage(
          signupMsg,
          error.message || "Unable to signup. Please try again.",
          "error",
        );
      } finally {
        setSignupLoading(false);
      }
    });
  }

  if (hasLoginForm) {
    showStoredSessionMessage();
  }
})();
