import { apiRequest } from "./api.js";
import { getDashboardPathByRole } from "./config.js";
import { setAuthState } from "./auth.js";

const form = document.getElementById("loginForm");
const messageEl = document.getElementById("loginMsg");

function setMessage(message, type = "error") {
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.className = `notice ${type}`;
}

function loadSessionMessage() {
  const expired = localStorage.getItem("sessionExpiredMessage");
  if (expired) {
    setMessage(expired, "error");
    localStorage.removeItem("sessionExpiredMessage");
  }
}

async function onLogin(event) {
  event.preventDefault();
  const email = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value || "";

  try {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    });

    setAuthState(result.token, result.role);
    setMessage("Login successful. Redirecting...", "success");
    window.location.href = getDashboardPathByRole(result.role);
  } catch (err) {
    setMessage(err.message || "Login failed", "error");
  }
}

if (form) {
  form.addEventListener("submit", onLogin);
}

loadSessionMessage();
