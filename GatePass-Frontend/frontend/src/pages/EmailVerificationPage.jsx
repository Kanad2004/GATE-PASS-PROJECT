import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  verifyOtp,
  sendOtp,
  safeLocalStorage,
  checkNetworkConnection,
} from "../utils/api";
import {
  EnvelopeIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  WifiIcon,
} from "@heroicons/react/24/outline";

const EmailVerificationPage = () => {
  const [otpInput, setOtpInput] = useState(Array(6).fill(""));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(600);
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [attempts, setAttempts] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const inputRefs = useRef([]);

  // Safe state access with fallback
  const formData = location.state?.formData;
  const visitDateTime = location.state?.visitDateTime;

  // **FIX: Persistent OTP Timer** - Store absolute start time
  const [otpStartTime] = useState(() => {
    const saved = safeLocalStorage.get("otpStartTime");
    if (saved && Date.now() - saved < 600000) {
      // If less than 10 minutes old
      return saved;
    } else {
      const startTime = Date.now();
      safeLocalStorage.set("otpStartTime", startTime);
      return startTime;
    }
  });

  // Enhanced input validation
  const validateOtpInput = useCallback((otp) => {
    const otpString = Array.isArray(otp) ? otp.join("") : otp;
    return /^\d{6}$/.test(otpString);
  }, []);

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

  // **FIX: Enhanced Timer with Persistence**
  useEffect(() => {
    // Validate required data
    if (!formData || !visitDateTime) {
      setError("Session expired. Please start the registration process again.");
      safeLocalStorage.remove("otpStartTime"); // Clean up
      const timer = setTimeout(() => navigate("/"), 3000);
      return () => clearTimeout(timer);
    }

    const updateCountdown = () => {
      const elapsed = Date.now() - otpStartTime;
      const remaining = Math.max(0, 600000 - elapsed); // 10 minutes in milliseconds
      const remainingSeconds = Math.floor(remaining / 1000);

      setCountdown(remainingSeconds);

      if (remainingSeconds <= 0) {
        setCanResend(true);
        return false; // Stop timer
      }
      return true; // Continue timer
    };

    // Initial update
    if (!updateCountdown()) return;

    // Set up interval with proper cleanup
    timerRef.current = setInterval(() => {
      if (!updateCountdown()) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 1000);

    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [formData, visitDateTime, navigate, otpStartTime]);

  // Auto-focus first input
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Network check
    if (!checkNetworkConnection()) {
      setError(
        "No internet connection. Please check your network and try again."
      );
      return;
    }

    // Validation
    if (!validateOtpInput(otpInput)) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    // Rate limiting
    if (attempts >= 3) {
      setError("Too many attempts. Please wait before trying again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await verifyOtp({
        email: formData.email,
        otp: otpInput.join(""),
        name: formData.name,
        mobileNumber: formData.mobileNumber,
        purpose: formData.purpose,
        visitDateAndTime: visitDateTime,
      });

      // **FIX: Clean up timer data on success**
      safeLocalStorage.remove("otpStartTime");

      setSuccess(
        "Your request has been sent to admin for approval. You will receive a QR code on your registered email upon approval."
      );

      // Clear sensitive data
      setOtpInput(Array(6).fill(""));

      // Auto redirect with cleanup
      const redirectTimer = setTimeout(() => navigate("/"), 5000);
      return () => clearTimeout(redirectTimer);
    } catch (error) {
      setAttempts((prev) => prev + 1);
      setError(error.message || "Invalid OTP. Please try again.");
      setOtpInput(Array(6).fill(""));

      // Focus back to first input
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    } finally {
      setLoading(false);
    }
  };

  // **FIX: Enhanced Resend with Timer Reset**
  const handleResendOtp = async () => {
    if (!canResend || !checkNetworkConnection()) {
      setError(
        !isOnline
          ? "No internet connection"
          : "Please wait until the timer expires to resend OTP"
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      await sendOtp({
        email: formData.email,
        name: formData.name,
        mobileNumber: formData.mobileNumber,
        purpose: formData.purpose,
        visitDateAndTime: visitDateTime,
      });

      // **FIX: Reset timer with new start time**
      const newStartTime = Date.now();
      safeLocalStorage.set("otpStartTime", newStartTime);

      // Reset local states
      setCountdown(600);
      setCanResend(false);
      setAttempts(0); // Reset attempts on successful resend
      setSuccess("A new OTP has been sent to your email.");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);

      // **FIX: Reload to sync with new timer**
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      setError(error.message || "Failed to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otpInput];
    newOtp[index] = value;
    setOtpInput(newOtp);

    // Auto-focus next input
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
      setFocusedIndex(index + 1);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otpInput[index] && index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus();
        setFocusedIndex(index - 1);
      }
    } else if (
      e.key === "ArrowLeft" &&
      index > 0 &&
      inputRefs.current[index - 1]
    ) {
      inputRefs.current[index - 1].focus();
      setFocusedIndex(index - 1);
    } else if (
      e.key === "ArrowRight" &&
      index < 5 &&
      inputRefs.current[index + 1]
    ) {
      inputRefs.current[index + 1].focus();
      setFocusedIndex(index + 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text");
    const digits = paste.replace(/\D/g, "").slice(0, 6);

    if (digits.length === 6) {
      const newOtp = digits.split("");
      setOtpInput(newOtp);

      // Focus last input
      if (inputRefs.current[5]) {
        inputRefs.current[5].focus();
        setFocusedIndex(5);
      }
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = () => ((600 - countdown) / 600) * 100;

  // Early return for invalid state
  if (!formData || !visitDateTime) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Session Expired
          </h2>
          <p className="text-gray-600 mb-4">
            Please start the registration process again.
          </p>
          <button
            onClick={() => {
              safeLocalStorage.remove("otpStartTime"); // Clean up
              navigate("/");
            }}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go to Registration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden flex items-center justify-center py-12 px-4">
      {/* Animated Background */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10 max-w-md w-full space-y-8">
        <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-8">
          {/* Offline Indicator */}
          {!isOnline && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center">
              <WifiIcon className="w-5 h-5 text-rose-500 mr-2" />
              <span className="text-rose-700 text-sm">
                You're offline. Please check your connection.
              </span>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-6 shadow-lg">
              <EnvelopeIcon className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Verify Your Email
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              We've sent a 6-digit OTP to{" "}
              <span className="font-semibold text-indigo-600 break-all">
                {formData?.email}
              </span>
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-xl animate-shake">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-rose-500 mr-2 flex-shrink-0" />
                <p className="text-rose-700">{error}</p>
              </div>
              {attempts >= 2 && (
                <p className="text-rose-600 text-sm mt-2">
                  Attempts remaining: {3 - attempts}
                </p>
              )}
            </div>
          )}

          {success ? (
            <div className="text-center space-y-6">
              <div className="relative">
                <CheckCircleIcon className="w-20 h-20 text-emerald-500 mx-auto animate-bounce" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <SparklesIcon className="w-8 h-8 text-emerald-300 animate-spin" />
                </div>
              </div>
              <div className="p-6 bg-emerald-50/80 backdrop-blur-sm border border-emerald-200 rounded-xl">
                <p className="text-emerald-700 font-medium leading-relaxed">
                  {success}
                </p>
              </div>
              <div className="flex justify-center">
                <div className="animate-pulse bg-gradient-to-r from-emerald-400 to-teal-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                  Redirecting to home page...
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Timer Display */}
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <svg
                    className="w-24 h-24 transform -rotate-90"
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-gray-200"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray="251.2"
                      strokeDashoffset={
                        251.2 - (251.2 * getProgressPercentage()) / 100
                      }
                      className="text-indigo-500 transition-all duration-1000 ease-in-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <ClockIcon className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
                      <div className="text-lg font-bold text-gray-700">
                        {formatTime(countdown)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <form className="space-y-8" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4 text-center">
                    Enter 6-digit OTP
                  </label>
                  <div
                    className="flex justify-center space-x-3"
                    onPaste={handlePaste}
                  >
                    {Array(6)
                      .fill(0)
                      .map((_, index) => (
                        <input
                          key={index}
                          ref={(el) => (inputRefs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength="1"
                          value={otpInput[index] || ""}
                          onChange={(e) =>
                            handleOtpChange(index, e.target.value)
                          }
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          onFocus={() => setFocusedIndex(index)}
                          className={`w-12 h-12 text-center text-xl font-bold border-2 rounded-xl bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 ${
                            focusedIndex === index
                              ? "border-indigo-500 bg-indigo-50/70 scale-110"
                              : otpInput[index]
                                ? "border-emerald-400 bg-emerald-50/70"
                                : "border-gray-200 hover:border-gray-300"
                          }`}
                          aria-label={`OTP digit ${index + 1}`}
                          autoComplete="off"
                        />
                      ))}
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    You can paste the 6-digit code directly
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !validateOtpInput(otpInput) || !isOnline}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Verifying...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <CheckCircleIcon className="w-5 h-5 mr-2" />
                      Verify OTP
                    </div>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading || !canResend || !isOnline}
                    className={`inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium transition-all duration-200 ${
                      !canResend || !isOnline
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:underline transform hover:scale-105"
                    }`}
                  >
                    <ArrowPathIcon
                      className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
                    />
                    Resend OTP
                  </button>
                  {!canResend && (
                    <p className="text-sm text-gray-500 mt-1">
                      Resend available in {formatTime(countdown)}
                    </p>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;
