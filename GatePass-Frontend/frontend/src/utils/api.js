import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const sendOtp = async (data) => {
  try {
    const response = await api.post("/user/send-otp", data);
    return response.data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to send OTP");
  }
};

export const verifyOtp = async (data) => {
  console.log("Verifying OTP with data:", data);
  try {
    const response = await api.post("/user/verify-otp", data);
    return response.data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to verify OTP");
  }
};

export const loginAdmin = async (data) => {
  try {
    const response = await api.post("/admin/login", data);
    return response.data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to login");
  }
};

export const getRequests = async (token) => {
  try {
    const response = await api.get("/user/requests", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || "Failed to fetch requests"
    );
  }
};

export const acceptRequest = async (requestId, token) => {
  try {
    const response = await api.post(
      "/user/accept-request",
      { requestId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || "Failed to accept request"
    );
  }
};

export const rejectRequest = async (requestId, token) => {
  try {
    const response = await api.post(
      "/user/reject-request",
      { requestId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || "Failed to reject request"
    );
  }
};

export const scanQr = async (qrString, token) => {
  try {
    const response = await api.post(
      "/user/scan-qr",
      { qrString },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to scan QR code");
  }
};
