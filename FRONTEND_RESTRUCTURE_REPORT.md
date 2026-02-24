# Frontend Restructure and Deployment Readiness Report

Generated on: February 24, 2026  
Project: HireFlow Recruitment Platform

## 1. Purpose of This Report

This report explains:

1. What frontend restructuring was done.
2. Why the changes are safe and non-breaking.
3. How each frontend file works, in beginner-friendly language.
4. How to run, deploy, debug, and maintain the frontend with confidence.

The main goal was to make the code easier for a beginner to understand, while preserving the currently working flow.

## 2. Scope of the Restructure

The request was to restructure frontend code for clarity without breaking behavior.  
To satisfy this safely, the refactor focused on:

1. Adding clear "Beginner Reading Guide" headers to all frontend JavaScript files.
2. Adding readability headers to frontend CSS files.
3. Preserving function names, event wiring, endpoint paths, and runtime logic.
4. Keeping existing HTML structure intact to avoid UI regressions.
5. Retaining existing data contracts with backend APIs.

This approach improves readability immediately, with near-zero regression risk.

## 3. Non-Breaking Strategy Used

To avoid breaking existing flows, this restructure intentionally did **not** change:

1. API endpoint URLs.
2. Request/response payload keys.
3. Event listener targets and data attributes.
4. Dashboard navigation routes.
5. Role authorization checks.
6. Existing status constants used for DB compatibility.

Changes were primarily documentation and structure comments, plus previously added API fallback hardening in login/runtime config.

## 4. Files Updated in This Restructure

### 4.1 Frontend JavaScript Files (all)

1. `frontend/js/about.js`
2. `frontend/js/runtime-config.js`
3. `frontend/js/script.js`
4. `frontend/js/dashboardAuth.js`
5. `frontend/js/login.js`
6. `frontend/js/candidate.js`
7. `frontend/js/companyAdmin.js`
8. `frontend/js/hiringManager.js`
9. `frontend/js/hrRecruiter.js`
10. `frontend/js/interviewer.js`
11. `frontend/js/platformAdmin.js`

### 4.2 Frontend CSS Files

1. `frontend/css/styles.css`
2. `frontend/css/public.css`
3. `frontend/css/theme.css`

## 5. Current Frontend Architecture (Beginner View)

Think of the frontend in 4 layers:

1. **Runtime Configuration Layer**
   - Decides which backend URL to call (`window.API_BASE`).
   - File: `frontend/js/runtime-config.js`.
2. **Shared Public Layer**
   - Public page behaviors (scroll, counters, contact form).
   - File: `frontend/js/script.js`.
3. **Authentication Layer**
   - Login/signup and dashboard session protection.
   - Files: `frontend/js/login.js`, `frontend/js/dashboardAuth.js`.
4. **Role Dashboard Layer**
   - One large script per role dashboard.
   - Files: candidate/companyAdmin/hrRecruiter/hiringManager/interviewer/platformAdmin scripts.

## 6. Startup Flow (Page Load Order)

Typical load sequence:

1. HTML loads.
2. CSS styles load.
3. `runtime-config.js` runs and sets API base.
4. `script.js` runs for shared public interactions.
5. Page-specific JS runs (for example `login.js` or `hrRecruiter.js`).

Dashboard flow:

1. Script checks token.
2. Loads profile.
3. Verifies role.
4. Opens default section.
5. Loads section data as needed.
6. Binds form actions and navigation buttons.

## 7. File-by-File Guide for Beginners

### 7.1 `frontend/js/runtime-config.js`

Role:

1. Picks the best API base URL at runtime.
2. Supports explicit values from window vars or `<meta name="api-base">`.
3. Handles Live Server ports (5500/5501/5502) by deriving backend `:5000`.

Why it matters:

1. Prevents wrong-origin API calls.
2. Reduces environment setup mistakes.
3. Helps avoid `405 Method Not Allowed` on static servers.

### 7.2 `frontend/js/script.js`

