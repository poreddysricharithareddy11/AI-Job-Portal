const Job = require("../models/Job");

exports.createJob = async (req, res) => {
  try {
    if (req.user.role !== "recruiter") return res.status(403).json({ msg: "Access denied" });

    const job = await Job.create({
      recruiter: req.user.id,
      title: req.body.title,
      description: req.body.description,
      salary: req.body.salary,
      openings: req.body.openings,
      status: "active"
    });
    return res.json(job);
  } catch (err) {
    console.error("❌ Create job failed:", err);
    return res.status(500).json({ msg: "Failed to create job" });
  }
};

exports.getJobs = async (req, res) => {
  try {
    if (req.user.role === "recruiter") {
      const jobs = await Job.find({ recruiter: req.user.id }).sort({ createdAt: -1 });
      return res.json(jobs);
    }
    const jobs = await Job.find({ status: "active" }).sort({ createdAt: -1 });
    return res.json(jobs);
  } catch (err) {
    console.error("❌ Get jobs failed:", err);
    return res.json([]); 
  }
};

exports.closeJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ msg: "Job not found" });
    if (job.recruiter.toString() !== req.user.id) return res.status(403).json({ msg: "Unauthorized" });

    job.status = "closed";
    await job.save();
    return res.json(job);
  } catch (err) {
    console.error("❌ Close job failed:", err);
    return res.status(500).json({ msg: "Failed to close job" });
  }
};