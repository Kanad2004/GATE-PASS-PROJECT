// import { useState, useEffect, useRef } from "react";
// import { useNavigate } from "react-router-dom";
// import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
// import { scanQr } from "../utils/api";

// const ScannerPage = () => {
//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState("");
//   const [scanResult, setScanResult] = useState(null);
//   const [isScanning, setIsScanning] = useState(false);
//   const [lastScanned, setLastScanned] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [imageFile, setImageFile] = useState(null);
//   const [showTutorial, setShowTutorial] = useState(true);
//   const [entryExitMessage, setEntryExitMessage] = useState("");
//   const [devices, setDevices] = useState([]);
//   const [cameraId, setCameraId] = useState(null);
//   const scannerRef = useRef(null);
//   const navigate = useNavigate();
//   const fileInputRef = useRef(null);

//   useEffect(() => {
//     const user = JSON.parse(localStorage.getItem("user"));
//     if (!user || user.role !== "admin") {
//       setError("You must be logged in as an admin to access this page.");
//       setTimeout(() => navigate("/login"), 3000);
//       return;
//     }

//     const hasSeenTutorial = localStorage.getItem("hasSeenScannerTutorial");
//     if (hasSeenTutorial) {
//       setShowTutorial(false);
//     }

//     scannerRef.current = new Html5Qrcode("qr-reader", {
//       formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
//     });

//     Html5Qrcode.getCameras()
//       .then((devs) => {
//         if (devs && devs.length > 0) {
//           setDevices(devs);
//           setCameraId(devs[0].id);
//         } else {
//           setError("No cameras detected. Please upload a QR code image.");
//         }
//       })
//       .catch((err) => {
//         setError("Failed to access cameras: " + err.message);
//       });

//     return () => {
//       stopScanner();
//     };
//   }, [navigate]);

//   const startScanner = async () => {
//     if (!scannerRef.current || !cameraId) {
//       setError(
//         "No camera selected. Please select a camera or upload a QR code image."
//       );
//       return;
//     }

//     try {
//       setError("");
//       setSuccess("");
//       setScanResult(null);
//       setIsScanning(true);

//       const config = { fps: 10, qrbox: { width: 250, height: 250 } };

//       await scannerRef.current.start(
//         cameraId,
//         config,
//         async (decodedText) => {
//           if (lastScanned === decodedText) return;

//           setLastScanned(decodedText);
//           setTimeout(() => setLastScanned(null), 5000);

//           await handleScanSuccess(decodedText);
//         },
//         (err) => {
//           if (err.name === "NotAllowedError" || err.name === "NotFoundError") {
//             setError(
//               "Camera access denied or unavailable. Please allow camera access or select another camera."
//             );
//             stopScanner();
//           }
//         }
//       );
//     } catch (err) {
//       setError("Failed to start scanner: " + err.message);
//       setIsScanning(false);
//     }
//   };

//   const stopScanner = async () => {
//     if (scannerRef.current && scannerRef.current.getState() === 2) {
//       try {
//         await scannerRef.current.stop();
//         scannerRef.current.clear();
//         setIsScanning(false);
//       } catch (err) {
//         console.error("Failed to stop scanner:", err);
//         setError("Failed to stop scanner: " + err.message);
//       }
//     }
//   };

//   const handleScanSuccess = async (qrString) => {
//     setLoading(true);
//     try {
//       await stopScanner();
//       setError("");
//       setSuccess("");
//       setScanResult(null);
//       setEntryExitMessage("");

//       const user = JSON.parse(localStorage.getItem("user"));
//       const response = await scanQr(qrString, user.accessToken);
//       console.log("ScannerPage - Scan Response:", response);
//       setScanResult(response);

//       let message = "";
//       let entryExitMessage = "";
//       if (response.entryTime) {
//         message = `Entry granted for ${response.user.name} at ${new Date(
//           response.entryTime
//         ).toLocaleString()}`;
//         entryExitMessage = `Entering at ${new Date(
//           response.entryTime
//         ).toLocaleTimeString()}`;
//         setSuccess(message);
//         setEntryExitMessage(entryExitMessage);
//         speak("Entry granted");
//       } else if (response.exitTime) {
//         message = `Exit logged for ${response.user.name} at ${new Date(
//           response.exitTime
//         ).toLocaleString()}`;
//         entryExitMessage = `Exiting at ${new Date(
//           response.exitTime
//         ).toLocaleTimeString()}`;
//         setSuccess(message);
//         setEntryExitMessage(entryExitMessage);
//         speak("Exit logged");
//       }

