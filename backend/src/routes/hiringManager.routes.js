const express = require("express");
const controller = require("../controllers/hiringManager.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { checkRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/profile", verifyToken, checkRole("HiringManager"), controller.getMyProfile);
router.put("/profile", verifyToken, checkRole("HiringManager"), controller.updateMyProfile);

router.get("/job-approvals", verifyToken, checkRole("HiringManager"), controller.listPendingApprovals);
router.get("/jobs", verifyToken, checkRole("HiringManager"), controller.listJobs);
router.post("/jobs/:id/approve", verifyToken, checkRole("HiringManager"), controller.approveJob);
router.post("/jobs/:id/reject", verifyToken, checkRole("HiringManager"), controller.rejectJob);
router.post("/jobs/:id/publish", verifyToken, checkRole("HiringManager"), controller.publishJob);
router.post("/jobs/:id/close", verifyToken, checkRole("HiringManager"), controller.closeJob);
router.get("/jobs/:id", verifyToken, checkRole("HiringManager"), controller.getJobById);

router.get("/applications", verifyToken, checkRole("HiringManager"), controller.listOfferAcceptedApplications);
router.post("/applications/:id/final-decision", verifyToken, checkRole("HiringManager"), controller.finalDecision);

module.exports = router;
