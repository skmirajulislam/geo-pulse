const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const logger = require("./utils/logger");
const { globalLimiter } = require("./middleware/rateLimiter");

// Routes
const newsRoutes = require("./routes/news.routes");
const weatherRoutes = require("./routes/weather.routes");
const aiRoutes = require("./routes/ai.routes");
const dataRoutes = require("./routes/data.routes");
const chatRoutes = require("./routes/chat.routes");

const app = express();

// Trust the first proxy hop (nginx, cloud LB, Railway, Render, etc.)
// so req.ip returns the real client IP instead of the load balancer IP
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1));

// ---------- MIDDLEWARE ----------
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : true; // allow all in dev (no CORS_ORIGIN set)

const corsOptions = {
  origin: corsOrigins,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
};

// CORS must come first — before helmet and rate limiters — so every
// response (including 403 rate-limit and preflight) carries the header.
app.use(cors(corsOptions));

// Helmet v8 defaults can override CORS headers; disable the conflicting
// policies that block legitimate cross-origin browser fetches.
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json());

// HTTP request logging → pipe into your logger
app.use(
  morgan("dev", {
    stream: {
      write: (message) => {
        logger.info(message.trim(), "http");
      }
    }
  })
);

// ---------- ROUTES ----------

// Health Check — no rate limit, always available
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    worker: process.pid, // shows which cluster worker handled the request
  });
});

// Apply global rate limiter to all remaining /api routes
app.use("/api", globalLimiter);

// Main API
app.use("/api", newsRoutes);
app.use("/api", weatherRoutes);
app.use("/api", aiRoutes);
app.use("/api", dataRoutes);
app.use("/api", chatRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Geopolitical Intelligence Backend Running 🚀");
});

// ---------- 404 HANDLER ----------
app.use((req, res) => {
  logger.warn(`Route not found: ${req.originalUrl}`, "app");

  res.status(404).json({
    success: false,
    error: "Route not found"
  });
});

// ---------- GLOBAL ERROR HANDLER ----------
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, "app");

  res.status(500).json({
    success: false,
    error: "Internal Server Error"
  });
});

module.exports = app;
