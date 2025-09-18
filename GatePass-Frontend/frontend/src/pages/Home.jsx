import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  sendOtp,
  safeLocalStorage,
  checkNetworkConnection,
  checkRateLimit,
} from "../utils/api";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  CalendarIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  QrCodeIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  WifiIcon,
  SparklesIcon,
  DocumentArrowDownIcon, // Added for visitor reports
} from "@heroicons/react/24/outline";

const Home = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobileNumber: "",
    purpose: "",
  });
  const [visitDateTime, setVisitDateTime] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [submitAttempts, setSubmitAttempts] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();

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

  // Enhanced location state handling
  useEffect(() => {
    try {
      if (location.state?.activeTab) {
        setActiveTab(location.state.activeTab);
      }

      if (location.state?.scanResult) {
        setScanResult(location.state.scanResult);
        setShowSuccessAnimation(true);
        const timer = setTimeout(() => setShowSuccessAnimation(false), 3000);
        return () => clearTimeout(timer);
      }

      // Safe localStorage access
      const savedResult = safeLocalStorage.get("scanResult");
      if (savedResult && !scanResult) {
        setScanResult(savedResult);
        safeLocalStorage.remove("scanResult");
        setShowSuccessAnimation(true);
        const timer = setTimeout(() => setShowSuccessAnimation(false), 3000);
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error("Error processing location state:", error);
    }
  }, [location.state, scanResult]);

  // Enhanced form validation with international support
  const validate = useCallback(() => {
    const newErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    } else if (formData.name.trim().length > 50) {
      newErrors.name = "Name must be less than 50 characters";
    } else if (!/^[a-zA-Z\s.'-]+$/u.test(formData.name.trim())) {
      newErrors.name = "Name contains invalid characters";
    }

    // Enhanced email validation
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address";
    } else if (formData.email.trim().length > 254) {
      newErrors.email = "Email address is too long";
    }

    // International phone validation
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/; // International format
    const indianPhoneRegex = /^[6-9]\d{9}$/; // Indian format
    if (!formData.mobileNumber.trim()) {
      newErrors.mobileNumber = "Mobile number is required";
    } else {
      const cleanPhone = formData.mobileNumber.replace(/[\s\-\(\)]/g, "");
      if (!phoneRegex.test(cleanPhone) && !indianPhoneRegex.test(cleanPhone)) {
        newErrors.mobileNumber = "Please enter a valid phone number";
      }
    }

    // Purpose validation
    if (!formData.purpose.trim()) {
      newErrors.purpose = "Purpose of visit is required";
    } else if (formData.purpose.trim().length < 10) {
      newErrors.purpose =
        "Please provide more details about your visit (minimum 10 characters)";
    } else if (formData.purpose.trim().length > 500) {
      newErrors.purpose =
        "Purpose description is too long (maximum 500 characters)";
    }

    // Enhanced date validation
    if (!visitDateTime) {
      newErrors.visitDateTime = "Visit date and time is required";
    } else {
      const now = new Date();
      const minDate = new Date(now.getTime() + 30 * 60000); // 30 minutes from now
      const maxDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      if (visitDateTime < minDate) {
        newErrors.visitDateTime =
          "Visit time must be at least 30 minutes from now";
      } else if (visitDateTime > maxDate) {
        newErrors.visitDateTime =
          "Visit time cannot be more than 30 days in advance";
      }

      // Check business hours (9 AM to 6 PM)
      const hour = visitDateTime.getHours();
      if (hour < 9 || hour >= 18) {
        newErrors.visitDateTime =
          "Please select a time during business hours (9 AM - 6 PM)";
      }

      // Check weekends
      const day = visitDateTime.getDay();
      if (day === 0 || day === 6) {
        newErrors.visitDateTime = "Office visits are not available on weekends";
      }
    }

    return newErrors;
  }, [formData, visitDateTime]);

  // **FIX: Stable input change handlers using useCallback**
  const handleNameChange = useCallback(
    (e) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, name: value }));

      // Clear field-specific error
      if (errors.name) {
        setErrors((prev) => ({ ...prev, name: "" }));
      }
    },
    [errors.name]
  );

  const handleEmailChange = useCallback(
    (e) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, email: value }));

      // Clear field-specific error
      if (errors.email) {
        setErrors((prev) => ({ ...prev, email: "" }));
      }
    },
    [errors.email]
  );

  const handleMobileChange = useCallback(
    (e) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, mobileNumber: value }));

      // Clear field-specific error
      if (errors.mobileNumber) {
        setErrors((prev) => ({ ...prev, mobileNumber: "" }));
      }
    },
    [errors.mobileNumber]
  );

  const handlePurposeChange = useCallback(
    (e) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, purpose: value }));

      // Clear field-specific error
      if (errors.purpose) {
        setErrors((prev) => ({ ...prev, purpose: "" }));
      }
    },
    [errors.purpose]
  );

  const handleDateTimeChange = useCallback(
    (date) => {
      setVisitDateTime(date);

      // Clear field-specific error
      if (errors.visitDateTime) {
        setErrors((prev) => ({ ...prev, visitDateTime: "" }));
      }
    },
    [errors.visitDateTime]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // **FIX: Clear any existing OTP timer when starting new registration**
    safeLocalStorage.remove("otpStartTime");

    // Network check
    if (!checkNetworkConnection()) {
      setErrors({
        submit:
          "No internet connection. Please check your network and try again.",
      });
      return;
    }

    // Rate limiting
    try {
      checkRateLimit("registration", 3, 600000); // Max 3 registrations per 10 minutes
    } catch (rateLimitError) {
      setErrors({ submit: rateLimitError.message });
      return;
    }

    // Comprehensive validation
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);

      // Scroll to first error
      const firstErrorField = document.querySelector(".border-rose-400");
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: "smooth", block: "center" });
        firstErrorField.focus();
      }
      return;
    }

    setLoading(true);
    setSubmitAttempts((prev) => prev + 1);

    try {
      // Sanitize and prepare data
      const sanitizedData = {
        email: formData.email.trim().toLowerCase(),
        name: formData.name.trim(),
        mobileNumber: formData.mobileNumber.replace(/[\s\-\(\)]/g, ""),
        purpose: formData.purpose.trim(),
        visitDateAndTime: visitDateTime.toISOString(),
      };

      await sendOtp(sanitizedData);

      // Navigate with clean state
      navigate("/verify-email", {
        state: {
          formData: sanitizedData,
          visitDateTime: sanitizedData.visitDateAndTime,
        },
      });
    } catch (error) {
      console.error("Submit error:", error);

      let errorMessage = "Failed to send OTP. Please try again.";

      if (error.message?.includes("Network")) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else if (error.message?.includes("timeout")) {
        errorMessage = "Request timeout. Please try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Add attempt info for multiple failures
      if (submitAttempts >= 2) {
        errorMessage += ` (Attempt ${submitAttempts + 1})`;
      }

      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const isLoggedIn = useCallback(() => {
    const user = safeLocalStorage.get("user");
    return user && user.role === "admin";
  }, []);

  const handleLogout = useCallback(() => {
    safeLocalStorage.remove("user");
    setActiveTab("home");
    navigate("/");
  }, [navigate]);

  const TabButton = ({
    id,
    label,
    icon: Icon,
    isActive,
    onClick,
    disabled = false,
  }) => (
    <button
      onClick={() => !disabled && onClick(id)}
      disabled={disabled}
      className={`group relative flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
        isActive
          ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
          : "bg-white/70 backdrop-blur-sm text-gray-700 hover:bg-white/90 border border-white/20"
      }`}
      aria-label={label}
    >
      <Icon
        className={`w-5 h-5 transition-transform duration-300 ${
          isActive ? "rotate-12" : "group-hover:rotate-12"
        }`}
      />
      <span>{label}</span>
      {isActive && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 opacity-20 animate-pulse" />
      )}
    </button>
  );

  // **FIX: Stable InputField component to prevent re-renders**
  const InputField = useCallback(
    ({
      id,
      label,
      type = "text",
      value,
      onChange,
      error,
      icon: Icon,
      placeholder,
      maxLength,
      ...props
    }) => (
      <div className="group">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-indigo-600 transition-colors duration-200"
        >
          <Icon className="w-4 h-4 inline mr-2" />
          {label}
        </label>
        <div className="relative">
          <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            maxLength={maxLength}
            className={`w-full px-4 py-3 bg-white/70 backdrop-blur-sm border-2 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 ${
              error
                ? "border-rose-400 bg-rose-50/70"
                : "border-gray-200 hover:border-gray-300"
            }`}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? `${id}-error` : undefined}
            {...props}
          />
          {error && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <ExclamationTriangleIcon className="w-5 h-5 text-rose-400" />
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${id}-error`}
            className="mt-2 text-sm text-rose-600 flex items-center animate-shake"
          >
            <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
            {error}
          </p>
        )}
        {maxLength && (
          <p className="mt-1 text-xs text-gray-500 text-right">
            {value.length}/{maxLength}
          </p>
        )}
      </div>
    ),
    []
  ); // Empty dependency array makes it stable

  const SuccessCard = ({ result }) => (
    <div
      className={`bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-6 shadow-lg transform transition-all duration-500 ${
        showSuccessAnimation ? "animate-slideIn scale-105" : ""
      }`}
    >
      <div className="flex items-center justify-center mb-4">
        <div className="relative">
          {result.success ? (
            <CheckCircleIcon className="w-16 h-16 text-emerald-500 animate-bounce" />
          ) : (
            <ExclamationTriangleIcon className="w-16 h-16 text-rose-500 animate-shake" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <SparklesIcon className="w-8 h-8 text-emerald-300 animate-spin" />
          </div>
        </div>
      </div>

      <div className="text-center space-y-3">
        <h3 className="text-2xl font-bold text-emerald-800">
          {result.success ? "Scan Successful!" : "Scan Failed"}
        </h3>
        <p
          className={`text-lg ${
            result.success ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {result.message}
        </p>

        {result.entryExitMessage && (
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-emerald-200">
            <p className="font-semibold text-indigo-700 flex items-center justify-center">
              <ClockIcon className="w-5 h-5 mr-2" />
              {result.entryExitMessage}
            </p>
          </div>
        )}

        {result.user && (
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-emerald-200">
            <h4 className="font-semibold text-gray-800 mb-2 flex items-center justify-center">
              <UserIcon className="w-5 h-5 mr-2" />
              Visitor Details
            </h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                <span className="font-medium">Name:</span> {result.user.name}
              </p>
              <p>
                <span className="font-medium">Email:</span> {result.user.email}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => setScanResult(null)}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
        >
          Close
        </button>
      </div>
    </div>
  );

  const FeatureCard = ({ icon: Icon, title, description, gradient }) => (
    <div
      className={`group relative bg-gradient-to-br ${gradient} p-6 rounded-2xl shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <Icon className="w-12 h-12 text-white mb-4 transform group-hover:rotate-12 transition-transform duration-300" />
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-white/90 text-sm leading-relaxed">{description}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-6 shadow-lg transform rotate-3 hover:rotate-6 transition-transform duration-300">
            <QrCodeIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-600 bg-clip-text text-transparent mb-4">
            Visitor Management System
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Streamlined visitor registration and QR-based access control for
            modern offices
          </p>
        </header>

        {/* Offline Indicator */}
        {!isOnline && (
          <div className="max-w-4xl mx-auto mb-6 p-4 bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-xl flex items-center justify-center">
            <WifiIcon className="w-5 h-5 text-rose-500 mr-2 flex-shrink-0" />
            <span className="text-rose-700">
              You're offline. Some features may not work properly.
            </span>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap justify-center gap-4 mb-12">
          <TabButton
            id="home"
            label="Register Visit"
            icon={UserIcon}
            isActive={activeTab === "home"}
            onClick={setActiveTab}
            disabled={!isOnline}
          />
          {isLoggedIn() && (
            <>
              <TabButton
                id="requests"
                label="Manage Requests"
                icon={DocumentTextIcon}
                isActive={activeTab === "requests"}
                onClick={setActiveTab}
              />
              <TabButton
                id="scanner"
                label="QR Scanner"
                icon={QrCodeIcon}
                isActive={activeTab === "scanner"}
                onClick={setActiveTab}
              />
              <TabButton
                id="reports"
                label="Visitor Reports"
                icon={DocumentArrowDownIcon}
                isActive={activeTab === "reports"}
                onClick={setActiveTab}
              />
            </>
          )}
          <TabButton
            id={isLoggedIn() ? "logout" : "login"}
            label={isLoggedIn() ? "Logout" : "Admin Login"}
            icon={ShieldCheckIcon}
            isActive={false}
            onClick={isLoggedIn() ? handleLogout : () => navigate("/login")}
          />
        </nav>

        {/* Tab Content */}
        <main className="max-w-4xl mx-auto">
          {activeTab === "home" && (
            <div className="space-y-8">
              {scanResult && <SuccessCard result={scanResult} />}

              {/* Registration Form */}
              <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 p-8">
                <div className="text-center mb-8">
                  <UserGroupIcon className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">
                    Register Your Visit
                  </h2>
                  <p className="text-gray-600">
                    Fill in your details to request access
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                  {errors.submit && (
                    <div className="bg-rose-50 border-l-4 border-rose-400 p-4 rounded-lg animate-shake">
                      <div className="flex items-center">
                        <ExclamationTriangleIcon className="w-5 h-5 text-rose-400 mr-2" />
                        <p className="text-rose-700">{errors.submit}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    <InputField
                      id="name"
                      label="Full Name"
                      value={formData.name}
                      onChange={handleNameChange}
                      error={errors.name}
                      icon={UserIcon}
                      placeholder="Enter your full name"
                      maxLength={50}
                      autoComplete="name"
                    />
                    <InputField
                      id="email"
                      label="Email Address"
                      type="email"
                      value={formData.email}
                      onChange={handleEmailChange}
                      error={errors.email}
                      icon={EnvelopeIcon}
                      placeholder="Enter your email"
                      maxLength={254}
                      autoComplete="email"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <InputField
                      id="mobileNumber"
                      label="Mobile Number"
                      type="tel"
                      value={formData.mobileNumber}
                      onChange={handleMobileChange}
                      error={errors.mobileNumber}
                      icon={PhoneIcon}
                      placeholder="Enter your phone number"
                      autoComplete="tel"
                    />

                    <div className="group">
                      <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-indigo-600 transition-colors duration-200">
                        <CalendarIcon className="w-4 h-4 inline mr-2" />
                        Visit Date & Time
                      </label>
                      <DatePicker
                        selected={visitDateTime}
                        onChange={handleDateTimeChange}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="MMMM d, yyyy h:mm aa"
                        minDate={new Date(Date.now() + 30 * 60000)}
                        maxDate={
                          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        }
                        filterTime={(time) => {
                          const hour = time.getHours();
                          return hour >= 9 && hour < 18;
                        }}
                        filterDate={(date) => {
                          const day = date.getDay();
                          return day !== 0 && day !== 6; // Exclude weekends
                        }}
                        className={`w-full px-4 py-3 bg-white/70 backdrop-blur-sm border-2 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 ${
                          errors.visitDateTime
                            ? "border-rose-400 bg-rose-50/70"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        placeholderText="Select visit date and time"
                        autoComplete="off"
                      />
                      {errors.visitDateTime && (
                        <p className="mt-2 text-sm text-rose-600 flex items-center animate-shake">
                          <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                          {errors.visitDateTime}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="group">
                    <label
                      htmlFor="purpose"
                      className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-indigo-600 transition-colors duration-200"
                    >
                      <ClipboardDocumentListIcon className="w-4 h-4 inline mr-2" />
                      Purpose of Visit
                    </label>
                    <textarea
                      id="purpose"
                      rows={4}
                      value={formData.purpose}
                      onChange={handlePurposeChange}
                      placeholder="Please describe the purpose of your visit in detail..."
                      maxLength={500}
                      className={`w-full px-4 py-3 bg-white/70 backdrop-blur-sm border-2 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 resize-none ${
                        errors.purpose
                          ? "border-rose-400 bg-rose-50/70"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      aria-invalid={errors.purpose ? "true" : "false"}
                      aria-describedby={
                        errors.purpose ? "purpose-error" : undefined
                      }
                    />
                    {errors.purpose && (
                      <p
                        id="purpose-error"
                        className="mt-2 text-sm text-rose-600 flex items-center animate-shake"
                      >
                        <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                        {errors.purpose}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 text-right">
                      {formData.purpose.length}/500
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !isOnline}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Sending OTP...
                      </div>
                    ) : (
                      "Send OTP & Register"
                    )}
                  </button>
                </form>
              </div>

              {/* Features Section */}
              <div className="grid md:grid-cols-3 gap-6 mt-12">
                <FeatureCard
                  icon={QrCodeIcon}
                  title="QR Code Access"
                  description="Secure QR-based entry system with real-time validation"
                  gradient="from-indigo-500 to-blue-600"
                />
                <FeatureCard
                  icon={ShieldCheckIcon}
                  title="Admin Control"
                  description="Complete admin dashboard for managing visitor requests"
                  gradient="from-purple-500 to-pink-600"
                />
                <FeatureCard
                  icon={ClockIcon}
                  title="Real-time Tracking"
                  description="Track entry and exit times with detailed logs"
                  gradient="from-teal-500 to-green-600"
                />
              </div>
            </div>
          )}

          {activeTab === "requests" && isLoggedIn() && (
            <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 p-8 text-center">
              <DocumentTextIcon className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Manage Visitor Requests
              </h2>
              <p className="text-gray-600 mb-6">
                Review and approve pending visitor applications
              </p>
              <Link
                to="/requests"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              >
                View Requests
                <DocumentTextIcon className="w-5 h-5 ml-2" />
              </Link>
            </div>
          )}

          {activeTab === "scanner" && isLoggedIn() && (
            <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 p-8 text-center">
              <QrCodeIcon className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                QR Code Scanner
              </h2>
              <p className="text-gray-600 mb-6">
                Scan visitor QR codes for entry/exit logging
              </p>
              <Link
                to="/scan"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              >
                Open Scanner
                <QrCodeIcon className="w-5 h-5 ml-2" />
              </Link>
            </div>
          )}

          {activeTab === "reports" && isLoggedIn() && (
            <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 p-8 text-center">
              <DocumentArrowDownIcon className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Visitor Reports
              </h2>
              <p className="text-gray-600 mb-6">
                Generate and download PDF reports of visitor records
              </p>
              <Link
                to="/visitor-reports"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              >
                Generate Reports
                <DocumentArrowDownIcon className="w-5 h-5 ml-2" />
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Home;
