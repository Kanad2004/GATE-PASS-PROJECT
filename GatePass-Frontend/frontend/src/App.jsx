import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { safeLocalStorage } from "./utils/api";

// Lazy load components for better performance
const Home = lazy(() => import("./pages/Home"));
const EmailVerificationPage = lazy(
  () => import("./pages/EmailVerificationPage")
);
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RequestsPage = lazy(() => import("./pages/RequestsPage"));
const ScannerPage = lazy(() => import("./pages/ScannerPage"));
const VisitorRecordsPage = lazy(() => import("./pages/VisitorRecordsPage"));

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error("Error Boundary caught an error:", error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    if (import.meta.env.PROD) {
      // Example: logErrorToService(error, errorInfo);
    }
  }

  handleReload = () => {
    // Clear any corrupted state before reload
    try {
      safeLocalStorage.remove("otpStartTime");
      safeLocalStorage.remove("scanResult");
    } catch (e) {
      console.warn("Failed to clear storage on error:", e);
    }
    window.location.reload();
  };

  handleGoHome = () => {
    // Clear any corrupted state before navigation
    try {
      safeLocalStorage.remove("otpStartTime");
      safeLocalStorage.remove("scanResult");
    } catch (e) {
      console.warn("Failed to clear storage on error:", e);
    }
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-8">
              <ExclamationTriangleIcon className="w-16 h-16 text-rose-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Something went wrong
              </h2>
              <p className="text-gray-600 mb-6">
                We're sorry, but something unexpected happened. Please try
                refreshing the page or go back to home.
              </p>

              <div className="space-y-3">
                <button
                  onClick={this.handleReload}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
                >
                  Refresh Page
                </button>

                <button
                  onClick={this.handleGoHome}
                  className="w-full bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-700 transition-colors duration-300"
                >
                  Go to Home
                </button>
              </div>

              {/* Development Mode Error Details */}
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    🔧 Error Details (Development Mode)
                  </summary>
                  <div className="mt-3 p-4 bg-gray-50 rounded-lg border">
                    <div className="mb-3">
                      <h4 className="font-semibold text-red-700 mb-2">
                        Error Message:
                      </h4>
                      <pre className="text-xs bg-red-100 p-2 rounded overflow-auto text-red-800 whitespace-pre-wrap">
                        {this.state.error.toString()}
                      </pre>
                    </div>
                    {this.state.errorInfo && (
                      <div>
                        <h4 className="font-semibold text-red-700 mb-2">
                          Component Stack:
                        </h4>
                        <pre className="text-xs bg-red-100 p-2 rounded overflow-auto text-red-800 whitespace-pre-wrap">
                          {this.state.errorInfo?.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Production Mode User Guidance */}
              {import.meta.env.PROD && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">
                    Need Help?
                  </h4>
                  <p className="text-sm text-blue-700">
                    If this problem persists, please contact our support team
                    with details about what you were doing when this error
                    occurred.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Enhanced Loading Component with better UX
const LoadingSpinner = ({ message = "Loading..." }) => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
    <div className="text-center">
      <div className="relative">
        {/* Main spinner */}
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
        {/* Pulsing backdrop */}
        <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-100 rounded-full animate-pulse mx-auto" />
      </div>
      <div className="space-y-2">
        <p className="text-gray-700 text-lg font-medium">{message}</p>
        <div className="flex justify-center space-x-1">
          <div
            className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <div
            className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <div
            className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  </div>
);

// FIX: Enhanced Routes with OTP Timer Cleanup
function AppRoutes() {
  const location = useLocation();

  // FIX: Clean up OTP timer when user navigates away from verification
  useEffect(() => {
    if (location.pathname !== "/verify-email") {
      // Clean up expired OTP timers (older than 15 minutes)
      try {
        const otpStartTime = safeLocalStorage.get("otpStartTime");
        if (otpStartTime) {
          const elapsed = Date.now() - otpStartTime;
          const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds

          if (elapsed > fifteenMinutes) {
            safeLocalStorage.remove("otpStartTime");
            console.log("Cleaned up expired OTP timer");
          }
        }
      } catch (error) {
        console.warn("Failed to clean up OTP timer:", error); // Fail silently - don't break the app
      }
    }
  }, [location.pathname]);

  // Clean up scan results when not on home page (optional)
  useEffect(() => {
    if (location.pathname !== "/" && location.pathname !== "/verify-email") {
      try {
        const scanResult = safeLocalStorage.get("scanResult");
        if (scanResult) {
          // Keep scan results for 5 minutes after scan
          const fiveMinutes = 5 * 60 * 1000;
          const resultAge = Date.now() - (scanResult.timestamp || 0);

          if (resultAge > fiveMinutes) {
            safeLocalStorage.remove("scanResult");
            console.log("Cleaned up old scan result");
          }
        }
      } catch (error) {
        console.warn("Failed to clean up scan result:", error);
      }
    }
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/verify-email" element={<EmailVerificationPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/requests" element={<RequestsPage />} />
      <Route path="/scan" element={<ScannerPage />} />
      <Route path="/visitor-reports" element={<VisitorRecordsPage />} />
    </Routes>
  );
}

// Main App Component with Global Error Handling
function App() {
  // Global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      console.error("Unhandled promise rejection:", event.reason);
      // Prevent default browser behavior
      event.preventDefault();
      // You might want to show a toast notification here or send the error to a logging service
    };

    const handleError = (event) => {
      console.error("Global error handler:", event.error);
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
      window.removeEventListener("error", handleError);
    };
  }, []);

  // FIX: Clean up storage on app startup if needed
  useEffect(() => {
    try {
      // Clean up any very old data on app startup
      const otpStartTime = safeLocalStorage.get("otpStartTime");
      if (otpStartTime && Date.now() - otpStartTime > 24 * 60 * 60 * 1000) {
        // 24 hours
        safeLocalStorage.remove("otpStartTime");
        console.log("Cleaned up very old OTP timer on startup");
      }

      const scanResult = safeLocalStorage.get("scanResult");
      if (
        scanResult &&
        scanResult.timestamp &&
        Date.now() - scanResult.timestamp > 24 * 60 * 60 * 1000
      ) {
        // 24 hours
        safeLocalStorage.remove("scanResult");
        console.log("Cleaned up old scan result on startup");
      }
    } catch (error) {
      console.warn("Failed to clean up storage on startup:", error);
    }
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <Suspense
          fallback={<LoadingSpinner message="Loading application..." />}
        >
          <AppRoutes />
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
