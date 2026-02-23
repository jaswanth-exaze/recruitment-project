
const service = require("../services/companyAdmin.service");

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

exports.listUsersByRole = async (req, res) => {
  try {
    if (!req.query.role) return res.status(400).json({ message: "role query param is required" });
    const includeInactive = String(req.query.include_inactive || "").trim().toLowerCase() === "true";
    return res.json(await service.listUsersByRole(req.query.role, req.user.company_id, includeInactive));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await service.getUserById(req.params.id, req.user.company_id);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.createUser = async (req, res) => {
  try {
    const payload = { ...req.body, company_id: req.user.company_id };
    return res.status(201).json(await service.createUser(payload, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const payload = { ...req.body, company_id: req.user.company_id };
    const affected = await service.updateUser(req.params.id, payload, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "User not found" });
    return res.json({ message: "User updated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const affected = await service.deactivateUser(req.params.id, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "User not found" });
    return res.json({ message: "User deactivated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.activateUser = async (req, res) => {
  try {
    const affected = await service.activateUser(req.params.id, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "User not found" });
    return res.json({ message: "User activated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.countUsersByRole = async (req, res) => {
  try {
    if (!req.query.role) return res.status(400).json({ message: "role query param is required" });
    return res.json(await service.countUsersByRole(req.query.role, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getAuditTrail = async (req, res) => {
  try {
    const entity = String(req.query.entity || "").trim();
    const id = String(req.query.id || "").trim();

    if ((entity && !id) || (!entity && id)) {
      return res.status(400).json({ message: "entity and id query params must be provided together" });
    }

    return res.json(
      await service.getAuditTrail(
        {
          entity_type: entity || undefined,
          entity_id: id || undefined,
        },
        req.user.company_id,
      ),
    );
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

exports.listApplications = async (req, res) => {
  try {
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

exports.finalDecision = async (req, res) => {
  try {
    const affected = await service.finalDecision(req.params.id, req.body.status, req.user.company_id);
    if (!affected) return res.status(404).json({ message: "Application not found" });
    return res.json({ message: "Final decision updated" });
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

exports.applicationStats = async (req, res) => {
  try {
    return res.json(await service.applicationStats(req.query.job_id, req.user.company_id));
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

exports.getOffers = async (req, res) => {
  try {
    return res.json(await service.getOffersByApplication(req.query.application_id, req.user.company_id));
  } catch (err) {
    return handleError(res, err);
  }
};
