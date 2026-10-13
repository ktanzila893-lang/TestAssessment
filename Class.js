const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Grade 10"
    section: { type: String, default: "A", trim: true }, // e.g. "A"
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    joinCode: { type: String, required: true, unique: true } // students use this to join the class
  },
  { timestamps: true }
);

module.exports = mongoose.model("Class", classSchema);
