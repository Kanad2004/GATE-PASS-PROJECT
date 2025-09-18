import axios from "axios";

// **API Configuration - Using your existing pattern**
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
const REQUEST_TIMEOUT = 15000; // 15 seconds for better reliability

// Create axios instance with enhanced configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
  // Enhanced retry configuration
  retry: 3,
  retryDelay: 1000,
});

// Enhanced request interceptor for token and logging
api.interceptors.request.use(
  (config) => {
    // Add request metadata for tracking
    config.metadata = {
      startTime: Date.now(),
      requestId: Math.random().toString(36).substr(2, 9),
    };

    // Development logging
    if (import.meta.env.DEV) {
      console.log(`🔄 API Request [${config.metadata.requestId}]:`, {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with better error handling
api.interceptors.response.use(
  (response) => {
    // Log response time in development
    if (import.meta.env.DEV && response.config.metadata) {
      const duration = Date.now() - response.config.metadata.startTime;
      console.log(
        `✅ API Response [${response.config.metadata.requestId}]: ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`
      );
    }
    return response;
  },
  (error) => {
    // Enhanced error handling with detailed logging
    const errorInfo = {
      code: error.code,
      message: error.message,
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
    };

    if (import.meta.env.DEV) {
      console.error("❌ API Error:", errorInfo);
    }

    // Connection and timeout errors
    if (error.code === "ECONNABORTED") {
      throw new Error(
        "Request timeout. Please check your internet connection and try again."
      );
    }

    if (error.code === "ERR_NETWORK" || !error.response) {
      throw new Error(
        "Network error. Please check your internet connection and try again."
      );
    }

    // HTTP status code handling
    const status = error.response.status;
    const serverMessage =
      error.response?.data?.message ||
      error.response?.data?.error?.message ||
      "An unexpected error occurred";

    switch (status) {
      case 400:
        throw new Error(serverMessage || "Invalid request data");
      case 401:
        // Clear invalid token
        safeLocalStorage.remove("user");
        throw new Error("Session expired. Please login again.");
      case 403:
        throw new Error("Access denied. Insufficient permissions.");
      case 404:
        throw new Error("Resource not found or endpoint unavailable.");
      case 409:
        throw new Error(serverMessage || "Conflict - resource already exists.");
      case 422:
        throw new Error(serverMessage || "Invalid data provided.");
      case 429:
        throw new Error(
          "Too many requests. Please wait a moment and try again."
        );
      case 500:
        throw new Error("Server error. Please try again in a few minutes.");
      case 502:
        throw new Error(
          "Server is temporarily unavailable. Please try again later."
        );
      case 503:
        throw new Error(
          "Service temporarily unavailable. Please try again later."
        );
      default:
        throw new Error(
          serverMessage || `Request failed with status ${status}`
        );
    }
  }
);

// **Enhanced Safe localStorage utility with error recovery**
const safeLocalStorage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const parsed = JSON.parse(item);

      // Check if data has expiration
      if (parsed && parsed._expires && Date.now() > parsed._expires) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed._data !== undefined ? parsed._data : parsed;
    } catch (error) {
      console.warn(`Failed to parse localStorage item '${key}':`, error);
      localStorage.removeItem(key); // Remove corrupted data
      return null;
    }
  },

  set: (key, value, expirationMs = null) => {
    try {
      let dataToStore = value;

      // Add expiration if specified
      if (expirationMs) {
        dataToStore = {
          _data: value,
          _expires: Date.now() + expirationMs,
        };
      }

      localStorage.setItem(key, JSON.stringify(dataToStore));
      return true;
    } catch (error) {
      console.warn(`Failed to set localStorage item '${key}':`, error);
      return false;
    }
  },

  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove localStorage item '${key}':`, error);
      return false;
    }
  },

  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn("Failed to clear localStorage:", error);
      return false;
    }
  },
};

// **Enhanced Input sanitization utility**
const sanitizeInput = (input) => {
  if (typeof input === "string") {
    return input
      .trim()
      .replace(/[<>\"']/g, "") // Basic XSS protection
      .substring(0, 1000); // Prevent excessive length
  }
  return input;
};

// **Enhanced API response validation**
const validateResponse = (response, expectedFields = []) => {
  if (!response?.data) {
    throw new Error("Invalid server response format");
  }

  // Handle different response structures from your backend
  const data = response.data.data || response.data;

  if (!data) {
    throw new Error("Empty response from server");
  }

  // Check for required fields
  for (const field of expectedFields) {
    if (!(field in data)) {
      throw new Error(`Missing required field in response: ${field}`);
    }
  }

  return data;
};

// **API Functions - Updated to match your backend structure**

export const sendOtp = async (data) => {
  try {
    // Enhanced input validation and sanitization
    const sanitizedData = {
      email: sanitizeInput(data.email?.toLowerCase()),
      name: sanitizeInput(data.name),
      mobileNumber: sanitizeInput(
        data.mobileNumber?.replace(/[^\d+\-\s()]/g, "")
      ),
      purpose: sanitizeInput(data.purpose),
      visitDateAndTime: data.visitDateAndTime,
    };

    // Validate required fields
    if (
      !sanitizedData.email ||
      !sanitizedData.name ||
      !sanitizedData.mobileNumber ||
      !sanitizedData.purpose
    ) {
      throw new Error("All fields are required");
    }

    const response = await api.post("/user/send-otp", sanitizedData);
    return validateResponse(response);
  } catch (error) {
    throw error; // Re-throw processed error
  }
};

export const verifyOtp = async (data) => {
  try {
    const sanitizedData = {
      email: sanitizeInput(data.email?.toLowerCase()),
      otp: sanitizeInput(data.otp?.replace(/\D/g, "")), // Only digits
      name: sanitizeInput(data.name),
      mobileNumber: sanitizeInput(data.mobileNumber),
      purpose: sanitizeInput(data.purpose),
      visitDateAndTime: data.visitDateAndTime,
    };

    // Validate OTP format
    if (!sanitizedData.otp || sanitizedData.otp.length !== 6) {
      throw new Error("Please enter a valid 6-digit OTP");
    }

    const response = await api.post("/user/verify-otp", sanitizedData);
    return validateResponse(response);
  } catch (error) {
    throw error;
  }
};

export const loginAdmin = async (data) => {
  try {
    const sanitizedData = {
      name: sanitizeInput(data.name),
      password: data.password, // Don't sanitize passwords
    };

    // Basic validation
    if (!sanitizedData.name || !sanitizedData.password) {
      throw new Error("Username and password are required");
    }

    const response = await api.post("/admin/login", sanitizedData);
    return validateResponse(response, ["admin", "accessToken"]);
  } catch (error) {
    throw error;
  }
};

export const getRequests = async (token) => {
  try {
    if (!token) {
      throw new Error("Authentication token is required");
    }

    const response = await api.get("/user/requests", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return validateResponse(response, ["requests"]);
  } catch (error) {
    throw error;
  }
};

export const acceptRequest = async (requestId, token) => {
  try {
    if (!requestId || !token) {
      throw new Error("Request ID and authentication token are required");
    }

    const response = await api.post(
      "/user/accept-request",
      { requestId: sanitizeInput(requestId) },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return validateResponse(response);
  } catch (error) {
    throw error;
  }
};

export const rejectRequest = async (requestId, token) => {
  try {
    if (!requestId || !token) {
      throw new Error("Request ID and authentication token are required");
    }

    const response = await api.post(
      "/user/reject-request",
      { requestId: sanitizeInput(requestId) },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return validateResponse(response);
  } catch (error) {
    throw error;
  }
};

export const scanQr = async (qrString, token) => {
  try {
    if (!qrString || !token) {
      throw new Error("QR string and authentication token are required");
    }

    const response = await api.post(
      "/user/scan-qr",
      { qrString: sanitizeInput(qrString) },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return validateResponse(response, ["user"]);
  } catch (error) {
    throw error;
  }
};

// **NEW: PDF Report Generation Function - Matching your router**
export const generateVisitorReport = async (filters, token) => {
  try {
    if (!token) {
      throw new Error("Authentication token is required");
    }

    // Sanitize filter inputs
    const sanitizedFilters = {
      startDate: sanitizeInput(filters.startDate),
      endDate: sanitizeInput(filters.endDate),
      status: sanitizeInput(filters.status),
      search: sanitizeInput(filters.search || ""),
    };

    const queryParams = new URLSearchParams(sanitizedFilters);

    // **UPDATED: Use your actual route path**
    const response = await api.get(
      `/user/generate-visitor-report?${queryParams}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/pdf",
        },
        responseType: "blob", // Important for PDF downloads
      }
    );

    return response.data; // Return blob directly
  } catch (error) {
    throw error;
  }
};

