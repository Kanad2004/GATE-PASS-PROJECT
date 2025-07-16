import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getRequests, acceptRequest, rejectRequest } from "../utils/api";
import { CheckIcon, XMarkIcon } from "@heroicons/react/20/solid";

const RequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      setError("You must be logged in as an admin to view this page.");
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    const fetchRequests = async () => {
      try {
        const response = await getRequests(user.accessToken);
        setRequests(response.requests);
        setLoading(false);
      } catch (err) {
        setError(err.message || "Failed to fetch requests");
        setLoading(false);
      }
    };

    fetchRequests();
  }, [navigate]);

  const handleAccept = async (requestId) => {
    if (!window.confirm("Are you sure you want to approve this request?"))
      return;
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      await acceptRequest(requestId, user.accessToken);
      setRequests(requests.filter((req) => req._id !== requestId));
    } catch (err) {
      setError(err.message || "Failed to accept request");
    }
  };

  const handleReject = async (requestId) => {
    if (!window.confirm("Are you sure you want to reject this request?"))
      return;
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      await rejectRequest(requestId, user.accessToken);
      setRequests(requests.filter((req) => req._id !== requestId));
    } catch (err) {
      setError(err.message || "Failed to reject request");
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedRequests.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to ${action} the selected requests?`
      )
    )
      return;
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      for (const requestId of selectedRequests) {
        if (action === "approve") {
          await acceptRequest(requestId, user.accessToken);
        } else {
          await rejectRequest(requestId, user.accessToken);
        }
      }
      setRequests(
        requests.filter((req) => !selectedRequests.includes(req._id))
      );
      setSelectedRequests([]);
    } catch (err) {
      setError(err.message || `Failed to ${action} requests`);
    }
  };

  const filteredRequests = requests.filter(
    (request) =>
      request.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl font-extrabold text-gray-800 mb-8 text-center">
          Visitor Requests
        </h2>
        {error && (
          <p className="text-rose-500 mb-6 text-center bg-rose-50 py-2 rounded-lg">
            {error}
          </p>
        )}
        {requests.length === 0 ? (
          <p className="text-center text-gray-600">No pending requests.</p>
        ) : (
          <>
            <div className="sticky top-16 z-40 bg-white/30 backdrop-blur-lg p-4 rounded-lg mb-6 flex justify-between items-center">
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBulkAction("approve")}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition duration-200 disabled:opacity-50"
                  disabled={selectedRequests.length === 0}
                >
                  Approve Selected
                </button>
                <button
                  onClick={() => handleBulkAction("reject")}
                  className="bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition duration-200 disabled:opacity-50"
                  disabled={selectedRequests.length === 0}
                >
                  Reject Selected
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="space-y-6">
              {filteredRequests.map((request) => (
                <div
                  key={request._id}
                  className="bg-white shadow-lg rounded-2xl p-6 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-xl tilt"
                  style={{ perspective: "1000px" }}
                  onMouseMove={(e) => {
                    const card = e.currentTarget;
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    const rotateX = (y - centerY) / 20;
                    const rotateY = (centerX - x) / 20;
                    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform =
                      "rotateX(0deg) rotateY(0deg)";
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedRequests.includes(request._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRequests([
                              ...selectedRequests,
                              request._id,
                            ]);
                          } else {
                            setSelectedRequests(
                              selectedRequests.filter(
                                (id) => id !== request._id
                              )
                            );
                          }
                        }}
                        className="h-5 w-5 text-indigo-600 rounded"
                      />
                      <div>
                        <p className="text-lg font-semibold text-indigo-600">
                          {request.name}
                        </p>
                        <p className="text-sm text-gray-500">{request.email}</p>
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          request.status === "pending"
                            ? "bg-yellow-100 text-yellow-800 animate-pulse"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {request.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <p className="text-sm text-gray-600">
                      <strong>Purpose:</strong> {request.purpose}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Visit:</strong>{" "}
                      {new Date(request.visitDateAndTime).toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-6 flex justify-end space-x-4">
                    <button
                      onClick={() => handleAccept(request._id)}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 transition duration-200 transform hover:scale-105"
                    >
                      <CheckIcon className="h-5 w-5 inline mr-2" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(request._id)}
                      className="bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-300 transition duration-200 transform hover:scale-105"
                    >
                      <XMarkIcon className="h-5 w-5 inline mr-2" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RequestsPage;
