const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: String,
  description: String,
  salary: String,
  openings: { type: Number, default: 1 },
  status: { type: String, enum: ["active", "closed"], default: "active" }
}, { timestamps: true });

module.exports = mongoose.model("Job", jobSchema);