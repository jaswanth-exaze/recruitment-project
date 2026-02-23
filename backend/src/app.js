const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const db = require("./config/db");
const app = express();
const { auditMutationMiddleware } = require("./middlewares/audit.middleware");
const authRoutes = require("./routes/auth.routes");
const platformAdminRoutes = require("./routes/platformAdmin.routes");
const companyAdminRoutes = require("./routes/companyAdmin.routes");
const hrRecruiterRoutes = require("./routes/hrRecruiter.routes");
const hiringManagerRoutes = require("./routes/hiringManager.routes");
const interviewerRoutes = require("./routes/interviewer.routes");
const candidateRoutes = require("./routes/candidate.routes");
const contactRequestRoutes = require("./routes/contactRequest.routes");

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(auditMutationMiddleware);

app.use("/auth", authRoutes);
app.use("/platform-admin", platformAdminRoutes);
app.use("/company-admin", companyAdminRoutes);
app.use("/hr-recruiter", hrRecruiterRoutes);
app.use("/hiring-manager", hiringManagerRoutes);
app.use("/interviewer", interviewerRoutes);
app.use("/candidate", candidateRoutes);
app.use("/contact-requests", contactRequestRoutes);
app.get("/health", (req, res) => {
  res.json({ message: "OK" });
});

const frontendRoot = path.resolve(__dirname, "../../frontend");
app.use("/frontend", express.static(frontendRoot));
app.use("/", express.static(path.join(frontendRoot, "public")));

module.exports = app;
