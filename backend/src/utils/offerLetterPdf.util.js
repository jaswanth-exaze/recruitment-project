const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const GENERATED_DIR = path.resolve(__dirname, "../../generated/offer-letters");
const GENERATED_ROUTE_PREFIX = "/generated/offer-letters";
const PAGE_MARGIN = 56;
const LOGO_FETCH_TIMEOUT_MS = 7000;
const HEADER_RIGHT_WIDTH = 228;
const HEADER_COLUMN_GAP = 12;
const HEADER_LOGO_WIDTH = 130;
const HEADER_LOGO_HEIGHT = 50;
const LOGO_BUFFER_CACHE = new Map();

const KNOWN_COMPANY_LOGOS = {
  infosys: "https://upload.wikimedia.org/wikipedia/commons/9/95/Infosys_logo.svg",
  tcs: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/TCS_Logo_%28cropped%29.jpg/640px-TCS_Logo_%28cropped%29.jpg",
  wipro: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Wipro_Primary_Logo_Color_RGB.svg",
};

const THEME = {
  text: "#161616",
  muted: "#505050",
  line: "#1f1f1f",
  tableHeaderBg: "#eef3ff",
  tableRowAltBg: "#f8faff",
  tableBorder: "#cfd9ef",
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

function defaultCompanyLogoUrl(companyName) {
  const normalized = String(companyName || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("infosys")) return KNOWN_COMPANY_LOGOS.infosys;
  if (normalized.includes("wipro")) return KNOWN_COMPANY_LOGOS.wipro;
  if (normalized.includes("tcs")) return KNOWN_COMPANY_LOGOS.tcs;
  return "";
}

function resolveCompanyLogoUrl(payload) {
  const direct = optionalText(payload.companyLogoUrl || payload.company_logo_url || payload.logo_url);
  if (direct) return direct;
  return defaultCompanyLogoUrl(payload.companyName || payload.company_name);
}

function wikimediaSvgToPngUrl(rawUrl, size = 512) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname !== "upload.wikimedia.org") return "";
    const rawPath = parsed.pathname || "";

    // Handles /wikipedia/commons/<a>/<b>/file.svg links.
    const baseMatch = rawPath.match(/^\/wikipedia\/commons\/([a-z0-9])\/([a-z0-9]{2})\/([^/]+\.svg)$/i);
    if (baseMatch) {
      const [, partA, partB, fileName] = baseMatch;
      const pngPath = `/wikipedia/commons/thumb/${partA}/${partB}/${fileName}/${Math.max(64, Number(size) || 512)}px-${fileName}.png`;
      return `${parsed.protocol}//${parsed.host}${pngPath}`;
    }

    // Handles /wikipedia/commons/thumb/.../size-file.svg links.
    const thumbMatch = rawPath.match(/^\/wikipedia\/commons\/thumb\/(.+\.svg)\/[^/]+$/i);
    if (thumbMatch) {
      const base = thumbMatch[1];
      const fileName = base.split("/").pop() || "logo.svg";
      const pngPath = `/wikipedia/commons/thumb/${base}/${Math.max(64, Number(size) || 512)}px-${fileName}.png`;
      return `${parsed.protocol}//${parsed.host}${pngPath}`;
    }

    return "";
  } catch (error) {
    return "";
  }
}

