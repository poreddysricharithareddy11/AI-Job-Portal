module.exports = (role) => {
  return (req, res, next) => {
    // Requires authMiddleware to be called first
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "Access denied: Unauthorized role" });
    }
    next();
  };
};