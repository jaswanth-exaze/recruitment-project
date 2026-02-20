const express = require("express");
const controller = require("../controllers/companyAdmin.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { checkRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/profile", verifyToken, checkRole("CompanyAdmin"), controller.getMyProfile);
router.put("/profile", verifyToken, checkRole("CompanyAdmin"), controller.updateMyProfile);

router.get("/users", verifyToken, checkRole("CompanyAdmin"), controller.listUsersByRole);
router.get("/users/count", verifyToken, checkRole("CompanyAdmin"), controller.countUsersByRole);
router.get("/users/:id", verifyToken, checkRole("CompanyAdmin"), controller.getUserById);
router.post("/users", verifyToken, checkRole("CompanyAdmin"), controller.createUser);
router.put("/users/:id", verifyToken, checkRole("CompanyAdmin"), controller.updateUser);
router.delete("/users/:id", verifyToken, checkRole("CompanyAdmin"), controller.deactivateUser);
router.post("/users/:id/activate", verifyToken, checkRole("CompanyAdmin"), controller.activateUser);

router.get("/jobs", verifyToken, checkRole("CompanyAdmin"), controller.listJobs);
router.get("/jobs/:id", verifyToken, checkRole("CompanyAdmin"), controller.getJobById);
router.post("/jobs", verifyToken, checkRole("CompanyAdmin"), controller.createJobDraft);
router.put("/jobs/:id", verifyToken, checkRole("CompanyAdmin"), controller.updateJob);
router.post("/jobs/:id/submit", verifyToken, checkRole("CompanyAdmin"), controller.submitJob);
router.post("/jobs/:id/publish", verifyToken, checkRole("CompanyAdmin"), controller.publishJob);
router.post("/jobs/:id/close", verifyToken, checkRole("CompanyAdmin"), controller.closeJob);

router.get("/applications", verifyToken, checkRole("CompanyAdmin"), controller.listApplications);
router.put("/applications/:id/move-stage", verifyToken, checkRole("CompanyAdmin"), controller.moveApplicationStage);
router.post("/applications/:id/screen", verifyToken, checkRole("CompanyAdmin"), controller.screenDecision);
router.post("/applications/:id/final-decision", verifyToken, checkRole("CompanyAdmin"), controller.finalDecision);
router.post("/applications/:id/recommend-offer", verifyToken, checkRole("CompanyAdmin"), controller.recommendOffer);
router.get("/applications/stats", verifyToken, checkRole("CompanyAdmin"), controller.applicationStats);

router.post("/offers", verifyToken, checkRole("CompanyAdmin"), controller.createOfferDraft);
router.put("/offers/:id/send", verifyToken, checkRole("CompanyAdmin"), controller.sendOffer);
router.get("/offers", verifyToken, checkRole("CompanyAdmin"), controller.getOffers);

module.exports = router;
