import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const LocalDashboard = () => {
  const { systemId } = useParams();
  const [data, setData] = useState([]);
  const [averageRAM, setAverageRAM] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5000/api/local/${systemId}`
        );
        setData(response.data.processData);
        setAverageRAM(response.data.averageRAM || 0);
        setAlerts(response.data.alerts);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [systemId]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    // In a real app, you'd clear authentication tokens here
  };

  // Mock data for pie chart
  const memoryDistribution = [
    { name: "Used RAM", value: averageRAM, color: "#ff6b6b" },
    { name: "Free RAM", value: 8192 - averageRAM, color: "#4ecdc4" },
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
                <i className="fas fa-desktop me-2"></i>
                Local System Dashboard
              </h2>
              <p className="text-muted mb-0">
                <i className="fas fa-server me-1"></i>
                System ID: {systemId}
              </p>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary">
                <i className="fas fa-download me-1"></i>Export Data
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
              <i className="fas fa-exclamation-triangle me-2"></i>Memory Alerts
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
                  <i className="fas fa-memory"></i>
                </div>
                <h5 className="card-title">Average RAM Usage</h5>
                <p className="card-text display-6 text-success">
                  {averageRAM.toFixed(2)} MB
                </p>
                <small className="text-muted">of 8GB total</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <div className="display-4 text-info mb-2">
                  <i className="fas fa-server"></i>
                </div>
                <h5 className="card-title">System Status</h5>
                <p className="card-text">
                  <span className="badge bg-success fs-6">
                    Monitoring Active
                  </span>
                </p>
                <small className="text-muted">eBPF tracking enabled</small>
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
                  <i className="fas fa-chart-pie"></i>
                </div>
                <h5 className="card-title">Memory Distribution</h5>
                <div
                  style={{ width: "100px", height: "100px", margin: "0 auto" }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={memoryDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                      >
                        {memoryDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <small className="text-muted">Used vs Free</small>
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
                  <i className="fas fa-chart-line me-2"></i>eBPF Memory Tracking
                  - Per-Program Usage Over Time
                </h5>
                <small className="text-muted">
                  Real-time memory allocation monitoring
                </small>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis
                      label={{
                        value: "Memory (KB)",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="allocKB"
                      stroke="#8884d8"
                      strokeWidth={3}
                      name="Allocated KB"
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="freeKB"
                      stroke="#82ca9d"
                      strokeWidth={3}
                      name="Free KB"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocalDashboard;
