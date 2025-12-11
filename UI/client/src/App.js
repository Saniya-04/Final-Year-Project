// Import React library - required for building React components
import React from "react";

// Import routing components from react-router-dom library
// BrowserRouter: Wraps the app to enable client-side routing
// Routes: Container that matches URL paths to components
// Route: Defines individual route mappings (path → component)
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Import custom components for different pages
import Login from "./components/Login";
import LocalDashboard from "./components/LocalDashboard";
import AdminDashboard from "./components/AdminDashboard";

// Import Bootstrap CSS framework for styling
import "bootstrap/dist/css/bootstrap.min.css";

// Main App component - entry point for the entire application
function App() {
  return (
    // Router: Enables routing functionality for the entire app
    <Router>
      <div className="App">
        {/* Routes: Container that manages which component to display based on URL */}
        <Routes>
          {/* Route 1: "/" path displays Login component (home page) */}
          <Route path="/" element={<Login />} />

          {/* Route 2: "/local/:systemId" displays LocalDashboard
              :systemId is a dynamic parameter (e.g., /local/123 where 123 is the systemId)
              The component can access this parameter to load specific system data */}
          <Route path="/local/:systemId" element={<LocalDashboard />} />

          {/* Route 3: "/admin" path displays AdminDashboard */}
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

// Export the App component so it can be used in other files (like index.js)
export default App;
