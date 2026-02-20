const express = require("express");
const controller = require("../controllers/platformAdmin.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { checkRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/profile", verifyToken, checkRole("PlatformAdmin"), controller.getMyProfile);
router.put("/profile", verifyToken, checkRole("PlatformAdmin"), controller.updateMyProfile);

router.get("/companies", verifyToken, checkRole("PlatformAdmin"), controller.listActiveCompanies);
router.get("/companies/count", verifyToken, checkRole("PlatformAdmin"), controller.countActiveCompanies);
router.get("/companies/:id", verifyToken, checkRole("PlatformAdmin"), controller.getCompanyById);
router.post("/companies", verifyToken, checkRole("PlatformAdmin"), controller.createCompany);
router.put("/companies/:id", verifyToken, checkRole("PlatformAdmin"), controller.updateCompany);
router.delete("/companies/:id", verifyToken, checkRole("PlatformAdmin"), controller.deactivateCompany);
router.post("/companies/:id/activate", verifyToken, checkRole("PlatformAdmin"), controller.activateCompany);

router.get("/users", verifyToken, checkRole("PlatformAdmin"), controller.listUsersByRole);
router.get("/users/count", verifyToken, checkRole("PlatformAdmin"), controller.countUsersByRole);
router.get("/users/:id", verifyToken, checkRole("PlatformAdmin"), controller.getUserById);
router.post("/users", verifyToken, checkRole("PlatformAdmin"), controller.createUser);
router.put("/users/:id", verifyToken, checkRole("PlatformAdmin"), controller.updateUser);
router.delete("/users/:id", verifyToken, checkRole("PlatformAdmin"), controller.deactivateUser);
router.post("/users/:id/activate", verifyToken, checkRole("PlatformAdmin"), controller.activateUser);

router.post("/audit-logs", verifyToken, checkRole("PlatformAdmin"), controller.insertAuditLog);
router.get("/audit", verifyToken, checkRole("PlatformAdmin"), controller.getAuditTrail);

router.post("/background-jobs", verifyToken, checkRole("PlatformAdmin"), controller.insertBackgroundJob);
router.get("/background-jobs/pending", verifyToken, checkRole("PlatformAdmin"), controller.getPendingJobs);
router.post("/background-jobs/:id/complete", verifyToken, checkRole("PlatformAdmin"), controller.completeBackgroundJob);
router.post("/background-jobs/:id/fail", verifyToken, checkRole("PlatformAdmin"), controller.failBackgroundJob);

module.exports = router;
