import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  scanQr,
  safeLocalStorage,
  checkNetworkConnection,
  checkRateLimit,
} from "../utils/api";
import {
  QrCodeIcon,
  CameraIcon,
  PhotoIcon,
  PlayIcon,
  StopIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LightBulbIcon,
  VideoCameraIcon,
  DocumentIcon,
  WifiIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";

const ScannerPage = () => {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [devices, setDevices] = useState([]);
  const [cameraId, setCameraId] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [scanCount, setScanCount] = useState(0);
  const [cameraError, setCameraError] = useState("");
  const [permissionState, setPermissionState] = useState("unknown");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);

  const scannerRef = useRef(null);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const lastScanTimeRef = useRef(0);

  // **FIXED: Safe scanner stop function with proper state checking**
  const stopScanner = useCallback(async () => {
    try {
      if (!scannerRef.current) {
        setIsScanning(false);
        return;
      }

      // Check scanner state before stopping
      const state = scannerRef.current.getState();
      console.log("Scanner state before stop:", state);

      // Only stop if scanner is in scanning state (state === 2)
      if (state === 2) {
        await scannerRef.current.stop();
        console.log("Scanner stopped successfully");
      } else {
        console.log("Scanner not in scanning state, skipping stop()");
      }

      // Always clear after stop (if scanner exists)
      try {
        await scannerRef.current.clear();
        console.log("Scanner cleared successfully");
      } catch (clearError) {
        console.warn("Scanner clear warning:", clearError);
      }
    } catch (err) {
      console.warn("Stop scanner warning (non-critical):", err.message);
      // Don't throw error, just log it as it's often expected behavior
    } finally {
      setIsScanning(false);
    }
  }, []);

  // **FIXED: Enhanced navigation function with safe scanner stopping**
  const navigateToHome = useCallback(
    async (scanData) => {
      try {
        // Stop scanner safely before navigation
        if (isScanning) {
          await stopScanner();
        }

        // Clear current state to prevent conflicts
        setError("");
        setSuccess("");
        setScanResult(null);
        setLoading(false);

        // Small delay to ensure scanner is fully stopped
        setTimeout(() => {
          navigate("/", {
            replace: true,
            state: {
              activeTab: "home",
              scanResult: scanData,
              timestamp: Date.now(),
            },
          });
        }, 100);
      } catch (error) {
        console.error("Navigation error:", error);
        // Fallback: Force navigation without state
        navigate("/", { replace: true });
      }
    },
    [navigate, isScanning, stopScanner]
  );

  // Debounced scan handler
  const debouncedScan = useCallback((decodedText) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 2000) return;
    lastScanTimeRef.current = now;
    handleScanSuccess(decodedText);
  }, []);

  // Initialize cameras
  const initializeCameras = async (retryCount = 0) => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(
        (device) => device.kind === "videoinput"
      );

      if (videoDevices && videoDevices.length > 0) {
        const cameras = videoDevices.map((device, index) => ({
          id: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }));

        setDevices(cameras);
        const selectedCameraId =
          cameras.find(
            (cam) =>
              cam.label.toLowerCase().includes("back") ||
              cam.label.toLowerCase().includes("rear") ||
              cam.label.toLowerCase().includes("environment")
          )?.id || cameras[0].id;

        setCameraId(selectedCameraId);
        setCameraError("");
        return true;
      } else {
        if (retryCount < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return await initializeCameras(retryCount + 1);
        } else {
          setCameraError("No cameras detected.");
          return false;
        }
      }
    } catch (error) {
      setCameraError(`Failed to access cameras: ${error.message}`);
      return false;
    }
  };

  // Check permissions
  const checkCameraPermissions = async () => {
    try {
      if ("permissions" in navigator) {
        const permission = await navigator.permissions.query({
          name: "camera",
        });
        setPermissionState(permission.state);
        if (permission.state === "granted") return true;
        if (permission.state === "denied" || permission.state === "prompt") {
          setShowPermissionDialog(true);
          return false;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState("granted");
      return true;
    } catch (err) {
      setCameraError(`Camera access failed: ${err.message}`);
      return false;
    }
  };

  // Request permission
  const requestCameraPermission = async () => {
    setLoading(true);
    setShowPermissionDialog(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState("granted");
      setSuccess("✅ Camera access granted!");
      setTimeout(async () => {
        await initializeCameras();
        setSuccess("");
      }, 500);
    } catch (error) {
      setError(`Camera access failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Network monitoring
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

  // **ENHANCED: Scanner initialization with safe cleanup**
  useEffect(() => {
    const user = safeLocalStorage.get("user");
    if (!user || user.role !== "admin") {
      setError("You must be logged in as an admin to access this page.");
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    const hasSeenTutorial = safeLocalStorage.get("hasSeenScannerTutorial");
    if (hasSeenTutorial) setShowTutorial(false);

    const initializeScanner = async () => {
      try {
        setScannerReady(false);

        // **ENHANCED: Safe cleanup of existing scanner**
        if (scannerRef.current) {
          try {
            const state = scannerRef.current.getState();
            if (state === 2) {
              await scannerRef.current.stop();
            }
            await scannerRef.current.clear();
          } catch (e) {
            console.warn("Scanner cleanup warning:", e);
          }
          scannerRef.current = null;
        }

        await new Promise((resolve) => setTimeout(resolve, 300));

        scannerRef.current = new Html5Qrcode("qr-reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });

        setScannerReady(true);
        const hasPermission = await checkCameraPermissions();
        if (hasPermission) await initializeCameras();
      } catch (err) {
        console.error("Scanner initialization error:", err);
        setScannerReady(false);
        setCameraError(`Failed to initialize scanner: ${err.message}`);
      }
    };

    initializeScanner();

    // **ENHANCED: Safe cleanup function**
    return () => {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2) {
            scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear().catch(() => {});
        } catch (e) {
          console.warn("Cleanup warning:", e);
        }
        scannerRef.current = null;
      }
    };
  }, [navigate]);

  const startScanner = async () => {
    if (!scannerRef.current || !cameraId || !checkNetworkConnection()) {
      setError("Scanner or camera not available, or no internet connection.");
      return;
    }

    try {
      setError("");
      setCameraError("");
      setSuccess("");
      setIsScanning(true);

      await scannerRef.current.start(
        cameraId,
        { fps: 10, qrbox: { width: 280, height: 280 } },
        debouncedScan,
        (errorMessage) => {
          if (!errorMessage.includes("NotFoundException")) {
            console.debug("QR Scan attempt:", errorMessage);
          }
        }
      );
    } catch (err) {
      console.error("Start scanner error:", err);
      setIsScanning(false);
      setCameraError(`Failed to start camera: ${err.message}`);
    }
  };

  // **FIXED: Enhanced scan success handler with safe navigation**
  const handleScanSuccess = async (qrString) => {
    if (loading || !qrString) return;

    try {
      checkRateLimit("qr-scan", 10, 60000);
    } catch (rateLimitError) {
      const scanResultData = {
        success: false,
        message: rateLimitError.message,
        user: null,
        entryTime: null,
        exitTime: null,
      };
      await navigateToHome(scanResultData);
      return;
    }

    setLoading(true);
    setScanCount((prev) => prev + 1);

    try {
      const user = safeLocalStorage.get("user");
      if (!user?.accessToken) {
        throw new Error("Session expired. Please login again.");
      }

      const response = await scanQr(qrString, user.accessToken);

      let scanResultData = null;

      if (response.entryTime) {
        const message = `Entry granted for ${response.user.name} at ${new Date(response.entryTime).toLocaleString()}`;
        const entryExitMessage = `Entering at ${new Date(response.entryTime).toLocaleTimeString()}`;

        scanResultData = {
          success: true,
          message,
          entryExitMessage,
          user: response.user,
          entryTime: response.entryTime,
          exitTime: null,
        };

        setSuccess("Entry logged successfully! Redirecting...");
        speak("Entry granted");
      } else if (response.exitTime) {
        const message = `Exit logged for ${response.user.name} at ${new Date(response.exitTime).toLocaleString()}`;
        const entryExitMessage = `Exiting at ${new Date(response.exitTime).toLocaleTimeString()}`;

        scanResultData = {
          success: true,
          message,
          entryExitMessage,
          user: response.user,
          entryTime: null,
          exitTime: response.exitTime,
        };

        setSuccess("Exit logged successfully! Redirecting...");
        speak("Exit logged");
      } else {
        throw new Error(
          "Invalid scan response: No entry or exit time provided"
        );
      }

      // **KEY: Navigate after a brief delay**
      setTimeout(async () => {
        await navigateToHome(scanResultData);
      }, 500);
    } catch (err) {
      console.error("Scan error:", err);
      const errorMessage = err.message || "Invalid or expired QR code";

      const scanResultData = {
        success: false,
        message: errorMessage,
        entryExitMessage: "",
        user: null,
        entryTime: null,
        exitTime: null,
      };

      speak("Scan Failed");

      // **KEY: Navigate to home even on error**
      setTimeout(async () => {
        await navigateToHome(scanResultData);
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  const speak = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const validateImageFile = (file) => {
    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (file.size > maxSize) {
      throw new Error("File size too large. Maximum size is 10MB.");
    }
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      throw new Error("Invalid file type. Please upload a valid image file.");
    }
    return true;
  };

  // **FIXED: Enhanced image upload with safe navigation**
  const handleImageUpload = async (file) => {
    if (!file) return;

    try {
      validateImageFile(file);
    } catch (validationError) {
      setError(validationError.message);
      return;
    }

    if (!checkNetworkConnection()) {
      setError("No internet connection.");
      return;
    }

    if (
      !scannerRef.current ||
      typeof scannerRef.current.scanFile !== "function"
    ) {
      setError("Scanner not ready. Please wait for initialization.");
      return;
    }

    setImageFile(file);
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await scannerRef.current.scanFile(file, true);
      await handleScanSuccess(result);
    } catch (err) {
      console.error("Image scan error:", err);
      const errorMessage = err.message?.includes("QR code not found")
        ? "No QR code found in the uploaded image."
        : `Scan failed: ${err.message}`;

      const scanResultData = {
        success: false,
        message: errorMessage,
        user: null,
        entryTime: null,
        exitTime: null,
      };

      speak("Scan Failed");

      // **KEY: Navigate to home even on image scan error**
      setTimeout(async () => {
        await navigateToHome(scanResultData);
      }, 500);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleImageUpload(file);
  };

  const closeTutorial = () => {
    setShowTutorial(false);
    safeLocalStorage.set("hasSeenScannerTutorial", true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden flex items-center justify-center py-12 px-4">
      {/* Animated Background */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10 max-w-lg w-full">
        <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-8">
          {/* Tutorial Modal */}
          {showTutorial && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-3xl">
              <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl max-w-sm mx-4 border border-white/20">
                <div className="text-center mb-4">
                  <LightBulbIcon className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                  <h3 className="text-xl font-bold text-gray-800">
                    QR Scanner Guide
                  </h3>
                </div>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start">
                    <VideoCameraIcon className="w-5 h-5 text-indigo-500 mr-2 mt-0.5 flex-shrink-0" />
                    <p>Enable camera access and select your preferred camera</p>
                  </div>
                  <div className="flex items-start">
                    <QrCodeIcon className="w-5 h-5 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                    <p>Point camera at QR code or upload an image</p>
                  </div>
                  <div className="flex items-start">
                    <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <p>You'll be redirected to home after scanning</p>
                  </div>
                </div>
                <button
                  onClick={closeTutorial}
                  className="mt-6 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:shadow-lg transition-all duration-200"
                >
                  Got It!
                </button>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-6 shadow-lg">
              <QrCodeIcon className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              QR Scanner
            </h2>
            <p className="text-lg text-gray-600">
              Scan visitor QR codes for entry/exit logging
            </p>
            {scanCount > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Scans today: {scanCount}
              </p>
            )}
          </div>

          {/* Status Messages */}
          {!isOnline && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center">
              <WifiIcon className="w-5 h-5 text-rose-500 mr-2" />
              <span className="text-rose-700 text-sm">
                You're offline. Scanning requires internet connection.
              </span>
            </div>
          )}

          {cameraError && !showPermissionDialog && (
            <div className="mb-6 p-4 bg-amber-50/80 backdrop-blur-sm border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0" />
                  <div>
                    <p className="text-amber-700 font-medium">Camera Issue</p>
                    <p className="text-amber-600 mt-1">{cameraError}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPermissionDialog(true)}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-xl">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-rose-500 mr-2 flex-shrink-0" />
                <p className="text-rose-700">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-50/80 backdrop-blur-sm border border-emerald-200 rounded-xl">
              <div className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0" />
                <p className="text-emerald-700">{success}</p>
              </div>
            </div>
          )}

          {/* Camera Permission Dialog */}
          {showPermissionDialog && (
            <div className="mb-6">
              <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200 rounded-xl p-6">
                <div className="text-center mb-4">
                  <CameraIcon className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-amber-800 mb-2">
                    Camera Access Required
                  </h3>
                  <p className="text-amber-700">
                    To scan QR codes, we need access to your camera.
                  </p>
                </div>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={requestCameraPermission}
                    disabled={loading}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 flex items-center disabled:opacity-50 disabled:transform-none"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Requesting Access...
                      </>
                    ) : (
                      <>
                        <CameraIcon className="w-5 h-5 mr-2" />
                        Enable Camera Access
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowPermissionDialog(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors duration-300"
                  >
                    Use Image Upload
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Scanner Area */}
          <div className="space-y-6">
            <div
              id="qr-reader"
              className={`w-full ${isScanning ? "block" : "hidden"} relative border-4 border-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl overflow-hidden shadow-lg`}
              style={{ minHeight: "280px" }}
            >
              {isScanning && loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-10">
                  <div className="bg-white/90 rounded-xl p-4 flex items-center">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-3" />
                    <p className="text-gray-700 font-medium">
                      Processing scan...
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            {!isScanning ? (
              <div className="space-y-6">
                {/* Camera Selection */}
                {devices.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <CameraIcon className="w-4 h-4 inline mr-1" />
                      Select Camera ({devices.length} available)
                    </label>
                    <select
                      value={cameraId || ""}
                      onChange={(e) => setCameraId(e.target.value)}
                      className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
                    >
                      {devices.map((device, index) => (
                        <option key={device.id} value={device.id}>
                          {device.label || `Camera ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Start Scanner Button */}
                <button
                  onClick={
                    permissionState === "granted" && cameraId
                      ? startScanner
                      : () => setShowPermissionDialog(true)
                  }
                  disabled={!isOnline || loading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {permissionState === "granted" && cameraId ? (
                    <>
                      <PlayIcon className="w-5 h-5 inline mr-2" />
                      Start Camera Scan
                    </>
                  ) : (
                    <>
                      <CameraIcon className="w-5 h-5 inline mr-2" />
                      Enable Camera Access
                    </>
                  )}
                </button>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <PhotoIcon className="w-4 h-4 inline mr-1" />
                    Or Upload QR Code Image
                    {!scannerReady && (
                      <span className="ml-2 text-xs text-amber-600">
                        (Scanner initializing...)
                      </span>
                    )}
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
                      dragActive
                        ? "border-indigo-500 bg-indigo-50/70 scale-105"
                        : scannerReady
                          ? "border-gray-300 hover:border-indigo-400 hover:bg-gray-50/70"
                          : "border-gray-200 bg-gray-50/50 cursor-not-allowed"
                    }`}
                    onDragOver={scannerReady ? handleDragOver : undefined}
                    onDragLeave={scannerReady ? handleDragLeave : undefined}
                    onDrop={scannerReady ? handleDrop : undefined}
                  >
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={(e) =>
                        scannerReady && handleImageUpload(e.target.files[0])
                      }
                      className="hidden"
                      disabled={!scannerReady}
                    />
                    <label
                      htmlFor="image-upload"
                      className={`cursor-pointer ${!scannerReady ? "opacity-50" : ""}`}
                    >
                      <ArrowUpTrayIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-indigo-600 font-medium mb-1">
                        {scannerReady
                          ? "Click to upload or drag and drop"
                          : "Scanner initializing..."}
                      </p>
                      <p className="text-sm text-gray-500">
                        PNG, JPG, JPEG, GIF, WebP up to 10MB
                      </p>
                    </label>
                  </div>
                  {imageFile && (
                    <div className="mt-2 text-sm text-gray-600 flex items-center">
                      <DocumentIcon className="w-4 h-4 mr-1" />
                      <span>Uploaded: {imageFile.name}</span>
                      <span className="ml-2 text-gray-400">
                        ({(imageFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={stopScanner}
                disabled={loading}
                className="w-full bg-rose-500 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:bg-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/20 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50"
              >
                <StopIcon className="w-5 h-5 inline mr-2" />
                {loading ? "Processing..." : "Stop Scanning"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScannerPage;
