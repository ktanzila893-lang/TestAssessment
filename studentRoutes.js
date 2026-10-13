const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/studentController");

router.use(verifyToken, requireRole("student"));

router.get("/tests", ctrl.getAvailableTests);
router.get("/tests/:id", ctrl.getTestForAttempt);
router.post("/tests/:id/submit", ctrl.submitTest);
router.get("/results", ctrl.getMyResults);
router.get("/results/:submissionId", ctrl.getResultDetail);

module.exports = router;
