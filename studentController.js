const Test = require("../models/Test");
const Submission = require("../models/Submission");
const { percentageToGrade, isFullyGraded } = require("../utils/grading");

// GET /api/student/tests  -> published tests for the student's class, with attempt status
exports.getAvailableTests = async (req, res) => {
  try {
    if (!req.user.classId) return res.status(400).json({ message: "You are not enrolled in a class yet." });

    const now = new Date();
    const tests = await Test.find({
      classId: req.user.classId,
      isPublished: true,
      availableFrom: { $lte: now },
      $or: [{ availableUntil: null }, { availableUntil: { $gte: now } }]
    })
      .select("title subject duration totalMarks availableFrom availableUntil questions")
      .sort({ createdAt: -1 });

    const submissions = await Submission.find({ student: req.user.id, test: { $in: tests.map((t) => t._id) } });
    const submissionMap = new Map(submissions.map((s) => [String(s.test), s]));

    const result = tests.map((t) => {
      const sub = submissionMap.get(String(t._id));
      return {
        _id: t._id,
        title: t.title,
        subject: t.subject,
        duration: t.duration,
        totalMarks: t.totalMarks,
        questionCount: t.questions.length,
        availableUntil: t.availableUntil,
        attempted: !!sub,
        status: sub ? sub.status : "not_attempted"
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tests.", error: err.message });
  }
};

// GET /api/student/tests/:id  -> get questions WITHOUT correct answers, to attempt the test
exports.getTestForAttempt = async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.id, classId: req.user.classId, isPublished: true });
    if (!test) return res.status(404).json({ message: "Test not found or not available to you." });

    const alreadySubmitted = await Submission.findOne({ test: test._id, student: req.user.id });
    if (alreadySubmitted) return res.status(400).json({ message: "You have already submitted this test." });

    const sanitizedQuestions = test.questions.map((q) => ({
      _id: q._id,
      type: q.type,
      questionText: q.questionText,
      options: q.type === "mcq" ? q.options : undefined,
      marks: q.marks
    }));

    res.json({
      _id: test._id,
      title: test.title,
      subject: test.subject,
      instructions: test.instructions,
      duration: test.duration,
      totalMarks: test.totalMarks,
      questions: sanitizedQuestions
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load test.", error: err.message });
  }
};

// POST /api/student/tests/:id/submit  -> body: { answers: [{questionId, answerText}], timeTakenSeconds, autoSubmitted }
exports.submitTest = async (req, res) => {
  try {
    const { answers, timeTakenSeconds, autoSubmitted } = req.body;
    const test = await Test.findOne({ _id: req.params.id, classId: req.user.classId, isPublished: true });
    if (!test) return res.status(404).json({ message: "Test not found or not available to you." });

    const existing = await Submission.findOne({ test: test._id, student: req.user.id });
    if (existing) return res.status(400).json({ message: "You have already submitted this test." });

    const gradedAnswers = test.questions.map((q) => {
      const studentAnswer = answers.find((a) => String(a.questionId) === String(q._id));
      const answerText = studentAnswer ? studentAnswer.answerText || "" : "";

      if (q.type === "mcq") {
        const isCorrect = answerText.trim().toLowerCase() === (q.correctAnswer || "").trim().toLowerCase();
        return {
          questionId: q._id,
          type: q.type,
          answerText,
          maxMarks: q.marks,
          marksAwarded: isCorrect ? q.marks : 0,
          autoGraded: true
        };
      }
      // short answer / essay -> needs manual grading by teacher
      return {
        questionId: q._id,
        type: q.type,
        answerText,
        maxMarks: q.marks,
        marksAwarded: null,
        autoGraded: false
      };
    });

    const submission = new Submission({
      test: test._id,
      student: req.user.id,
      answers: gradedAnswers,
      submittedAt: new Date(),
      timeTakenSeconds: timeTakenSeconds || 0,
      autoSubmitted: !!autoSubmitted
    });

    if (isFullyGraded(gradedAnswers)) {
      submission.totalScore = gradedAnswers.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
      submission.maxScore = test.totalMarks;
      const percentage = submission.maxScore > 0 ? (submission.totalScore / submission.maxScore) * 100 : 0;
      submission.grade = percentageToGrade(percentage);
      submission.status = "graded";
    }

    await submission.save();
    res.status(201).json({ message: "Test submitted successfully.", submission });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "You have already submitted this test." });
    res.status(500).json({ message: "Failed to submit test.", error: err.message });
  }
};

// GET /api/student/results
exports.getMyResults = async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user.id })
      .populate("test", "title subject totalMarks")
      .sort({ submittedAt: -1 });
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch results.", error: err.message });
  }
};

// GET /api/student/results/:submissionId
exports.getResultDetail = async (req, res) => {
  try {
    const submission = await Submission.findOne({ _id: req.params.submissionId, student: req.user.id }).populate(
      "test",
      "title subject totalMarks questions"
    );
    if (!submission) return res.status(404).json({ message: "Result not found." });
    res.json(submission);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch result.", error: err.message });
  }
};
