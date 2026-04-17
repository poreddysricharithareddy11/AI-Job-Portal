const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  score: { type: Number, default: 0 }, // 0-100% Match Score
  missingKeywords: [String],
  // Match breakdown for recruiter view & RF shortlisting
  matchBreakdown: {
    sbertScore: Number,
    tfidfScore: Number,
    ruleScore: Number
  },
  yearsExperience: { type: Number, default: 0 },
  educationScore: { type: Number, default: 0 },
  certificationCount: { type: Number, default: 0 },
  shortlistRF: { type: Boolean, default: null },
  profileText: { type: String, default: "" }, // skills + experience + education for SBERT shortlist
  similarityScore: { type: Number, default: null }, // score from shortlist-by-similarity
  status: {
    type: String,
    enum: ["active", "selected", "rejected", "closed"],
    default: "active"
  }
}, { timestamps: true });

// 🔒 Unique index prevents duplicate AI analysis for the same user/job pair
applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

module.exports = mongoose.model("Application", applicationSchema);