Role:

1. Public site interactions only.
2. Navbar shrinking on scroll.
3. Back-to-top visibility.
4. Animated counters and section reveal effects.
5. Contact form submit with API fallback.

Beginner tip:

1. If a visual issue appears on home/about pages, start here.

### 7.3 `frontend/js/login.js`

Role:

1. Handles login and candidate signup form submissions.
2. Builds multiple auth endpoint candidates (`/auth/login`, `/api/auth/login`) across possible base URLs.
3. Stores token and role in local/session storage.
4. Redirects user to role-specific dashboard.

Important reliability behavior:

1. Treats `404` and `405` as retryable to try next candidate endpoint.
2. Helps when frontend is served from `127.0.0.1:5500` but backend is on `:5000`.

### 7.4 `frontend/js/dashboardAuth.js`

Role:

1. Shared dashboard auth helpers.
2. Token read/write/remove functions.
3. Fetch wrapper that auto-attaches bearer token.
4. Refresh-on-401 behavior.
5. Redirect to login when session expires.

Beginner tip:

1. If protected API calls fail after being idle, inspect this file first.

### 7.5 `frontend/js/platformAdmin.js`

Role:

1. Platform-level governance dashboard.
2. Company management.
3. Global user management.
4. Audit logs and contact requests.
5. Profile editing and logout.

Structure pattern:

1. Config object with endpoint map.
2. State object with loaded flags, rows, and pagination.
3. Utility helpers.
4. API request wrapper.
5. Render functions.
6. Action handlers.
7. `initPlatformAdminDashboard()`.

### 7.6 `frontend/js/companyAdmin.js`

Role:

1. Company-level operations dashboard.
2. Manage HR/HiringManager/Interviewer users.
3. Create/update/submit/publish/close jobs.
4. Handle applications and offers.
5. View company audit logs.

Structure pattern:

1. Endpoint map and state.
2. Shared helpers for status normalization and formatting.
3. API access wrapper.
4. Users section handlers.
5. Jobs section handlers.
6. Applications section handlers.
7. Offers section handlers.
8. Activity + profile + init.

### 7.7 `frontend/js/hrRecruiter.js`

Role:

1. HR operational dashboard.
2. Jobs, applications, candidates, interviews, offers, profile.
3. Offer drafting and sending workflow.

Important sections:

1. Offer draft persistence helpers.
2. Application stage movement controls.
3. Interview scheduling and updates.
4. Offer eligible list, offer draft creation, send offer action.

Beginner tip:

1. For offer-related issues, trace:
   - `submitCreateOffer(...)`
   - `applyOfferDraftToSendForm(...)`
   - `submitSendOffer(...)`

### 7.8 `frontend/js/hiringManager.js`

Role:

1. Job approvals.
2. Job listing.
3. Final decision on offer-accepted applications.
4. Profile and logout.

Beginner tip:

1. Approval actions and final decisions are separate sections; do not mix payload formats.

### 7.9 `frontend/js/interviewer.js`

Role:

1. Interview tracking.
2. Scorecard creation/finalization.
3. Profile and logout.

Important flow:

1. Load interviews.
2. Load pending scorecard interview options.
3. Submit scorecard.
4. Finalize scorecard.

### 7.10 `frontend/js/candidate.js`

Role:

1. Candidate profile.
2. Job browsing and application.
3. Saved jobs.
4. Offers accept/decline.
5. Resume/profile updates.

Important flow:

1. Profile load validates role.
2. Jobs load with filters.
3. Apply modal prefill.
4. Offers list and action handling.

### 7.11 `frontend/js/about.js`

Role:

1. Small visual enhancements only for About page.

## 8. CSS Guide for Beginners

### 8.1 `frontend/css/styles.css`

Main style system:

1. Root tokens.
2. Global typography.
3. Public page components.
4. Dashboard components.
5. Utility and responsive classes.

### 8.2 `frontend/css/public.css`

