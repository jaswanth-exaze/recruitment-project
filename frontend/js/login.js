/**
 * Login page logic.
 * Handles credential submission, response messaging, and role-based redirect.
 */



// Authenticates the user and routes them to the correct dashboard.
async function login() {



    const event = window.event;
    if (event) event.preventDefault();

    // 2. Select the values using the classes provided in your HTML
    // We target the input inside the .email and .password divs
    const emailInput = document.querySelector('.input-group.email input');
    const passwordInput = document.querySelector('.input-group.password input');

    const email = emailInput.value;
    const password = passwordInput.value;
  // Read input values from login form.

  
  // Send credentials to backend auth endpoint.
  const res = await fetch("auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  // Parse backend response (success payload or error payload).
  const data = await res.json().catch(() => ({}));

  // If login failed, show backend message and stop.
//   if (!res.ok) {
//     msg.style.color = "red";
//     msg.innerText = data.message || "Login failed. Please try again.";
//     return;
//   }

  // Save auth session data for protected pages.
  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role);
  localStorage.removeItem("sessionExpiredMessage");

  // Redirect based on role returned by backend.
  if (data.role === "Candidate")
    window.location.href = "./dashboards/candidate.html";
  else if (data.role === "PlatformAdmin")
    window.location.href = "./dashboards/platformAdmin.html";
  else if (data.role === "CompanyAdmin")
    window.location.href = "./dashboards/companyAdmin.html";   
    else if (data.role === "HR")
      window.location.href = "./dashboards/hr.html";
    else if (data.role === "HiringManager")
      window.location.href = "./dashboards/hrManager.html";
    else
    window.location.href = "./dashboards/interviewer.html";
}

// Shows a one-time message when a previous session expired.
(function showSessionExpiredMessage() {
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
});




