const express = require("express");
const {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  refreshAccessToken,
} = require("../controllers/adminController");
const { authenticateAdmin } = require("../middlewares/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.post("/register", asyncHandler(registerAdmin));
router.post("/login", asyncHandler(loginAdmin));
router.post("/logout", authenticateAdmin, asyncHandler(logoutAdmin));
router.post("/refresh-token", asyncHandler(refreshAccessToken));

module.exports = router;
