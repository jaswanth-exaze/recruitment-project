const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const GENERATED_DIR = path.resolve(__dirname, "../../generated/offer-letters");
const GENERATED_ROUTE_PREFIX = "/generated/offer-letters";
const PAGE_MARGIN = 56;

const THEME = {
  text: "#161616",
  muted: "#505050",
  line: "#1f1f1f",
};

const DEFAULT_CONDITIONS = [
  "This offer is contingent upon satisfactory background verification and reference checks.",
  "You will be required to comply with company policies, confidentiality, and code of conduct requirements.",
  "This offer remains valid for acceptance as per the timeline communicated by the Talent Acquisition team.",
];

const PRIMARY_DETAIL_KEYS = new Set([
  "joining_date",
  "offered_ctc",
  "bonus",
  "probation_months",
  "work_location",
  "offer_notes",
  "benefits",
  "conditions",
  "employment_contingencies",
  "salary_payment_frequency",
  "salary_payment_method",
  "first_pay_period",
  "offer_expiration_date",
  "accept_by",
  "reporting_to",
  "manager_name",
  "job_duties",
  "responsibilities",
  "role_summary",
]);

function sanitizeForFileName(value) {
  return String(value || "company")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function toText(value, fallback = "Not specified") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
}

function optionalText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text || "";
}

function formatDate(value) {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toText(value);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function ensureSpace(doc, requiredHeight = 80) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + requiredHeight > bottom) {
    doc.addPage();
  }
}

function formatKeyLabel(key) {
  return String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatAdditionalDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  return Object.entries(details)
    .filter(([key, value]) => !PRIMARY_DETAIL_KEYS.has(key) && value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const textValue = typeof value === "object" ? JSON.stringify(value) : String(value).trim();
      return { label: formatKeyLabel(key), value: textValue || "Not specified" };
    });
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|;|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function drawHorizontalRule(doc, y) {
  const lineY = y !== undefined ? y : doc.y;
  doc.save();
  doc.moveTo(PAGE_MARGIN, lineY)
    .lineTo(doc.page.width - PAGE_MARGIN, lineY)
    .lineWidth(0.9)
    .strokeColor(THEME.line)
    .stroke();
  doc.restore();
}

function drawLetterhead(doc, payload) {
  const companyName = toText(payload.companyName, "Company");
  const companyDomain = optionalText(payload.companyDomain);
  const offerId = toText(payload.offerId);
  const issueDate = formatDate(new Date());

  const topY = PAGE_MARGIN;
  const rightWidth = 228;
  const rightX = doc.page.width - PAGE_MARGIN - rightWidth;

  doc.fillColor(THEME.text).font("Times-Bold").fontSize(18).text(companyName, PAGE_MARGIN, topY, {
    width: doc.page.width - (PAGE_MARGIN * 2) - rightWidth - 12,
  });

  const leftAfterNameY = doc.y;
  if (companyDomain) {
    doc.fillColor(THEME.muted).font("Times-Roman").fontSize(10.5).text(companyDomain, PAGE_MARGIN, leftAfterNameY, {
      width: doc.page.width - (PAGE_MARGIN * 2) - rightWidth - 12,
      lineGap: 2,
    });
  }
  const leftBottomY = doc.y;

  doc.fillColor(THEME.text).font("Times-Bold").fontSize(14).text("EMPLOYMENT OFFER LETTER", rightX, topY, {
    width: rightWidth,
    align: "right",
  });
  doc.fillColor(THEME.text).font("Times-Roman").fontSize(10.5).text(`Date: ${issueDate}`, rightX, topY + 24, {
    width: rightWidth,
    align: "right",
  });
  doc.fillColor(THEME.text).font("Times-Roman").fontSize(10.5).text(`Offer ID: ${offerId}`, rightX, topY + 40, {
    width: rightWidth,
    align: "right",
  });
  const rightBottomY = doc.y;

  const headerBottom = Math.max(leftBottomY, rightBottomY) + 10;
  drawHorizontalRule(doc, headerBottom);
  doc.y = headerBottom + 12;
}

