# HireFlow Recruitment Platform

## Overview
HireFlow is a multi-role recruitment platform with dashboards for:
- Platform Admin
- Company Admin
- HR Recruiter
- Hiring Manager
- Interviewer
- Candidate

The backend is a Node.js/Express API with MySQL.  
The frontend is static HTML/CSS/JS and can be served by the backend or deployed separately.

## Project Structure
- `backend/` API server, services, email and PDF utilities
- `frontend/` static UI pages and dashboard scripts
- `database design/` schema and migration SQL files

## Local Setup
1. Install dependencies:
   - `cd backend`
   - `npm install`
2. Configure environment:
   - Copy `backend/.env.example` to `backend/.env`
   - Set DB, JWT, SMTP, and URL values
3. Prepare database:
   - Run `database design/database.sql`
   - Run migration files from `database design/migrations/`
4. Run backend:
   - `npm start`
5. Open app:
   - `http://localhost:3000/frontend/public/login.html`

## Deployment Readiness

### Backend
- `backend/src/server.js` reads `PORT` and `HOST` from environment.
- `backend/src/app.js` uses `CORS_ORIGINS` (comma-separated) for production-safe CORS.
- Health check endpoint: `GET /health`
- Generated offer letters are served from: `/generated/offer-letters/...`

Required backend env variables are documented in `backend/.env.example`.

### Frontend
- Runtime API configuration is centralized in:
  - `frontend/js/runtime-config.js`
- All public and dashboard pages now load `runtime-config.js` before app scripts.
- Default behavior uses same-origin API (`window.location.origin`).
- If frontend and backend are on different domains, set API base through:
  - `window.API_BASE` before loading app scripts, or
  - `<meta name="api-base" content="https://your-backend-domain">`

## Production Notes
- Do not commit real secrets in `.env`.
- Ensure `PUBLIC_BASE_URL` points to your backend domain so generated offer letter URLs are correct.
- Set `FRONTEND_LOGIN_URL` to the deployed login page for email CTA links.
- Configure `CORS_ORIGINS` to your deployed frontend origins.

## Useful Commands
- Backend (dev watch): `npm run dev`
- Backend (start): `npm start`
