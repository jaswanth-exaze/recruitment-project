const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

//middelewares for authentication and role-based access control
const { verifyToken } = require("../middlewares/auth.middleware");
const { checkRole } = require("../middlewares/role.middleware");

// User login route.
router.post("/login", authController.login);
router.post(
  "/profile",
  verifyToken,
  checkRole("CUSTOMER"),
  authController.profile,
);

module.exports = router;
