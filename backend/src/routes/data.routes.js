const express = require("express");
const router = express.Router();

const logger = require("../utils/logger");
const { eventsLimiter } = require("../middleware/rateLimiter");
const { getGeopoliticalEvents } = require("../modules/news/news.service");
const { getTrendingEvents, isDatabaseEnabled } = require("../db/events.repository");
const { getRealMarketData } = require("../modules/finance/market.service");
const { getWeatherForecast, getWeatherRegions } = require("../modules/weather/weather.service");

const STOCKS_FALLBACK = [
	{ symbol: "SPX", name: "S&P 500", direction: "stable", changePct: 0 },
	{ symbol: "CL", name: "Crude Oil", direction: "stable", changePct: 0 },
	{ symbol: "GC", name: "Gold", direction: "stable", changePct: 0 },
	{ symbol: "DXY", name: "US Dollar Index", direction: "stable", changePct: 0 },
	{ symbol: "BTC", name: "Bitcoin", direction: "stable", changePct: 0 },
];

const mapArticle = (event) => ({
	id: event.id,
	title: event.title,
	description: event.description,
	country: event.country,
	type: event.type,
	severity: event.severity,
	confidence: event.confidence,
	score: event.score || 0,
	publishedAt: event.timestamp,
	source: event.sources?.[0]?.name || null,
	url: event.sources?.[0]?.url || null,
});

router.get("/news/live", eventsLimiter, async (req, res) => {
	try {
		const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
		const events = await getGeopoliticalEvents();
		const live = events.slice(0, limit).map(mapArticle);

		res.json({
			success: true,
			count: live.length,
			data: live,
		});
	} catch (err) {
		logger.error(`Live news route error: ${err.message}`, "data.routes");
		res.status(500).json({ success: false, error: "Internal Server Error" });
	}
});

router.get("/articles/trending", eventsLimiter, async (req, res) => {
	try {
		const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
		const days = Math.max(1, Math.min(30, Number(req.query.days) || 3));

		let items = [];
		if (isDatabaseEnabled()) {
			items = await getTrendingEvents({ limit, days });
		}

		if (items.length === 0) {
			const fallback = await getGeopoliticalEvents();
			items = fallback.slice(0, limit);
		}

		const trending = items.map(mapArticle);

		res.json({
			success: true,
			count: trending.length,
			data: trending,
		});
	} catch (err) {
		logger.error(`Trending articles route error: ${err.message}`, "data.routes");
		res.status(500).json({ success: false, error: "Internal Server Error" });
	}
});

router.get("/stocks/quotes", eventsLimiter, async (req, res) => {
	try {
		const marketData = await getRealMarketData();
		res.json({
			success: true,
			live: Boolean(marketData && marketData.length > 0),
			data: marketData && marketData.length > 0 ? marketData : STOCKS_FALLBACK,
		});
	} catch (err) {
		logger.error(`Stocks route error: ${err.message}`, "data.routes");
		res.status(500).json({ success: false, error: "Internal Server Error" });
	}
});

router.get("/weather/forecast", eventsLimiter, async (req, res) => {
	try {
		const latitude = Number(req.query.latitude);
		const longitude = Number(req.query.longitude);
		if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
			return res.status(400).json({
				success: false,
				error: "latitude and longitude query params are required numbers",
			});
		}

		const data = await getWeatherForecast({
			latitude,
			longitude,
			days: req.query.days || 7,
			hourly: req.query.hourly || "temperature_2m",
		});

		res.json({ success: true, data });
	} catch (err) {
		logger.error(`Weather forecast route error: ${err.message}`, "data.routes");
		res.status(500).json({ success: false, error: "Internal Server Error" });
	}
});

router.get("/weather/regions", eventsLimiter, async (_req, res) => {
	try {
		const data = await getWeatherRegions();
		res.json({ success: true, count: data.length, data });
	} catch (err) {
		logger.error(`Weather regions route error: ${err.message}`, "data.routes");
		res.status(500).json({ success: false, error: "Internal Server Error" });
	}
});

router.get("/weather/events", eventsLimiter, async (_req, res) => {
	try {
		const { getWeatherEvents } = require("../modules/weather/weather.service");
		const data = await getWeatherEvents();
		res.json({ success: true, count: (data || []).length, data: data || [] });
	} catch (err) {
		logger.error(`Weather events route error: ${err.message}`, "data.routes");
		res.status(500).json({ success: false, error: "Internal Server Error" });
	}
});

module.exports = router;
