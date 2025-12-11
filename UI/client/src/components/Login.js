import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const VALID_CREDENTIALS = {
  admin: { username: "admin", password: "admin123" },
  local: { username: "local", password: "local123" },
};

const Login = () => {
  const [role, setRole] = useState(""); // local / admin
  const [systemId, setSystemId] = useState(""); // only for local users
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!role) {
      alert("Please select access level");
      return;
    }

    const creds = VALID_CREDENTIALS[role];
    if (!creds) {
      alert("Invalid role");
      return;
    }

    if (username !== creds.username || password !== creds.password) {
      alert("Invalid username or password");
      return;
    }

    if (role === "local" && !systemId) {
      alert("Please enter your system ID");
      return;
    }

    // Store simple auth info locally
    localStorage.setItem(
      "auth",
      JSON.stringify({
        role,
        username,
        systemId: role === "local" ? systemId : null,
      })
    );

    if (role === "local") {
      navigate(`/local/${systemId}`);
    } else if (role === "admin") {
      navigate("/admin");
    }
  };

  return (
    <>
      {/* Header section */}
      <div className="dashboard-header">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-md-10">
              <div className="text-center">
                <h1 className="display-4">
                  <i className="fas fa-microchip me-3"></i>
                  eBPF Memory Management Dashboard
                </h1>
                <p className="lead">
                  Advanced memory monitoring and leak detection using eBPF
                  technology
                </p>

                <div className="mt-3">
                  <span className="badge bg-primary me-2">
                    Real-time Monitoring
                  </span>
                  <span className="badge bg-success me-2">Leak Detection</span>
                  <span className="badge bg-info me-2">
                    Performance Analytics
                  </span>
                  <span className="badge bg-warning">eBPF Powered</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Login form section */}
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card shadow-lg">
              {/* Card Header */}
              <div className="card-header text-center bg-gradient-primary text-white">
                <h3>
                  <i className="fas fa-sign-in-alt me-2"></i>
                  Secure Login
                </h3>
              </div>

              {/* Card Body (Form) */}
              <div className="card-body p-4">
                <form onSubmit={handleSubmit}>
                  <div className="row">
                    {/* Username */}
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label htmlFor="username" className="form-label">
                          <i className="fas fa-user me-2"></i>
                          Username
                        </label>
                        <input
                          type="text"
                          id="username"
                          className="form-control"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter username"
                          required
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label htmlFor="password" className="form-label">
                          <i className="fas fa-lock me-2"></i>
                          Password
                        </label>
                        <input
                          type="password"
                          id="password"
                          className="form-control"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter password"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div className="mb-3">
                    <label htmlFor="role" className="form-label">
                      <i className="fas fa-user-tag me-2"></i>
                      Access Level
                    </label>

                    <select
                      id="role"
                      className="form-select"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                    >
                      <option value="">Select access level...</option>
                      <option value="local">
                        Local User - Monitor Your System
                      </option>
                      <option value="admin">
                        Administrator - Monitor All Systems
                      </option>
                    </select>
                  </div>

                  {/* System ID (only visible for local users) */}
                  {role === "local" && (
                    <div className="mb-3">
                      <label htmlFor="systemId" className="form-label">
                        <i className="fas fa-server me-2"></i>
                        System ID
                      </label>
                      <input
                        type="text"
                        id="systemId"
                        className="form-control"
                        value={systemId}
                        onChange={(e) => setSystemId(e.target.value)}
                        placeholder="Enter your system identifier"
                        required
                      />
                    </div>
                  )}

                  {/* Login button */}
                  <div className="d-grid">
                    <button type="submit" className="btn btn-primary btn-lg">
                      <i className="fas fa-sign-in-alt me-2"></i>
                      Login to Dashboard
                    </button>
                  </div>
                </form>
              </div>

              {/* Card Footer */}
              <div className="card-footer text-center">
                <small className="text-muted">
                  <i className="fas fa-shield-alt me-1"></i>
                  Secure eBPF-based memory monitoring system
                </small>
                <br />
                <small className="text-muted">
                  <strong>Test creds:</strong> Admin → admin / admin123, Local →
                  local / local123
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
