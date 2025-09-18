import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getRequests,
  acceptRequest,
  rejectRequest,
  safeLocalStorage,
  checkNetworkConnection,
} from "../utils/api";
import {
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  UserIcon,
  ClockIcon,
  DocumentTextIcon,
  CalendarIcon,
  EnvelopeIcon,
  PhoneIcon,
  ExclamationTriangleIcon,
  WifiIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

const RequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [filterStatus, setFilterStatus] = useState("all");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate();

  // Debounced search to improve performance
  const debouncedSearch = useMemo(() => {
    const timeoutId = setTimeout(() => {}, 0);
    clearTimeout(timeoutId);

    return (term) => {
      const handler = setTimeout(() => {
        setSearchTerm(term);
      }, 300);

      return () => clearTimeout(handler);
    };
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

  // Enhanced authentication and data fetching
  useEffect(() => {
    const initializePage = async () => {
      try {
        const user = safeLocalStorage.get("user");
        if (!user || user.role !== "admin") {
          setError("You must be logged in as an admin to view this page.");
          const timer = setTimeout(() => navigate("/login"), 3000);
          return () => clearTimeout(timer);
        }

        if (!checkNetworkConnection()) {
          setError(
            "No internet connection. Please check your network and try again."
          );
          setLoading(false);
          return;
        }

        await fetchRequests(user.accessToken);
      } catch (err) {
        console.error("Page initialization error:", err);
        setError("Failed to initialize page. Please refresh and try again.");
        setLoading(false);
      }
    };

    initializePage();
  }, [navigate]);

  const fetchRequests = async (token) => {
    try {
      setLoading(true);
      setError("");

      const response = await getRequests(token);

      if (response && Array.isArray(response.requests)) {
        setRequests(response.requests);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Fetch requests error:", err);
      setError(err.message || "Failed to fetch requests");

      // If token is invalid, clear it and redirect
      if (err.message?.includes("Session expired")) {
        safeLocalStorage.remove("user");
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = useCallback(
    async (requestId) => {
      if (!window.confirm("Are you sure you want to approve this request?"))
        return;

      if (!checkNetworkConnection()) {
        setError(
          "No internet connection. Please check your network and try again."
        );
        return;
      }

      try {
        const user = safeLocalStorage.get("user");
        if (!user?.accessToken) {
          throw new Error("Session expired. Please login again.");
        }

        await acceptRequest(requestId, user.accessToken);

        // Update UI optimistically
        setRequests((prev) => prev.filter((req) => req._id !== requestId));
        setSelectedRequests((prev) => prev.filter((id) => id !== requestId));
      } catch (err) {
        console.error("Accept request error:", err);
        setError(err.message || "Failed to accept request");

        if (err.message?.includes("Session expired")) {
          safeLocalStorage.remove("user");
          navigate("/login");
        }
      }
    },
    [navigate]
  );

  const handleReject = useCallback(
    async (requestId) => {
      if (!window.confirm("Are you sure you want to reject this request?"))
        return;

      if (!checkNetworkConnection()) {
        setError(
          "No internet connection. Please check your network and try again."
        );
        return;
      }

      try {
        const user = safeLocalStorage.get("user");
        if (!user?.accessToken) {
          throw new Error("Session expired. Please login again.");
        }

        await rejectRequest(requestId, user.accessToken);

        // Update UI optimistically
        setRequests((prev) => prev.filter((req) => req._id !== requestId));
        setSelectedRequests((prev) => prev.filter((id) => id !== requestId));
      } catch (err) {
        console.error("Reject request error:", err);
        setError(err.message || "Failed to reject request");

        if (err.message?.includes("Session expired")) {
          safeLocalStorage.remove("user");
          navigate("/login");
        }
      }
    },
    [navigate]
  );

  const handleBulkAction = async (action) => {
    if (selectedRequests.length === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${selectedRequests.length} selected request(s)?`
      )
    )
      return;

    if (!checkNetworkConnection()) {
      setError(
        "No internet connection. Please check your network and try again."
      );
      return;
    }

    setBulkLoading(true);
    setBulkError("");
    const errors = [];
    const successful = [];

    try {
      const user = safeLocalStorage.get("user");
      if (!user?.accessToken) {
        throw new Error("Session expired. Please login again.");
      }

      // Process requests sequentially with error tracking
      for (const requestId of selectedRequests) {
        try {
          if (action === "approve") {
            await acceptRequest(requestId, user.accessToken);
          } else {
            await rejectRequest(requestId, user.accessToken);
          }
          successful.push(requestId);
        } catch (err) {
          console.error(`Bulk ${action} error for request ${requestId}:`, err);
          errors.push({ requestId, error: err.message });
        }
      }

      // Update UI for successful operations
      if (successful.length > 0) {
        setRequests((prev) =>
          prev.filter((req) => !successful.includes(req._id))
        );
        setSelectedRequests([]);
      }

      // Show results to user
      if (errors.length === 0) {
        // All successful
        const successMessage = `Successfully ${action}ed ${successful.length} request(s)`;
        setError(""); // Clear any previous errors

        // Show success message temporarily
        const successDiv = document.createElement("div");
        successDiv.className =
          "fixed top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg z-50";
        successDiv.textContent = successMessage;
        document.body.appendChild(successDiv);
        setTimeout(() => document.body.removeChild(successDiv), 3000);
      } else if (successful.length === 0) {
        // All failed
        setBulkError(`Failed to ${action} all requests. Please try again.`);
      } else {
        // Partial success
        setBulkError(
          `${action.charAt(0).toUpperCase() + action.slice(1)}ed ${successful.length} request(s). ` +
            `${errors.length} request(s) failed. Please review and try again for failed items.`
        );
      }
    } catch (err) {
      console.error("Bulk action error:", err);
      setBulkError(err.message || `Failed to ${action} requests`);

      if (err.message?.includes("Session expired")) {
        safeLocalStorage.remove("user");
        navigate("/login");
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSelectAll = useCallback(() => {
    if (selectedRequests.length === filteredRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(filteredRequests.map((req) => req._id));
    }
  }, [selectedRequests.length]);

  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Memoized filtered and sorted requests for performance
  const filteredRequests = useMemo(() => {
    return requests
      .filter((request) => {
        if (!request) return false;

        const matchesSearch =
          searchTerm === "" ||
          [
            request.name,
            request.email,
            request.purpose,
            request.mobileNumber,
          ].some((field) =>
            field?.toLowerCase().includes(searchTerm.toLowerCase())
          );

        const matchesStatus =
          filterStatus === "all" || request.status === filterStatus;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (!a || !b) return 0;

        switch (sortBy) {
          case "newest":
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          case "oldest":
            return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
          case "name":
            return (a.name || "").localeCompare(b.name || "");
          case "visitDate":
            return (
              new Date(a.visitDateAndTime || 0) -
              new Date(b.visitDateAndTime || 0)
            );
          default:
            return 0;
        }
      });
  }, [requests, searchTerm, filterStatus, sortBy]);

  const clearErrors = useCallback(() => {
    setError("");
    setBulkError("");
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <DocumentTextIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Visitor Requests
          </h1>
          <p className="text-xl text-gray-600">
            Manage and review visitor access requests
          </p>
        </div>

        {/* Offline Indicator */}
        {!isOnline && (
          <div className="max-w-4xl mx-auto mb-6 p-4 bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-xl flex items-center">
            <WifiIcon className="w-5 h-5 text-rose-500 mr-2 flex-shrink-0" />
            <span className="text-rose-700">
              You're offline. Some features may not work properly.
            </span>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6 p-4 bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-xl animate-shake">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-rose-500 mr-2 flex-shrink-0" />
                <p className="text-rose-700">{error}</p>
              </div>
              <button
                onClick={clearErrors}
                className="text-rose-500 hover:text-rose-700 ml-2"
                aria-label="Clear error message"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {bulkError && (
          <div className="max-w-4xl mx-auto mb-6 p-4 bg-amber-50/80 backdrop-blur-sm border border-amber-200 rounded-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <InformationCircleIcon className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0" />
                <p className="text-amber-700">{bulkError}</p>
              </div>
              <button
                onClick={clearErrors}
                className="text-amber-600 hover:text-amber-800 ml-2"
                aria-label="Clear bulk error message"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 p-12">
              <DocumentTextIcon className="w-24 h-24 text-gray-400 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                No Pending Requests
              </h2>
              <p className="text-gray-600 text-lg">
                All visitor requests have been processed. New requests will
                appear here for your review.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Controls */}
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[300px]">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or purpose..."
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-3 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
                    aria-label="Search requests"
                  />
                </div>

                {/* Filters and Sort */}
                <div className="flex items-center space-x-4">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Sort requests"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="name">Name A-Z</option>
                    <option value="visitDate">Visit Date</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Filter by status"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedRequests.length > 0 && (
                <div className="mt-4 flex items-center justify-between p-4 bg-indigo-50/70 backdrop-blur-sm border border-indigo-200 rounded-xl">
                  <span className="text-indigo-700 font-medium">
                    {selectedRequests.length} request(s) selected
                  </span>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleBulkAction("approve")}
                      disabled={bulkLoading || !isOnline}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                      ) : (
                        <CheckIcon className="w-4 h-4 mr-1" />
                      )}
                      Approve All
                    </button>
                    <button
                      onClick={() => handleBulkAction("reject")}
                      disabled={bulkLoading || !isOnline}
                      className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                      ) : (
                        <XMarkIcon className="w-4 h-4 mr-1" />
                      )}
                      Reject All
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Select All Toggle */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleSelectAll}
                className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium transition-colors duration-200"
              >
                <input
                  type="checkbox"
                  checked={
                    selectedRequests.length === filteredRequests.length &&
                    filteredRequests.length > 0
                  }
                  readOnly
                  className="mr-2 h-4 w-4 text-indigo-600 rounded"
                />
                Select All ({filteredRequests.length})
              </button>

              <span className="text-gray-600">
                Showing {filteredRequests.length} of {requests.length} requests
              </span>
            </div>

            {/* Requests List */}
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <RequestCard
                  key={request._id}
                  request={request}
                  isSelected={selectedRequests.includes(request._id)}
                  onSelect={(selected) => {
                    if (selected) {
                      setSelectedRequests([...selectedRequests, request._id]);
                    } else {
                      setSelectedRequests(
                        selectedRequests.filter((id) => id !== request._id)
                      );
                    }
                  }}
                  onAccept={() => handleAccept(request._id)}
                  onReject={() => handleReject(request._id)}
                  isOnline={isOnline}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Memoized Request Card component for better performance
const RequestCard = React.memo(
  ({ request, isSelected, onSelect, onAccept, onReject, isOnline }) => {
    if (!request) return null;

    return (
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 p-6 transform transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(e.target.checked)}
              className="mt-1 h-5 w-5 text-indigo-600 rounded"
              aria-label={`Select request from ${request.name}`}
            />

            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center">
                    <UserIcon className="w-5 h-5 mr-2 text-indigo-600" />
                    {request.name}
                  </h3>
                  <div className="flex items-center text-gray-600 mt-1">
                    <EnvelopeIcon className="w-4 h-4 mr-1" />
                    <span className="text-sm break-all">{request.email}</span>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    request.status === "pending"
                      ? "bg-yellow-100 text-yellow-800 animate-pulse"
                      : request.status === "approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {request.status}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center text-gray-600">
                    <PhoneIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="text-sm">{request.mobileNumber}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <CalendarIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="text-sm">
                      {request.visitDateAndTime
                        ? new Date(request.visitDateAndTime).toLocaleString()
                        : "Not specified"}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    <DocumentTextIcon className="w-4 h-4 inline mr-1" />
                    <strong>Purpose:</strong>
                  </p>
                  <p className="text-sm text-gray-700 bg-gray-50/70 backdrop-blur-sm rounded-lg p-3">
                    {request.purpose || "No purpose specified"}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center text-xs text-gray-500">
                  <ClockIcon className="w-4 h-4 mr-1" />
                  Submitted{" "}
                  {request.createdAt
                    ? new Date(request.createdAt).toLocaleDateString()
                    : "Unknown date"}
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={onAccept}
                    disabled={!isOnline}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 transform hover:scale-105 flex items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    aria-label={`Approve request from ${request.name}`}
                  >
                    <CheckIcon className="w-4 h-4 mr-1" />
                    Approve
                  </button>
                  <button
                    onClick={onReject}
                    disabled={!isOnline}
                    className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/20 transition-all duration-200 transform hover:scale-105 flex items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    aria-label={`Reject request from ${request.name}`}
                  >
                    <XMarkIcon className="w-4 h-4 mr-1" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

RequestCard.displayName = "RequestCard";

export default RequestsPage;
