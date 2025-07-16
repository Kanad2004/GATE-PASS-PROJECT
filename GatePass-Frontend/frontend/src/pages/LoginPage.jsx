import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin } from "../utils/api";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/20/solid";

const LoginPage = () => {
  const [credentials, setCredentials] = useState({
    name: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!credentials.name) newErrors.name = "Username is required";
    if (!credentials.password) newErrors.password = "Password is required";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const response = await loginAdmin({
        name: credentials.name,
        password: credentials.password,
      });
      localStorage.setItem(
        "user",
        JSON.stringify({
          name: response.admin.name,
          role: "admin",
          accessToken: response.accessToken,
        })
      );
      navigate("/");
    } catch (error) {
      setErrors({ auth: error.message || "Invalid admin credentials" });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 px-4 py-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl border-2 border-gradient-to-r from-indigo-500 to-emerald-500 shadow-lg">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-gray-800">
            Admin Sign In
          </h2>
          <p className="mt-2 text-lg text-gray-500">Access admin dashboard</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {errors.auth && (
            <div
              className="bg-rose-50 border border-rose-400 text-rose-700 px-4 py-3 rounded-lg animate-shake"
              role="alert"
            >
              <span className="block sm:inline">{errors.auth}</span>
            </div>
          )}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Admin Username
            </label>
            <div className="relative">
              <input
                id="name"
                name="name"
                type="text"
                value={credentials.name}
                onChange={(e) =>
                  setCredentials({ ...credentials, name: e.target.value })
                }
                onKeyDown={handleKeyDown}
                className={`mt-2 block w-full px-4 py-3 border ${
                  errors.name ? "border-rose-500" : "border-gray-200"
                } rounded-lg shadow-sm focus:outline-none focus:border-indigo-500 transition duration-200 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-indigo-500 after:transition-all after:duration-300 focus:after:w-full`}
                placeholder="Enter admin username"
              />
              {errors.name && (
                <p className="mt-2 text-sm text-rose-600">{errors.name}</p>
              )}
            </div>
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
                onKeyDown={handleKeyDown}
                className={`mt-2 block w-full px-4 py-3 border ${
                  errors.password ? "border-rose-500" : "border-gray-200"
                } rounded-lg shadow-sm focus:outline-none focus:border-indigo-500 transition duration-200 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-indigo-500 after:transition-all after:duration-300 focus:after:w-full`}
                placeholder="Enter admin password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-5 text-gray-500 hover:text-indigo-600 transition duration-200"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
              {errors.password && (
                <p className="mt-2 text-sm text-rose-600">{errors.password}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <a
              href="#"
              className="text-sm text-indigo-600 hover:underline hover:text-indigo-500 transition duration-200"
            >
              Forgot Password?
            </a>
          </div>
          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-200 transform hover:scale-105"
            >
              Sign in as Admin
            </button>
          </div>
          <div className="mt-2 text-center">
            <p className="text-sm text-gray-500">
              Regular users don't need to sign in.{" "}
              <a
                href="/"
                className="text-indigo-600 hover:underline hover:text-indigo-500 transition duration-200"
              >
                Register here
              </a>{" "}
              for a visit.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
