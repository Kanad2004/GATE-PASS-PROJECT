import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { safeLocalStorage, checkNetworkConnection } from "../utils/api";
import {
  CalendarIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  UserGroupIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  WifiIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ClockIcon,
  UserIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

const VisitorRecordsPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Filter states
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    status: "all", // all, completed, inside, scheduled
    search: "",
  });

  const navigate = useNavigate();

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

  // Authentication check
  useEffect(() => {
    const user = safeLocalStorage.get("user");
    if (!user || user.role !== "admin") {
      setError("You must be logged in as an admin to access this page.");
      const timer = setTimeout(() => navigate("/login"), 3000);
      return () => clearTimeout(timer);
    }
  }, [navigate]);

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear previous messages when filters change
    setError("");
    setSuccess("");
  };

  // **UPDATED: Generate PDF using your backend route**
  const generatePDF = async () => {
    if (!checkNetworkConnection()) {
      setError(
        "No internet connection. Please check your network and try again."
      );
      return;
    }

    // Validation
    if (!filters.startDate || !filters.endDate) {
      setError("Please select both start and end dates.");
      return;
    }

    if (new Date(filters.startDate) > new Date(filters.endDate)) {
      setError("Start date cannot be later than end date.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const user = safeLocalStorage.get("user");
      if (!user?.accessToken) {
        throw new Error("Session expired. Please login again.");
      }

      // **UPDATED: Use your API base URL and route**
      const API_BASE_URL =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

      // Prepare query parameters
      const queryParams = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        status: filters.status,
        search: filters.search.trim(),
      });

      // **UPDATED: Call your actual backend route**
      const response = await fetch(
        `${API_BASE_URL}/user/generate-visitor-report?${queryParams}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        // Handle different error status codes
        if (response.status === 401) {
          safeLocalStorage.remove("user");
          throw new Error("Session expired. Please login again.");
        } else if (response.status === 404) {
          throw new Error(
            "PDF generation service not available. Please contact administrator."
          );
        } else if (response.status === 500) {
          throw new Error(
            "Server error while generating PDF. Please try again later."
          );
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
              `Failed to generate PDF: ${response.statusText}`
          );
        }
      }

      // **Convert response to blob for PDF download**
      const blob = await response.blob();

      // Verify it's actually a PDF
      if (blob.type !== "application/pdf" && !blob.type.includes("pdf")) {
        throw new Error("Invalid file format received. Expected PDF.");
      }

      // **Create download link**
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // **Generate filename with date range**
      const startDateStr = filters.startDate;
      const endDateStr = filters.endDate;
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `visitor-report-${startDateStr}-to-${endDateStr}-${timestamp}.pdf`;
      link.setAttribute("download", filename);

      // **Trigger download**
      document.body.appendChild(link);
      link.click();

      // **Clean up**
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess(
        `📄 PDF report generated and downloaded successfully! File: ${filename}`
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      console.error("Generate PDF error:", err);
      setError(
        err.message || "Failed to generate PDF report. Please try again."
      );

      // Handle session expiry
      if (err.message?.includes("Session expired")) {
        safeLocalStorage.remove("user");
        const timer = setTimeout(() => navigate("/login"), 3000);
        return () => clearTimeout(timer);
      }
    } finally {
      setLoading(false);
    }
  };

  // **Utility function to get filter summary**
  const getFilterSummary = () => {
    const startDate = new Date(filters.startDate).toLocaleDateString();
    const endDate = new Date(filters.endDate).toLocaleDateString();
    const daysDiff =
      Math.ceil(
        (new Date(filters.endDate) - new Date(filters.startDate)) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    return {
      dateRange: `${startDate} to ${endDate}`,
      days: daysDiff,
      status:
        filters.status === "all"
          ? "All Visitors"
          : filters.status.charAt(0).toUpperCase() + filters.status.slice(1),
      hasSearch: filters.search.trim().length > 0,
    };
  };

  const filterSummary = getFilterSummary();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden py-12 px-4">
      {/* Animated Background */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10 container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-6 shadow-lg transform rotate-3 hover:rotate-6 transition-transform duration-300">
            <DocumentTextIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-600 bg-clip-text text-transparent mb-4">
            Visitor Reports
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Generate and download comprehensive PDF reports of visitor records
            with advanced filtering options
          </p>
        </div>

        {/* Offline Indicator */}
        {!isOnline && (
          <div className="max-w-4xl mx-auto mb-6 p-4 bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-xl flex items-center justify-center">
            <WifiIcon className="w-5 h-5 text-rose-500 mr-2 flex-shrink-0" />
            <span className="text-rose-700">
              You're offline. PDF generation requires internet connection.
            </span>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6 p-4 bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-xl animate-shake">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-rose-500 mr-2 flex-shrink-0" />
              <p className="text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* Success Messages */}
        {success && (
          <div className="max-w-4xl mx-auto mb-6 p-4 bg-emerald-50/80 backdrop-blur-sm border border-emerald-200 rounded-xl">
            <div className="flex items-center">
              <CheckCircleIcon className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0" />
              <div>
                <p className="text-emerald-700 font-medium">Success!</p>
                <p className="text-emerald-600 mt-1">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-8">
            {/* Filter Section Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
                <FunnelIcon className="w-6 h-6 mr-2" />
                Report Filters
              </h2>
              <p className="text-gray-600">
                Configure your report parameters to generate customized visitor
                data
              </p>
            </div>

            {/* Filters */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <CalendarIcon className="w-4 h-4 inline mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    handleFilterChange("startDate", e.target.value)
                  }
                  className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
                  max={filters.endDate}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <CalendarIcon className="w-4 h-4 inline mr-1" />
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    handleFilterChange("endDate", e.target.value)
                  }
                  className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
                  min={filters.startDate}
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <UserGroupIcon className="w-4 h-4 inline mr-1" />
                  Visitor Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
                >
                  <option value="all">All Visitors</option>
                  <option value="completed">Completed (Entry & Exit)</option>
                  <option value="inside">Currently Inside</option>
                  <option value="scheduled">Scheduled Only</option>
                </select>
              </div>

              {/* Search Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MagnifyingGlassIcon className="w-4 h-4 inline mr-1" />
                  Search Filter
                </label>
                <input
                  type="text"
                  placeholder="Name, email, purpose, mobile..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Search across visitor name, email, purpose, or mobile number
                </p>
              </div>
            </div>

            {/* Filter Summary */}
            <div className="mb-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl">
              <h3 className="font-semibold text-indigo-800 mb-3 flex items-center">
                <ClockIcon className="w-5 h-5 mr-2" />
                Report Summary
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <p className="flex items-center">
                    <CalendarIcon className="w-4 h-4 text-indigo-500 mr-2" />
                    <span className="text-gray-600">Date Range:</span>
                    <span className="font-medium text-indigo-700 ml-2">
                      {filterSummary.dateRange}
                    </span>
                  </p>
                  <p className="flex items-center">
                    <ClockIcon className="w-4 h-4 text-indigo-500 mr-2" />
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium text-indigo-700 ml-2">
                      {filterSummary.days} day
                      {filterSummary.days !== 1 ? "s" : ""}
                    </span>
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="flex items-center">
                    <UserGroupIcon className="w-4 h-4 text-indigo-500 mr-2" />
                    <span className="text-gray-600">Status Filter:</span>
                    <span className="font-medium text-indigo-700 ml-2">
                      {filterSummary.status}
                    </span>
                  </p>
                  {filterSummary.hasSearch && (
                    <p className="flex items-center">
                      <MagnifyingGlassIcon className="w-4 h-4 text-indigo-500 mr-2" />
                      <span className="text-gray-600">Search:</span>
                      <span className="font-medium text-indigo-700 ml-2">
                        "{filters.search.trim()}"
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Generate PDF Button */}
            <div className="text-center mb-8">
              <button
                onClick={generatePDF}
                disabled={loading || !isOnline}
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                    Generating PDF Report...
                  </>
                ) : (
                  <>
                    <DocumentArrowDownIcon className="w-6 h-6 mr-3" />
                    Generate PDF Report
                    <SparklesIcon className="w-5 h-5 ml-2 animate-pulse" />
                  </>
                )}
              </button>

              {loading && (
                <div className="mt-4 flex justify-center">
                  <div className="animate-pulse bg-gradient-to-r from-indigo-400 to-purple-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                    Processing your request... This may take a few seconds.
                  </div>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50/70 backdrop-blur-sm border border-blue-200 rounded-2xl p-6">
              <h3 className="font-semibold text-blue-800 mb-4 flex items-center">
                <UserIcon className="w-5 h-5 mr-2" />
                How to Use
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">1.</span>
                    Select your desired date range for the report
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">2.</span>
                    Choose visitor status filter (optional)
                  </li>
                </ul>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">3.</span>
                    Add search terms to filter specific visitors (optional)
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">4.</span>
                    Click "Generate PDF Report" to download
                  </li>
                </ul>
              </div>

              <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-300">
                <p className="text-blue-800 text-sm">
                  <strong>💡 Tip:</strong> The PDF will include visitor details,
                  entry/exit times, duration of stay, and status information
                  based on your selected filters.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <button
                onClick={() =>
                  setFilters({
                    startDate: new Date().toISOString().split("T")[0],
                    endDate: new Date().toISOString().split("T")[0],
                    status: "all",
                    search: "",
                  })
                }
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-300 flex items-center"
              >
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                Reset Filters
              </button>

              <button
                onClick={() =>
                  handleFilterChange(
                    "startDate",
                    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      .toISOString()
                      .split("T")[0]
                  )
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-300 flex items-center"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Last 7 Days
              </button>

              <button
                onClick={() =>
                  handleFilterChange(
                    "startDate",
                    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                      .toISOString()
                      .split("T")[0]
                  )
                }
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-300 flex items-center"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Last 30 Days
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitorRecordsPage;
