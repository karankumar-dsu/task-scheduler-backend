require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
 
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const assistantRoutes = require("./routes/assistantRoutes");
const { initSocket } = require("./utils/socket");
const { startReminderJob } = require("./utils/scheduler");
 
// Ensure uploads/voicemails directory exists
const uploadDir = path.join(__dirname, "uploads", "voicemails");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
 
const app = express();
const server = http.createServer(app);
 
// Allow the web dev URL AND the Capacitor APK's WebView origins.
// Packaged Android apps send Origin as "capacitor://localhost" or
// "https://localhost" (or sometimes no Origin header at all) — none of
// which match a single hardcoded CLIENT_URL, so requests were being
// blocked by CORS when running from the APK.
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
];
const corsOptionsDelegate = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};
 
const io = new Server(server, {
  cors: corsOptionsDelegate,
});
initSocket(io);
 
app.use(cors(corsOptionsDelegate));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
 
// Voice Mail Audio Files ko access karne ke liye static route
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
 
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/assistant", assistantRoutes);
 
app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});
 
// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});
 
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  startReminderJob();
});
 