const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Class = require("../models/Class");

const signToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email, classId: user.classId || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// POST /api/auth/register/teacher
exports.registerTeacher = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const teacher = await User.create({ name, email, password: hashedPassword, role: "teacher" });

    const token = signToken(teacher);
    res.status(201).json({
      message: "Teacher account created successfully.",
      token,
      user: { id: teacher._id, name: teacher.name, email: teacher.email, role: teacher.role }
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed.", error: err.message });
  }
};

// POST /api/auth/register/student  (requires a class joinCode from the teacher)
exports.registerStudent = async (req, res) => {
  try {
    const { name, email, password, joinCode, rollNumber } = req.body;
    if (!name || !email || !password || !joinCode) {
      return res.status(400).json({ message: "Name, email, password and class join code are required." });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });

    const classDoc = await Class.findOne({ joinCode: joinCode.trim().toUpperCase() });
    if (!classDoc) return res.status(404).json({ message: "Invalid class join code. Check with your teacher." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const student = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "student",
      classId: classDoc._id,
      rollNumber: rollNumber || ""
    });

    const token = signToken(student);
    res.status(201).json({
      message: "Student account created successfully.",
      token,
      user: { id: student._id, name: student.name, email: student.email, role: student.role, classId: classDoc._id }
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed.", error: err.message });
  }
};

// POST /api/auth/login  (works for both roles)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid email or password." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid email or password." });

    const token = signToken(user);
    res.json({
      message: "Login successful.",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, classId: user.classId }
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed.", error: err.message });
  }
};

// Utility to generate a unique class join code, used by teacherController
exports.generateJoinCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();
