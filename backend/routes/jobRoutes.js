const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const {
  createJob,
  getJobs,
  closeJob
} = require("../controllers/jobController");

/**
 * Job routes
 * - Jobseeker: can view active jobs
 * - Recruiter: can view only their own jobs
 */

router.post("/", auth, createJob);

// IMPORTANT: this route MUST be protected
router.get("/", auth, getJobs);

router.put("/close/:id", auth, closeJob);

module.exports = router;
