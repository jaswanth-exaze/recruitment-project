const service = require("../services/contactRequest.service");

function handleError(res, err) {
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "Duplicate record" });
  }
  return res.status(400).json({ message: err.message || "Request failed" });
}

exports.createContactRequest = async (req, res) => {
  try {
    const data = await service.createContactRequest(req.body);
    return res.status(201).json({ message: "Contact request submitted", ...data });
  } catch (err) {
    return handleError(res, err);
  }
};
