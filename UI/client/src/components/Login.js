import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [role, setRole] = useState("");
  const [systemId, setSystemId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simple authentication simulation
    if (username && password) {
      if (role === "local") {
        navigate(`/local/${systemId}`);
      } else if (role === "admin") {
        navigate("/admin");
      }
    } else {
      alert("Please enter username and password");
    }
  };

  return (
    <>
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
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card shadow-lg">
              <div className="card-header text-center bg-gradient-primary text-white">
                <h3>
                  <i className="fas fa-sign-in-alt me-2"></i>Secure Login
                </h3>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleSubmit}>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label htmlFor="username" className="form-label">
                          <i className="fas fa-user me-2"></i>Username
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter username"
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label htmlFor="password" className="form-label">
                          <i className="fas fa-lock me-2"></i>Password
                        </label>
                        <input
                          type="password"
                          className="form-control"
                          id="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter password"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="role" className="form-label">
                      <i className="fas fa-user-tag me-2"></i>Access Level
                    </label>
                    <select
                      className="form-select"
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                    >
                      <option value="">Select access level...</option>
                      <option value="local">
                        <i className="fas fa-desktop me-2"></i>Local User -
                        Monitor Your System
                      </option>
                      <option value="admin">
                        <i className="fas fa-crown me-2"></i>Administrator -
                        Monitor All Systems
                      </option>
                    </select>
                  </div>
                  {role === "local" && (
                    <div className="mb-3">
                      <label htmlFor="systemId" className="form-label">
                        <i className="fas fa-server me-2"></i>System ID
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="systemId"
                        value={systemId}
                        onChange={(e) => setSystemId(e.target.value)}
                        placeholder="Enter your system identifier"
                        required
                      />
                    </div>
                  )}
                  <div className="d-grid">
                    <button type="submit" className="btn btn-primary btn-lg">
                      <i className="fas fa-sign-in-alt me-2"></i>Login to
                      Dashboard
                    </button>
                  </div>
                </form>
              </div>
              <div className="card-footer text-center">
                <small className="text-muted">
                  <i className="fas fa-shield-alt me-1"></i>
                  Secure eBPF-based memory monitoring system
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