function drawRecipientBlock(doc, payload, offerDetails) {
  const candidateName = toText(payload.candidateName, "Candidate");
  const candidateEmail = toText(payload.candidateEmail);
  const candidateAddress = optionalText(offerDetails.candidate_address || offerDetails.candidate_location);

  ensureSpace(doc, 90);
  doc.fillColor(THEME.text).font("Times-Roman").fontSize(11).text("To,", PAGE_MARGIN, doc.y);
  doc.text(candidateName);
  doc.text(candidateEmail);
  if (candidateAddress) doc.text(candidateAddress);
  doc.moveDown(0.45);

  doc.fillColor(THEME.text).font("Times-Bold").fontSize(11.2).text("Subject: Offer of Employment", PAGE_MARGIN, doc.y, {
    width: doc.page.width - (PAGE_MARGIN * 2),
  });
  doc.moveDown(0.28);
  drawHorizontalRule(doc, doc.y);
  doc.y += 8;
}

function drawParagraph(doc, text) {
  const contentWidth = doc.page.width - (PAGE_MARGIN * 2);
  ensureSpace(doc, 70);
  doc.fillColor(THEME.text).font("Times-Roman").fontSize(11).text(text, PAGE_MARGIN, doc.y, {
    width: contentWidth,
    lineGap: 3,
  });
  doc.moveDown(0.45);
}

function drawSectionHeading(doc, title) {
  const contentWidth = doc.page.width - (PAGE_MARGIN * 2);
  ensureSpace(doc, 42);
  doc.fillColor(THEME.text).font("Times-Bold").fontSize(11.8).text(title, PAGE_MARGIN, doc.y, {
    width: contentWidth,
  });
  drawHorizontalRule(doc, doc.y + 2);
  doc.y += 8;
}

function drawClause(doc, index, label, value) {
  const contentWidth = doc.page.width - (PAGE_MARGIN * 2);
  ensureSpace(doc, 30);
  doc.fillColor(THEME.text).font("Times-Bold").fontSize(11).text(`${index}. ${label}: `, PAGE_MARGIN, doc.y, {
    continued: true,
    width: contentWidth,
  });
  doc.fillColor(THEME.text).font("Times-Roman").fontSize(11).text(value, {
    width: contentWidth,
  });
  doc.moveDown(0.12);
}

function drawBulletList(doc, items) {
  if (!items.length) return;
  const contentWidth = doc.page.width - (PAGE_MARGIN * 2);
  items.forEach((item) => {
    ensureSpace(doc, 24);
    doc.fillColor(THEME.text).font("Times-Roman").fontSize(10.8).text(`- ${item}`, PAGE_MARGIN + 10, doc.y, {
      width: contentWidth - 10,
      lineGap: 2,
    });
    doc.moveDown(0.12);
  });
}