// **Enhanced network connectivity checker**
export const checkNetworkConnection = () => {
  if (!navigator.onLine) {
    return false;
  }

  // Additional check for connection quality if available
  if (window.navigator.connection) {
    const connection = window.navigator.connection;
    // Avoid very slow connections
    if (connection.effectiveType === "slow-2g" || connection.downlink < 0.5) {
      return false;
    }
  }

  return true;
};

// **Enhanced rate limiting utility with better cleanup**
const rateLimiter = new Map();
export const checkRateLimit = (key, maxRequests = 5, windowMs = 60000) => {
  const now = Date.now();
  const requests = rateLimiter.get(key) || [];

  // Clean old requests (more efficient cleanup)
  const validRequests = requests.filter((time) => now - time < windowMs);

  if (validRequests.length >= maxRequests) {
    const oldestRequest = Math.min(...validRequests);
    const resetTime = Math.ceil((windowMs - (now - oldestRequest)) / 1000);
    throw new Error(
      `Rate limit exceeded. Please wait ${resetTime} seconds before trying again.`
    );
  }

  validRequests.push(now);
  rateLimiter.set(key, validRequests);

  // Cleanup old entries periodically
  if (rateLimiter.size > 100) {
    rateLimiter.forEach((value, key) => {
      const validEntries = value.filter((time) => now - time < windowMs);
      if (validEntries.length === 0) {
        rateLimiter.delete(key);
      } else {
        rateLimiter.set(key, validEntries);
      }
    });
  }

  return true;
};

