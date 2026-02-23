const db = require("../config/db");

exports.createContactRequest = async (payload) => {
  const {
    full_name,
    work_email,
    company_name,
    role,
    message,
    agreed_to_contact,
  } = payload;

  if (!full_name || !work_email || !company_name || !role || !message) {
    throw new Error("full_name, work_email, company_name, role and message are required");
  }

  const [result] = await db.promise().query(
    `
      INSERT INTO contact_requests
        (full_name, work_email, company_name, role, message, agreed_to_contact, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [full_name, work_email, company_name, role, message, agreed_to_contact ? 1 : 0],
  );

  return { id: result.insertId };
};
