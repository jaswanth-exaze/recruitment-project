const express = require("express");
const controller = require("../controllers/hrRecruiter.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { checkRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/profile", verifyToken, checkRole("HR"), controller.getMyProfile);
router.put("/profile", verifyToken, checkRole("HR"), controller.updateMyProfile);

router.get("/jobs", verifyToken, checkRole("HR"), controller.listJobs);
router.get("/jobs/:id", verifyToken, checkRole("HR"), controller.getJobById);
router.post("/jobs", verifyToken, checkRole("HR"), controller.createJobDraft);
router.put("/jobs/:id", verifyToken, checkRole("HR"), controller.updateJob);
router.post("/jobs/:id/submit", verifyToken, checkRole("HR"), controller.submitJob);

router.get("/candidates/:id/profile", verifyToken, checkRole("HR"), controller.getCandidateProfile);
router.put("/candidates/:id/profile", verifyToken, checkRole("HR"), controller.updateCandidateProfile);
router.post("/candidates/:id/resume", verifyToken, checkRole("HR"), controller.uploadResume);

router.get("/applications", verifyToken, checkRole("HR"), controller.listApplications);
router.put("/applications/:id/move-stage", verifyToken, checkRole("HR"), controller.moveApplicationStage);
router.post("/applications/:id/screen", verifyToken, checkRole("HR"), controller.screenDecision);
router.post("/applications/:id/recommend-offer", verifyToken, checkRole("HR"), controller.recommendOffer);

router.post("/interviews", verifyToken, checkRole("HR"), controller.scheduleInterview);
router.get("/interviews", verifyToken, checkRole("HR"), controller.getInterviews);
router.put("/interviews/:id", verifyToken, checkRole("HR"), controller.updateInterview);

router.post("/offers", verifyToken, checkRole("HR"), controller.createOfferDraft);
router.put("/offers/:id/send", verifyToken, checkRole("HR"), controller.sendOffer);

module.exports = router;
