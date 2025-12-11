import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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

import { collection, doc, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Compute avg ratio
const computeAverageRatio = (snapshots) => {
  if (!snapshots.length) return 0;
  const total = snapshots.reduce((sum, s) => sum + (s.ratio || 0), 0);
  return total / snapshots.length;
};

// Alerts for admin based on Ratio
const generateAdminAlerts = (snapshots) => {
  const alerts = [];
  const critical = snapshots.filter((s) => s.ratio >= 300).length;
  const warning = snapshots.filter((s) => s.ratio >= 150 && s.ratio < 300).length;

  if (critical > 0)
    alerts.push(`Critical: ${critical} system(s) show extreme memory pressure!`);

  if (warning > 0)
    alerts.push(`Warning: ${warning} system(s) show rising memory pressure.`);

  if (alerts.length === 0)
    alerts.push("All systems are operating normally.");

  return alerts;
};

const AdminDashboard = () => {
  const [systemIds, setSystemIds] = useState([]);
  const [systemSnapshots, setSystemSnapshots] = useState({});
  const [systemHistories, setSystemHistories] = useState({});
  const [averageRatio, setAverageRatio] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // Discover system IDs
  useEffect(() => {
    const systemsRef = collection(db, "systems");

    const unsubscribe = onSnapshot(systemsRef, (snapshot) => {
      const ids = snapshot.docs.map((doc) => doc.id);
      setSystemIds(ids);
      console.log("Detected system IDs:", ids);
    });

    return () => unsubscribe();
  }, []);

  // Attach listeners for each system
  useEffect(() => {
    if (!systemIds.length) {
      setSystemSnapshots({});
      setSystemHistories({});
      setAverageRatio(0);
      setAlerts([]);
      return;
    }

    const unsubscribes = [];

    systemIds.forEach((systemId) => {
      // Latest snapshot
      const snapRef = doc(db, "systems", systemId, "latest", "snapshot");

      const unsubSnap = onSnapshot(snapRef, (docSnap) => {
        if (!docSnap.exists()) {
          console.log(`No snapshot found for ${systemId}`);
          return;
        }

        const r = docSnap.data();

        const allocMB = r.AllocKB / 1024;
        const freeMB = r.FreeKB / 1024;
        const ratio = r.Ratio; // use Ratio directly

        setSystemSnapshots((prev) => {
          const updated = {
            ...prev,
            [systemId]: {
              systemId,
              allocMB,
              freeMB,
              ratio,
              time: new Date(r.TimeStamp * 1000).toLocaleTimeString(),
            },
          };

          const array = Object.values(updated);
          setAverageRatio(computeAverageRatio(array));
          setAlerts(generateAdminAlerts(array));

          return updated;
        });
      });

      unsubscribes.push(unsubSnap);

      // Historical reports
      const reportsRef = collection(db, "systems", systemId, "reports");
      const qReports = query(reportsRef, orderBy("TimeStamp", "asc"));

      const unsubHistory = onSnapshot(qReports, (snapshot) => {
        const history = snapshot.docs.map((d) => {
          const r = d.data();
          return {
            time: new Date(r.TimeStamp * 1000).toLocaleTimeString(),
            allocMB: r.AllocKB / 1024,
            freeMB: r.FreeKB / 1024,
            ratio: r.Ratio,
          };
        });

        setSystemHistories((prev) => ({
          ...prev,
          [systemId]: history,
        }));
      });

      unsubscribes.push(unsubHistory);
    });

    return () => unsubscribes.forEach((u) => u());
  }, [systemIds]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("auth");
  };

  const snapshotsArray = Object.values(systemSnapshots);

  const systemHealth = [
    {
      name: "Healthy",
      value: snapshotsArray.filter((s) => s.ratio < 150).length,
      color: "#4ecdc4",
    },
    {
      name: "Warning",
      value: snapshotsArray.filter((s) => s.ratio >= 150 && s.ratio < 300).length,
      color: "#ffe66d",
    },
    {
      name: "Critical",
      value: snapshotsArray.filter((s) => s.ratio >= 300).length,
      color: "#ff6b6b",
    },
  ];

  if (!isLoggedIn) {
    return (
      <div className="container text-center mt-5">
        <h4>You have been logged out</h4>
        <Link to="/" className="btn btn-primary mt-3">Login Again</Link>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">

      {/* Header */}
      <div className="dashboard-header mb-4">
        <div className="container d-flex justify-content-between align-items-center">
          <div>
            <h2><i className="fas fa-crown me-2"></i>Administrator Dashboard</h2>
            <p className="text-muted"><i className="fas fa-network-wired me-1"></i>Live Firestore Monitoring</p>
          </div>
          <button className="btn btn-outline-danger" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="container mb-4">
          <div className="alert alert-danger">
            <h5>System Alerts</h5>
            <ul>{alerts.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        </div>
      )}

      {/* Stats section */}
      <div className="container mb-4">
        <div className="row">

          <div className="col-md-3">
            <div className="card text-center">
              <h5>Average Memory Pressure</h5>
              <p className="display-6 text-success">{averageRatio.toFixed(2)}%</p>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card text-center">
              <h5>Systems Monitored</h5>
              <p className="display-6">{systemIds.length}</p>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card text-center">
              <h5>Last Updated</h5>
              <p>{new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card text-center p-2">
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={systemHealth} dataKey="value">
                    {systemHealth.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <small>System Health</small>
            </div>
          </div>

        </div>
      </div>

      {/* History charts */}
      <div className="container">
        <div className="row">
          {systemIds.map((id) => {
            const history = systemHistories[id] || [];

            return (
              <div className="col-md-6 mb-4" key={id}>
                <div className="card">
                  <div className="card-header">
                    <h5>System {id} — Memory History</h5>
                  </div>

                  <div className="card-body">
                    {history.length === 0 ? (
                      <p className="text-muted">No historical data.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={history}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis label={{ value: "MB", angle: -90 }} />
                          <Tooltip />
                          <Legend />
                          <Line dataKey="allocMB" stroke="#8884d8" strokeWidth={3} />
                          <Line dataKey="freeMB" stroke="#82ca9d" strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {systemIds.length === 0 && (
            <div className="alert alert-info text-center mt-4">
              No systems found in Firestore.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
