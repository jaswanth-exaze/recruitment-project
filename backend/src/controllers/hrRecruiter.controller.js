const service = require("../services/hrRecruiter.service");

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

exports.listJobs = async (req, res) => {
  try {
    const query = { ...req.query, company_id: req.user.company_id };
    return res.json(await service.listJobs(query, req.user.company_id));
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

exports.createJobDraft = async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.created_by = req.user.user_id;
    payload.company_id = req.user.company_id;
    return res.status(201).json(await service.createJobDraft(payload));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.updateJob = async (req, res) => {
  try {
    const affected = await service.updateJob(req.params.id, req.body, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Job not found or not editable" });
    return res.json({ message: "Job updated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.submitJob = async (req, res) => {
  try {
    const affected = await service.submitJob(req.params.id, req.body.approver_id, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Job not found" });
    return res.json({ message: "Job submitted for approval" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getCandidateProfile = async (req, res) => {
  try {
    const profile = await service.getCandidateProfile(Number(req.params.id), req.user.company_id);
    if (!profile) return res.status(404).json({ message: "Candidate profile not found" });
    return res.json(profile);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.updateCandidateProfile = async (req, res) => {
  try {
    const affected = await service.updateCandidateProfile(Number(req.params.id), req.body, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Candidate profile not found" });
    return res.json({ message: "Candidate profile updated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.uploadResume = async (req, res) => {
  try {
    const affected = await service.uploadResume(Number(req.params.id), req.body.resume_url, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Candidate profile not found" });
    return res.json({ message: "Resume uploaded" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.listApplications = async (req, res) => {
  try {
    if (!req.query.job_id) return res.status(400).json({ message: "job_id query param is required" });
    return res.json(await service.listApplicationsForJob(req.query.job_id, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.moveApplicationStage = async (req, res) => {
  try {
    const affected = await service.moveApplicationStage(
      req.params.id,
      req.body.status,
      req.body.current_stage_id,
      req.user.company_id,
    );
    if (!affected) return res.status(404).json({ message: "Application not found" });
    return res.json({ message: "Application updated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.screenDecision = async (req, res) => {
  try {
    const affected = await service.screenDecision(req.params.id, req.body.status, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Application not found" });
    return res.json({ message: "Screening decision updated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.recommendOffer = async (req, res) => {
  try {
    const affected = await service.recommendOffer(req.params.id, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Application not found" });
    return res.json({ message: "Offer recommended" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.scheduleInterview = async (req, res) => {
  try {
    return res.status(201).json(await service.scheduleInterview(req.body, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getInterviews = async (req, res) => {
  try {
    return res.json(await service.getInterviews(req.query, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.updateInterview = async (req, res) => {
  try {
    const affected = await service.updateInterview(req.params.id, req.body.status, req.body.notes, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Interview not found" });
    return res.json({ message: "Interview updated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.createOfferDraft = async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.created_by = req.user.user_id;
    return res.status(201).json(await service.createOfferDraft(payload, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.sendOffer = async (req, res) => {
  try {
    const affected = await service.sendOffer(req.params.id, req.body, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Offer not found" });
    return res.json({ message: "Offer sent" });
  } catch (err) {
    return handleError(res, err);
  }
};
