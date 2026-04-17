const express = require("express");
const cors = require("cors");
const path = require("path");

// Route Imports
const authRoutes = require("./routes/authRoutes");
const jobRoutes = require("./routes/jobRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const errorHandler = require("./middleware/errorMiddleware");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// 📁 Fixed: Serve the specific 'resumes' folder so frontend can access them
// Access via: http://localhost:5000/uploads/resumes/filename.pdf
app.use("/uploads/resumes", express.static(path.join(__dirname, "uploads/resumes")));

// 🚀 Register API Routes
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);

// Root Health Check
app.get("/", (req, res) => {
  res.json({ message: "AI Job Portal Backend is fully operational" });
});

// Global Error Handler - MUST BE LAST
app.use(errorHandler);

module.exports = app;