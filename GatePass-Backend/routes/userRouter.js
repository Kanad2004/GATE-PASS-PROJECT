const express = require("express");
const {
  user_register,
  user_verification,
} = require("../controllers/userController");
const { authenticateAdmin } = require("../middlewares/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.post("/send-otp", asyncHandler(user_register.sendOtp));
router.post(
  "/verify-otp",
  asyncHandler(user_verification.verifyOtpAndRegister)
);
router.get(
  "/requests",
  authenticateAdmin,
  asyncHandler(user_verification.getRequests)
);
router.post(
  "/accept-request",
  authenticateAdmin,
  asyncHandler(user_verification.acceptRequest)
);
router.post(
  "/reject-request",
  authenticateAdmin,
  asyncHandler(user_verification.rejectRequest)
);
router.post(
  "/scan-qr",
  authenticateAdmin,
  asyncHandler(user_verification.scanQr)
);
router.get(
  "/download-log",
  authenticateAdmin,
  asyncHandler(user_verification.downloadLog)
);
module.exports = router;
