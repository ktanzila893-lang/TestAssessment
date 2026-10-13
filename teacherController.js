const crypto = require("crypto");
const Class = require("../models/Class");
const Test = require("../models/Test");
const Submission = require("../models/Submission");
const User = require("../models/User");
const { percentageToGrade, isFullyGraded } = require("../utils/grading");

/* ---------------------------- CLASS MANAGEMENT ---------------------------- */

// POST /api/teacher/classes
exports.createClass = async (req, res) => {
  try {
    const { name, section } = req.body;
    if (!name) return res.status(400).json({ message: "Class name is required." });

    let joinCode;
    let unique = false;
    while (!unique) {
      joinCode = crypto.randomBytes(3).toString("hex").toUpperCase();
      const exists = await Class.findOne({ joinCode });
      if (!exists) unique = true;
    }

    const newClass = await Class.create({ name, section: section || "A", teacher: req.user.id, joinCode });
    res.status(201).json({ message: "Class created successfully.", class: newClass });
  } catch (err) {
    res.status(500).json({ message: "Failed to create class.", error: err.message });
  }
};

// GET /api/teacher/classes
exports.getMyClasses = async (req, res) => {
  try {
    const classes = await Class.find({ teacher: req.user.id }).sort({ createdAt: -1 });
    // attach student counts
    const withCounts = await Promise.all(
      classes.map(async (c) => {
        const studentCount = await User.countDocuments({ classId: c._id, role: "student" });
        return { ...c.toObject(), studentCount };
      })
    );
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch classes.", error: err.message });
  }
};

// GET /api/teacher/classes/:classId/students
exports.getClassStudents = async (req, res) => {
  try {
    const classDoc = await Class.findOne({ _id: req.params.classId, teacher: req.user.id });
    if (!classDoc) return res.status(404).json({ message: "Class not found." });
    const students = await User.find({ classId: classDoc._id, role: "student" }).select("name email rollNumber");
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch students.", error: err.message });
  }
};

/* ------------------------------ TEST CREATION ------------------------------ */

// POST /api/teacher/tests
exports.createTest = async (req, res) => {
  try {
    const { title, subject, instructions, classId, duration, questions, availableFrom, availableUntil } = req.body;

    if (!title || !subject || !classId || !duration || !questions || !questions.length) {
      return res.status(400).json({ message: "Title, subject, class, duration and at least one question are required." });
    }

    const classDoc = await Class.findOne({ _id: classId, teacher: req.user.id });
    if (!classDoc) return res.status(404).json({ message: "Class not found or does not belong to you." });

    for (const q of questions) {
      if (!q.questionText || !q.type || !q.marks) {
        return res.status(400).json({ message: "Each question needs text, a type and marks." });
      }
      if (q.type === "mcq" && (!q.options || q.options.length < 2 || !q.correctAnswer)) {
        return res.status(400).json({ message: "MCQ questions need at least 2 options and a correct answer." });
      }
    }

    const test = await Test.create({
      title,
      subject,
      instructions: instructions || "",
      classId,
      teacher: req.user.id,
      duration,
      questions,
      availableFrom: availableFrom || Date.now(),
      availableUntil: availableUntil || null
    });

    res.status(201).json({ message: "Test created successfully.", test });
  } catch (err) {
    res.status(500).json({ message: "Failed to create test.", error: err.message });
  }
};

// GET /api/teacher/tests
exports.getMyTests = async (req, res) => {
  try {
    const tests = await Test.find({ teacher: req.user.id }).populate("classId", "name section").sort({ createdAt: -1 });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tests.", error: err.message });
  }
};

// GET /api/teacher/tests/:id
exports.getTestById = async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.id, teacher: req.user.id });
    if (!test) return res.status(404).json({ message: "Test not found." });
    res.json(test);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch test.", error: err.message });
  }
};

// PUT /api/teacher/tests/:id
exports.updateTest = async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.id, teacher: req.user.id });
    if (!test) return res.status(404).json({ message: "Test not found." });
    if (test.isPublished) {
      return res.status(400).json({ message: "Cannot edit a test that has already been published to students." });
    }
    Object.assign(test, req.body);
    await test.save();
    res.json({ message: "Test updated successfully.", test });
  } catch (err) {
    res.status(500).json({ message: "Failed to update test.", error: err.message });
  }
};

