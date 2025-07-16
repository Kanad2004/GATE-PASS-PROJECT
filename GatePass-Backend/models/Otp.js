const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    trim: true,
  },
  otp: {
    type: String,
    required: [true, "OTP is required"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60, // OTP expires in 10 minutes
  },
});

module.exports = mongoose.model("Otp", otpSchema);
