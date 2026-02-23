const service = require("../services/hiringManager.service");

function handleError(res, err) {
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "Duplicate record" });
  }
  return res.status(400).json({ message: err.message || "Request failed" });
}

exports.getMyProfile = async (req, res) => {
  try {
    const data = await service.getMyProfile(req.user.user_id);
    if (!data) return res.status(404).json({ message: "Profile not found" });
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const data = await service.updateMyProfile(req.user.user_id, req.body);
    return res.json({ message: "Profile updated", data });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.listPendingApprovals = async (req, res) => {
  try {
    const approverId = req.user.user_id;
    return res.json(await service.listPendingApprovals(approverId, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.listJobs = async (req, res) => {
  try {
    return res.json(
      await service.listJobs(req.user.company_id, {
        status: req.query.status,
      }),
    );
  } catch (err) {
    return handleError(res, err);
  }
};

exports.listOfferAcceptedApplications = async (req, res) => {
  try {
    return res.json(
      await service.listOfferAcceptedApplications(req.user.company_id, {
        job_id: req.query.job_id,
      }),
    );
  } catch (err) {
    return handleError(res, err);
  }
};

exports.approveJob = async (req, res) => {
  try {
    const affected = await service.approveJob(
      req.params.id,
      req.user.user_id,
      req.body.comments,
      req.user.company_id,
    );
    if (!affected) return res.status(404).json({ message: "Approval record not found" });
    return res.json({ message: "Job approved and published" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.rejectJob = async (req, res) => {
  try {
    const affected = await service.rejectJob(
      req.params.id,
      req.user.user_id,
      req.body.comments,
      req.user.company_id,
    );
    if (!affected) return res.status(404).json({ message: "Approval record not found" });
    return res.json({ message: "Job rejected" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.finalDecision = async (req, res) => {
  try {
    const affected = await service.finalDecision(req.params.id, req.body.status, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Application not found or not offer accecepted" });
    return res.json({ message: "Final decision updated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.publishJob = async (req, res) => {
  try {
    const affected = await service.publishJob(req.params.id, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Job not found" });
    return res.json({ message: "Job published" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.closeJob = async (req, res) => {
  try {
    const affected = await service.closeJob(req.params.id, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Job not found" });
    return res.json({ message: "Job closed" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getJobById = async (req, res) => {
  try {
    const job = await service.getJobById(req.params.id, req.user.company_id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    return res.json(job);
  } catch (err) {
    return handleError(res, err);
  }
};
