const express = require("express");
const router = express.Router();

const logger = require("../utils/logger");
const { eventsLimiter, datesLimiter } = require("../middleware/rateLimiter");

const { getWeatherEvents } = require("../modules/weather/weather.service");

// ---------- WEATHER CATEGORY MAPPING ----------
const CATEGORY_MAP = {
	// Seismic
	earthquake: "Seismic & Volcanic",
	volcano: "Seismic & Volcanic",
	tsunami: "Seismic & Volcanic",
	landslide: "Seismic & Volcanic",
	avalanche: "Seismic & Volcanic",

	// Storms
	hurricane: "Storms",
	typhoon: "Storms",
	cyclone: "Storms",
	tornado: "Storms",
	storm: "Storms",
	blizzard: "Storms",
	monsoon: "Storms",

	// Fire & Heat
	wildfire: "Fire & Heat",
	heatwave: "Fire & Heat",
	drought: "Fire & Heat",

	// Flooding & Water
	flood: "Flooding & Water",
	coldwave: "Extreme Cold",

	// General
	weather: "General Weather",
};

// Fallback category ordering for display
const CATEGORY_ORDER = [
	"Seismic & Volcanic",
	"Storms",
	"Fire & Heat",
	"Flooding & Water",
	"Extreme Cold",
	"General Weather",
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

// GET /api/weather/dates
router.get("/weather/dates", datesLimiter, async (req, res) => {
	try {
		logger.info("GET /api/weather/dates", "weather.routes");
		const { getAvailableDates } = require("../cache/weatherCache.service");
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

// GET /api/weather
router.get("/weather", eventsLimiter, async (req, res) => {
	const start = Date.now();

	try {
		const targetDate = req.query.date;
		logger.info(`GET /api/weather${targetDate ? `?date=${targetDate}` : ''}`, "weather.routes");

		const events = await getWeatherEvents(targetDate);
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
