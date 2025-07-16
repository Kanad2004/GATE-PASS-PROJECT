const mongoose = require("mongoose");
const { ApiError } = require("../utils/ApiError");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new ApiError(
        500,
        "MONGO_URI is not defined in environment variables"
      );
    }

    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw new ApiError(500, "Database connection failed", error);
  }
};

const closeDB = async () => {
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  } catch (error) {
    console.error(`Error closing MongoDB connection: ${error.message}`);
    throw new ApiError(500, "Failed to close database connection", error);
  }
};

module.exports = { connectDB, closeDB };
