const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const db = require("./config/db");
const app = express();
const authRoutes = require("./routes/auth.routes");
const platformAdminRoutes = require("./routes/platformAdmin.routes");
const companyAdminRoutes = require("./routes/companyAdmin.routes");
const hrRecruiterRoutes = require("./routes/hrRecruiter.routes");
const hiringManagerRoutes = require("./routes/hiringManager.routes");
const interviewerRoutes = require("./routes/interviewer.routes");
const candidateRoutes = require("./routes/candidate.routes");

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/platform-admin", platformAdminRoutes);
app.use("/company-admin", companyAdminRoutes);
app.use("/hr-recruiter", hrRecruiterRoutes);
app.use("/hiring-manager", hiringManagerRoutes);
app.use("/interviewer", interviewerRoutes);
app.use("/candidate", candidateRoutes);
app.get("/health", (req, res) => {
  res.json({ message: "OK" });
});

module.exports = app;
