const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redis = require("../config/redis");
const logger = require("../utils/logger");

// ---------- REDIS STORE (shared across all cluster workers) ----------
const makeRedisStore = (prefix) =>
	new RedisStore({
		sendCommand: async (...args) => redis.call(...args),
		prefix: `rl:${prefix}:`,
	});

// ---------- SHARED HANDLER ----------
const limitExceededHandler = (req, res, next, options) => {
	logger.warn(
		`Rate limit hit — IP: ${req.ip} | Route: ${req.originalUrl} | Limit: ${options.max}/${options.windowMs / 1000}s`,
		"rateLimiter"
	);
	res.status(options.statusCode).json({
		success: false,
		error: "Too many requests",
		message: `Rate limit exceeded. Max ${options.max} requests per ${options.windowMs / 60000} minute(s).`,
		retryAfter: Math.ceil(options.windowMs / 1000),
	});
};

// ---------- TIER 1: Global fallback (all /api routes) ----------
exports.globalLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: Number(process.env.RATE_LIMIT_GLOBAL || 200),
	standardHeaders: true,   // Emit RateLimit-* headers (IETF draft, works in v6/v7/v8)
	legacyHeaders: false,    // Disable deprecated X-RateLimit-* headers
	store: makeRedisStore("global"),
	handler: limitExceededHandler,
	skip: (req) => req.path === "/api/health",
	keyGenerator: ipKeyGenerator,
});

// ---------- TIER 2: Events API ----------
exports.eventsLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: Number(process.env.RATE_LIMIT_EVENTS || 60),
	standardHeaders: true,
	legacyHeaders: false,
	store: makeRedisStore("events"),
	handler: limitExceededHandler,
	keyGenerator: ipKeyGenerator,
});

// ---------- TIER 3: Dates API ----------
exports.datesLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: Number(process.env.RATE_LIMIT_DATES || 120),
	standardHeaders: true,
	legacyHeaders: false,
	store: makeRedisStore("dates"),
	handler: limitExceededHandler,
	keyGenerator: ipKeyGenerator,
});

