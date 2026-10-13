const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/teacherController");

router.use(verifyToken, requireRole("teacher"));

// Classes
router.post("/classes", ctrl.createClass);
router.get("/classes", ctrl.getMyClasses);
router.get("/classes/:classId/students", ctrl.getClassStudents);
router.get("/classes/:classId/analytics", ctrl.getClassAnalytics);

// Tests
router.post("/tests", ctrl.createTest);
router.get("/tests", ctrl.getMyTests);
router.get("/tests/:id", ctrl.getTestById);
router.put("/tests/:id", ctrl.updateTest);
router.put("/tests/:id/publish", ctrl.publishTest);
router.delete("/tests/:id", ctrl.deleteTest);

// Submissions / grading
router.get("/tests/:id/submissions", ctrl.getTestSubmissions);
router.get("/submissions/:id", ctrl.getSubmissionById);
router.put("/submissions/:id/grade", ctrl.gradeSubmission);

module.exports = router;
