const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const role = require("../middleware/roleMiddleware");
const {
  applyJobWithAI,
  getMyApplications,
  getTopApplicants,
  updateApplicationStatus,
  skillGapReport,
  runShortlistRF,
} = require("../controllers/applicationController");

// Standardized Endpoints
router.post("/apply-ai", auth, upload.single("resume"), applyJobWithAI);
router.get("/my-applications", auth, getMyApplications);
router.get("/top/:jobId", auth, getTopApplicants);
router.put("/status/:id", auth, updateApplicationStatus);
// Skill gap: resume + jobId (applicant or recruiter)
router.post("/skill-gap", auth, upload.single("resume"), skillGapReport);
// Recruiter only: run RF shortlist for a job
router.post("/shortlist-rf/:jobId", auth, role("recruiter"), runShortlistRF);

module.exports = router;