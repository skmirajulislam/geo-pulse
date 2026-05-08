const express = require("express");
const router = express.Router();

const logger = require("../utils/logger");
const { eventsLimiter } = require("../middleware/rateLimiter");
const asyncHandler = require("../utils/asyncHandler");
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

router.get(
	"/news/live",
	eventsLimiter,
	asyncHandler(async (req, res, next) => {
		const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
		const events = await getGeopoliticalEvents();
		const live = events.slice(0, limit).map(mapArticle);

		res.json({
			success: true,
			count: live.length,
			data: live,
		});
	})
);

router.get(
	"/articles/trending",
	eventsLimiter,
	asyncHandler(async (req, res, next) => {
		const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
		const days = Math.max(1, Math.min(30, Number(req.query.days) || 3));

		let items = [];
		if (isDatabaseEnabled()) {
			try {
				items = await getTrendingEvents({ limit, days });
			} catch (err) {
				logger.warn(
					`Trending DB read unavailable, using cache fallback: ${err.message}`,
					"data.routes"
				);
			}
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
	})
);

router.get(
	"/stocks/quotes",
	eventsLimiter,
	asyncHandler(async (req, res, next) => {
		const marketData = await getRealMarketData();
		res.json({
			success: true,
			live: Boolean(marketData && marketData.length > 0),
			data: marketData && marketData.length > 0 ? marketData : STOCKS_FALLBACK,
		});
	})
);

router.get(
	"/weather/forecast",
	eventsLimiter,
	asyncHandler(async (req, res, next) => {
		const latitude = Number(req.query.latitude);
		const longitude = Number(req.query.longitude);
		if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
			const err = new Error(
				"latitude and longitude query params are required numbers"
			);
			err.statusCode = 400;
			throw err;
		}

		const data = await getWeatherForecast({
			latitude,
			longitude,
			days: req.query.days || 7,
			hourly: req.query.hourly || "temperature_2m",
		});

		res.json({ success: true, data });
	})
);

router.get(
	"/weather/regions",
	eventsLimiter,
	asyncHandler(async (_req, res, next) => {
		const data = await getWeatherRegions();
		res.json({ success: true, count: data.length, data });
	})
);

router.get(
	"/weather/events",
	eventsLimiter,
	asyncHandler(async (_req, res, next) => {
		const { getWeatherEvents } = require("../modules/weather/weather.service");
		const data = await getWeatherEvents();
		res.json({ success: true, count: (data || []).length, data: data || [] });
	})
);

module.exports = router;
