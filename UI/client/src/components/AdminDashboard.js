import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const AdminDashboard = () => {
  const [data, setData] = useState([]);
  const [averageUsage, setAverageUsage] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/admin");
        setData(response.data.systemData);
        setAverageUsage(response.data.averageUsage || 0);
        setAlerts(response.data.alerts);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    setIsLoggedIn(false);
    // In a real app, you'd clear authentication tokens here
  };

  // Mock data for system health pie chart
  const systemHealth = [
    {
      name: "Healthy",
      value: data.filter((s) => s.averageRAM < 4000).length,
      color: "#4ecdc4",
    },
    {
      name: "Warning",
      value: data.filter((s) => s.averageRAM >= 4000 && s.averageRAM < 6000)
        .length,
      color: "#ffe66d",
    },
    {
      name: "Critical",
      value: data.filter((s) => s.averageRAM >= 6000).length,
      color: "#ff6b6b",
    },
  ];

  if (!isLoggedIn) {
    return (
      <div className="container text-center mt-5">
        <div className="alert alert-info">
          <h4>You have been logged out</h4>
          <Link to="/" className="btn btn-primary mt-3">
            Login Again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      {/* Header */}
      <div className="dashboard-header mb-4">
        <div className="container">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1">
                <i className="fas fa-crown me-2"></i>
                Administrator Dashboard
              </h2>
              <p className="text-muted mb-0">
                <i className="fas fa-network-wired me-1"></i>
                Global system monitoring and analytics
              </p>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary">
                <i className="fas fa-download me-1"></i>Export Report
              </button>
              <button className="btn btn-outline-danger" onClick={handleLogout}>
                <i className="fas fa-sign-out-alt me-1"></i>Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="container mb-4">
          <div className="alert alert-danger alert-dismissible fade show">
            <h5>
              <i className="fas fa-exclamation-triangle me-2"></i>Critical
              System Alerts
            </h5>
            <ul className="mb-0">
              {alerts.map((alert, index) => (
                <li key={index}>
                  <i className="fas fa-warning me-1"></i>
                  {alert}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="alert"
            ></button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="container mb-4">
        <div className="row">
          <div className="col-md-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <div className="display-4 text-primary mb-2">
                  <i className="fas fa-chart-bar"></i>
                </div>
                <h5 className="card-title">Average Usage Across All Systems</h5>
                <p className="card-text display-6 text-success">
                  {averageUsage.toFixed(2)} MB
                </p>
                <small className="text-muted">Global average</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <div className="display-4 text-info mb-2">
                  <i className="fas fa-network-wired"></i>
                </div>
                <h5 className="card-title">Systems Monitored</h5>
                <p className="card-text display-6">{data.length}</p>
                <small className="text-muted">Active connections</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <div className="display-4 text-warning mb-2">
                  <i className="fas fa-clock"></i>
                </div>
                <h5 className="card-title">Last Updated</h5>
                <p className="card-text">{new Date().toLocaleTimeString()}</p>
                <small className="text-muted">Auto-refresh: 5s</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <div className="display-4 text-secondary mb-2">
                  <i className="fas fa-heartbeat"></i>
                </div>
                <h5 className="card-title">System Health</h5>
                <div
                  style={{ width: "100px", height: "100px", margin: "0 auto" }}
                >
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={systemHealth}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                      >
                        {systemHealth.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <small className="text-muted">Health status</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="container">
        <div className="row">
          <div className="col-md-12">
            <div className="card chart-container">
              <div className="card-header">
                <h5>
                  <i className="fas fa-chart-bar me-2"></i>eBPF Memory Analytics
                  - Per-System Usage Comparison
                </h5>
                <small className="text-muted">
                  Real-time memory usage across all monitored systems
                </small>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="systemId" />
                    <YAxis
                      label={{
                        value: "Memory Usage (MB)",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="averageRAM"
                      fill="#8884d8"
                      name="Average RAM (MB)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
