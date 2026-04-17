const router = require("express").Router();
const auth = require("../middleware/authMiddleware");

const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);

router.get("/profile", auth, getProfile);
router.put("/profile", auth, updateProfile);
router.put("/change-password", auth, changePassword);

module.exports = router;
