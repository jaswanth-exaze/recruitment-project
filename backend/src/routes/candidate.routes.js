const express = require("express");
const controller = require("../controllers/candidate.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { checkRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/profile", verifyToken, checkRole("Candidate"), controller.getMyProfile);
router.put("/profile", verifyToken, checkRole("Candidate"), controller.updateMyProfile);

router.get("/me/profile", verifyToken, checkRole("Candidate"), (req, res, next) => {
  req.params.id = String(req.user.user_id);
  return controller.getCandidateProfile(req, res, next);
});
router.put("/me/profile", verifyToken, checkRole("Candidate"), (req, res, next) => {
  req.params.id = String(req.user.user_id);
  return controller.updateCandidateProfile(req, res, next);
});
router.post("/me/resume", verifyToken, checkRole("Candidate"), (req, res, next) => {
  req.params.id = String(req.user.user_id);
  return controller.uploadResume(req, res, next);
});
router.get("/verify-email", controller.verifyEmail);

router.get("/jobs", verifyToken, checkRole("Candidate"), controller.listJobs);
router.get("/jobs/:id", verifyToken, checkRole("Candidate"), controller.getJobById);
router.post("/applications", verifyToken, checkRole("Candidate"), controller.applyForJob);
router.get("/my-applications", verifyToken, checkRole("Candidate"), controller.listMyApplications);

router.post("/saved-jobs", verifyToken, checkRole("Candidate"), controller.saveJob);
router.delete("/saved-jobs", verifyToken, checkRole("Candidate"), controller.unsaveJob);
router.get("/saved-jobs", verifyToken, checkRole("Candidate"), controller.listSavedJobs);

router.post("/offers/:id/accept", verifyToken, checkRole("Candidate"), controller.acceptOffer);
router.post("/offers/:id/decline", verifyToken, checkRole("Candidate"), controller.declineOffer);
router.get("/offers", verifyToken, checkRole("Candidate"), controller.getOffers);

module.exports = router;
