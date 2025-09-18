import axios from "axios";

// **API Configuration**
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://gate-pass-project-1.onrender.com/api/v1";
const REQUEST_TIMEOUT = 15000;

// Create axios instance with enhanced configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // **IMPORTANT: Enable cookies for refresh tokens**
});

// Enhanced request interceptor for token and logging
api.interceptors.request.use(
  async (config) => {
    // Add request metadata for tracking
    config.metadata = {
      startTime: Date.now(),
      requestId: Math.random().toString(36).substr(2, 9),
    };

    // **AUTO TOKEN REFRESH: Check if token needs refresh before API calls**
    const user = safeLocalStorage.get("user");
    if (user?.accessToken && user?.tokenExpiry) {
      const now = Date.now();
      const timeUntilExpiry = user.tokenExpiry - now;

      // Refresh token if it expires in less than 5 minutes
      if (timeUntilExpiry < 5 * 60 * 1000) {
        console.log("🔄 Token expires soon, attempting refresh...");
        try {
          await refreshAccessToken();
        } catch (error) {
          console.warn("Failed to refresh token:", error);
          // Continue with existing token
        }
      }
    }

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

// Enhanced response interceptor with automatic token refresh
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
  async (error) => {
    const originalRequest = error.config;

    // **AUTO TOKEN REFRESH: Handle 401 errors with token refresh**
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        console.log("🔄 401 error, attempting token refresh...");
        await refreshAccessToken();

        // Retry the original request with new token
        const user = safeLocalStorage.get("user");
        if (user?.accessToken) {
          originalRequest.headers.Authorization = `Bearer ${user.accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        // Clear invalid tokens and redirect to login
        safeLocalStorage.remove("user");
        window.location.href = "/login";
        throw new Error("Session expired. Please login again.");
      }
    }

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
        // Clear invalid token (if not already handled by refresh logic)
        if (originalRequest._retry) {
          safeLocalStorage.remove("user");
          throw new Error("Session expired. Please login again.");
        }
        break;
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

// **Enhanced Safe localStorage utility**
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
      localStorage.removeItem(key);
      return null;
    }
  },

  set: (key, value, expirationMs = null) => {
    try {
      let dataToStore = value;

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
      .replace(/[<>\"']/g, "")
      .substring(0, 1000);
  }
  return input;
};

// **Enhanced API response validation**
const validateResponse = (response, expectedFields = []) => {
  if (!response?.data) {
    throw new Error("Invalid server response format");
  }

  const data = response.data.data || response.data;

  if (!data) {
    throw new Error("Empty response from server");
  }

  for (const field of expectedFields) {
    if (!(field in data)) {
      throw new Error(`Missing required field in response: ${field}`);
    }
  }

  return data;
};

// **NEW: Token refresh function**
const refreshAccessToken = async () => {
  try {
    const response = await api.post(
      "/admin/refresh-token",
      {},
      {
        withCredentials: true, // Send cookies with refresh token
      }
    );

    const data = validateResponse(response, ["accessToken"]);

    // Update stored user data with new token
    const user = safeLocalStorage.get("user");
    if (user) {
      const updatedUser = {
        ...user,
        accessToken: data.accessToken,
        tokenExpiry: Date.now() + 15 * 60 * 1000, // Assume 15 min expiry
      };
      safeLocalStorage.set("user", updatedUser);
      console.log("✅ Access token refreshed successfully");
    }

    return data.accessToken;
  } catch (error) {
    console.error("Token refresh failed:", error);
    throw error;
  }
};

// **UPDATED: Enhanced login function with proper token storage**
export const loginAdmin = async (data) => {
  try {
    const sanitizedData = {
      name: sanitizeInput(data.name),
      password: data.password,
    };

    if (!sanitizedData.name || !sanitizedData.password) {
      throw new Error("Username and password are required");
    }

    const response = await api.post("/admin/login", sanitizedData, {
      withCredentials: true, // Important for cookies
    });

    const responseData = validateResponse(response, ["admin", "accessToken"]);

    // **ENHANCED: Store user data with token expiry tracking**
    const userData = {
      admin: responseData.admin,
      accessToken: responseData.accessToken,
      refreshToken: responseData.refreshToken, // Store refresh token too
      role: "admin",
      tokenExpiry: Date.now() + 15 * 60 * 1000, // Assume 15 minutes expiry
      loginTime: Date.now(),
    };

    safeLocalStorage.set("user", userData);

    console.log("✅ Admin logged in successfully:", responseData.admin.name);
    return responseData;
  } catch (error) {
    throw error;
  }
};

// **NEW: Logout function**
export const logoutAdmin = async () => {
  try {
    const user = safeLocalStorage.get("user");

    if (user?.accessToken) {
      // Call backend logout to clear cookies
      await api.post(
        "/admin/logout",
        {},
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
          withCredentials: true,
        }
      );
    }

    // Clear local storage
    safeLocalStorage.remove("user");
    console.log("✅ Admin logged out successfully");

    return true;
  } catch (error) {
    // Even if logout fails, clear local storage
    safeLocalStorage.remove("user");
    console.warn("Logout API failed, but cleared local storage:", error);
    return true;
  }
};

// **UPDATED: Enhanced API functions with proper token handling**
export const sendOtp = async (data) => {
  try {
    const sanitizedData = {
      email: sanitizeInput(data.email?.toLowerCase()),
      name: sanitizeInput(data.name),
      mobileNumber: sanitizeInput(
        data.mobileNumber?.replace(/[^\d+\-\s()]/g, "")
      ),
      purpose: sanitizeInput(data.purpose),
      visitDateAndTime: data.visitDateAndTime,
    };

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
    throw error;
  }
};

export const verifyOtp = async (data) => {
  try {
    const sanitizedData = {
      email: sanitizeInput(data.email?.toLowerCase()),
      otp: sanitizeInput(data.otp?.replace(/\D/g, "")),
      name: sanitizeInput(data.name),
      mobileNumber: sanitizeInput(data.mobileNumber),
      purpose: sanitizeInput(data.purpose),
      visitDateAndTime: data.visitDateAndTime,
    };

    if (!sanitizedData.otp || sanitizedData.otp.length !== 6) {
      throw new Error("Please enter a valid 6-digit OTP");
    }

    const response = await api.post("/user/verify-otp", sanitizedData);
    return validateResponse(response);
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

export const generateVisitorReport = async (filters, token) => {
  try {
    if (!token) {
      throw new Error("Authentication token is required");
    }

    const sanitizedFilters = {
      startDate: sanitizeInput(filters.startDate),
      endDate: sanitizeInput(filters.endDate),
      status: sanitizeInput(filters.status),
      search: sanitizeInput(filters.search || ""),
    };

    const queryParams = new URLSearchParams(sanitizedFilters);

    const response = await api.get(
      `/user/generate-visitor-report?${queryParams}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/pdf",
        },
        responseType: "blob",
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

// **Enhanced network connectivity checker**
export const checkNetworkConnection = () => {
  if (!navigator.onLine) {
    return false;
  }

  if (window.navigator.connection) {
    const connection = window.navigator.connection;
    if (connection.effectiveType === "slow-2g" || connection.downlink < 0.5) {
      return false;
    }
  }

  return true;
};

// **Enhanced rate limiting utility**
const rateLimiter = new Map();
export const checkRateLimit = (key, maxRequests = 5, windowMs = 60000) => {
  const now = Date.now();
  const requests = rateLimiter.get(key) || [];

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

// **Utility functions**
export const downloadFile = (
  blob,
  filename,
  mimeType = "application/octet-stream"
) => {
  try {
    if (!(blob instanceof Blob)) {
      throw new Error("Invalid file data");
    }

    const url = window.URL.createObjectURL(
      new Blob([blob], { type: mimeType })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("File download error:", error);
    throw new Error("Failed to download file");
  }
};

export const healthCheck = async () => {
  try {
    const response = await api.get("/health", { timeout: 5000 });
    return response.data;
  } catch (error) {
    throw new Error("Service health check failed");
  }
};

// **UPDATED: Session validation with token refresh**
export const validateSession = async (token) => {
  try {
    if (!token) return false;

    const response = await api.get("/admin/validate-session", {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 3000,
    });

    return response.status === 200;
  } catch (error) {
    // Try to refresh token if validation fails
    try {
      await refreshAccessToken();
      return true;
    } catch (refreshError) {
      return false;
    }
  }
};

// **NEW: Check if user is logged in and token is valid**
export const isLoggedIn = () => {
  const user = safeLocalStorage.get("user");
  if (!user || !user.accessToken) return false;

  // Check if token is expired
  if (user.tokenExpiry && Date.now() > user.tokenExpiry + 5 * 60 * 1000) {
    // Token expired more than 5 minutes ago, likely invalid
    return false;
  }

  return true;
};

// **Export all utilities**
export {
  safeLocalStorage,
  sanitizeInput,
  validateResponse,
  api as apiClient,
  refreshAccessToken,
};

// **Debug function for development**
export const debugAPI = () => {
  if (import.meta.env.DEV) {
    const user = safeLocalStorage.get("user");
    console.log("🔧 API Debug Info:", {
      baseURL: API_BASE_URL,
      timeout: REQUEST_TIMEOUT,
      rateLimiterSize: rateLimiter.size,
      networkStatus: checkNetworkConnection(),
      userLoggedIn: !!user,
      tokenExpiry: user?.tokenExpiry ? new Date(user.tokenExpiry) : null,
      tokenValid: isLoggedIn(),
    });
  }
};