// **Utility function for file downloads**
export const downloadFile = (
  blob,
  filename,
  mimeType = "application/octet-stream"
) => {
  try {
    // Validate blob
    if (!(blob instanceof Blob)) {
      throw new Error("Invalid file data");
    }

    // Create download URL
    const url = window.URL.createObjectURL(
      new Blob([blob], { type: mimeType })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("File download error:", error);
    throw new Error("Failed to download file");
  }
};

// **Health check function**
export const healthCheck = async () => {
  try {
    const response = await api.get("/health", { timeout: 5000 });
    return response.data;
  } catch (error) {
    throw new Error("Service health check failed");
  }
};

// **Session validation function**
export const validateSession = async (token) => {
  try {
    if (!token) return false;

    const response = await api.get("/admin/validate-session", {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 3000,
    });

    return response.status === 200;
  } catch (error) {
    return false;
  }
};

// **Export all utilities**
export { safeLocalStorage, sanitizeInput, validateResponse, api as apiClient };

// **Debug function for development**
export const debugAPI = () => {
  if (import.meta.env.DEV) {
    console.log("🔧 API Debug Info:", {
      baseURL: API_BASE_URL,
      timeout: REQUEST_TIMEOUT,
      rateLimiterSize: rateLimiter.size,
      networkStatus: checkNetworkConnection(),
    });
  }
};
