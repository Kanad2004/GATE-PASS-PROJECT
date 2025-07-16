const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const User = require("./User");

const qrCodeSchema = new mongoose.Schema({
  qrString: {
    type: String,
    required: [true, "QR string is required"],
    unique: true,
    default: uuidv4,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User ID is required"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // QR code expires in 24 hours
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

qrCodeSchema.statics.cleanupExpired = async function () {
  try {
    const expiredQRCodes = await this.find({
      createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    for (const qrCode of expiredQRCodes) {
      await User.findByIdAndDelete(qrCode.userId);
      await this.deleteOne({ _id: qrCode._id });
    }

    console.log(
      `Cleaned up ${expiredQRCodes.length} expired QR codes and associated users`
    );
  } catch (error) {
    console.error("Error cleaning up expired QR codes:", error);
  }
};

qrCodeSchema.statics.generateQRCode = async function (userId) {
  try {
    const qrCode = await this.create({ userId });
    return qrCode;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw error;
  }
};

qrCodeSchema.statics.findActiveByUserId = async function (userId) {
  return await this.findOne({ userId, isActive: true });
};

qrCodeSchema.methods.deactivate = async function () {
  this.isActive = false;
  await this.save();
};

module.exports = mongoose.model("QRCode", qrCodeSchema);
