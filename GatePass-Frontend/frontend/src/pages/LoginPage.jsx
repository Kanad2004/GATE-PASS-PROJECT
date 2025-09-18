import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  loginAdmin,
  safeLocalStorage,
  checkNetworkConnection,
  checkRateLimit,
} from "../utils/api";
import {
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  UserIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  WifiIcon,
} from "@heroicons/react/24/outline";

const LoginPage = () => {
  const [credentials, setCredentials] = useState({
    name: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const navigate = useNavigate();
  const passwordTimeoutRef = useRef(null);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-hide password visibility after timeout for security
  useEffect(() => {
    if (showPassword) {
      passwordTimeoutRef.current = setTimeout(() => {
        setShowPassword(false);
      }, 30000); // Hide after 30 seconds
    }

    return () => {
      if (passwordTimeoutRef.current) {
        clearTimeout(passwordTimeoutRef.current);
      }
    };
  }, [showPassword]);

  // Check if user is already logged in
  useEffect(() => {
    const user = safeLocalStorage.get("user");
    if (user && user.role === "admin") {
      navigate("/");
    }
  }, [navigate]);

  // Load remembered credentials
  useEffect(() => {
    const remembered = safeLocalStorage.get("rememberedCredentials");
    if (remembered?.name) {
      setCredentials((prev) => ({ ...prev, name: remembered.name }));
      setRememberMe(true);
    }
  }, []);

  // Enhanced validation with security rules
  const validate = () => {
    const newErrors = {};

    if (!credentials.name?.trim()) {
      newErrors.name = "Username is required";
    } else if (credentials.name.trim().length < 3) {
      newErrors.name = "Username must be at least 3 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(credentials.name.trim())) {
      newErrors.name =
        "Username can only contain letters, numbers, and underscores";
    }

    if (!credentials.password) {
      newErrors.password = "Password is required";
    } else if (credentials.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Network check
    if (!checkNetworkConnection()) {
      setErrors({
        auth: "No internet connection. Please check your network and try again.",
      });
      return;
    }

    // Rate limiting for security
    try {
      checkRateLimit("login", 5, 300000); // Max 5 attempts per 5 minutes
    } catch (rateLimitError) {
      setErrors({ auth: rateLimitError.message });
      return;
    }

    // Validation
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setLoginAttempts((prev) => prev + 1);

    try {
      const response = await loginAdmin({
        name: credentials.name.trim(),
        password: credentials.password,
      });

      // Store user data securely
      const userData = {
        name: response.admin.name,
        role: "admin",
        accessToken: response.accessToken,
        loginTime: Date.now(),
      };

      safeLocalStorage.set("user", userData);

      // Handle remember me functionality (only username, never password)
      if (rememberMe) {
        safeLocalStorage.set("rememberedCredentials", {
          name: credentials.name.trim(),
        });
      } else {
        safeLocalStorage.remove("rememberedCredentials");
      }

      // Clear sensitive data from state
      setCredentials({ name: "", password: "" });
      setShowPassword(false);

      // Reset attempts on successful login
      setLoginAttempts(0);

      // Navigate to admin dashboard
      navigate("/");
    } catch (error) {
      console.error("Login error:", error);

      // Enhanced error handling
      let errorMessage = "Invalid admin credentials";

      if (error.message?.includes("Network")) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else if (error.message?.includes("timeout")) {
        errorMessage = "Request timeout. Please try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Show security warning after multiple attempts
      if (loginAttempts >= 2) {
        errorMessage += ` (${3 - loginAttempts} attempts remaining)`;
      }

      setErrors({ auth: errorMessage });

      // Clear password field for security
      setCredentials((prev) => ({ ...prev, password: "" }));
      setShowPassword(false);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      handleSubmit(e);
    }
  };

  const handlePasswordToggle = () => {
    setShowPassword(!showPassword);

    // Clear any existing timeout
    if (passwordTimeoutRef.current) {
      clearTimeout(passwordTimeoutRef.current);
    }
  };

  const handleInputChange = (field, value) => {
    setCredentials((prev) => ({ ...prev, [field]: value }));

    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden flex items-center justify-center px-4 py-8">
      {/* Animated Background */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-8">
          {/* Offline Indicator */}
          {!isOnline && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center">
              <WifiIcon className="w-5 h-5 text-rose-500 mr-2" />
              <span className="text-rose-700 text-sm">
                You're offline. Login requires internet connection.
              </span>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-6 shadow-lg">
              <ShieldCheckIcon className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Admin Portal
            </h2>
            <p className="text-lg text-gray-600">
              Access administrative dashboard
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            {/* Auth Error */}
            {errors.auth && (
              <div className="p-4 bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-xl animate-shake">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-rose-500 mr-2 flex-shrink-0" />
                  <p className="text-rose-700">{errors.auth}</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Username Field */}
              <div className="group">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-indigo-600 transition-colors duration-200"
                >
                  <UserIcon className="w-4 h-4 inline mr-2" />
                  Admin Username
                </label>
                <div className="relative">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="username"
                    value={credentials.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField("")}
                    onKeyDown={handleKeyDown}
                    className={`w-full px-4 py-3 bg-white/70 backdrop-blur-sm border-2 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 ${
                      errors.name
                        ? "border-rose-400 bg-rose-50/70"
                        : focusedField === "name"
                          ? "border-indigo-500 bg-indigo-50/70"
                          : "border-gray-200 hover:border-gray-300"
                    }`}
                    placeholder="Enter admin username"
                    aria-invalid={errors.name ? "true" : "false"}
                    aria-describedby={errors.name ? "name-error" : undefined}
                  />
                </div>
                {errors.name && (
                  <p
                    id="name-error"
                    className="mt-2 text-sm text-rose-600 flex items-center animate-shake"
                  >
                    <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="group">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-indigo-600 transition-colors duration-200"
                >
                  <LockClosedIcon className="w-4 h-4 inline mr-2" />
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={credentials.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField("")}
                    onKeyDown={handleKeyDown}
                    className={`w-full px-4 py-3 pr-12 bg-white/70 backdrop-blur-sm border-2 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 ${
                      errors.password
                        ? "border-rose-400 bg-rose-50/70"
                        : focusedField === "password"
                          ? "border-indigo-500 bg-indigo-50/70"
                          : "border-gray-200 hover:border-gray-300"
                    }`}
                    placeholder="Enter admin password"
                    aria-invalid={errors.password ? "true" : "false"}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={handlePasswordToggle}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors duration-200 p-1 rounded"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p
                    id="password-error"
                    className="mt-2 text-sm text-rose-600 flex items-center animate-shake"
                  >
                    <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                    {errors.password}
                  </p>
                )}
                {showPassword && (
                  <p className="mt-1 text-xs text-amber-600">
                    Password will be hidden automatically in 30 seconds
                  </p>
                )}
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-colors"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-gray-700"
                >
                  Remember username
                </label>
              </div>

              <div className="text-sm">
                <a
                  href="#"
                  className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors duration-200"
                  onClick={(e) => {
                    e.preventDefault();
                    alert(
                      "Please contact your system administrator for password reset."
                    );
                  }}
                >
                  Forgot password?
                </a>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading || !isOnline || loginAttempts >= 3}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <ShieldCheckIcon className="w-5 h-5 mr-2" />
                  Sign in as Admin
                </div>
              )}
            </button>

            {/* Additional Info */}
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Regular users don't need to sign in.{" "}
                <a
                  href="/"
                  className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors duration-200"
                >
                  Register for a visit
                </a>
              </p>

              {loginAttempts >= 2 && (
                <p className="text-xs text-amber-600">
                  Security: Multiple login attempts detected. Account may be
                  temporarily locked after 3 failed attempts.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