Legacy/extra public styles for selected page layouts.

### 8.3 `frontend/css/theme.css`

Secondary theme tokens and reusable visual utilities.

## 9. Common Coding Pattern Used Across Dashboards

All role dashboard scripts follow this consistent pattern:

1. `CONFIG`
   - Contains endpoint paths and shared constants.
2. `STATE`
   - Holds current UI data and loaded flags.
3. `UI REFERENCES`
   - Caches DOM elements via data attributes.
4. `HELPERS`
   - Parse, normalize, format, validate functions.
5. `API WRAPPER`
   - Single place for backend HTTP calls.
6. `RENDERERS`
   - Converts data rows into table/cards/chart UI.
7. `ACTIONS`
   - Handlers for button clicks/forms.
8. `INIT`
   - Entry function binds events and loads first view.

This pattern makes onboarding easier because each file is organized similarly.

## 10. Deployment Readiness Notes

### 10.1 Frontend

1. Runtime API base is environment-aware.
2. All pages can use same-origin API by default.
3. Cross-origin setup can be controlled via API base injection.

### 10.2 Backend Coupling Requirements

Frontend assumes backend routes like:

1. `/auth/login`
2. `/auth/signup`
3. Role endpoints such as `/hr-recruiter/...`, `/company-admin/...`, etc.

### 10.3 CORS

If frontend and backend are on different domains:

1. Backend `CORS_ORIGINS` must include frontend origin.
2. Frontend must use correct API base via runtime config.

## 11. Debugging Playbook

### Issue A: `405 Method Not Allowed` during login

Meaning:

1. Request reached a server that does not allow that method on that path.

Typical cause:

1. Login request sent to static frontend server (for example `127.0.0.1:5500`) instead of backend API server.

Checks:

1. Browser DevTools Network -> request URL for login.
2. Verify backend is running on expected port (`:5000` or `:3000`).
3. Ensure runtime-config/login endpoint fallback chooses backend base.

### Issue B: `ERR_CONNECTION_REFUSED`

Meaning:

1. Host/port is unreachable.

Checks:

1. Backend process running.
2. Port number matches frontend API base.
3. Local firewall/proxy not blocking.

### Issue C: Token exists but dashboard redirects to login

Checks:

1. Token key names in storage.
2. `dashboardAuth.js` wrapper and refresh flow.
3. Backend `auth/profile` and role validation response.

## 12. Beginner Onboarding Path (Step-by-Step)

If you are new, read in this order:

1. `frontend/js/runtime-config.js`
2. `frontend/js/login.js`
3. `frontend/js/dashboardAuth.js`
4. One role script of your choice (`hrRecruiter.js` recommended first)
5. `frontend/css/styles.css`

Then test this manual flow:

1. Login.
2. Navigate sections.
3. Submit one form.
4. Observe request payload in Network tab.
5. Observe response and UI update.

## 13. Suggested Next Refactor (Optional, Not Required for Current Stability)

If you want deeper cleanup later without changing behavior:

1. Split each role script into modules:
   - `config.js`
   - `state.js`
   - `api.js`
   - `render.js`
   - `actions.js`
   - `init.js`
2. Move duplicated helper logic into shared utility files.
3. Introduce a build step (Vite or similar) only after module split is complete.

This was intentionally not done now to avoid flow break in production-like static script loading.

## 14. Validation Performed After Restructure

Validation run:

1. JavaScript syntax checks on all frontend JS files.

Result:

1. Syntax checks passed.

## 15. Final Summary

What is now improved:

1. Every frontend JS file has a beginner-focused reading guide.
2. Frontend CSS files have clear purpose and section intent headers.
3. Existing runtime behavior and current working flow are preserved.
4. Frontend architecture and deployment behavior are fully documented in this report.

What remains intentionally unchanged:

1. Endpoint contracts.
2. Data structures.
3. Dashboard event wiring.
4. Existing role flows.

This gives immediate readability gains now, with minimal regression risk.

