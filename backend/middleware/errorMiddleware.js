/**
 * Global Error Handling Middleware
 * Standardizes all error responses across the MERN stack
 */
module.exports = (err, req, res, next) => {
  // Log the error internally for debugging
  console.error(`🔥 [ERROR] ${req.method} ${req.url}:`, err.stack || err.message);

  // 1. Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({ success: false, msg: message });
  }

  // 2. Handle Duplicate Key Errors (e.g., already applied to a job)
  if (err.code === 11000) {
    return res.status(400).json({ 
      success: false, 
      msg: "Duplicate entry found. You might have already performed this action." 
    });
  }

  // 3. Handle JWT Authentication Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, msg: "Invalid session. Please login again." });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, msg: "Session expired. Please login again." });
  }

  // 4. Default Generic Error
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    msg: message,
    // Only show stack trace in development mode to avoid leaking system paths
    stack: process.env.NODE_ENV === 'development' ? err.stack : null
  });
};