//       const scanResultData = {
//         success: true,
//         message,
//         entryExitMessage,
//         user: response.user,
//         entryTime: response.entryTime,
//         exitTime: response.exitTime,
//       };

//       console.log(
//         "ScannerPage - Saving scanResult to localStorage:",
//         scanResultData
//       );
//       localStorage.setItem("scanResult", JSON.stringify(scanResultData));

//       console.log("ScannerPage - Navigating with state:", {
//         activeTab: "home",
//         scanResult: scanResultData,
//       });

//       navigate("/", {
//         state: {
//           activeTab: "home",
//           scanResult: scanResultData,
//         },
//       });
//     } catch (err) {
//       setError(err.message || "Invalid or expired QR code");
//       speak("Scan Failed");
//       setSuccess("");
//       setEntryExitMessage("");
//       setTimeout(() => {
//         setError("");
//         setIsScanning(false);
//       }, 3000);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const speak = (text) => {
//     if ("speechSynthesis" in window) {
//       const utterance = new SpeechSynthesisUtterance(text);
//       window.speechSynthesis.speak(utterance);
//     }
//   };

//   const handleImageUpload = async (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     setImageFile(file);
//     setError("");
//     setSuccess("");
//     setScanResult(null);
//     setLoading(true);

//     try {
//       const result = await scannerRef.current.scanFile(file, true);
//       await handleScanSuccess(result);
//     } catch (err) {
//       setError("Failed to scan QR code from image: " + err.message);
//       setTimeout(() => {
//         setError("");
//         setImageFile(null);
//         if (fileInputRef.current) fileInputRef.current.value = null;
//       }, 3000);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDragOver = (e) => {
//     e.preventDefault();
//   };

//   const handleDrop = async (e) => {
//     e.preventDefault();
//     const file = e.dataTransfer.files[0];
//     if (!file) return;

//     setImageFile(file);
//     setError("");
//     setSuccess("");
//     setScanResult(null);
//     setLoading(true);

//     try {
//       const result = await scannerRef.current.scanFile(file, true);
//       await handleScanSuccess(result);
//     } catch (err) {
//       setError("Failed to scan QR code from image: " + err.message);
//       setTimeout(() => {
//         setError("");
//         setImageFile(null);
//         if (fileInputRef.current) fileInputRef.current.value = null;
//       }, 3000);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleScanAgain = () => {
//     setError("");
//     setSuccess("");
//     setScanResult(null);
//     setImageFile(null);
//     if (fileInputRef.current) fileInputRef.current.value = null;
//   };

