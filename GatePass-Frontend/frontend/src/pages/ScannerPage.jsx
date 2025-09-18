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
  const [lastScanned, setLastScanned] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [entryExitMessage, setEntryExitMessage] = useState("");
  const [devices, setDevices] = useState([]);
  const [cameraId, setCameraId] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [scanCount, setScanCount] = useState(0);
  const [cameraError, setCameraError] = useState("");
  const [permissionState, setPermissionState] = useState("unknown");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  // **NEW: Track scanner readiness**
  const [scannerReady, setScannerReady] = useState(false);

  const scannerRef = useRef(null);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const cleanupRef = useRef(null);

  // Debounced scan handler to prevent rapid scans
  const debouncedScan = useCallback((decodedText) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 2000) return; // 2 second debounce
    lastScanTimeRef.current = now;
    handleScanSuccess(decodedText);
  }, []);

  // **ENHANCED: Multiple camera enumeration with proper device handling**
  const initializeCameras = async (retryCount = 0) => {
    try {
      console.log("Initializing cameras, attempt:", retryCount + 1);

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(
        (device) => device.kind === "videoinput"
      );

      console.log("Found video devices:", videoDevices);

      if (videoDevices && videoDevices.length > 0) {
        const cameras = videoDevices.map((device, index) => ({
          id: device.deviceId,
          label:
            device.label ||
            `Camera ${index + 1}` +
              (device.deviceId.includes("usb") ? " (USB)" : "") +
              (device.deviceId.includes("built") ? " (Built-in)" : ""),
        }));

        setDevices(cameras);

        let selectedCameraId = null;

        // 1. Prefer back/rear/environment camera
        const backCamera = cameras.find(
          (camera) =>
            camera.label.toLowerCase().includes("back") ||
            camera.label.toLowerCase().includes("rear") ||
            camera.label.toLowerCase().includes("environment")
        );

        // 2. Prefer USB/external cameras (usually better quality)
        const usbCamera = cameras.find(
          (camera) =>
            camera.label.toLowerCase().includes("usb") ||
            camera.id.includes("usb")
        );

        // 3. Fall back to first camera
        selectedCameraId = backCamera?.id || usbCamera?.id || cameras[0].id;

        setCameraId(selectedCameraId);
        setCameraError("");

        console.log("Selected camera ID:", selectedCameraId);
        console.log("Available cameras:", cameras);

        return true;
      } else {
        if (retryCount < 3) {
          console.log("No cameras found, retrying in 1 second...");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return await initializeCameras(retryCount + 1);
        } else {
          setCameraError(
            "No cameras detected. Please connect a camera device or refresh the page."
          );
          return false;
        }
      }
    } catch (error) {
      console.error("Failed to enumerate devices:", error);

      try {
        console.log("Falling back to Html5Qrcode.getCameras()");
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          setDevices(cameras);
          const backCamera = cameras.find(
            (camera) =>
              camera.label.toLowerCase().includes("back") ||
              camera.label.toLowerCase().includes("rear") ||
              camera.label.toLowerCase().includes("environment")
          );
          setCameraId(backCamera ? backCamera.id : cameras[0].id);
          setCameraError("");
          return true;
        }
      } catch (fallbackError) {
        console.error("Fallback camera enumeration failed:", fallbackError);
      }

      setCameraError(`Failed to access cameras: ${error.message}`);
      return false;
    }
  };

  // Check camera permissions
  const checkCameraPermissions = async () => {
    try {
      if ("permissions" in navigator) {
        const permission = await navigator.permissions.query({
          name: "camera",
        });
        setPermissionState(permission.state);

        if (permission.state === "granted") {
          return true;
        } else if (permission.state === "denied") {
          setShowPermissionDialog(true);
          return false;
        } else if (permission.state === "prompt") {
          setShowPermissionDialog(true);
          return false;
        }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        stream.getTracks().forEach((track) => track.stop());
        setPermissionState("granted");
        return true;
      } catch (err) {
        console.error("Camera access test failed:", err);
        if (err.name === "NotAllowedError") {
          setPermissionState("denied");
          setShowPermissionDialog(true);
        } else if (err.name === "NotFoundError") {
          setCameraError("No camera found. Please connect a camera device.");
        } else {
          setCameraError(`Camera access failed: ${err.message}`);
        }
        return false;
      }
    } catch (error) {
      console.error("Permission check failed:", error);
      setCameraError("Unable to check camera permissions.");
      return false;
    }
  };

  // **ENHANCED: Request camera permission with better UX**
  const requestCameraPermission = async () => {
    setLoading(true);
    setShowPermissionDialog(false);
    setCameraError("");
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      stream.getTracks().forEach((track) => track.stop());

      setPermissionState("granted");
      setSuccess("✅ Camera access granted! Initializing cameras...");

      setTimeout(async () => {
        const success = await initializeCameras();
        if (success) {
          setSuccess("✅ Camera access granted! You can now start scanning.");
        } else {
          setSuccess("");
          setCameraError(
            "Cameras initialized but none detected. Please refresh the page."
          );
        }

        setTimeout(() => setSuccess(""), 3000);
      }, 500);
    } catch (error) {
      console.error("Camera permission request failed:", error);

      if (error.name === "NotAllowedError") {
        setPermissionState("denied");
        setError(
          "❌ Camera permission denied. Please allow camera access in your browser settings and refresh the page."
        );
      } else if (error.name === "NotFoundError") {
        setError(
          "📷 No camera device found. Please connect a camera or use image upload."
        );
      } else if (error.name === "NotReadableError") {
        setError(
          "🔒 Camera is being used by another application. Please close other apps."
        );
      } else {
        setError(`⚠️ Camera access failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

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

  // **ENHANCED: Scanner initialization with retry logic**
  useEffect(() => {
    const user = safeLocalStorage.get("user");
    if (!user || user.role !== "admin") {
      setError("You must be logged in as an admin to access this page.");
      const timer = setTimeout(() => navigate("/login"), 3000);
      return () => clearTimeout(timer);
    }

    const hasSeenTutorial = safeLocalStorage.get("hasSeenScannerTutorial");
    if (hasSeenTutorial) {
      setShowTutorial(false);
    }

    const initializeScanner = async () => {
      try {
        setScannerReady(false);

        // **FIX: Clear any existing scanner first**
        if (scannerRef.current) {
          try {
            if (scannerRef.current.getState() === 2) {
              await scannerRef.current.stop();
            }
            await scannerRef.current.clear();
          } catch (e) {
            console.warn("Failed to clear existing scanner:", e);
          }
          scannerRef.current = null;
        }

        // **FIX: Add a small delay to ensure DOM is ready**
        await new Promise((resolve) => setTimeout(resolve, 100));

        scannerRef.current = new Html5Qrcode("qr-reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });

        console.log("✅ Scanner initialized successfully");
        setScannerReady(true);

        const hasPermission = await checkCameraPermissions();

        if (hasPermission === true) {
          await initializeCameras();
        }
      } catch (err) {
        console.error("Scanner initialization error:", err);
        setScannerReady(false);
        setCameraError(`Failed to initialize scanner: ${err.message}`);

        // **FIX: Retry initialization after delay**
        setTimeout(() => {
          console.log("Retrying scanner initialization...");
          initializeScanner();
        }, 2000);
      }
    };

    initializeScanner();

    cleanupRef.current = async () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.getState() === 2) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (err) {
          console.error("Scanner cleanup error:", err);
        }
        scannerRef.current = null;
      }
    };

    return cleanupRef.current;
  }, [navigate]);

  // **FIX: Set default cameraId when devices change**
  useEffect(() => {
    if (devices.length > 0 && !cameraId) {
      const backCamera = devices.find(
        (camera) =>
          camera.label.toLowerCase().includes("back") ||
          camera.label.toLowerCase().includes("rear") ||
          camera.label.toLowerCase().includes("environment")
      );
      const usbCamera = devices.find(
        (camera) =>
          camera.label.toLowerCase().includes("usb") ||
          camera.id.includes("usb")
      );
      const defaultId = backCamera?.id || usbCamera?.id || devices[0].id;
      setCameraId(defaultId);
      setError("");
      console.log("Set default cameraId to:", defaultId);
    }
  }, [devices, cameraId]);

  const startScanner = async () => {
    console.log("Starting scanner with cameraId:", cameraId);
    console.log("Available devices:", devices);

    if (!scannerRef.current || !cameraId) {
      setError(
        "No camera selected. Please enable camera access or upload a QR code image."
      );
      return;
    }

    if (!checkNetworkConnection()) {
      setError(
        "No internet connection. Please check your network and try again."
      );
      return;
    }

    try {
      setError("");
      setCameraError("");
      setSuccess("");
      setScanResult(null);
      setIsScanning(true);

      const config = {
        fps: 10,
        qrbox: { width: 280, height: 280 },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      await scannerRef.current.start(
        cameraId,
        config,
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

      if (err.name === "NotAllowedError") {
        setPermissionState("denied");
        setCameraError("Camera access denied. Please grant camera permission.");
        setShowPermissionDialog(true);
      } else if (err.name === "NotFoundError") {
        setCameraError(
          "Camera not found. Please check your camera connection."
        );
      } else if (err.name === "NotReadableError") {
        setCameraError(
          "Camera is being used by another application. Please close other apps and try again."
        );
      } else {
        setCameraError(`Failed to start camera: ${err.message}`);
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.getState() === 2) {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        }
        setIsScanning(false);
      } catch (err) {
        console.error("Stop scanner error:", err);
        setError(`Failed to stop scanner: ${err.message}`);
        setIsScanning(false);
      }
    }
  };

  const handleScanSuccess = async (qrString) => {
    if (loading || !qrString) return;

    try {
      checkRateLimit("qr-scan", 10, 60000);
    } catch (rateLimitError) {
      setError(rateLimitError.message);
      return;
    }

    setLoading(true);
    setScanCount((prev) => prev + 1);

    try {
      await stopScanner();
      setError("");
      setSuccess("");
      setScanResult(null);
      setEntryExitMessage("");

      const user = safeLocalStorage.get("user");
      if (!user?.accessToken) {
        throw new Error("Session expired. Please login again.");
      }

      const response = await scanQr(qrString, user.accessToken);

      let message = "";
      let entryExitMessage = "";
      let scanResultData = null;

      if (response.entryTime) {
        message = `Entry granted for ${response.user.name} at ${new Date(response.entryTime).toLocaleString()}`;
        entryExitMessage = `Entering at ${new Date(response.entryTime).toLocaleTimeString()}`;
        setSuccess(message);
        setEntryExitMessage(entryExitMessage);
        speak("Entry granted");
        scanResultData = {
          success: true,
          message,
          entryExitMessage,
          user: response.user,
          entryTime: response.entryTime,
          exitTime: null,
        };
      } else if (response.exitTime) {
        message = `Exit logged for ${response.user.name} at ${new Date(response.exitTime).toLocaleString()}`;
        entryExitMessage = `Exiting at ${new Date(response.exitTime).toLocaleTimeString()}`;
        setSuccess(message);
        setEntryExitMessage(entryExitMessage);
        speak("Exit logged");
        scanResultData = {
          success: true,
          message,
          entryExitMessage,
          user: response.user,
          entryTime: null,
          exitTime: response.exitTime,
        };
      } else {
        throw new Error(
          "Invalid scan response: No entry or exit time provided"
        );
      }

      safeLocalStorage.set("scanResult", scanResultData);

      navigate("/", {
        state: {
          activeTab: "home",
          scanResult: scanResultData,
        },
      });
    } catch (err) {
      console.error("Scan error:", err);
      const errorMessage = err.message || "Invalid or expired QR code";
      setError(errorMessage);
      speak("Scan Failed");

      const scanResultData = {
        success: false,
        message: errorMessage,
        entryExitMessage: "",
        user: null,
        entryTime: null,
        exitTime: null,
      };

      safeLocalStorage.set("scanResult", scanResultData);
      navigate("/", {
        state: {
          activeTab: "home",
          scanResult: scanResultData,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const speak = (text) => {
    if ("speechSynthesis" in window && window.speechSynthesis) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1.1;
      utterance.volume = 0.8;

      utterance.onerror = (event) => {
        console.warn("Speech synthesis error:", event.error);
      };

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

  // **FIXED: handleImageUpload function with proper null checks**
  const handleImageUpload = async (file) => {
    if (!file) return;

    try {
      validateImageFile(file);
    } catch (validationError) {
      setError(validationError.message);
      return;
    }

    if (!checkNetworkConnection()) {
      setError(
        "No internet connection. Please check your network and try again."
      );
      return;
    }

    // **FIX: Check if scanner is initialized before using scanFile**
    if (!scannerRef.current) {
      setError(
        "Scanner not initialized. Please wait for the scanner to load or refresh the page."
      );
      return;
    }

    // **FIX: Additional check for scanner state and method availability**
    try {
      if (typeof scannerRef.current.scanFile !== "function") {
        setError("Scanner not ready. Please try again in a moment.");
        return;
      }
    } catch (err) {
      console.error("Scanner state check failed:", err);
      setError("Scanner not available. Please refresh the page and try again.");
      return;
    }

    setImageFile(file);
    setError("");
    setSuccess("");
    setScanResult(null);
    setLoading(true);

    try {
      console.log("Attempting to scan uploaded image...");
      const result = await scannerRef.current.scanFile(file, true);
      console.log("Image scan result:", result);
      await handleScanSuccess(result);
    } catch (err) {
      console.error("Image scan error:", err);
      let errorMessage = "Failed to scan QR code from image.";

      // **Enhanced error messages based on error type**
      if (err.message?.includes("QR code not found")) {
        errorMessage =
          "No QR code found in the uploaded image. Please ensure the image contains a clear QR code.";
      } else if (err.message?.includes("Unable to decode")) {
        errorMessage =
          "Unable to decode QR code. Please try with a clearer image.";
      } else if (err.message) {
        errorMessage = `Scan failed: ${err.message}`;
      }

      setError(errorMessage);
      speak("Scan Failed");

      const scanResultData = {
        success: false,
        message: errorMessage,
        entryExitMessage: "",
        user: null,
        entryTime: null,
        exitTime: null,
      };

      safeLocalStorage.set("scanResult", scanResultData);
      navigate("/", {
        state: {
          activeTab: "home",
          scanResult: scanResultData,
        },
      });
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
    if (file) {
      await handleImageUpload(file);
    }
  };

  const handleScanAgain = () => {
    setError("");
    setSuccess("");
    setScanResult(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
                    <p>
                      Point the camera at the QR code for automatic scanning
                    </p>
                  </div>
                  <div className="flex items-start">
                    <PhotoIcon className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <p>Upload or drag & drop QR code images as alternative</p>
                  </div>
                  <div className="flex items-start">
                    <ShieldExclamationIcon className="w-5 h-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
                    <p>Works with built-in, USB, and mobile cameras</p>
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
                    To scan QR codes, we need access to your camera. This works
                    with built-in cameras, USB cameras, and mobile cameras
                    connected to your device.
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
                    Use Image Upload Instead
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Offline Indicator */}
          {!isOnline && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center">
              <WifiIcon className="w-5 h-5 text-rose-500 mr-2" />
              <span className="text-rose-700 text-sm">
                You're offline. Scanning requires internet connection.
              </span>
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

          {/* Camera Error */}
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

          {/* Status Messages */}
          {error && (
            <div className="mb-6 p-4 bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-xl animate-shake">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-rose-500 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-rose-700 font-medium">Scan Failed:</p>
                  <p className="text-rose-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 space-y-3">
              <div className="p-4 bg-emerald-50/80 backdrop-blur-sm border border-emerald-200 rounded-xl">
                <div className="flex items-center">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0" />
                  <div>
                    <p className="text-emerald-700 font-medium">
                      Scan Successful:
                    </p>
                    <p className="text-emerald-600 mt-1">{success}</p>
                  </div>
                </div>
              </div>
              {entryExitMessage && (
                <div className="p-3 bg-indigo-50/80 backdrop-blur-sm border border-indigo-200 rounded-xl text-center">
                  <p className="text-indigo-700 font-semibold">
                    {entryExitMessage}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Scanner Area */}
          <div className="space-y-6">
            <div
              id="qr-reader"
              className={`w-full ${
                isScanning ? "block" : "hidden"
              } relative border-4 border-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl overflow-hidden shadow-lg ${
                lastScanned ? "animate-pulse" : ""
              }`}
              style={{ minHeight: "280px" }}
            >
              {isScanning && (
                <div className="absolute inset-0 bg-transparent z-10">
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-64 h-64 border-4 border-white/50 border-dashed rounded-lg animate-pulse" />
                  </div>
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                      <div className="bg-white/90 rounded-xl p-4 flex items-center">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-3" />
                        <p className="text-gray-700 font-medium">
                          Processing scan...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Camera Controls */}
            {!isScanning ? (
              <div className="space-y-6">
                {scanResult && (
                  <div className="p-4 bg-gray-50/70 backdrop-blur-sm border border-gray-200 rounded-xl">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Last Scan Result:
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <strong>Name:</strong> {scanResult.user?.name}
                      </p>
                      <p>
                        <strong>Email:</strong> {scanResult.user?.email}
                      </p>
                      {scanResult.entryTime && (
                        <p>
                          <strong>Entry:</strong>{" "}
                          {new Date(scanResult.entryTime).toLocaleString()}
                        </p>
                      )}
                      {scanResult.exitTime && (
                        <p>
                          <strong>Exit:</strong>{" "}
                          {new Date(scanResult.exitTime).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* **ENHANCED: Multiple Camera Selection** */}
                {devices.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <CameraIcon className="w-4 h-4 inline mr-1" />
                      Select Camera ({devices.length} available)
                    </label>
                    <select
                      value={cameraId || ""}
                      onChange={(e) => {
                        console.log("Camera changed to:", e.target.value);
                        setCameraId(e.target.value);
                      }}
                      className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
                      aria-label="Select camera for scanning"
                    >
                      {devices.map((device, index) => (
                        <option key={device.id} value={device.id}>
                          {device.label || `Camera ${index + 1}`}
                        </option>
                      ))}
                    </select>
                    {devices.length > 1 && (
                      <p className="mt-1 text-xs text-gray-500">
                        💡 Tip: USB and external cameras often provide better
                        quality for QR scanning
                      </p>
                    )}
                  </div>
                )}

                {/* Debug Info */}
                {devices.length === 0 && permissionState === "granted" && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-blue-700 text-sm">
                      🔄 Camera permission granted but no devices found.
                      <button
                        onClick={() => initializeCameras()}
                        className="ml-2 text-blue-800 underline hover:no-underline"
                      >
                        Try Again
                      </button>
                    </p>
                  </div>
                )}

                {/* Start Scanner Button */}
                <button
                  onClick={
                    permissionState === "granted" && cameraId
                      ? startScanner
                      : () => setShowPermissionDialog(true)
                  }
                  disabled={!isOnline}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  aria-label="Start camera scanning"
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

                {/* **ENHANCED: File Upload Area with Scanner Status** */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <PhotoIcon className="w-4 h-4 inline mr-1" />
                    Or Upload QR Code Image
                    {/* **ADD SCANNER STATUS** */}
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
                      aria-label="Upload QR code image"
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

                {/* Scan Again Button */}
                {(scanResult || imageFile) && (
                  <button
                    onClick={handleScanAgain}
                    className="w-full bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-500/20 transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    <QrCodeIcon className="w-5 h-5 inline mr-2" />
                    Scan Another Code
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={stopScanner}
                className="w-full bg-rose-500 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:bg-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/20 transition-all duration-300 transform hover:scale-[1.02]"
                aria-label="Stop camera scanning"
              >
                <StopIcon className="w-5 h-5 inline mr-2" />
                Stop Scanning
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScannerPage;