function drawSignatureBlock(doc, payload, offerDetails) {
  const recruiterName = toText(payload.recruiterName, "HR Team");
  const recruiterEmail = toText(payload.recruiterEmail);
  const companyName = toText(payload.companyName, "Company");
  const offerExpiry = formatDate(offerDetails.offer_expiration_date || offerDetails.accept_by);

  ensureSpace(doc, 220);

  drawParagraph(
    doc,
    `If you accept this offer, please complete the acceptance process on or before ${offerExpiry}. `
      + "By accepting, you confirm that you understand and agree to the terms outlined in this offer letter.",
  );

  doc.fillColor(THEME.text).font("Times-Roman").fontSize(11).text("Sincerely,", PAGE_MARGIN, doc.y);
  doc.moveDown(0.35);
  doc.font("Times-Bold").text(recruiterName);
  doc.font("Times-Roman").text(recruiterEmail);
  doc.text(`${companyName} - Talent Acquisition`);
  doc.moveDown(1.0);

  const lineWidth = 214;
  const leftX = PAGE_MARGIN;
  const rightX = doc.page.width - PAGE_MARGIN - lineWidth;
  const lineY = doc.y + 10;

  doc.save();
  doc.moveTo(leftX, lineY).lineTo(leftX + lineWidth, lineY).lineWidth(0.8).strokeColor(THEME.line).stroke();
  doc.moveTo(rightX, lineY).lineTo(rightX + lineWidth, lineY).lineWidth(0.8).strokeColor(THEME.line).stroke();
  doc.restore();

  doc.fillColor(THEME.muted).font("Times-Roman").fontSize(10).text("Authorized Signatory", leftX, lineY + 5, {
    width: lineWidth,
    align: "center",
  });
  doc.text("Candidate Signature", rightX, lineY + 5, {
    width: lineWidth,
    align: "center",
  });

  const dateLineWidth = 110;
  const leftDateX = leftX;
  const rightDateX = rightX;
  const dateLineY = lineY + 52;

  doc.save();
  doc.moveTo(leftDateX, dateLineY).lineTo(leftDateX + dateLineWidth, dateLineY).lineWidth(0.8).strokeColor(THEME.line).stroke();
  doc.moveTo(rightDateX, dateLineY).lineTo(rightDateX + dateLineWidth, dateLineY).lineWidth(0.8).strokeColor(THEME.line).stroke();
  doc.restore();

  doc.fillColor(THEME.muted).font("Times-Roman").fontSize(10).text("Date", leftDateX, dateLineY + 4, {
    width: dateLineWidth,
    align: "center",
  });
  doc.text("Date", rightDateX, dateLineY + 4, {
    width: dateLineWidth,
    align: "center",
  });

  doc.y = dateLineY + 24;
}

function formatProbation(value) {
  if (value === null || value === undefined || value === "") return "As per company policy";
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) return `${num} month(s)`;
  return toText(value);
}

function getPublicBaseUrl() {
  const configured = String(
    process.env.PUBLIC_BASE_URL || process.env.API_PUBLIC_BASE_URL || process.env.APP_PUBLIC_BASE_URL || "",
  )
    .trim()
    .replace(/\/+$/, "");
  if (configured) return configured;
  return `http://localhost:${process.env.PORT || 3000}`;
}

function buildOfferLetterLinks(relativePath, offerId) {
  const publicBaseUrl = getPublicBaseUrl();
  const documentUrl = `${publicBaseUrl}${relativePath}`;
  const esignLink = `${documentUrl}#candidate-esign-${offerId}`;
  return { documentUrl, esignLink };
}