// PUT /api/teacher/tests/:id/publish
exports.publishTest = async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.id, teacher: req.user.id });
    if (!test) return res.status(404).json({ message: "Test not found." });
    test.isPublished = !test.isPublished;
    await test.save();
    res.json({ message: test.isPublished ? "Test published to students." : "Test unpublished.", test });
  } catch (err) {
    res.status(500).json({ message: "Failed to update publish status.", error: err.message });
  }
};

// DELETE /api/teacher/tests/:id
exports.deleteTest = async (req, res) => {
  try {
    const test = await Test.findOneAndDelete({ _id: req.params.id, teacher: req.user.id });
    if (!test) return res.status(404).json({ message: "Test not found." });
    await Submission.deleteMany({ test: test._id });
    res.json({ message: "Test deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete test.", error: err.message });
  }
};

/* --------------------------- RESULTS & GRADING --------------------------- */

// GET /api/teacher/tests/:id/submissions
exports.getTestSubmissions = async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.id, teacher: req.user.id });
    if (!test) return res.status(404).json({ message: "Test not found." });

    const submissions = await Submission.find({ test: test._id })
      .populate("student", "name email rollNumber")
      .sort({ submittedAt: -1 });

    res.json({ test: { title: test.title, totalMarks: test.totalMarks }, submissions });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch submissions.", error: err.message });
  }
};

// GET /api/teacher/submissions/:id
exports.getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate("student", "name email rollNumber")
      .populate("test", "title subject teacher totalMarks questions");

    if (!submission || String(submission.test.teacher) !== req.user.id) {
      return res.status(404).json({ message: "Submission not found." });
    }
    res.json(submission);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch submission.", error: err.message });
  }
};

// PUT /api/teacher/submissions/:id/grade  -> body: { grades: [{ questionId, marksAwarded }] }
exports.gradeSubmission = async (req, res) => {
  try {
    const { grades } = req.body; // array of { questionId, marksAwarded }
    const submission = await Submission.findById(req.params.id).populate("test", "teacher totalMarks");
    if (!submission || String(submission.test.teacher) !== req.user.id) {
      return res.status(404).json({ message: "Submission not found." });
    }

    grades.forEach(({ questionId, marksAwarded }) => {
      const answer = submission.answers.find((a) => String(a.questionId) === String(questionId));
      if (answer) {
        answer.marksAwarded = Math.min(Math.max(0, Number(marksAwarded)), answer.maxMarks);
      }
    });

    if (isFullyGraded(submission.answers)) {
      submission.totalScore = submission.answers.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
      submission.maxScore = submission.test.totalMarks;
      const percentage = submission.maxScore > 0 ? (submission.totalScore / submission.maxScore) * 100 : 0;
      submission.grade = percentageToGrade(percentage);
      submission.status = "graded";
    }

    await submission.save();
    res.json({ message: "Grades saved successfully.", submission });
  } catch (err) {
    res.status(500).json({ message: "Failed to save grades.", error: err.message });
  }
};

// GET /api/teacher/classes/:classId/analytics
exports.getClassAnalytics = async (req, res) => {
  try {
    const classDoc = await Class.findOne({ _id: req.params.classId, teacher: req.user.id });
    if (!classDoc) return res.status(404).json({ message: "Class not found." });

    const tests = await Test.find({ classId: classDoc._id });
    const testIds = tests.map((t) => t._id);
    const submissions = await Submission.find({ test: { $in: testIds }, status: "graded" }).populate("test", "title totalMarks");

    const perTest = tests.map((test) => {
      const subs = submissions.filter((s) => String(s.test._id) === String(test._id));
      const avg = subs.length ? subs.reduce((sum, s) => sum + s.totalScore, 0) / subs.length : 0;
      const gradeDistribution = subs.reduce((acc, s) => {
        acc[s.grade] = (acc[s.grade] || 0) + 1;
        return acc;
      }, {});
      return {
        testId: test._id,
        title: test.title,
        totalMarks: test.totalMarks,
        attempts: subs.length,
        averageScore: Math.round(avg * 100) / 100,
        gradeDistribution
      };
    });

    res.json({ class: { name: classDoc.name, section: classDoc.section }, tests: perTest });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch analytics.", error: err.message });
  }
};