//   const closeTutorial = () => {
//     setShowTutorial(false);
//     localStorage.setItem("hasSeenScannerTutorial", "true");
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 py-12 px-4 sm:px-6 lg:px-8">
//       <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-lg relative">
//         {showTutorial && (
//           <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-2xl">
//             <div className="bg-white p-6 rounded-lg max-w-sm">
//               <h3 className="text-xl font-bold text-gray-800 mb-4">
//                 How to Use the QR Scanner
//               </h3>
//               <ol className="list-decimal list-inside space-y-2 text-gray-600">
//                 <li>
//                   Select a camera if multiple are available, then click "Start
//                   Camera Scan".
//                 </li>
//                 <li>Point the selected camera at the QR code to scan.</li>
//                 <li>
//                   Alternatively, upload a QR code image if the camera isn't
//                   working.
//                 </li>
//                 <li>Click "Stop Scanning" to pause the camera.</li>
//               </ol>
//               <button
//                 onClick={closeTutorial}
//                 className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-200"
//               >
//                 Got It!
//               </button>
//             </div>
//           </div>
//         )}
//         <h2 className="text-center text-4xl font-extrabold text-gray-800">
//           Scan QR Code
//         </h2>
//         <p className="mt-2 text-center text-lg text-gray-500">
//           Use your selected camera to scan the visitor's QR code, or upload an
//           image.
//         </p>
//         {error && (
//           <p className="text-rose-500 text-center bg-rose-50 py-2 rounded-lg">
//             Scan Failed: {error}
//           </p>
//         )}
//         {success && (
//           <>
//             <p className="text-emerald-600 text-center bg-emerald-50 py-2 rounded-lg">
//               Scan Successful: {success}
//             </p>
//             {entryExitMessage && (
//               <p className="text-indigo-700 text-center mt-2 font-semibold">
//                 {entryExitMessage}
//               </p>
//             )}
//           </>
//         )}
//         <div className="w-full">
//           <div
//             id="qr-reader"
//             className={`w-full ${
//               isScanning ? "block" : "hidden"
//             } relative border-4 border-indigo-500 rounded-lg overflow-hidden ${
//               lastScanned ? "animate-pulse" : ""
//             }`}
//           >
//             {isScanning && (
//               <div className="absolute inset-0 bg-transparent">
//                 <div className="w-full h-1 bg-indigo-500 animate-scanLine"></div>
//               </div>
//             )}
//             {loading && (
//               <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50">
//                 <p className="text-gray-600">Scanning...</p>
//               </div>
//             )}
//           </div>
//           {isScanning ? (
//             <button
//               onClick={stopScanner}
//               className="mt-4 w-full bg-rose-600 text-white py-3 px-4 rounded-lg shadow-lg hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-300 transition duration-200 transform hover:scale-105"
//             >
//               Stop Scanning
//             </button>
//           ) : (
//             <div className="text-center space-y-4">
//               {scanResult ? (
//                 <>
//                   <p className="text-gray-600">
//                     <strong>Name:</strong> {scanResult.user.name}
//                   </p>
//                   <p className="text-gray-600">
//                     <strong>Email:</strong> {scanResult.user.email}
//                   </p>
//                   {scanResult.entryTime ? (
//                     <p className="text-gray-600">
//                       <strong>Entry Time:</strong>{" "}
//                       {new Date(scanResult.entryTime).toLocaleString()}
//                     </p>
//                   ) : (
//                     <p className="text-gray-600">
//                       <strong>Exit Time:</strong>{" "}
//                       {new Date(scanResult.exitTime).toLocaleString()}
//                     </p>
//                   )}
//                 </>
//               ) : (
//                 <>
//                   {devices.length > 1 && (
//                     <div className="mb-4">
//                       <label className="block text-sm font-medium text-gray-700">
//                         Select Camera
//                       </label>
//                       <select
//                         value={cameraId}
//                         onChange={(e) => setCameraId(e.target.value)}
//                         className="border p-2 rounded"
//                       >
//                         {devices.map((device) => (
//                           <option key={device.id} value={device.id}>
//                             {device.label || device.id}
//                           </option>
//                         ))}
//                       </select>
//                     </div>
//                   )}
//                   <button
//                     onClick={startScanner}
//                     className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-200 transform hover:scale-105"
//                   >
//                     Start Camera Scan
//                   </button>
//                   <div className="mt-4">
//                     <label
//                       htmlFor="image-upload"
//                       className="block text-sm font-medium text-gray-700 mb-2"
//                     >
//                       Or Upload QR Code Image
//                     </label>
//                     <div
//                       className="border-2 border-dashed border-indigo-500 rounded-lg p-4 text-center hover:border-indigo-700 transition duration-200"
//                       onDragOver={handleDragOver}
//                       onDrop={handleDrop}
//                     >
//                       <input
//                         id="image-upload"
//                         type="file"
//                         accept="image/*"
//                         ref={fileInputRef}
//                         onChange={handleImageUpload}
//                         className="hidden"
//                       />
//                       <label htmlFor="image-upload" className="cursor-pointer">
//                         <p className="text-indigo-600">
//                           Click to upload or drag and drop
//                         </p>
//                         <p className="text-sm text-gray-500">
//                           PNG, JPG, or GIF
//                         </p>
//                       </label>
//                     </div>
//                     {imageFile && (
//                       <p className="mt-2 text-sm text-gray-600">
//                         Uploaded: {imageFile.name}
//                       </p>
//                     )}
//                   </div>
//                 </>
//               )}
//               {(scanResult || imageFile) && (
//                 <button
//                   onClick={handleScanAgain}
//                   className="mt-4 w-full bg-indigo-600 text-white py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-200 transform hover:scale-105"
//                 >
//                   Scan Again
//                 </button>
//               )}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ScannerPage;
 

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { scanQr } from "../utils/api";

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
  const scannerRef = useRef(null);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      setError("You must be logged in as an admin to access this page.");
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    const hasSeenTutorial = localStorage.getItem("hasSeenScannerTutorial");
    if (hasSeenTutorial) {
      setShowTutorial(false);
    }

    scannerRef.current = new Html5Qrcode("qr-reader", {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });

    Html5Qrcode.getCameras()
      .then((devs) => {
        if (devs && devs.length > 0) {
          setDevices(devs);
          setCameraId(devs[0].id);
        } else {
          setError("No cameras detected. Please upload a QR code image.");
        }
      })
      .catch((err) => {
        setError("Failed to access cameras: " + err.message);
      });

    return () => {
      stopScanner();
    };
  }, [navigate]);

  const startScanner = async () => {
    if (!scannerRef.current || !cameraId) {
      setError(
        "No camera selected. Please select a camera or upload a QR code image."
      );
      return;
    }

    try {
      setError("");
      setSuccess("");
      setScanResult(null);
      setIsScanning(true);

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      await scannerRef.current.start(
        cameraId,
        config,
        async (decodedText) => {
          if (lastScanned === decodedText) return;

          setLastScanned(decodedText);
          setTimeout(() => setLastScanned(null), 5000);

          await handleScanSuccess(decodedText);
        },
        (err) => {
          if (err.name === "NotAllowedError" || err.name === "NotFoundError") {
            setError(
              "Camera access denied or unavailable. Please allow camera access or select another camera."
            );
            stopScanner();
          }
        }
      );
    } catch (err) {
      setError("Failed to start scanner: " + err.message);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.getState() === 2) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        setIsScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner:", err);
        setError("Failed to stop scanner: " + err.message);
      }
    }
  };

  const handleScanSuccess = async (qrString) => {
    setLoading(true);
    try {
      await stopScanner();
      setError("");
      setSuccess("");
      setScanResult(null);
      setEntryExitMessage("");

      const user = JSON.parse(localStorage.getItem("user"));
      const response = await scanQr(qrString, user.accessToken);
      console.log("ScannerPage - Scan Response:", response);

      let message = "";
      let entryExitMessage = "";
      let scanResultData = null;

      if (response.entryTime) {
        message = `Entry granted for ${response.user.name} at ${new Date(
          response.entryTime
        ).toLocaleString()}`;
        entryExitMessage = `Entering at ${new Date(
          response.entryTime
        ).toLocaleTimeString()}`;
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
        message = `Exit logged for ${response.user.name} at ${new Date(
          response.exitTime
        ).toLocaleString()}`;
        entryExitMessage = `Exiting at ${new Date(
          response.exitTime
        ).toLocaleTimeString()}`;
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
        throw new Error("Invalid scan response: No entry or exit time provided");
      }

      console.log(
        "ScannerPage - Saving scanResult to localStorage:",
        scanResultData
      );
      localStorage.setItem("scanResult", JSON.stringify(scanResultData));

      console.log("ScannerPage - Navigating to Home with state:", {
        activeTab: "home",
        scanResult: scanResultData,
      });

      navigate("/", {
        state: {
          activeTab: "home",
          scanResult: scanResultData,
        },
      });
    } catch (err) {
      const errorMessage = err.message || "Invalid or expired QR code";
      console.error("ScannerPage - Scan Error:", err);
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

      console.log(
        "ScannerPage - Saving error scanResult to localStorage:",
        scanResultData
      );
      localStorage.setItem("scanResult", JSON.stringify(scanResultData));

      console.log("ScannerPage - Navigating to Home with error state:", {
        activeTab: "home",
        scanResult: scanResultData,
      });

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
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    setError("");
    setSuccess("");
    setScanResult(null);
    setLoading(true);

    try {
      const result = await scannerRef.current.scanFile(file, true);
      await handleScanSuccess(result);
    } catch (err) {
      const errorMessage = "Failed to scan QR code from image: " + err.message;
      console.error("ScannerPage - Image Scan Error:", err);
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

      console.log(
        "ScannerPage - Saving error scanResult to localStorage:",
        scanResultData
      );
      localStorage.setItem("scanResult", JSON.stringify(scanResultData));

      console.log("ScannerPage - Navigating to Home with error state:", {
        activeTab: "home",
        scanResult: scanResultData,
      });

      navigate("/", {
        state: {
          activeTab: "home",
          scanResult: scanResultData,
        },
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    setImageFile(file);
    setError("");
    setSuccess("");
    setScanResult(null);
    setLoading(true);

    try {
      const result = await scannerRef.current.scanFile(file, true);
      await handleScanSuccess(result);
    } catch (err) {
      const errorMessage = "Failed to scan QR code from image: " + err.message;
      console.error("ScannerPage - Image Scan Error:", err);
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

      console.log(
        "ScannerPage - Saving error scanResult to localStorage:",
        scanResultData
      );
      localStorage.setItem("scanResult", JSON.stringify(scanResultData));

      console.log("ScannerPage - Navigating to Home with error state:", {
        activeTab: "home",
        scanResult: scanResultData,
      });

      navigate("/", {
        state: {
          activeTab: "home",
          scanResult: scanResultData,
        },
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleScanAgain = () => {
    setError("");
    setSuccess("");
    setScanResult(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem("hasSeenScannerTutorial", "true");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-lg relative">
        {showTutorial && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-2xl">
            <div className="bg-white p-6 rounded-lg max-w-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                How to Use the QR Scanner
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>
                  Select a camera if multiple are available, then click "Start
                  Camera Scan".
                </li>
                <li>Point the selected camera at the QR code to scan.</li>
                <li>
                  Alternatively, upload a QR code image if the camera isn't
                  working.
                </li>
                <li>Click "Stop Scanning" to pause the camera.</li>
              </ol>
              <button
                onClick={closeTutorial}
                className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-200"
              >
                Got It!
              </button>
            </div>
          </div>
        )}
        <h2 className="text-center text-4xl font-extrabold text-gray-800">
          Scan QR Code
        </h2>
        <p className="mt-2 text-center text-lg text-gray-500">
          Use your selected camera to scan the visitor's QR code, or upload an
          image.
        </p>
        {error && (
          <p className="text-rose-500 text-center bg-rose-50 py-2 rounded-lg">
            Scan Failed: {error}
          </p>
        )}
        {success && (
          <>
            <p className="text-emerald-600 text-center bg-emerald-50 py-2 rounded-lg">
              Scan Successful: {success}
            </p>
            {entryExitMessage && (
              <p className="text-indigo-700 text-center mt-2 font-semibold">
                {entryExitMessage}
              </p>
            )}
          </>
        )}
        <div className="w-full">
          <div
            id="qr-reader"
            className={`w-full ${
              isScanning ? "block" : "hidden"
            } relative border-4 border-indigo-500 rounded-lg overflow-hidden ${
              lastScanned ? "animate-pulse" : ""
            }`}
          >
            {isScanning && (
              <div className="absolute inset-0 bg-transparent">
                <div className="w-full h-1 bg-indigo-500 animate-scanLine"></div>
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50">
                <p className="text-gray-600">Scanning...</p>
              </div>
            )}
          </div>
          {isScanning ? (
            <button
              onClick={stopScanner}
              className="mt-4 w-full bg-rose-600 text-white py-3 px-4 rounded-lg shadow-lg hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-300 transition duration-200 transform hover:scale-105"
            >
              Stop Scanning
            </button>
          ) : (
            <div className="text-center space-y-4">
              {scanResult ? (
                <>
                  <p className="text-gray-600">
                    <strong>Name:</strong> {scanResult.user.name}
                  </p>
                  <p className="text-gray-600">
                    <strong>Email:</strong> {scanResult.user.email}
                  </p>
                  {scanResult.entryTime ? (
                    <p className="text-gray-600">
                      <strong>Entry Time:</strong>{" "}
                      {new Date(scanResult.entryTime).toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-gray-600">
                      <strong>Exit Time:</strong>{" "}
                      {new Date(scanResult.exitTime).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {devices.length > 1 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Select Camera
                      </label>
                      <select
                        value={cameraId}
                        onChange={(e) => setCameraId(e.target.value)}
                        className="border p-2 rounded"
                      >
                        {devices.map((device) => (
                          <option key={device.id} value={device.id}>
                            {device.label || device.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    onClick={startScanner}
                    className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-200 transform hover:scale-105"
                  >
                    Start Camera Scan
                  </button>
                  <div className="mt-4">
                    <label
                      htmlFor="image-upload"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Or Upload QR Code Image
                    </label>
                    <div
                      className="border-2 border-dashed border-indigo-500 rounded-lg p-4 text-center hover:border-indigo-700 transition duration-200"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <label htmlFor="image-upload" className="cursor-pointer">
                        <p className="text-indigo-600">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-sm text-gray-500">
                          PNG, JPG, or GIF
                        </p>
                      </label>
                    </div>
                    {imageFile && (
                      <p className="mt-2 text-sm text-gray-600">
                        Uploaded: {imageFile.name}
                      </p>
                    )}
                  </div>
                </>
              )}
              {(scanResult || imageFile) && (
                <button
                  onClick={handleScanAgain}
                  className="mt-4 w-full bg-indigo-600 text-white py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-200 transform hover:scale-105"
                >
                  Scan Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScannerPage;