const service = require("../services/interviewer.service");

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

exports.getInterviews = async (req, res) => {
  try {
    return res.json(await service.getInterviews(req.query, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.updateInterview = async (req, res) => {
  try {
    const affected = await service.updateInterview(
      req.params.id,
      req.body.status,
      req.body.notes,
      req.user.user_id,
      req.user.company_id,
    );
    if (!affected) return res.status(404).json({ message: "Interview not found" });
    return res.json({ message: "Interview updated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getPendingScorecardInterviews = async (req, res) => {
  try {
    return res.json(await service.getPendingScorecardInterviews(req.user.user_id, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.submitScorecard = async (req, res) => {
  try {
    return res.status(201).json(await service.submitScorecard(req.body, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.finalizeScorecard = async (req, res) => {
  try {
    const affected = await service.finalizeScorecard(req.params.id, req.user.user_id, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Scorecard not found or already finalized" });
    return res.json({ message: "Scorecard finalized" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getScorecards = async (req, res) => {
  try {
    return res.json(await service.getScorecardsByInterview(req.query.interview_id, req.user.user_id, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};
