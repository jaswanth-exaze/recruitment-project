const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

router.post("/login", authController.login);
router.get("/profile", verifyToken, authController.profile);
router.post("/refresh", authController.refreshToken);
router.post("/logout", authController.logout);

module.exports = router;
