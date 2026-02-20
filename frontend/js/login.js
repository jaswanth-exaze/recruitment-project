/**
 * Login page logic.
 * Handles credential submission, response messaging, and role-based redirect.
 */

const API_BASE = window.location.origin.includes("localhost:3000")
  ? window.location.origin
  : "http://localhost:3000";

// Authenticates the user and routes them to the correct dashboard.
async function login(event) {
  event.preventDefault();

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const msg = document.getElementById("loginMsg");

  const email = emailInput?.value?.trim();
  const password = passwordInput?.value || "";

  // Send credentials to backend auth endpoint.
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  // Parse backend response (success payload or error payload).
  const data = await res.json().catch(() => ({}));

  // If login failed, show backend message and stop.
  if (!res.ok) {
    if (msg) {
      msg.style.color = "red";
      msg.innerText = data.message || "Login failed. Please try again.";
    }
    return;
  }

  // Save auth session data for protected pages.
  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role);
  localStorage.removeItem("sessionExpiredMessage");
  if (msg) msg.innerText = "";
  console.log("Login successful, token and role saved to localStorage.", data);
  // Redirect based on role returned by backend.
  if (data.role === "Candidate")
    window.location.href = "./dashboards/candidate.html";
  else if (data.role === "PlatformAdmin")
    window.location.href = "./dashboards/platformAdmin.html";
  else if (data.role === "CompanyAdmin")
    window.location.href = "./dashboards/companyAdmin.html";
  else if (data.role === "HR") window.location.href = "./dashboards/hr.html";
  else if (data.role === "HiringManager")
    window.location.href = "./dashboards/hrManager.html";
  else window.location.href = "./dashboards/interviewer.html";
}

// Shows a one-time message when a previous session expired.
function showSessionExpiredMessage() {
  // Read message written by auth interceptor before redirect.
  const msgText = localStorage.getItem("sessionExpiredMessage");
  if (!msgText) return;

  const msg = document.getElementById("loginMsg");
  if (msg) {
    msg.style.color = "#b45309";
    msg.innerText = msgText;
  }

  // Remove it so it does not show again on next refresh.
  localStorage.removeItem("sessionExpiredMessage");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (form) {
    form.addEventListener("submit", login);
  }
  showSessionExpiredMessage();
});
