const jwt = require("jsonwebtoken");
const { ApiError } = require("../utils/ApiError");
const Admin = require("../models/Admin");

const authenticateAdmin = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken || // Check for accessToken in cookies
      req.header("Authorization")?.replace("Bearer ", ""); // Fallback to Authorization header

    if (!token) {
      console.error("No token provided in cookies or headers");
      throw new ApiError(401, "Unauthorized request: No token provided");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET); // Use correct secret for access token

    const admin = await Admin.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!admin) {
      throw new ApiError(401, "Invalid token: Admin not found");
    }

    req.admin = admin;
    console.log(`Authenticated admin: ${admin.name}`);
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    throw new ApiError(401, error?.message || "Invalid or expired token");
  }
};

module.exports = { authenticateAdmin };
