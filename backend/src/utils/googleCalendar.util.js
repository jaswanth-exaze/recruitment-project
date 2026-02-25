const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeCalendarDateTime(value) {
  const raw = cleanText(value).replace(" ", "T");
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  return "";
}

function parseDateTimeInput(value) {
  const raw = normalizeCalendarDateTime(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatLocalDateTime(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) return "";
  const yyyy = safeDate.getFullYear();
  const mm = String(safeDate.getMonth() + 1).padStart(2, "0");
  const dd = String(safeDate.getDate()).padStart(2, "0");
  const hh = String(safeDate.getHours()).padStart(2, "0");
  const min = String(safeDate.getMinutes()).padStart(2, "0");
  const sec = String(safeDate.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}`;
}

function ensureConfigured() {
  const clientEmail = cleanText(process.env.GOOGLE_CALENDAR_CLIENT_EMAIL);
  const privateKey = cleanText(process.env.GOOGLE_CALENDAR_PRIVATE_KEY).replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google Calendar integration is not configured. Set GOOGLE_CALENDAR_CLIENT_EMAIL and GOOGLE_CALENDAR_PRIVATE_KEY.",
    );
  }
  return { clientEmail, privateKey };
}

function buildAuthClient({ organizerEmail }) {
  const { clientEmail, privateKey } = ensureConfigured();
  const configuredSubject = cleanText(process.env.GOOGLE_CALENDAR_IMPERSONATE_USER);
  const subject = configuredSubject || cleanText(organizerEmail);
  return new google.auth.JWT(clientEmail, null, privateKey, [GOOGLE_CALENDAR_SCOPE], subject || undefined);
}

function buildAttendees({ candidateEmail, interviewerEmail }) {
  const attendees = [];
  const seen = new Set();
  const add = (email) => {
    const normalized = cleanText(email).toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    attendees.push({ email: normalized });
    seen.add(normalized);
  };
  add(candidateEmail);
  add(interviewerEmail);
  return attendees;
}

exports.createInterviewGoogleMeet = async ({
  organizerEmail,
  candidateEmail,
  interviewerEmail,
  scheduledAt,
  durationMinutes,
  jobTitle,
  companyName,
  applicationId,
  notes,
}) => {
  const startDateTime = normalizeCalendarDateTime(scheduledAt);
  if (!startDateTime) {
    throw new Error("scheduled_at must be a valid date or datetime");
  }
  const startDate = parseDateTimeInput(startDateTime);
  if (!startDate) {
    throw new Error("scheduled_at must be a valid date or datetime");
  }

  const safeDuration = Number.isInteger(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60;
  const endDate = new Date(startDate.getTime() + safeDuration * 60 * 1000);
  const endDateTime = formatLocalDateTime(endDate);
  const timezone = cleanText(process.env.GOOGLE_CALENDAR_TIMEZONE) || "Asia/Kolkata";
  const calendarId = cleanText(process.env.GOOGLE_CALENDAR_ID) || "primary";
  const requiredCandidateEmail = cleanText(candidateEmail);
  const requiredInterviewerEmail = cleanText(interviewerEmail);
  if (!requiredCandidateEmail || !requiredInterviewerEmail) {
    throw new Error("candidate and interviewer emails are required for Google Calendar invites");
  }

  const auth = buildAuthClient({ organizerEmail });
  const calendar = google.calendar({ version: "v3", auth });

  const summaryCompany = cleanText(companyName) || "HireFlow";
  const summaryJob = cleanText(jobTitle) || "Interview";
  const summary = `Interview: ${summaryJob} | ${summaryCompany}`;
  const descriptionLines = [
    `Application ID: ${cleanText(applicationId) || "N/A"}`,
    cleanText(notes) ? `Notes: ${cleanText(notes)}` : "",
  ].filter(Boolean);

  const requestBody = {
    summary,
    description: descriptionLines.join("\n"),
    start: {
      dateTime: startDateTime,
      timeZone: timezone,
    },
    end: {
      dateTime: endDateTime,
      timeZone: timezone,
    },
    attendees: buildAttendees({ candidateEmail: requiredCandidateEmail, interviewerEmail: requiredInterviewerEmail }),
    conferenceData: {
      createRequest: {
        requestId: uuidv4(),
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    },
  };

  const response = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody,
  });

  const event = response?.data || {};
  const videoEntry = Array.isArray(event?.conferenceData?.entryPoints)
    ? event.conferenceData.entryPoints.find((entry) => entry?.entryPointType === "video" && cleanText(entry?.uri))
    : null;
  const meetingLink = cleanText(event.hangoutLink) || cleanText(videoEntry?.uri);

  if (!meetingLink) {
    throw new Error("Google Calendar event created but meeting link was not returned");
  }

  return {
    meetingLink,
    eventId: cleanText(event.id),
    eventHtmlLink: cleanText(event.htmlLink),
  };
};
