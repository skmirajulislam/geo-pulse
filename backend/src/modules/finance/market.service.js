const axios = require("axios");
const logger = require("../../utils/logger");

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;

// Cache to prevent hitting the 5 calls/minute rate limit on Massive/Polygon basic tier
let marketCache = {
	data: null,
	timestamp: 0,
};

const CACHE_TTL_MS = 60 * 1000; // 1 minute

const TICKER_MAP = {
	SPY: { symbol: "SPX", name: "S&P 500" },
	USO: { symbol: "CL", name: "Crude Oil" },
	GLD: { symbol: "GC", name: "Gold" },
	UUP: { symbol: "DXY", name: "US Dollar Index" },
	"X:BTCUSD": { symbol: "BTC", name: "Bitcoin" },
};

/**
 * Fetches real-time(ish) daily market snapshots from Massive (Polygon) API.
 * Uses previous close/daily agg for stocks/ETFs, prioritizing the basic tier endpoints.
 */
exports.getRealMarketData = async () => {
	if (!MASSIVE_API_KEY) {
		logger.warn("MASSIVE_API_KEY is not set. Skipping real market data.", "market.service");
		return null;
	}

	// Return cached data if valid
	if (marketCache.data && Date.now() - marketCache.timestamp < CACHE_TTL_MS) {
		return marketCache.data;
	}

	try {
		logger.info("Fetching real market data from Massive API...", "market.service");
		const results = [];
		const tickers = Object.keys(TICKER_MAP);

		// Fetch all tickers concurrently. 
		// Polygon allows 5 requests per minute so 5 concurrent requests is the edge.
		const requests = tickers.map((t) =>
			axios
				.get(`https://api.massive.com/v2/aggs/ticker/${t}/prev?adjusted=true&apiKey=${MASSIVE_API_KEY}`, {
					timeout: 5000,
				})
				.catch((err) => {
					// Catch individual failures so one bad ticker doesn't fail them all
					logger.warn(`Failed to fetch market data for ${t}: ${err.message}`, "market.service");
					return null;
				})
		);

		const responses = await Promise.all(requests);

		responses.forEach((res, index) => {
			if (res && res.data && res.data.results && res.data.results.length > 0) {
				const agg = res.data.results[0];
				const rawTicker = tickers[index];
				const mapped = TICKER_MAP[rawTicker];
				
				// Calculate open-to-close change percentage
				const change = ((agg.c - agg.o) / agg.o) * 100;
				const direction = change > 0.05 ? "up" : change < -0.05 ? "down" : "stable";

				results.push({
					symbol: mapped.symbol,
					name: mapped.name,
					direction,
					changePct: parseFloat(change.toFixed(2)),
				});
			}
		});

		if (results.length > 0) {
			marketCache = {
				data: results,
				timestamp: Date.now(),
			};
			return results;
		}

		return null;
	} catch (err) {
		logger.error(`Error fetching from Massive API: ${err.message}`, "market.service");
		return null;
	}
};
