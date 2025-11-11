const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/ram_monitor",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const reportSchema = new mongoose.Schema({
  SystemId: String,
  Pid: Number,
  Process: String,
  AllocKB: Number,
  FreeKB: Number,
  Ratio: Number,
  LeakSuspect: Boolean,
  TimeStamp: Number,
});

const Report = mongoose.model("processed_data", reportSchema);

// API endpoints
app.get("/api/local/:systemId", async (req, res) => {
  try {
    const { systemId } = req.params;
    const reports = await Report.find({ SystemId: systemId })
      .sort({ TimeStamp: -1 })
      .limit(100);

    // Calculate average RAM usage
    const totalAlloc = reports.reduce((sum, r) => sum + r.AllocKB, 0);
    const averageRAM = totalAlloc / reports.length / 1024; // Convert to MB

    // Prepare data for line chart (per-program usage over time)
    const processData = reports.slice(0, 20).map((r) => ({
      time: new Date(r.TimeStamp * 1000).toLocaleTimeString(),
      allocKB: r.AllocKB,
      freeKB: r.FreeKB,
      process: r.Process,
    }));

    // Generate alerts based on leak detection
    const alerts = [];
    const leakReports = reports.filter((r) => r.LeakSuspect);
    if (leakReports.length > 0) {
      alerts.push(`Memory leak detected in ${leakReports.length} processes`);
    }
    const highRatioReports = reports.filter((r) => r.Ratio > 5);
    if (highRatioReports.length > 0) {
      alerts.push(
        `High memory ratio detected in ${highRatioReports.length} processes`
      );
    }

    res.json({ averageRAM, processData, alerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin", async (req, res) => {
  try {
    const reports = await Report.find().sort({ TimeStamp: -1 }).limit(1000);

    // Calculate average usage across all systems
    const totalAlloc = reports.reduce((sum, r) => sum + r.AllocKB, 0);
    const averageUsage = totalAlloc / reports.length / 1024; // Convert to MB

    // Group by system for per-system comparison
    const systemMap = {};
    reports.forEach((r) => {
      if (!systemMap[r.SystemId]) {
        systemMap[r.SystemId] = [];
      }
      systemMap[r.SystemId].push(r.AllocKB);
    });

    const systemData = Object.keys(systemMap).map((systemId) => {
      const usages = systemMap[systemId];
      const averageRAM =
        usages.reduce((sum, u) => sum + u, 0) / usages.length / 1024;
      return { systemId, averageRAM };
    });

    // Generate global alerts
    const alerts = [];
    const totalLeaks = reports.filter((r) => r.LeakSuspect).length;
    if (totalLeaks > 0) {
      alerts.push(
        `Memory leaks detected across ${totalLeaks} processes in the network`
      );
    }
    const totalHighRatio = reports.filter((r) => r.Ratio > 5).length;
    if (totalHighRatio > 0) {
      alerts.push(`High memory ratios detected in ${totalHighRatio} processes`);
    }

    res.json({ averageUsage, systemData, alerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/alerts", async (req, res) => {
  try {
    const alerts = await Report.find({
      $or: [{ LeakSuspect: true }, { Ratio: { $gt: 5 } }],
    })
      .sort({ TimeStamp: -1 })
      .limit(50);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
