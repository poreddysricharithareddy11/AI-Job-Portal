// Load ENV variables first!
require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

/**
 * Initialize System
 * 1. Connect to MongoDB
 * 2. Start Express Server
 */
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`📡 API endpoints: http://localhost:${PORT}/api`);
    console.log(`📄 Static resumes: http://localhost:${PORT}/uploads/resumes`);
  });
}).catch(err => {
  console.error("❌ CRITICAL: Server failed to start:", err.message);
  process.exit(1);
});