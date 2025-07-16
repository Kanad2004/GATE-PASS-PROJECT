import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { sendOtp } from "../utils/api";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/20/solid";
import Confetti from "react-confetti";

const Home = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobileNumber: "",
    purpose: "",
  });
  const [visitDateTime, setVisitDateTime] = useState(null);
  const [errors, setErrors] = useState({});
  const [logDate, setLogDate] = useState(new Date());
  const [formProgress, setFormProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [scanConfirmation, setScanConfirmation] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log("Home - useEffect - Location:", location);
    const loggedInUser = localStorage.getItem("user");
    if (loggedInUser) {
      setUser(JSON.parse(loggedInUser));
    }

    const pathname = location.pathname;
    let initialTab = pathname === "/daily-entry" ? "daily-entry" : "home";
    if (location.state && location.state.activeTab) {
      initialTab = location.state.activeTab;
    }
    console.log("Home - useEffect - Setting activeTab:", initialTab);
    setActiveTab(initialTab);

    let scanResult = null;
    if (location.state && location.state.scanResult) {
      console.log(
        "Home - useEffect - Found scanResult in location.state:",
        location.state.scanResult
      );
      scanResult = location.state.scanResult;
    } else {
      const storedScanResult = localStorage.getItem("scanResult");
      if (storedScanResult) {
        console.log(
          "Home - useEffect - Found scanResult in localStorage:",
          storedScanResult
        );
        scanResult = JSON.parse(storedScanResult);
      }
    }

    if (scanResult) {
      console.log("Home - useEffect - Setting scanConfirmation:", scanResult);
      setScanConfirmation(scanResult);
      setTimeout(() => {
        console.log(
          "Home - useEffect - Clearing scanConfirmation and localStorage"
        );
        setScanConfirmation(null);
        localStorage.removeItem("scanResult");
      }, 5000);
    } else {
      console.log("Home - useEffect - No scanResult found");
    }

    const totalFields = 5;
    const filledFields =
      Object.values(formData).filter(Boolean).length + (visitDateTime ? 1 : 0);
    setFormProgress((filledFields / totalFields) * 100);
  }, [location, location.key, formData, visitDateTime]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("scanResult");
    setUser(null);
    setActiveTab("home");
    navigate("/");
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/.+\@.+\..+/.test(formData.email)) {
      newErrors.email = "Invalid email address";
    }
    if (!formData.mobileNumber) {
      newErrors.mobileNumber = "Mobile number is required";
    } else if (!/^\d{10}$/.test(formData.mobileNumber)) {
      newErrors.mobileNumber = "Mobile number must be 10 digits";
    }
    if (!formData.purpose) newErrors.purpose = "Purpose of visit is required";
    if (!visitDateTime) {
      newErrors.visitDateTime = "Visit date and time are required";
    } else {
      const hours = visitDateTime.getHours();
      if (hours < 9 || hours >= 18) {
        newErrors.visitDateTime = "Visits allowed between 9 AM and 6 PM";
      }
    }
    return newErrors;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await sendOtp({
        email: formData.email,
        name: formData.name,
        mobileNumber: formData.mobileNumber,
        purpose: formData.purpose,
        visitDateAndTime: visitDateTime.toISOString(),
      });
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
      navigate("/verify-email", {
        state: { formData, visitDateTime: visitDateTime.toISOString() },
      });
    } catch (error) {
      setErrors({ api: error.message || "Failed to send OTP" });
    }
  };

  const handleDownloadLog = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/v1/user/download-log?date=${
          logDate.toISOString().split("T")[0]
        }`,
        {
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to download log");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `entry-log-${logDate.toISOString().split("T")[0]}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setErrors({ api: "Failed to download log" });
    }
  };

  const renderContent = () => {
    console.log(
      "Home - renderContent - activeTab:",
      activeTab,
      "scanConfirmation:",
      scanConfirmation
    );
    switch (activeTab) {
      case "home":
        return (
          <div className="px-4 py-8 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-emerald-500">
                Welcome to GatePass System
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                {user && user.role === "admin"
                  ? "Admin Dashboard: Manage visitor registrations and entries."
                  : "Register for a visit. No login required for visitors."}
              </p>
            </div>
            {scanConfirmation ? (
              <div className="max-w-lg mx-auto mb-6">
                <p className="text-emerald-600 text-center bg-emerald-50 py-2 rounded-lg">
                  {scanConfirmation.message || "Scan processed successfully"}
                </p>
                {scanConfirmation.entryExitMessage && (
                  <p className="text-indigo-700 text-center mt-2 font-semibold">
                    {scanConfirmation.entryExitMessage}
                  </p>
                )}
                {scanConfirmation.user && (
                  <p className="text-gray-700 text-center mt-2">
                    User: {scanConfirmation.user.name} (
                    {scanConfirmation.user.email})
                  </p>
                )}
                {scanConfirmation.entryTime && (
                  <p className="text-gray-700 text-center mt-2">
                    Entry Time:{" "}
                    {new Date(scanConfirmation.entryTime).toLocaleString()}
                  </p>
                )}
                {scanConfirmation.exitTime && (
                  <p className="text-gray-700 text-center mt-2">
                    Exit Time:{" "}
                    {new Date(scanConfirmation.exitTime).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="max-w-lg mx-auto mb-6">
                <p className="text-gray-600 text-center">
                  No recent scan data available.
                </p>
              </div>
            )}
            <div className="max-w-lg mx-auto bg-white/30 backdrop-blur-lg border border-gray-200/50 shadow-lg p-8 rounded-2xl">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                Visitor Registration
              </h2>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${formProgress}%` }}
                ></div>
              </div>
              {errors.api && (
                <p className="text-rose-500 mb-4 text-center bg-rose-50 py-2 rounded-lg">
                  {errors.api}
                </p>
              )}
              <form onSubmit={handleRegister} className="space-y-6">
                <div className="relative">
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={`peer block w-full px-4 py-3 border ${
                      errors.name ? "border-rose-500" : "border-gray-200"
                    } rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200 bg-white/50`}
                    placeholder=" "
                  />
                  <label
                    htmlFor="name"
                    className="absolute left-4 top-3 text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:-top-6 peer-focus:text-sm peer-focus:text-indigo-600 peer-filled:-top-6 peer-filled:text-sm"
                  >
                    Name
                  </label>
                  {formData.name && !errors.name && (
                    <CheckCircleIcon className="absolute right-3 top-3 h-6 w-6 text-emerald-500" />
                  )}
                  {errors.name && (
                    <XCircleIcon className="absolute right-3 top-3 h-6 w-6 text-rose-500" />
                  )}
                  {errors.name && (
                    <p className="text-rose-500 text-xs mt-2">{errors.name}</p>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={`peer block w-full px-4 py-3 border ${
                      errors.email ? "border-rose-500" : "border-gray-200"
                    } rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200 bg-white/50`}
                    placeholder=" "
                  />
                  <label
                    htmlFor="email"
                    className="absolute left-4 top-3 text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:-top-6 peer-focus:text-sm peer-focus:text-indigo-600 peer-filled:-top-6 peer-filled:text-sm"
                  >
                    Email
                  </label>
                  {formData.email && !errors.email && (
                    <CheckCircleIcon className="absolute right-3 top-3 h-6 w-6 text-emerald-500" />
                  )}
                  {errors.email && (
                    <XCircleIcon className="absolute right-3 top-3 h-6 w-6 text-rose-500" />
                  )}
                  {errors.email && (
                    <p className="text-rose-500 text-xs mt-2">{errors.email}</p>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    id="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, mobileNumber: e.target.value })
                    }
                    className={`peer block w-full px-4 py-3 border ${
                      errors.mobileNumber
                        ? "border-rose-500"
                        : "border-gray-200"
                    } rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200 bg-white/50`}
                    placeholder=" "
                  />
                  <label
                    htmlFor="mobileNumber"
                    className="absolute left-4 top-3 text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:-top-6 peer-focus:text-sm peer-focus:text-indigo-600 peer-filled:-top-6 peer-filled:text-sm"
                  >
                    Mobile Number
                  </label>
                  {formData.mobileNumber && !errors.mobileNumber && (
                    <CheckCircleIcon className="absolute right-3 top-3 h-6 w-6 text-emerald-500" />
                  )}
                  {errors.mobileNumber && (
                    <XCircleIcon className="absolute right-3 top-3 h-6 w-6 text-rose-500" />
                  )}
                  {errors.mobileNumber && (
                    <p className="text-rose-500 text-xs mt-2">
                      {errors.mobileNumber}
                    </p>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    id="purpose"
                    value={formData.purpose}
                    onChange={(e) =>
                      setFormData({ ...formData, purpose: e.target.value })
                    }
                    className={`peer block w-full px-4 py-3 border ${
                      errors.purpose ? "border-rose-500" : "border-gray-200"
                    } rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200 bg-white/50`}
                    placeholder=" "
                  />
                  <label
                    htmlFor="purpose"
                    className="absolute left-4 top-3 text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:-top-6 peer-focus:text-sm peer-focus:text-indigo-600 peer-filled:-top-6 peer-filled:text-sm"
                  >
                    Purpose of Visit
                  </label>
                  {formData.purpose && !errors.purpose && (
                    <CheckCircleIcon className="absolute right-3 top-3 h-6 w-6 text-emerald-500" />
                  )}
                  {errors.purpose && (
                    <XCircleIcon className="absolute right-3 top-3 h-6 w-6 text-rose-500" />
                  )}
                  {errors.purpose && (
                    <p className="text-rose-500 text-xs mt-2">
                      {errors.purpose}
                    </p>
                  )}
                </div>
                <div className="relative">
                  <DatePicker
                    selected={visitDateTime}
                    onChange={(date) => setVisitDateTime(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="MMMM d, yyyy h:mm aa"
                    className={`block w-full px-4 py-3 border ${
                      errors.visitDateTime
                        ? "border-rose-500"
                        : "border-gray-200"
                    } rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200 bg-white/50`}
                    placeholderText="Select visit date and time"
                  />
                  <label
                    htmlFor="visitDateTime"
                    className={`absolute left-4 text-gray-500 transition-all duration-200 pointer-events-none ${
                      visitDateTime
                        ? "-top-6 text-sm text-indigo-600"
                        : "top-3 text-base"
                    }`}
                  >
                    Visit Date and Time
                  </label>
                  {visitDateTime && !errors.visitDateTime && (
                    <CheckCircleIcon className="absolute right-3 top-3 h-6 w-6 text-emerald-500" />
                  )}
                  {errors.visitDateTime && (
                    <XCircleIcon className="absolute right-3 top-3 h-6 w-6 text-rose-500" />
                  )}
                  {errors.visitDateTime && (
                    <p className="text-rose-500 text-xs mt-2">
                      {errors.visitDateTime}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-200 transform hover:scale-105"
                >
                  Register
                </button>
              </form>
              {showConfetti && <Confetti />}
            </div>
          </div>
        );
      case "requests":
        return (
          <div className="px-4 py-8 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold text-gray-800 text-center">
              Visitor Requests
            </h1>
            <p className="text-gray-600 mt-2 text-center">
              View and manage all pending and approved visitor requests.
            </p>
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate("/requests")}
                className="bg-indigo-600 text-white py-3 px-6 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-200 transform hover:scale-105"
              >
                Manage Requests
              </button>
            </div>
          </div>
        );
      case "daily-entry":
        return (
          <div className="px-4 py-8 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold text-gray-800 text-center">
              Daily Entry
            </h1>
            <p className="text-gray-600 mt-2 text-center">
              Download daily entry logs for visitors as PDF.
            </p>
            <div className="mt-6 bg-white/30 backdrop-blur-lg border border-gray-200/50 shadow-lg p-8 rounded-2xl max-w-md mx-auto">
              <label
                htmlFor="logDate"
                className="block text-sm font-medium text-gray-700"
              >
                Select Date
              </label>
              <DatePicker
                selected={logDate}
                onChange={(date) => setLogDate(date)}
                dateFormat="yyyy-MM-dd"
                className="mt-2 block w-full px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200 bg-white/50"
                placeholderText="Select date"
              />
              <button
                onClick={handleDownloadLog}
                className="mt-4 w-full bg-indigo-600 text-white py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-200 transform hover:scale-105"
              >
                Download PDF Log
              </button>
              {errors.api && (
                <p className="text-rose-500 mt-2 text-center bg-rose-50 py-2 rounded-lg">
                  {errors.api}
                </p>
              )}
            </div>
          </div>
        );
      default:
        return (
          <div className="px-4 py-8 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-emerald-500">
                Welcome to GatePass System
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                {user && user.role === "admin"
                  ? "Admin Dashboard: Manage visitor registrations and entries."
                  : "Register for a visit. No login required for visitors."}
              </p>
            </div>
            {scanConfirmation ? (
              <div className="max-w-lg mx-auto mb-6">
                <p className="text-emerald-600 text-center bg-emerald-50 py-2 rounded-lg">
                  {scanConfirmation.message || "Scan processed successfully"}
                </p>
                {scanConfirmation.entryExitMessage && (
                  <p className="text-indigo-700 text-center mt-2 font-semibold">
                    {scanConfirmation.entryExitMessage}
                  </p>
                )}
                {scanConfirmation.user && (
                  <p className="text-gray-700 text-center mt-2">
                    User: {scanConfirmation.user.name} (
                    {scanConfirmation.user.email})
                  </p>
                )}
                {scanConfirmation.entryTime && (
                  <p className="text-gray-700 text-center mt-2">
                    Entry Time:{" "}
                    {new Date(scanConfirmation.entryTime).toLocaleString()}
                  </p>
                )}
                {scanConfirmation.exitTime && (
                  <p className="text-gray-700 text-center mt-2">
                    Exit Time:{" "}
                    {new Date(scanConfirmation.exitTime).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="max-w-lg mx-auto mb-6">
                <p className="text-gray-600 text-center">
                  No recent scan data available.
                </p>
              </div>
            )}
            <div className="max-w-lg mx-auto bg-white/30 backdrop-blur-lg border border-gray-200/50 shadow-lg p-8 rounded-2xl">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                Visitor Registration
              </h2>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${formProgress}%` }}
                ></div>
              </div>
              {errors.api && (
                <p className="text-rose-500 mb-4 text-center bg-rose-50 py-2 rounded-lg">
                  {errors.api}
                </p>
              )}
              <form onSubmit={handleRegister} className="space-y-6">
                <div className="relative">
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={`peer block w-full px-4 py-3 border ${
                      errors.name ? "border-rose-500" : "border-gray-200"
                    } rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200 bg-white/50`}
                    placeholder=" "
                  />
                  <label
                    htmlFor="name"
                    className="absolute left-4 top-3 text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:-top-6 peer-focus:text-sm peer-focus:text-indigo-600 peer-filled:-top-6 peer-filled:text-sm"
                  >
                    Name
                  </label>
                  {formData.name && !errors.name && (
                    <CheckCircleIcon className="absolute right-3 top-3 h-6 w-6 text-emerald-500" />
                  )}
                  {errors.name && (
                    <XCircleIcon className="absolute right-3 top-3 h-6 w-6 text-rose-500" />
                  )}
                  {errors.name && (
                    <p className="text-rose-500 text-xs mt-2">{errors.name}</p>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={`peer block w-full px-4 py-3 border ${
                      errors.email ? "border-rose-500" : "border-gray-200"
                    } rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200 bg-white/50`}
                    placeholder=" "
                  />
                  <label
                    htmlFor="email"
                    className="absolute left-4 top-3 text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:-top-6 peer-focus:text-sm peer-focus:text-indigo-600 peer-filled:-top-6 peer-filled:text-sm"
                  >
                    Email
                  </label>
                  {formData.email && !errors.email && (
                    <CheckCircleIcon className="absolute right-3 top-3 h-6 w-6 text-emerald-500" />
                  )}
                  {errors.email && (
                    <XCircleIcon className="absolute right-3 top-3 h-6 w-6 text-rose-500" />
                  )}
                  {errors.email && (
                    <p className="text-rose-500 text-xs mt-2">{errors.email}</p>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    id="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, mobileNumber: e.target.value })
                    }
                    className={`peer block w-full px-4 py-3 border ${
                      errors.mobileNumber
                        ? "border-rose-500"
                        : "border-gray-200"
                    } rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200 bg-white/50`}
                    placeholder=" "
                  />
                  <label
                    htmlFor="mobileNumber"
                    className="absolute left-4 top-3 text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:-top-6 peer-focus:text-sm peer-focus:text-indigo-600 peer-filled:-top-6 peer-filled:text-sm"
                  >
                    Mobile Number
                  </label>
                  {formData.mobileNumber && !errors.mobileNumber && (
                    <CheckCircleIcon className="absolute right-3 top-3 h-6 w-6 text-emerald-500" />
                  )}
                  {errors.mobileNumber && (
                    <XCircleIcon className="absolute right-3 top-3 h-6 w-6 text-rose-500" />
                  )}
                  {errors.mobileNumber && (
                    <p className="text-rose-500 text-xs mt-2">
                      {errors.mobileNumber}
                    </p>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    id="purpose"
                    value={formData.purpose}
                    onChange={(e) =>
                      setFormData({ ...formData, purpose: e.target.value })
                    }
                    className={`peer block w-full px-4 py-3 border ${
                      errors.purpose ? "border-rose-500" : "border-gray-200"
                    } rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200 bg-white/50`}
                    placeholder=" "
                  />
                  <label
                    htmlFor="purpose"
                    className="absolute left-4 top-3 text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:-top-6 peer-focus:text-sm peer-focus:text-indigo-600 peer-filled:-top-6 peer-filled:text-sm"
                  >
                    Purpose of Visit
                  </label>
                  {formData.purpose && !errors.purpose && (
                    <CheckCircleIcon className="absolute right-3 top-3 h-6 w-6 text-emerald-500" />
                  )}
                  {errors.purpose && (
                    <XCircleIcon className="absolute right-3 top-3 h-6 w-6 text-rose-500" />
                  )}
                  {errors.purpose && (
                    <p className="text-rose-500 text-xs mt-2">
                      {errors.purpose}
                    </p>
                  )}
                </div>
                <div className="relative">
                  <DatePicker
                    selected={visitDateTime}
                    onChange={(date) => setVisitDateTime(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="MMMM d, yyyy h:mm aa"
                    className={`peer block w-full px-4 py-3 border ${
                      errors.visitDateTime
                        ? "border-rose-500"
                        : "border-gray-200"
                    } rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-500 transition duration-200 bg-white/50`}
                    placeholderText=" "
                  />
                  <label
                    htmlFor="visitDateTime"
                    className="absolute left-4 top-3 text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:-top-6 peer-focus:text-sm peer-focus:text-indigo-600 peer-filled:-top-6 peer-filled:text-sm"
                  >
                    Visit Date and Time
                  </label>
                  {visitDateTime && !errors.visitDateTime && (
                    <CheckCircleIcon className="absolute right-3 top-3 h-6 w-6 text-emerald-500" />
                  )}
                  {errors.visitDateTime && (
                    <XCircleIcon className="absolute right-3 top-3 h-6 w-6 text-rose-500" />
                  )}
                  {errors.visitDateTime && (
                    <p className="text-rose-500 text-xs mt-2">
                      {errors.visitDateTime}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-200 transform hover:scale-105"
                >
                  Register
                </button>
              </form>
              {showConfetti && <Confetti />}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
      <nav className="bg-indigo-700 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-white text-xl font-bold">GatePass</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <div className="flex space-x-4">
                <NavItem
                  title="Home"
                  isActive={activeTab === "home"}
                  onClick={() => {
                    setActiveTab("home");
                    navigate("/", { state: { activeTab: "home" } });
                  }}
                />
                {user && user.role === "admin" && (
                  <>
                    <NavItem
                      title="Requests"
                      isActive={activeTab === "requests"}
                      onClick={() => {
                        setActiveTab("requests");
                        navigate("/requests", {
                          state: { activeTab: "requests" },
                        });
                      }}
                    />
                    <NavItem
                      title="Daily Entry"
                      isActive={activeTab === "daily-entry"}
                      onClick={() => {
                        setActiveTab("daily-entry");
                        navigate("/daily-entry", {
                          state: { activeTab: "daily-entry" },
                        });
                      }}
                    />
                    <NavItem
                      title="Scan QR"
                      isActive={activeTab === "scan"}
                      onClick={() => {
                        setActiveTab("scan");
                        navigate("/scan", { state: { activeTab: "scan" } });
                      }}
                    />
                  </>
                )}
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-800 transition duration-200 transform hover:scale-110"
                  >
                    Logout (Admin: {user.name})
                  </button>
                ) : (
                  <button
                    onClick={() => navigate("/login")}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-800 transition duration-200 transform hover:scale-110"
                  >
                    Admin Login
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center sm:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-indigo-600 focus:outline-none transition duration-200"
                onClick={toggleMobileMenu}
              >
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="sm:hidden animate-slideIn">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <MobileNavItem
                title="Home"
                isActive={activeTab === "home"}
                onClick={() => {
                  setActiveTab("home");
                  navigate("/", { state: { activeTab: "home" } });
                  setIsMobileMenuOpen(false);
                }}
              />
              {user && user.role === "admin" && (
                <>
                  <MobileNavItem
                    title="Requests"
                    isActive={activeTab === "requests"}
                    onClick={() => {
                      setActiveTab("requests");
                      navigate("/requests", {
                        state: { activeTab: "requests" },
                      });
                      setIsMobileMenuOpen(false);
                    }}
                  />
                  <MobileNavItem
                    title="Daily Entry"
                    isActive={activeTab === "daily-entry"}
                    onClick={() => {
                      setActiveTab("daily-entry");
                      navigate("/daily-entry", {
                        state: { activeTab: "daily-entry" },
                      });
                      setIsMobileMenuOpen(false);
                    }}
                  />
                  <MobileNavItem
                    title="Scan QR"
                    isActive={activeTab === "scan"}
                    onClick={() => {
                      setActiveTab("scan");
                      navigate("/scan", { state: { activeTab: "scan" } });
                      setIsMobileMenuOpen(false);
                    }}
                  />
                </>
              )}
              {user ? (
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 rounded-lg text-base font-medium text-left text-white hover:bg-indigo-600 transition duration-200"
                >
                  Logout (Admin: {user.name})
                </button>
              ) : (
                <button
                  onClick={() => {
                    navigate("/login");
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 rounded-lg text-base font-medium text-left text-white hover:bg-indigo-600 transition duration-200"
                >
                  Admin Login
                </button>
              )}
            </div>
          </div>
        )}
      </nav>
      <main className="flex-grow">{renderContent()}</main>
      <footer className="bg-white shadow-inner">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            © {new Date().getFullYear()} GatePass System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

const NavItem = ({ title, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition duration-200 transform ${
        isActive
          ? "bg-indigo-800 text-white scale-110"
          : "text-indigo-100 hover:bg-indigo-600 hover:scale-110"
      }`}
    >
      {title}
    </button>
  );
};

const MobileNavItem = ({ title, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`block px-3 py-2 rounded-lg text-base font-medium w-full text-left transition duration-200 ${
        isActive
          ? "bg-indigo-800 text-white"
          : "text-indigo-100 hover:bg-indigo-600"
      }`}
    >
      {title}
    </button>
  );
};

export default Home;
