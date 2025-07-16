const Admin = require("../models/Admin");
const { ApiError } = require("../utils/ApiError");
const { ApiResponse } = require("../utils/ApiResponse");
const { asyncHandler } = require("../utils/asyncHandler");

const registerAdmin = asyncHandler(async (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    throw new ApiError(400, "Name and password are required");
  }

  const existingAdmin = await Admin.findOne({ name });
  if (existingAdmin) {
    throw new ApiError(409, "Admin with this name already exists");
  }

  const admin = await Admin.create({ name, password });

  await admin.save();

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        admin: { _id: admin._id, name: admin.name },
      },
      "Admin registered successfully"
    )
  );
});

const loginAdmin = asyncHandler(async (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    throw new ApiError(400, "Name and password are required");
  }

  const admin = await Admin.findOne({ name });
  if (!admin) {
    throw new ApiError(404, "Admin does not exist");
  }

  const isPasswordValid = await admin.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const accessToken = admin.generateAccessToken();
  const refreshToken = admin.generateRefreshToken();

  admin.refreshToken = refreshToken;
  await admin.save();

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          admin: { _id: admin._id, name: admin.name },
          accessToken,
          refreshToken,
        },
        "Admin logged in successfully"
      )
    );
});

const logoutAdmin = asyncHandler(async (req, res) => {
  await Admin.findByIdAndUpdate(
    req.admin._id,
    { $unset: { refreshToken: 1 } },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "Admin logged out successfully"));
});

module.exports = { registerAdmin, loginAdmin, logoutAdmin };
