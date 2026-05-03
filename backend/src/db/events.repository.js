const { MongoClient } = require("mongodb");
const logger = require("../utils/logger");

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 15);
const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;

let client = null;
let collection = null;

const isDatabaseEnabled = () => Boolean(process.env.MONGODB_URI);

const mapDocToEvent = (doc) => ({
	id: doc.id,
	type: doc.type,
	country: doc.country,
	coords: doc.coords,
	severity: doc.severity,
	confidence: doc.confidence,
	timestamp: doc.timestamp || (doc.published_at ? new Date(doc.published_at).toISOString() : null),
	title: doc.title,
	description: doc.description,
	sources: doc.sources || [],
	score: typeof doc.score === "number" ? doc.score : 0,
});

const ensureIndexes = async () => {
	if (!collection) return;

	await Promise.all([
		collection.createIndex({ source_url: 1 }, { unique: true, sparse: true }),
		collection.createIndex({ canonical_url: 1 }, { sparse: true }),
		collection.createIndex({ title_fingerprint: 1 }, { sparse: true }),
		collection.createIndex({ coarse_fingerprint: 1 }, { sparse: true }),
		collection.createIndex({ published_at: 1 }, { expireAfterSeconds: RETENTION_SECONDS }),
		collection.createIndex({ published_at: -1 }),
		collection.createIndex({ country: 1, type: 1 }),
	]);
};

const getCollection = async () => {
	if (!isDatabaseEnabled()) return null;
	if (collection) return collection;

	const mongoUri = process.env.MONGODB_URI;
	const dbName = process.env.MONGODB_DB_NAME || "world_monitor";

	client = new MongoClient(mongoUri, {
		maxPoolSize: 20,
		minPoolSize: 2,
	});

	await client.connect();
	collection = client.db(dbName).collection("events");
	await ensureIndexes();
	logger.info(`MongoDB connected (${dbName}.events)`, "db.events");
	return collection;
};

exports.isDatabaseEnabled = isDatabaseEnabled;

exports.connectEventsRepository = async () => {
	try {
		await getCollection();
	} catch (err) {
		logger.error(`MongoDB connection failed: ${err.message}`, "db.events");
		throw err;
	}
};

exports.closeEventsRepository = async () => {
	if (!client) return;
	await client.close();
	client = null;
	collection = null;
};

exports.upsertEvents = async (events = []) => {
	if (!events.length || !isDatabaseEnabled()) return { upserted: 0, modified: 0 };

	const col = await getCollection();
	if (!col) return { upserted: 0, modified: 0 };

	const ops = events.map((event) => {
		const sourceUrl = event.sources?.[0]?.url || null;
		const publishedAt = new Date(event.timestamp || Date.now());

		const doc = {
			...event,
			source_url: sourceUrl,
			published_at: publishedAt,
			updated_at: new Date(),
		};

		const filter = sourceUrl ? { source_url: sourceUrl } : { id: event.id };

		return {
			updateOne: {
				filter,
				update: {
					$set: doc,
					$setOnInsert: { created_at: new Date() },
				},
				upsert: true,
			},
		};
	});

	const result = await col.bulkWrite(ops, { ordered: false });
	return {
		upserted: result.upsertedCount || 0,
		modified: result.modifiedCount || 0,
	};
};

exports.getEventsByDate = async (targetDate) => {
	if (!isDatabaseEnabled()) return [];

	const col = await getCollection();
	if (!col) return [];

	const query = {};
	if (targetDate) {
		const start = new Date(`${targetDate}T00:00:00.000Z`);
		const end = new Date(`${targetDate}T23:59:59.999Z`);
		query.published_at = { $gte: start, $lte: end };
	}

	const docs = await col
		.find(query, {
			projection: {
				_id: 0,
				id: 1,
				type: 1,
				country: 1,
				coords: 1,
				severity: 1,
				confidence: 1,
				timestamp: 1,
				title: 1,
				description: 1,
				sources: 1,
				score: 1,
				published_at: 1,
			},
		})
		.sort({ score: -1, published_at: -1 })
		.toArray();

	return docs.map(mapDocToEvent);
};

exports.getAvailableDatesFromDb = async () => {
	if (!isDatabaseEnabled()) return [];

	const col = await getCollection();
	if (!col) return [];

	const rows = await col
		.aggregate([
			{
				$project: {
					date: {
						$dateToString: {
							date: "$published_at",
							format: "%Y-%m-%d",
							timezone: "UTC",
						},
					},
				},
			},
			{ $group: { _id: "$date" } },
			{ $sort: { _id: 1 } },
		])
		.toArray();

	return rows.map((r) => r._id);
};

exports.getRecentDuplicateCandidates = async () => {
	if (!isDatabaseEnabled()) return [];

	const col = await getCollection();
	if (!col) return [];

	const cutoff = new Date(Date.now() - RETENTION_SECONDS * 1000);
	const docs = await col
		.find(
			{ published_at: { $gte: cutoff } },
			{
				projection: {
					_id: 0,
					title: 1,
					type: 1,
					country: 1,
					timestamp: 1,
					published_at: 1,
					canonical_url: 1,
					source_url: 1,
					title_fingerprint: 1,
					coarse_fingerprint: 1,
				},
			},
		)
		.limit(5000)
		.toArray();

	return docs;
};

exports.getTrendingEvents = async ({ limit = 20, days = 3 } = {}) => {
	if (!isDatabaseEnabled()) return [];

	const col = await getCollection();
	if (!col) return [];

	const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
	const boundedDays = Math.max(1, Math.min(30, Number(days) || 3));
	const cutoff = new Date(Date.now() - boundedDays * 24 * 60 * 60 * 1000);

	const docs = await col
		.find(
			{ published_at: { $gte: cutoff } },
			{
				projection: {
					_id: 0,
					id: 1,
					type: 1,
					country: 1,
					coords: 1,
					severity: 1,
					confidence: 1,
					timestamp: 1,
					title: 1,
					description: 1,
					sources: 1,
					score: 1,
					published_at: 1,
				},
			},
		)
		.sort({ score: -1, severity: -1, confidence: -1, published_at: -1 })
		.limit(boundedLimit)
		.toArray();

	return docs.map(mapDocToEvent);
};
