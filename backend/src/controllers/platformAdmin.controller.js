const service = require("../services/platformAdmin.service");

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

exports.listActiveCompanies = async (req, res) => {
  try {
    return res.json(await service.listActiveCompanies());
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getCompanyById = async (req, res) => {
  try {
    const company = await service.getCompanyById(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });
    return res.json(company);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.countActiveCompanies = async (req, res) => {
  try {
    return res.json(await service.countActiveCompanies());
  } catch (err) {
    return handleError(res, err);
  }
};

exports.createCompany = async (req, res) => {
  try {
    return res.status(201).json(await service.createCompany(req.body));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const affected = await service.updateCompany(req.params.id, req.body);
    if (!affected) return res.status(404).json({ message: "Company not found" });
    return res.json({ message: "Company updated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.deactivateCompany = async (req, res) => {
  try {
    const affected = await service.deactivateCompany(req.params.id);
    if (!affected) return res.status(404).json({ message: "Company not found" });
    return res.json({ message: "Company deactivated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.activateCompany = async (req, res) => {
  try {
    const affected = await service.activateCompany(req.params.id);
    if (!affected) return res.status(404).json({ message: "Company not found" });
    return res.json({ message: "Company activated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.listUsersByRole = async (req, res) => {
  try {
    if (!req.query.role) return res.status(400).json({ message: "role query param is required" });
    return res.json(await service.listUsersByRole(req.query.role));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await service.getUserById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.createUser = async (req, res) => {
  try {
    return res.status(201).json(await service.createUser(req.body));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const affected = await service.updateUser(req.params.id, req.body);
    if (!affected) return res.status(404).json({ message: "User not found" });
    return res.json({ message: "User updated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const affected = await service.deactivateUser(req.params.id);
    if (!affected) return res.status(404).json({ message: "User not found" });
    return res.json({ message: "User deactivated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.activateUser = async (req, res) => {
  try {
    const affected = await service.activateUser(req.params.id);
    if (!affected) return res.status(404).json({ message: "User not found" });
    return res.json({ message: "User activated" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.countUsersByRole = async (req, res) => {
  try {
    if (!req.query.role) return res.status(400).json({ message: "role query param is required" });
    return res.json(await service.countUsersByRole(req.query.role));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.insertAuditLog = async (req, res) => {
  try {
    return res.status(201).json(await service.insertAuditLog(req.body));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getAuditTrail = async (req, res) => {
  try {
    if (!req.query.entity || !req.query.id) {
      return res.status(400).json({ message: "entity and id query params are required" });
    }
    return res.json(await service.getAuditTrail(req.query.entity, req.query.id));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.insertBackgroundJob = async (req, res) => {
  try {
    return res.status(201).json(await service.insertBackgroundJob(req.body));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getPendingJobs = async (req, res) => {
  try {
    return res.json(await service.getPendingJobs());
  } catch (err) {
    return handleError(res, err);
  }
};

exports.completeBackgroundJob = async (req, res) => {
  try {
    const affected = await service.completeBackgroundJob(req.params.id);
    if (!affected) return res.status(404).json({ message: "Background job not found" });
    return res.json({ message: "Background job marked completed" });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.failBackgroundJob = async (req, res) => {
  try {
    const affected = await service.failBackgroundJob(req.params.id, req.body.error_message);
    if (!affected) return res.status(404).json({ message: "Background job not found" });
    return res.json({ message: "Background job marked failed" });
  } catch (err) {
    return handleError(res, err);
  }
};
