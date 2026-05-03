/**
 * memoryGuard.js
 *
 * Runs BEFORE each pipeline execution.
 * Checks Redis memory against the 30 MB plan quota.
 * If usage exceeds the eviction threshold (default 85 % = ~25.5 MB):
 *   1. Evicts the oldest archive date keys from Redis.
 *   2. Purges the corresponding oldest records from MongoDB.
 *
 * This keeps the database within quota without manual intervention.
 */

const redis  = require("../config/redis");
const logger = require("../utils/logger");
const { isDatabaseEnabled } = require("../db/events.repository");

const REDIS_MAX_MEMORY_MB        = Number(process.env.REDIS_MAX_MEMORY_MB        || 30);
const REDIS_EVICTION_THRESHOLD   = Number(process.env.REDIS_EVICTION_THRESHOLD_PCT || 85) / 100;
const REDIS_MAX_BYTES            = REDIS_MAX_MEMORY_MB * 1024 * 1024;
const EVICTION_TRIGGER_BYTES     = Math.floor(REDIS_MAX_BYTES * REDIS_EVICTION_THRESHOLD);
const ARCHIVE_INDEX              = "geopolitics_archive_dates";

// How many of the oldest dates to drop per eviction pass
const EVICTION_BATCH_DATES       = 3;

// ---------- INTERNAL: parse redis INFO memory output ----------
const parseRedisMemory = (infoText) => {
	const match = infoText.match(/used_memory:(\d+)/);
	return match ? Number(match[1]) : 0;
};

// ---------- INTERNAL: get Redis memory usage in bytes ----------
const getRedisUsedBytes = async () => {
	try {
		const info = await redis.info("memory");
		return parseRedisMemory(info);
	} catch (err) {
		logger.warn(`Memory guard: could not read Redis INFO — ${err.message}`, "memoryGuard");
		return 0;
	}
};

// ---------- INTERNAL: evict oldest dates from Redis archive ----------
const evictOldestFromRedis = async (oldestDates) => {
	if (!oldestDates.length) return;
	const keys = oldestDates.map((d) => `geopolitics_events:${d}`);
	await redis.del(...keys);
	await redis.srem(ARCHIVE_INDEX, ...oldestDates);
	logger.info(
		`Memory guard: evicted ${oldestDates.length} oldest Redis archive keys: ${oldestDates.join(", ")}`,
		"memoryGuard"
	);
};

// ---------- INTERNAL: evict oldest records from MongoDB ----------
const evictOldestFromMongoDB = async (oldestDates) => {
	if (!oldestDates.length || !isDatabaseEnabled()) return;

	// Lazy require to avoid circular deps
	const { MongoClient } = require("mongodb");
	const mongoUri = process.env.MONGODB_URI;
	const dbName   = process.env.MONGODB_DB_NAME || "world_monitor";

	// Reuse open connection if possible; otherwise open a short-lived one
	let client;
	let closeAfter = false;
	try {
		// We import the shared collection getter from events.repository
		const { getEventsByDate } = require("../db/events.repository");

		// Build date range covering all eviction dates
		const starts = oldestDates.map((d) => new Date(`${d}T00:00:00.000Z`));
		const ends   = oldestDates.map((d) => new Date(`${d}T23:59:59.999Z`));
		const minStart = new Date(Math.min(...starts));
		const maxEnd   = new Date(Math.max(...ends));

		// Open a temp client for bulk delete
		client = new MongoClient(mongoUri, { maxPoolSize: 2 });
		await client.connect();
		closeAfter = true;

		const col = client.db(dbName).collection("events");
		const result = await col.deleteMany({
			published_at: { $gte: minStart, $lte: maxEnd },
		});

		logger.info(
			`Memory guard: purged ${result.deletedCount} MongoDB records for dates: ${oldestDates.join(", ")}`,
			"memoryGuard"
		);
	} catch (err) {
		logger.error(`Memory guard: MongoDB eviction failed — ${err.message}`, "memoryGuard");
	} finally {
		if (closeAfter && client) {
			try { await client.close(); } catch (_) {}
		}
	}
};

// ---------- PUBLIC: run memory check + evict if needed ----------
exports.runMemoryGuard = async () => {
	try {
		const usedBytes = await getRedisUsedBytes();
		const usedMB    = (usedBytes / 1024 / 1024).toFixed(2);
		const usedPct   = ((usedBytes / REDIS_MAX_BYTES) * 100).toFixed(1);

		logger.info(
			`Memory guard: Redis usage = ${usedMB} MB / ${REDIS_MAX_MEMORY_MB} MB (${usedPct}%) — ` +
			`eviction threshold = ${(REDIS_EVICTION_THRESHOLD * 100).toFixed(0)}% (${(EVICTION_TRIGGER_BYTES / 1024 / 1024).toFixed(1)} MB)`,
			"memoryGuard"
		);

		if (usedBytes < EVICTION_TRIGGER_BYTES) {
			logger.info("Memory guard: within quota — no eviction needed", "memoryGuard");
			return { evicted: false, usedMB: Number(usedMB) };
		}

		// Over threshold — find oldest archive dates
		logger.warn(
			`Memory guard: usage (${usedPct}%) exceeds ${(REDIS_EVICTION_THRESHOLD * 100).toFixed(0)}% threshold. Evicting oldest records…`,
			"memoryGuard"
		);

		const allDates = (await redis.smembers(ARCHIVE_INDEX)).sort(); // oldest first
		if (!allDates.length) {
			logger.warn("Memory guard: archive index empty — nothing to evict", "memoryGuard");
			return { evicted: false, usedMB: Number(usedMB) };
		}

		const toEvict = allDates.slice(0, EVICTION_BATCH_DATES);

		// Evict from Redis and MongoDB in parallel
		await Promise.all([
			evictOldestFromRedis(toEvict),
			evictOldestFromMongoDB(toEvict),
		]);

		// Re-check usage after eviction
		const afterBytes = await getRedisUsedBytes();
		const afterMB    = (afterBytes / 1024 / 1024).toFixed(2);
		logger.info(
			`Memory guard: eviction complete. Redis usage now ${afterMB} MB`,
			"memoryGuard"
		);

		return { evicted: true, dates: toEvict, usedMB: Number(afterMB) };
	} catch (err) {
		logger.error(`Memory guard: unexpected error — ${err.message}`, "memoryGuard");
		return { evicted: false, error: err.message };
	}
};