async function generateOfferLetterPdf(payload) {
  await fs.promises.mkdir(GENERATED_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const fileName = `offer_${payload.offerId}_${sanitizeForFileName(payload.companyName)}_${timestamp}.pdf`;
  const absolutePath = path.join(GENERATED_DIR, fileName);
  const relativePath = `${GENERATED_ROUTE_PREFIX}/${fileName}`;

  const candidateName = toText(payload.candidateName, "Candidate");
  const companyName = toText(payload.companyName, "Company");
  const offerDetails = payload.offerDetails && typeof payload.offerDetails === "object" && !Array.isArray(payload.offerDetails)
    ? payload.offerDetails
    : {};

  const joiningDate = formatDate(offerDetails.joining_date);
  const workLocation = toText(offerDetails.work_location, toText(payload.jobLocation));
  const employmentType = toText(payload.employmentType);
  const jobTitle = toText(payload.jobTitle);
  const department = toText(payload.department);
  const reportingTo = toText(offerDetails.reporting_to || offerDetails.manager_name, "your reporting manager");
  const offeredCtc = toText(offerDetails.offered_ctc);
  const joiningBonus = toText(offerDetails.bonus, "As per company policy");
  const probation = formatProbation(offerDetails.probation_months);
  const payFrequency = toText(offerDetails.salary_payment_frequency, "monthly");
  const payMethod = toText(offerDetails.salary_payment_method, "company payroll");
  const firstPayPeriod = toText(offerDetails.first_pay_period, "the first eligible payroll cycle");
  const roleSummary = toText(
    offerDetails.job_duties || offerDetails.responsibilities || offerDetails.role_summary,
    "the responsibilities discussed during the interview process",
  );
  const offerNotes = toText(offerDetails.offer_notes, "");

  const contingencies = normalizeList(offerDetails.employment_contingencies);
  const benefits = normalizeList(offerDetails.benefits);
  const conditions = normalizeList(offerDetails.conditions);
  const additionalDetails = formatAdditionalDetails(offerDetails);

  const contingencyText = contingencies.length
    ? contingencies.join("; ")
    : "standard pre-employment verification checks";
  const benefitsText = benefits.length
    ? benefits.join("; ")
    : "the company's standard benefits program as applicable to your grade and role";
  const conditionItems = conditions.length ? conditions : DEFAULT_CONDITIONS;

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
    const stream = fs.createWriteStream(absolutePath);

    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);

    doc.pipe(stream);
    Object.assign(doc.info, {
      Title: `Employment Offer Letter - ${companyName}`,
      Author: companyName,
      Subject: `Offer Letter for ${candidateName}`,
      Creator: "HireFlow Recruitment Platform",
      CreationDate: doc.info?.CreationDate || new Date(),
    });

    drawLetterhead(doc, payload);
    drawRecipientBlock(doc, payload, offerDetails);

    drawParagraph(doc, `Dear ${candidateName},`);

    drawParagraph(
      doc,
      `We are pleased to offer you the ${employmentType} position of ${jobTitle} at ${companyName}, `
        + `with a proposed start date of ${joiningDate}. This offer is contingent upon ${contingencyText}. `
        + `You will report to ${reportingTo} and your primary work location will be ${workLocation}.`,
    );

    drawParagraph(
      doc,
      `Your role will require ${roleSummary}. You are expected to perform your duties diligently, `
        + "maintain high professional standards, and comply with all company policies and lawful instructions.",
    );

    drawParagraph(
      doc,
      `Your annual compensation will be ${offeredCtc}, payable ${payFrequency} through ${payMethod}, `
        + `starting from ${firstPayPeriod}. In addition, a joining bonus of ${joiningBonus} will apply `
        + "as per applicable terms and internal policy.",
    );

    drawParagraph(
      doc,
      `Your employment is at-will and either you or ${companyName} may terminate employment at any time, `
        + "with or without cause and with or without notice, subject to applicable law and policy terms.",
    );

    drawParagraph(
      doc,
      `You will also be eligible for ${benefitsText}. This offer letter, together with applicable policy documents, `
        + "constitutes the primary terms of your employment.",
    );

    drawSectionHeading(doc, "Offer Details");
    drawClause(doc, 1, "Position", jobTitle);
    drawClause(doc, 2, "Department", department);
    drawClause(doc, 3, "Employment Type", employmentType);
    drawClause(doc, 4, "Work Location", workLocation);
    drawClause(doc, 5, "Joining Date", joiningDate);
    drawClause(doc, 6, "Annual Compensation", offeredCtc);
    drawClause(doc, 7, "Joining Bonus", joiningBonus);
    drawClause(doc, 8, "Probation Period", probation);

    if (additionalDetails.length) {
      drawSectionHeading(doc, "Additional Terms");
      drawBulletList(
        doc,
        additionalDetails.map((item) => `${item.label}: ${item.value}`),
      );
      doc.moveDown(0.2);
    }

    drawSectionHeading(doc, "General Conditions");
    drawBulletList(doc, conditionItems);
    doc.moveDown(0.2);

    if (offerNotes) {
      drawSectionHeading(doc, "Offer Notes");
      drawParagraph(doc, offerNotes);
    }

    drawSignatureBlock(doc, payload, offerDetails);

    doc.fillColor(THEME.muted).font("Times-Roman").fontSize(9).text(
      "This is a system-generated employment offer letter for record and acceptance workflow purposes.",
      PAGE_MARGIN,
      doc.y,
      {
        width: doc.page.width - (PAGE_MARGIN * 2),
      },
    );

    doc.end();
  });

  return { absolutePath, relativePath };
}

module.exports = {
  generateOfferLetterPdf,
  buildOfferLetterLinks,
};
