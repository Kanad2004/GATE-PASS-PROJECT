import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Home from "./pages/Home";
import EmailVerificationPage from "./pages/EmailVerificationPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RequestsPage from "./pages/RequestsPage.jsx";
import ScannerPage from "./pages/ScannerPage";

function AppRoutes() {
  const location = useLocation();
  return (
    <Routes location={location}>
      <Route path="/" element={<Home key={location.key} />} />
      <Route path="/verify-email" element={<EmailVerificationPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/requests" element={<RequestsPage />} />
      <Route path="/scan" element={<ScannerPage />} />
      <Route path="/daily-entry" element={<Home key={location.key} />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
