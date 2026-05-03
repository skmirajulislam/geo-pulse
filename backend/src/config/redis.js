const Redis = require("ioredis");
const logger = require("../utils/logger.js");

const redisUrl = process.env.REDIS_URL;
const tlsEnabled =
	process.env.REDIS_TLS === "true" || (redisUrl && redisUrl.startsWith("rediss://"));

const baseOptions = {
	username: process.env.REDIS_USERNAME || undefined,
	password: process.env.REDIS_PASSWORD || undefined,
	db: Number(process.env.REDIS_DB || 0),
	maxRetriesPerRequest: 3,
	enableReadyCheck: true,
	connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 10000),
	retryStrategy(times) {
		return Math.min(times * 100, 2000);
	},
};

if (tlsEnabled) {
	baseOptions.tls = {
		rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false",
	};
}

const redis = redisUrl
	? new Redis(redisUrl, baseOptions)
	: new Redis({
		host: process.env.REDIS_HOST || "127.0.0.1",
		port: Number(process.env.REDIS_PORT || 6379),
		...baseOptions,
	});

// ---------- STARTUP DIAGNOSTIC ----------
const _diagHost = redisUrl
	? redisUrl.replace(/:\/\/[^@]*@/, "://***@") // mask credentials in URL
	: `${process.env.REDIS_HOST || "127.0.0.1"}:${process.env.REDIS_PORT || 6379}`;

const _isCloudHost =
	_diagHost.includes("redislabs.com") ||
	_diagHost.includes("upstash.io") ||
	_diagHost.includes("redis.cloud") ||
	_diagHost.includes("railway.app");

logger.info(
	`Redis config → host: ${_diagHost} | TLS: ${tlsEnabled ? "ON ✅" : "OFF ⚠️"} | db: ${baseOptions.db}`,
	"redis"
);

if (_isCloudHost && !tlsEnabled) {
	logger.warn(
		"Redis is connecting to a cloud host WITHOUT TLS. " +
		"Credentials travel unencrypted. To enable TLS: " +
		"get the TLS port from your Redis Cloud dashboard, " +
		"set REDIS_URL=rediss://... (note: rediss with double-s) and REDIS_TLS=true.",
		"redis"
	);
}

redis.on("connect", () => {
	logger.info("Redis connected", "redis");
});

redis.on("ready", () => {
	logger.info(`Redis ready — TLS: ${tlsEnabled ? "ON ✅" : "OFF ⚠️"}`, "redis");
});

redis.on("error", (err) => {
	logger.error(`Redis error: ${err.message}`, "redis");
});

module.exports = redis;

