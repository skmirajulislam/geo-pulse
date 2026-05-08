const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const logger = require("./utils/logger");
const { globalLimiter } = require("./middleware/rateLimiter");
const { globalErrorHandler, timeoutHandler, notFoundHandler, healthCheck } = require("./middleware/errorHandler");

// Routes
const newsRoutes = require("./routes/news.routes");
const weatherRoutes = require("./routes/weather.routes");
const aiRoutes = require("./routes/ai.routes");
const dataRoutes = require("./routes/data.routes");
const chatRoutes = require("./routes/chat.routes");
const shipsRoutes = require("./routes/ships.routes");

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

// Add timeout handler (30 second max per request)
app.use(timeoutHandler(30000));

// ---------- ROUTES ----------

// Health Check — no rate limit, always available
app.get("/api/health", healthCheck);

// Apply global rate limiter to all remaining /api routes
app.use("/api", globalLimiter);

// Main API
app.use("/api", newsRoutes);
app.use("/api", weatherRoutes);
app.use("/api", aiRoutes);
app.use("/api", dataRoutes);
app.use("/api", chatRoutes);
app.use("/api/ships", shipsRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Geopolitical Intelligence Backend Running 🚀");
});

// 404 handler
app.use(notFoundHandler);

// Global error handler (MUST be last)
app.use(globalErrorHandler);

module.exports = app;
