const express = require("express");
const router = express.Router();

const logger = require("../utils/logger");
const { eventsLimiter, datesLimiter } = require("../middleware/rateLimiter");

const { getGeopoliticalEvents } = require("../modules/news/news.service");

// ---------- CATEGORY MAPPING ----------
const CATEGORY_MAP = {
	// Armed Conflict
	war: "Armed Conflict",
	attack: "Armed Conflict",
	airstrike: "Armed Conflict",
	battle: "Armed Conflict",
	conflict: "Armed Conflict",
	clash: "Armed Conflict",
	bombing: "Armed Conflict",
	shelling: "Armed Conflict",
	invasion: "Armed Conflict",
	siege: "Armed Conflict",
	insurgency: "Armed Conflict",
	ambush: "Armed Conflict",
	military: "Armed Conflict",
	hostage: "Armed Conflict",

	// Politics
	policy: "Politics",
	legislation: "Politics",
	reform: "Politics",
	law: "Politics",
	election: "Politics",
	coup: "Politics",
	protest: "Politics",
	uprising: "Politics",
	riot: "Politics",
	crackdown: "Politics",
	referendum: "Politics",
	"regime change": "Politics",

	// Diplomacy
	diplomacy: "Diplomacy",
	negotiation: "Diplomacy",
	summit: "Diplomacy",
	treaty: "Diplomacy",
	alliance: "Diplomacy",
	sanction: "Diplomacy & Sanctions",
	embargo: "Diplomacy & Sanctions",
	blockade: "Diplomacy & Sanctions",
	tension: "Diplomacy",
	threat: "Diplomacy",

	// Terrorism & Security
	assassination: "Terrorism & Security",
	operation: "Terrorism & Security",

	// Cyber & Tech
	espionage: "Cyber & Tech",
	cyberattack: "Cyber & Tech",
	hacking: "Cyber & Tech",
	surveillance: "Cyber & Tech",
	technology: "Cyber & Tech",

	// Environment & Climate
	environment: "Environment & Climate",
	earthquake: "Environment & Climate",
	weather: "Environment & Climate",

	// Health & Disaster
	pandemic: "Health & Disaster",
	disaster: "Health & Disaster",
	crisis: "Health & Disaster",
	humanitarian: "Health & Disaster",
	humanitariancrisis: "Health & Disaster",
	refugee: "Health & Disaster",
	displacement: "Health & Disaster",
	famine: "Health & Disaster",
	evacuation: "Health & Disaster",
	"mass-death": "Health & Disaster",
	health: "Health & Disaster",

	// Global Economy
	tradewar: "Global Economy",
	tariff: "Global Economy",
	armsdeal: "Global Economy",
	economy: "Global Economy",
	business: "Global Economy",
	market: "Global Economy",

	// Catch-alls that fit specific buckets
	politics: "Politics",
	terrorism: "Terrorism & Security",
	crime: "Terrorism & Security",
	lawenforcement: "Terrorism & Security",
	social: "Politics",
	media: "Politics",
	culture: "Other",
	death: "Health & Disaster",
	policychange: "Politics",
};

// Fallback category ordering for display
const CATEGORY_ORDER = [
	"Armed Conflict",
	"Terrorism & Security",
	"Cyber & Tech",
	"Politics",
	"Diplomacy",
	"Diplomacy & Sanctions",
	"Global Economy",
	"Health & Disaster",
	"Environment & Climate",
	"Other",
];

const categorizeEvents = (events) => {
	const grouped = {};

	for (const event of events) {
		const category =
			CATEGORY_MAP[event.type] || CATEGORY_MAP[event.event_type] || "Other";

		if (!grouped[category]) {
			grouped[category] = [];
		}

		grouped[category].push(event);
	}

	// Return ordered object
	const result = {};
	for (const cat of CATEGORY_ORDER) {
		if (grouped[cat]) {
			result[cat] = grouped[cat];
		}
	}

	return result;
};

// GET /api/geopolitics/dates
router.get("/geopolitics/dates", datesLimiter, async (req, res) => {
	try {
		logger.info("GET /api/geopolitics/dates", "routes");
		const { getAvailableDates } = require("../cache/cache.service");
		const dates = await getAvailableDates();
		
		res.status(200).json({
			success: true,
			dates,
		});
	} catch (err) {
		logger.error(`Date Route error: ${err.message}`, "routes");
		res.status(500).json({ success: false, error: "Internal Server Error" });
	}
});

// GET /api/geopolitics
router.get("/geopolitics", eventsLimiter, async (req, res) => {
	const start = Date.now();

	try {
		const targetDate = req.query.date;
		logger.info(`GET /api/geopolitics${targetDate ? `?date=${targetDate}` : ''}`, "routes");

		const events = await getGeopoliticalEvents(targetDate);
		const data = categorizeEvents(events);

		const duration = Date.now() - start;

		logger.info(
			`Response sent (${events.length} events) in ${duration}ms`,
			"routes",
		);

		res.status(200).json({
			success: true,
			count: events.length,
			data,
		});
	} catch (err) {
		logger.error(`Route error: ${err.message}`, "routes");

		res.status(500).json({
			success: false,
			error: "Internal Server Error",
		});
	}
});

module.exports = router;