function wikimediaSpecialFilePathPngUrl(rawUrl, size = 640) {
  try {
    const parsed = new URL(rawUrl);
    const isWikimediaHost = parsed.hostname === "upload.wikimedia.org" || parsed.hostname === "commons.wikimedia.org";
    if (!isWikimediaHost) return "";

    const fileNameRaw = decodeURIComponent((parsed.pathname || "").split("/").pop() || "");
    if (!fileNameRaw || !fileNameRaw.toLowerCase().endsWith(".svg")) return "";

    const width = Math.max(64, Number(size) || 640);
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileNameRaw)}?width=${width}`;
  } catch (error) {
    return "";
  }
}

function isSvgContent(contentType, buffer) {
  const safeType = String(contentType || "").toLowerCase();
  if (safeType.includes("image/svg")) return true;
  const head = Buffer.isBuffer(buffer) ? buffer.slice(0, 200).toString("utf8").toLowerCase() : "";
  return head.includes("<svg");
}

async function fetchBinary(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOGO_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "HireFlow-OfferLetter/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`Logo fetch failed (${response.status})`);
    }
    const data = await response.arrayBuffer();
    return {
      buffer: Buffer.from(data),
      contentType: response.headers.get("content-type") || "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCompanyLogoBuffer(logoUrl) {
  const url = optionalText(logoUrl);
  if (!url) return null;
  if (LOGO_BUFFER_CACHE.has(url)) {
    const cached = LOGO_BUFFER_CACHE.get(url);
    return Buffer.isBuffer(cached) ? Buffer.from(cached) : null;
  }

  try {
    const first = await fetchBinary(url);
    if (!first.buffer?.length) return null;
    if (!isSvgContent(first.contentType, first.buffer)) {
      LOGO_BUFFER_CACHE.set(url, Buffer.from(first.buffer));
      return Buffer.from(first.buffer);
    }

    const rasterCandidates = [
      wikimediaSvgToPngUrl(url, 640),
      wikimediaSpecialFilePathPngUrl(url, 640),
    ].filter(Boolean);

    for (let i = 0; i < rasterCandidates.length; i += 1) {
      const rasterUrl = rasterCandidates[i];
      try {
        const result = await fetchBinary(rasterUrl);
        if (!result.buffer?.length) continue;
        if (isSvgContent(result.contentType, result.buffer)) continue;
        LOGO_BUFFER_CACHE.set(url, Buffer.from(result.buffer));
        return Buffer.from(result.buffer);
      } catch (error) {
        // Try next fallback URL.
      }
    }

    LOGO_BUFFER_CACHE.set(url, null);
    return null;
  } catch (error) {
    LOGO_BUFFER_CACHE.set(url, null);
    return null;
  }
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

function drawLetterhead(doc, payload, companyLogoBuffer = null) {
  const companyName = toText(payload.companyName, "Company");
  const companyDomain = optionalText(payload.companyDomain);
  const offerId = toText(payload.offerId);
  const issueDate = formatDate(new Date());

  const topY = PAGE_MARGIN;
  const rightWidth = HEADER_RIGHT_WIDTH;
  const rightX = doc.page.width - PAGE_MARGIN - rightWidth;
  const leftWidth = doc.page.width - (PAGE_MARGIN * 2) - rightWidth - HEADER_COLUMN_GAP;
  const logoWidth = HEADER_LOGO_WIDTH;
  const logoHeight = HEADER_LOGO_HEIGHT;

  let leftTextX = PAGE_MARGIN;
  let leftTextY = topY;
  let leftTextWidth = leftWidth;
  let logoBottomY = topY;
  if (companyLogoBuffer) {
    try {
      doc.image(companyLogoBuffer, PAGE_MARGIN, topY, {
        fit: [logoWidth, logoHeight],
        align: "left",
        valign: "top",
      });
      logoBottomY = topY + logoHeight;

      const remainingWidth = leftWidth - logoWidth - 10;
      if (remainingWidth >= 120) {
        leftTextX = PAGE_MARGIN + logoWidth + 10;
        leftTextY = topY + 1;
        leftTextWidth = remainingWidth;
      } else {
        leftTextX = PAGE_MARGIN;
        leftTextY = logoBottomY + 6;
        leftTextWidth = leftWidth;
      }
    } catch (error) {
      leftTextX = PAGE_MARGIN;
      leftTextY = topY;
      leftTextWidth = leftWidth;
      logoBottomY = topY;
    }
  }

  doc.fillColor(THEME.text).font("Times-Bold").fontSize(18).text(companyName, leftTextX, leftTextY, {
    width: leftTextWidth,
    lineGap: 1.2,
  });

  const leftAfterNameY = doc.y + 1;
  if (companyDomain) {
    doc.fillColor(THEME.muted).font("Times-Roman").fontSize(10.5).text(companyDomain, leftTextX, leftAfterNameY, {
      width: leftTextWidth,
      lineGap: 2,
    });
  }
  const leftBottomY = Math.max(doc.y, logoBottomY);

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

  const headerBottom = Math.max(leftBottomY, rightBottomY) + 12;
  drawHorizontalRule(doc, headerBottom);
  doc.y = headerBottom + 14;
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

function drawOfferDetailsTable(doc, rows) {
  const tableWidth = doc.page.width - (PAGE_MARGIN * 2);
  const labelColumnWidth = Math.round(tableWidth * 0.34);
  const valueColumnWidth = tableWidth - labelColumnWidth;
  const rowPaddingX = 10;
  const rowPaddingY = 7;
  const rowGap = 0;

  const normalizedRows = Array.isArray(rows)
    ? rows.filter((row) => row && row.label && row.value !== undefined && row.value !== null)
    : [];

  if (!normalizedRows.length) return;

  const headerMinHeight = 28;
  ensureSpace(doc, headerMinHeight + 6);
  const headerY = doc.y;
  const headerHeight = headerMinHeight;

  doc.save();
  doc.rect(PAGE_MARGIN, headerY, tableWidth, headerHeight).fillAndStroke(THEME.tableHeaderBg, THEME.tableBorder);
  doc.moveTo(PAGE_MARGIN + labelColumnWidth, headerY)
    .lineTo(PAGE_MARGIN + labelColumnWidth, headerY + headerHeight)
    .lineWidth(0.8)
    .strokeColor(THEME.tableBorder)
    .stroke();
  doc.restore();

  doc.fillColor(THEME.text).font("Times-Bold").fontSize(10.8).text("Offer Item", PAGE_MARGIN + rowPaddingX, headerY + 8, {
    width: labelColumnWidth - (rowPaddingX * 2),
  });
  doc.text("Details", PAGE_MARGIN + labelColumnWidth + rowPaddingX, headerY + 8, {
    width: valueColumnWidth - (rowPaddingX * 2),
  });

  doc.y = headerY + headerHeight + rowGap;

  normalizedRows.forEach((row, index) => {
    const labelText = toText(row.label);
    const valueText = toText(row.value);

    const labelTextHeight = doc.heightOfString(labelText, {
      width: labelColumnWidth - (rowPaddingX * 2),
      align: "left",
      lineGap: 2,
    });
    const valueTextHeight = doc.heightOfString(valueText, {
      width: valueColumnWidth - (rowPaddingX * 2),
      align: "left",
      lineGap: 2,
    });

    const rowHeight = Math.max(28, Math.ceil(Math.max(labelTextHeight, valueTextHeight) + (rowPaddingY * 2)));
    ensureSpace(doc, rowHeight + 4);

    const y = doc.y;
    const isAlternate = index % 2 === 1;

    doc.save();
    if (isAlternate) {
      doc.rect(PAGE_MARGIN, y, tableWidth, rowHeight).fill(THEME.tableRowAltBg);
    }
    doc.rect(PAGE_MARGIN, y, tableWidth, rowHeight)
      .lineWidth(0.7)
      .strokeColor(THEME.tableBorder)
      .stroke();
    doc.moveTo(PAGE_MARGIN + labelColumnWidth, y)
      .lineTo(PAGE_MARGIN + labelColumnWidth, y + rowHeight)
      .lineWidth(0.7)
      .strokeColor(THEME.tableBorder)
      .stroke();
    doc.restore();

    doc.fillColor(THEME.text).font("Times-Bold").fontSize(10.6).text(labelText, PAGE_MARGIN + rowPaddingX, y + rowPaddingY, {
      width: labelColumnWidth - (rowPaddingX * 2),
      lineGap: 2,
    });
    doc.fillColor(THEME.text).font("Times-Roman").fontSize(10.8).text(
      valueText,
      PAGE_MARGIN + labelColumnWidth + rowPaddingX,
      y + rowPaddingY,
      {
        width: valueColumnWidth - (rowPaddingX * 2),
        lineGap: 2,
      },
    );

    doc.y = y + rowHeight + rowGap;
  });

  doc.moveDown(0.25);
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
  const companyLogoUrl = resolveCompanyLogoUrl(payload);
  let companyLogoBuffer = await fetchCompanyLogoBuffer(companyLogoUrl);
  if (!companyLogoBuffer) {
    const fallbackLogoUrl = defaultCompanyLogoUrl(companyName);
    if (fallbackLogoUrl && fallbackLogoUrl !== companyLogoUrl) {
      companyLogoBuffer = await fetchCompanyLogoBuffer(fallbackLogoUrl);
    }
  }
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

    drawLetterhead(doc, payload, companyLogoBuffer);
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
    drawOfferDetailsTable(doc, [
      { label: "Position", value: jobTitle },
      { label: "Department", value: department },
      { label: "Employment Type", value: employmentType },
      { label: "Work Location", value: workLocation },
      { label: "Joining Date", value: joiningDate },
      { label: "Annual Compensation", value: offeredCtc },
      { label: "Joining Bonus", value: joiningBonus },
      { label: "Probation Period", value: probation },
    ]);

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
