const Application = require("../models/Application");
const Job = require("../models/Job");
const aiService = require("../services/aiEngineService");
const fs = require("fs");
const path = require("path");

// JOB SEEKER: Apply for a job
exports.applyJobWithAI = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "Resume file missing" });

    const { jobId } = req.body;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ msg: "Job not found" });

    const alreadyApplied = await Application.findOne({ job: jobId, applicant: req.user.id });
    if (alreadyApplied) return res.status(400).json({ msg: "Already applied" });

    const filePath = path.resolve(req.file.path);
    const aiResult = await aiService.analyzeResumeWithAI(
      filePath,
      job.description,
      job.title,
      job._id.toString()
    );
    if (
      aiResult?.service_error &&
      (!aiResult?.extracted?.skills || aiResult.extracted.skills.length === 0)
    ) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(503).json({
        msg: "AI analysis service is unavailable. Please start AI engine and try again.",
        detail: aiResult.service_error,
      });
    }

    const extracted = aiResult.extracted || {};
    const breakdown = aiResult.match_breakdown || {};
    const profileParts = [
      (extracted.skills || []).join(" "),
      String(extracted.years_of_experience ?? ""),
      (extracted.education || []).join(" "),
      (extracted.certifications || []).join(" "),
    ];
    const profileText = profileParts.filter(Boolean).join(" ").trim().slice(0, 10000);

    const application = await Application.create({
      job: jobId,
      applicant: req.user.id,
      score: aiResult.match_percentage || 0,
      missingKeywords: aiResult.missing_keywords || [],
      matchBreakdown: {
        sbertScore: breakdown.sbert_score,
        tfidfScore: breakdown.tfidf_score,
        ruleScore: breakdown.rule_score,
      },
      yearsExperience: extracted.years_of_experience ?? 0,
      educationScore: (extracted.education && extracted.education.length) ? 1 : 0,
      certificationCount: (extracted.certifications && extracted.certifications.length) || 0,
      profileText,
      status: "active",
    });

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    return res.json({
      success: true,
      application,
      aiAnalysis: {
        match_percentage: aiResult.match_percentage,
        missing_keywords: aiResult.missing_keywords,
        experience_level: aiResult.experience_level,
        top_roles: aiResult.top_roles,
        match_breakdown: aiResult.match_breakdown,
        extracted: aiResult.extracted,
      },
    });
  } catch (err) {
    console.error("Apply Error:", err);
    return res.status(500).json({ msg: "Application failed" });
  }
};

// JOB SEEKER: Get their own applications
exports.getMyApplications = async (req, res) => {
  try {
    const apps = await Application.find({ applicant: req.user.id }).populate("job");
    return res.json(apps || []);
  } catch (err) {
    return res.status(500).json({ msg: "Failed to load applications" });
  }
};

// RECRUITER: Get all applicants for a specific job (after shortlist: by similarityScore, else by score)
exports.getTopApplicants = async (req, res) => {
  try {
    const apps = await Application.find({ job: req.params.jobId })
      .sort({ similarityScore: -1, score: -1 })
      .populate("applicant", "name email");
    return res.json(apps || []);
  } catch (err) {
    return res.status(500).json({ msg: "Failed to load applicants" });
  }
};

// RECRUITER: Update candidate status (Hire/Reject)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const updated = await Application.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ msg: "Update failed" });
  }
};

// RECRUITER: Skill gap report for a job (resume + jobId)
exports.skillGapReport = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "Resume file missing" });
    const { jobId } = req.body;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ msg: "Job not found" });

    const filePath = path.resolve(req.file.path);
    const report = await aiService.skillGapReport(
      filePath,
      job.description,
      job.title
    );
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.json(report);
  } catch (err) {
    console.error("Skill gap error:", err);
    return res.status(500).json({ msg: "Skill gap analysis failed" });
  }
};

// RECRUITER: Run shortlist (SBERT similarity sort + RF flag for top candidates)
exports.runShortlistRF = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ msg: "Job not found" });

    const apps = await Application.find({ job: jobId })
      .sort({ score: -1 })
      .populate("applicant", "name email");

    if (!apps.length) return res.json({ applications: [], msg: "No applicants" });

    const candidates = apps.map((a) => ({
      application_id: a._id.toString(),
      profile_text: a.profileText || "",
    }));

    const { order } = await aiService.shortlistBySimilarity(
      job.title,
      job.description,
      candidates
    );

    const scoreById = {};
    (order || []).forEach((o, idx) => {
      scoreById[o.application_id] = { score: o.score, rank: idx };
    });

    const topN = Math.max(1, Math.ceil(apps.length / 2));
    for (const app of apps) {
      const id = app._id.toString();
      const info = scoreById[id];
      app.similarityScore = info ? info.score : null;
      app.shortlistRF = info && info.rank < topN;
      await app.save();
    }

    const updated = await Application.find({ job: jobId })
      .sort({ similarityScore: -1, score: -1 })
      .populate("applicant", "name email");
    return res.json({ applications: updated, order: order || [] });
  } catch (err) {
    console.error("Shortlist RF error:", err);
    return res.status(500).json({ msg: "Shortlist failed" });
  }
};