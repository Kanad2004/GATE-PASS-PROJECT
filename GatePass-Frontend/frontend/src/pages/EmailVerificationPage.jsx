import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { verifyOtp, sendOtp } from "../utils/api";

const EmailVerificationPage = () => {
  const [otpInput, setOtpInput] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(600); // 10 minutes
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { formData, visitDateTime } = location.state || {};

  useEffect(() => {
    if (!formData || !visitDateTime) {
      setError("No registration data found. Please register again.");
      setTimeout(() => navigate("/"), 3000);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [formData, visitDateTime, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!otpInput || otpInput.length !== 6) {
      setError("Please enter a 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      await verifyOtp({
        email: formData.email,
        otp: otpInput,
        name: formData.name,
        mobileNumber: formData.mobileNumber,
        purpose: formData.purpose,
        visitDateAndTime: visitDateTime,
      });
      setSuccess(
        "Your request has been sent to admin for approval. You will receive a QR code on your registered email upon approval."
      );
      setError("");
      setTimeout(() => navigate("/"), 5000);
    } catch (error) {
      setError(error.message || "Invalid OTP. Please try again.");
      setSuccess("");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) {
      setError("Please wait until the timer expires to resend OTP.");
      return;
    }

    setLoading(true);
    try {
      await sendOtp({
        email: formData.email,
        name: formData.name,
        mobileNumber: formData.mobileNumber,
        purpose: formData.purpose,
        visitDateAndTime: visitDateTime,
      });
      setCountdown(600);
      setCanResend(false);
      setError("");
      setSuccess("A new OTP has been sent to your email.");
    } catch (error) {
      setError(error.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-gray-100 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.1),inset_-4px_-4px_8px_rgba(255,255,255,0.8)] p-8 rounded-2xl">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-gray-800">
            Verify Your Email
          </h2>
          <p className="mt-2 text-lg text-gray-500">
            We’ve sent a 6-digit OTP to{" "}
            <span className="font-semibold text-indigo-600">
              {formData?.email || "your email"}
            </span>
            . Please enter it below.
          </p>
        </div>
        {error && (
          <p className="text-rose-500 text-center bg-rose-50 py-2 rounded-lg">
            {error}
          </p>
        )}
        {success ? (
          <div className="text-center">
            <svg
              className="w-16 h-16 mx-auto text-emerald-500 animate-checkmark"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="text-emerald-600 text-center bg-emerald-50 py-2 rounded-lg">
              {success}
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-6">
              <svg className="w-24 h-24" viewBox="0 0 100 100">
                <circle
                  className="text-gray-200"
                  strokeWidth="10"
                  stroke="currentColor"
                  fill="none"
                  r="40"
                  cx="50"
                  cy="50"
                />
                <circle
                  className="text-indigo-600"
                  strokeWidth="10"
                  stroke="currentColor"
                  fill="none"
                  r="40"
                  cx="50"
                  cy="50"
                  strokeDasharray="251.2"
                  strokeDashoffset={(251.2 * (600 - countdown)) / 600}
                  transform="rotate(-90 50 50)"
                />
                <text
                  x="50"
                  y="55"
                  textAnchor="middle"
                  fill="currentColor"
                  className="text-xl font-bold text-gray-600"
                >
                  {formatTime(countdown)}
                </text>
              </svg>
            </div>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="flex justify-center space-x-2">
                {[...Array(6)].map((_, index) => (
                  <input
                    key={index}
                    type="text"
                    maxLength="1"
                    value={otpInput[index] || ""}
                    onChange={(e) => {
                      const newOtp = otpInput.split("");
                      newOtp[index] = e.target.value;
                      setOtpInput(newOtp.join(""));
                      if (e.target.value && index < 5) {
                        document.getElementById(`otp-${index + 1}`).focus();
                      }
                    }}
                    id={`otp-${index}`}
                    className="w-12 h-12 text-center text-xl border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200"
                    autoFocus={index === 0}
                  />
                ))}
              </div>
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-200 transform hover:scale-105 ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  } flex items-center justify-center`}
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    "Verify OTP"
                  )}
                </button>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading || !canResend}
                  className={`text-indigo-600 hover:underline transition duration-200 ${
                    !canResend
                      ? "animate-shake opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  Resend OTP
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailVerificationPage;
