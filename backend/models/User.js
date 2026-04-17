const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ["jobseeker", "recruiter"], required: true },
  name: String,
  email: { type: String, unique: true },
  password: String,
  resume: String // Stores the filename of the last uploaded resume
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);