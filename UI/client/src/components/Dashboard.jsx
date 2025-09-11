import { useState, useEffect } from "react";
import axios from "axios";
import LocalUserView from "./LocalUserView";
import AdminUserView from "./AdminUserView";
import Alerts from "./Alerts";

const Dashboard = ({ role, onLogout }) => {
  const [activeView, setActiveView] = useState("overview");
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("http://localhost:5000/api/alerts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAlerts(response.data.alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                RAM Dashboard
              </h1>
              <span className="ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                {role === "admin" ? "Admin User" : "Local User"}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveView("overview")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeView === "overview"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Overview
            </button>
            {role === "local" && (
              <button
                onClick={() => setActiveView("processes")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeView === "processes"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Process Details
              </button>
            )}
            {role === "admin" && (
              <button
                onClick={() => setActiveView("systems")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeView === "systems"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                System Comparison
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="mb-6">
              <Alerts alerts={alerts} onRefresh={fetchAlerts} />
            </div>
          )}

          {/* Content based on role and active view */}
          {role === "local" && <LocalUserView activeView={activeView} />}

          {role === "admin" && <AdminUserView activeView={activeView} />}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
