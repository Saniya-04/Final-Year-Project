import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db();
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
  }
}

connectDB();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Access token required" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// Role-based middleware
const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};

// Login endpoint
app.post("/api/login", (req, res) => {
  const { username, password, role } = req.body;

  // Simple authentication (in production, use proper user management)
  if (username === "admin" && password === "admin" && role === "admin") {
    const token = jwt.sign({ username, role: "admin" }, process.env.JWT_SECRET);
    return res.json({ token, role: "admin" });
  } else if (username === "local" && password === "local" && role === "local") {
    const token = jwt.sign({ username, role: "local" }, process.env.JWT_SECRET);
    return res.json({ token, role: "local" });
  }

  res.status(401).json({ error: "Invalid credentials" });
});

// Local User: Average RAM usage and per-program usage
app.get(
  "/api/local/ram",
  authenticateToken,
  requireRole("local"),
  async (req, res) => {
    try {
      const collection = db.collection("processed_data");

      // Get data for current system (assuming system_id is available)
      const systemId = req.user.systemId || "local-system";

      const data = await collection
        .find({ system_id: systemId })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      if (data.length === 0) {
        return res.json({ average: 0, processes: [], chartData: [] });
      }

      // Calculate average RAM usage
      const totalRam = data.reduce((sum, item) => sum + item.total_ram_mb, 0);
      const average = totalRam / data.length;

      // Get per-program usage (latest data)
      const latestData = data[0];
      const processes = latestData.processes || [];

      // Prepare chart data (RAM usage over time)
      const chartData = data.map((item) => ({
        timestamp: item.timestamp,
        ram: item.total_ram_mb,
      }));

      res.json({ average, processes, chartData });
    } catch (error) {
      console.error("Error fetching local RAM data:", error);
      res.status(500).json({ error: "Failed to fetch RAM data" });
    }
  }
);

// Admin User: Average usage across all systems and per-system comparison
app.get(
  "/api/admin/systems",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const collection = db.collection("processed_data");

      // Get all systems data
      const data = await collection.find({}).sort({ timestamp: -1 }).toArray();

      if (data.length === 0) {
        return res.json({ systemsAverage: 0, systemComparison: [] });
      }

      // Group by system
      const systemData = {};
      data.forEach((item) => {
        const systemId = item.system_id;
        if (!systemData[systemId]) {
          systemData[systemId] = [];
        }
        systemData[systemId].push(item);
      });

      // Calculate average for each system
      const systemComparison = Object.keys(systemData).map((systemId) => {
        const systemItems = systemData[systemId];
        const totalRam = systemItems.reduce(
          (sum, item) => sum + item.total_ram_mb,
          0
        );
        const average = totalRam / systemItems.length;

        return {
          systemId,
          average: Math.round(average),
          dataPoints: systemItems.length,
        };
      });

      // Overall systems average
      const totalAllSystems = systemComparison.reduce(
        (sum, sys) => sum + sys.average,
        0
      );
      const systemsAverage = totalAllSystems / systemComparison.length;

      res.json({
        systemsAverage: Math.round(systemsAverage),
        systemComparison,
      });
    } catch (error) {
      console.error("Error fetching admin systems data:", error);
      res.status(500).json({ error: "Failed to fetch systems data" });
    }
  }
);

// Alerts endpoint (memory leaks and abnormal patterns)
app.get("/api/alerts", authenticateToken, async (req, res) => {
  try {
    const collection = db.collection("processed_data");
    const alerts = [];

    // Get recent data based on user role
    let query = {};
    if (req.user.role === "local") {
      query.system_id = req.user.systemId || "local-system";
    }

    const data = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    if (data.length < 10) {
      return res.json({ alerts: [] });
    }

    // Detect memory leaks (increasing trend over time)
    const recentData = data.slice(0, 10);
    const ramValues = recentData.map((item) => item.total_ram_mb);
    const increasing = ramValues.every(
      (val, i) => i === 0 || val >= ramValues[i - 1] * 0.95
    );

    if (increasing && ramValues[0] > ramValues[ramValues.length - 1] * 1.2) {
      alerts.push({
        type: "warning",
        message:
          "Potential memory leak detected - RAM usage is consistently increasing",
        timestamp: new Date().toISOString(),
      });
    }

    // Detect abnormal spikes
    const average =
      ramValues.reduce((sum, val) => sum + val, 0) / ramValues.length;
    const stdDev = Math.sqrt(
      ramValues.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) /
        ramValues.length
    );

    if (ramValues[0] > average + 2 * stdDev) {
      alerts.push({
        type: "error",
        message: "Abnormal RAM usage spike detected",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ alerts });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Backend running at http://localhost:${PORT}`)
);
