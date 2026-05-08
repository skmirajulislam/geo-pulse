const express = require("express");
const router = express.Router();

const logger = require("../utils/logger");
const { eventsLimiter, datesLimiter } = require("../middleware/rateLimiter");
const asyncHandler = require("../utils/asyncHandler");

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
	tsunami: "Flooding & Water",
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
router.get(
	"/weather/dates",
	datesLimiter,
	asyncHandler(async (req, res, next) => {
		logger.info("GET /api/weather/dates", "weather.routes");
		const { getAvailableDates } = require("../cache/weatherCache.service");
		const dates = await getAvailableDates();

		res.status(200).json({
			success: true,
			dates,
		});
	})
);

// GET /api/weather
router.get(
	"/weather",
	eventsLimiter,
	asyncHandler(async (req, res, next) => {
		const start = Date.now();
		const targetDate = req.query.date;
		logger.info(
			`GET /api/weather${targetDate ? `?date=${targetDate}` : ""}`,
			"weather.routes"
		);

		const events = await getWeatherEvents(targetDate);
		const data = categorizeEvents(events);

		const duration = Date.now() - start;
		logger.info(
			`Response sent (${events.length} events) in ${duration}ms`,
			"routes"
		);

		res.status(200).json({
			success: true,
			count: events.length,
			data,
		});
	})
);

module.exports = router;
