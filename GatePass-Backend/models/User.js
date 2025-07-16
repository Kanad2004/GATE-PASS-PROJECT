const mongoose = require("mongoose");

const entrySchema = new mongoose.Schema({
  entryTime: {
    type: Date,
    required: true,
  },
  exitTime: {
    type: Date,
  },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
    },
    visitDateAndTime: {
      type: Date,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "not-visited"],
      default: "not-visited",
    },
    isVisited: {
      type: Boolean,
      default: false,
    },
    entries: [entrySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
