/**
 * mongoClient.js — Shared MongoDB client singleton
 *
 * All repositories (events, weather, chatRooms) share this single MongoClient
 * instead of each creating their own connection to the same URI.
 * This reduces connection overhead from 3x to 1x.
 */

const { MongoClient } = require("mongodb");
const logger = require("../utils/logger");

const MONGO_RETRY_COOLDOWN_MS = Number(process.env.MONGO_RETRY_COOLDOWN_MS || 60000);

let client = null;
let db = null;
let mongoBackoffUntil = 0;

const isDatabaseEnabled = () => Boolean(process.env.MONGODB_URI);

/**
 * Get the shared MongoClient and database instance.
 * Returns null if MongoDB is not configured or is in backoff.
 */
const getDb = async () => {
	if (!isDatabaseEnabled()) return null;
	if (db) return db;
	if (Date.now() < mongoBackoffUntil) return null;

	const mongoUri = process.env.MONGODB_URI;
	const dbName = process.env.MONGODB_DB_NAME || "world_monitor";

	try {
		client = new MongoClient(mongoUri, {
			maxPoolSize: 20,
			minPoolSize: 2,
		});

		await client.connect();
		db = client.db(dbName);
		mongoBackoffUntil = 0;
		logger.info(`MongoDB shared client connected (${dbName})`, "db.shared");
		return db;
	} catch (err) {
		mongoBackoffUntil = Date.now() + MONGO_RETRY_COOLDOWN_MS;
		if (client) {
			try { await client.close(); } catch (_) {}
		}
		client = null;
		db = null;
		throw err;
	}
};

/**
 * Close the shared connection (called on graceful shutdown).
 */
const closeSharedClient = async () => {
	if (!client) return;
	try {
		await client.close();
	} catch (_) {}
	client = null;
	db = null;
	mongoBackoffUntil = 0;
	logger.info("MongoDB shared client closed", "db.shared");
};

module.exports = {
	isDatabaseEnabled,
	getDb,
	closeSharedClient,
};
