const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  type: { type: String, enum: ["mcq", "short", "essay"], required: true },
  questionText: { type: String, required: true },
  options: [{ type: String }], // used only for mcq
  correctAnswer: { type: String, default: "" }, // used only for mcq (auto-grading)
  marks: { type: Number, required: true, default: 1 }
});

const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    instructions: { type: String, default: "" },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    duration: { type: Number, required: true }, // in minutes
    questions: [questionSchema],
    totalMarks: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
    availableFrom: { type: Date, default: Date.now },
    availableUntil: { type: Date, default: null } // null = no deadline
  },
  { timestamps: true }
);

// Auto-calculate total marks whenever questions change
testSchema.pre("save", function (next) {
  this.totalMarks = this.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  next();
});

module.exports = mongoose.model("Test", testSchema);
