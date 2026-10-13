const express = require("express");
const router = express.Router();
const { registerTeacher, registerStudent, login } = require("../controllers/authController");

router.post("/register/teacher", registerTeacher);
router.post("/register/student", registerStudent);
router.post("/login", login);

module.exports = router;
