const service = require("../services/candidate.service");

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

exports.getCandidateProfile = async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (req.user.user_id !== targetId) {
      return res.status(403).json({ message: "Access denied to another candidate profile" });
    }
    const profile = await service.getCandidateProfile(targetId);
    if (!profile) return res.status(404).json({ message: "Candidate profile not found" });
    return res.json(profile);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.updateCandidateProfile = async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (req.user.user_id !== targetId) {
      return res.status(403).json({ message: "Access denied to another candidate profile" });
    }
    const affected = await service.updateCandidateProfile(targetId, req.body);
    if (!affected) return res.status(404).json({ message: "Candidate profile not found" });
    return res.json({ message: "Candidate profile updated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.uploadResume = async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (req.user.user_id !== targetId) {
      return res.status(403).json({ message: "Access denied to another candidate profile" });
    }
    const affected = await service.uploadResume(targetId, req.body.resume_url);
    if (!affected) return res.status(404).json({ message: "Candidate profile not found" });
    return res.json({ message: "Resume uploaded" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const token = req.query.token;
    const userId = Number(token);
    if (!userId) return res.status(400).json({ message: "Invalid or missing token" });
    const affected = await service.verifyCandidateEmail(userId);
    if (!affected) return res.status(404).json({ message: "Candidate profile not found" });
    return res.json({ message: "Email verified successfully" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.listJobs = async (req, res) => {
  try {
    return res.json(await service.listJobs(req.query));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getJobById = async (req, res) => {
  try {
    const job = await service.getJobById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    return res.json(job);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.applyForJob = async (req, res) => {
  try {
    return res.status(201).json(
      await service.applyForJob({
        job_id: req.body.job_id,
        candidate_id: req.user.user_id,
      }),
    );
  } catch (err) {
    return handleError(res, err);
  }
};

exports.listMyApplications = async (req, res) => {
  try {
    return res.json(await service.listApplicationsByCandidate(req.user.user_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.saveJob = async (req, res) => {
  try {
    if (!req.body.job_id) {
      return res.status(400).json({ message: "job_id is required" });
    }
    return res.status(201).json(await service.saveJob(req.user.user_id, req.body.job_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.unsaveJob = async (req, res) => {
  try {
    const affected = await service.unsaveJob(req.user.user_id, req.body.job_id);
    if (!affected) return res.status(404).json({ message: "Saved job not found" });
    return res.json({ message: "Job unsaved" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.listSavedJobs = async (req, res) => {
  try {
    return res.json(await service.listSavedJobs(req.user.user_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.acceptOffer = async (req, res) => {
  try {
    const affected = await service.acceptOffer(req.params.id);
    if (!affected) return res.status(404).json({ message: "Offer not found" });
    return res.json({ message: "Offer accepted and application moved to hired" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.declineOffer = async (req, res) => {
  try {
    const affected = await service.declineOffer(req.params.id);
    if (!affected) return res.status(404).json({ message: "Offer not found" });
    return res.json({ message: "Offer declined and application moved to rejected" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getOffers = async (req, res) => {
  try {
    if (!req.query.application_id) {
      return res.status(400).json({ message: "application_id query param is required" });
    }
    return res.json(await service.getOffersByApplication(req.query.application_id));
  } catch (err) {
    return handleError(res, err);
  }
};
