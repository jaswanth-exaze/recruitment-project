const express = require("express");
const controller = require("../controllers/interviewer.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { checkRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/profile", verifyToken, checkRole("Interviewer"), controller.getMyProfile);
router.put("/profile", verifyToken, checkRole("Interviewer"), controller.updateMyProfile);

router.get("/interviews", verifyToken, checkRole("Interviewer"), (req, res, next) => {
  req.query.interviewer_id = req.user.user_id;
  return controller.getInterviews(req, res, next);
});
router.put("/interviews/:id", verifyToken, checkRole("Interviewer"), controller.updateInterview);

router.post("/scorecards", verifyToken, checkRole("Interviewer"), (req, res, next) => {
  req.body.interviewer_id = req.user.user_id;
  return controller.submitScorecard(req, res, next);
});
router.put("/scorecards/:id/finalize", verifyToken, checkRole("Interviewer"), controller.finalizeScorecard);
router.get("/scorecards", verifyToken, checkRole("Interviewer"), controller.getScorecards);

module.exports = router;
