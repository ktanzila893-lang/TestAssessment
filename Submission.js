const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ["mcq", "short", "essay"], required: true },
  answerText: { type: String, default: "" },
  maxMarks: { type: Number, required: true },
  marksAwarded: { type: Number, default: null }, // null until graded
  autoGraded: { type: Boolean, default: false }
});

const submissionSchema = new mongoose.Schema(
  {
    test: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    answers: [answerSchema],
    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    grade: { type: String, default: "" }, // e.g. A+, B, F
    status: { type: String, enum: ["pending_review", "graded"], default: "pending_review" },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
    timeTakenSeconds: { type: Number, default: 0 },
    autoSubmitted: { type: Boolean, default: false } // true if timer ran out
  },
  { timestamps: true }
);

// One attempt per student per test
submissionSchema.index({ test: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Submission", submissionSchema);
