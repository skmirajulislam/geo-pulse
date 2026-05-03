const axios  = require("axios");
const logger = require("../../utils/logger");
const { getCache } = require("../../cache/weatherCache.service");

/* ─────────────────────── legacy event feed ───────────────────────── */

exports.getWeatherEvents = async (targetDate) => {
	logger.info(`Request received: weather${targetDate ? ` (Date: ${targetDate})` : ""}`, "weather.service");

	const cached = await getCache(targetDate);

	if (cached) {
		logger.info("Returning cached data", "weather.service");
		return cached;
	}

	logger.warn("No cache available yet", "weather.service");
	return [];
};

/* ─────────────────────── curated region list ─────────────────────── */

const REGIONS = [
	{ id: "new_york",    name: "New York",       latitude:  40.7128, longitude:  -74.0060  },
	{ id: "london",      name: "London",          latitude:  51.5074, longitude:   -0.1278  },
	{ id: "paris",       name: "Paris",           latitude:  48.8566, longitude:    2.3522  },
	{ id: "berlin",      name: "Berlin",          latitude:  52.5200, longitude:   13.4050  },
	{ id: "moscow",      name: "Moscow",          latitude:  55.7558, longitude:   37.6173  },
	{ id: "beijing",     name: "Beijing",         latitude:  39.9042, longitude:  116.4074  },
	{ id: "tokyo",       name: "Tokyo",           latitude:  35.6762, longitude:  139.6503  },
	{ id: "delhi",       name: "New Delhi",       latitude:  28.6139, longitude:   77.2090  },
	{ id: "mumbai",      name: "Mumbai",          latitude:  19.0760, longitude:   72.8777  },
	{ id: "dubai",       name: "Dubai",           latitude:  25.2048, longitude:   55.2708  },
	{ id: "singapore",   name: "Singapore",       latitude:   1.3521, longitude:  103.8198  },
	{ id: "sydney",      name: "Sydney",          latitude: -33.8688, longitude:  151.2093  },
	{ id: "cairo",       name: "Cairo",           latitude:  30.0444, longitude:   31.2357  },
	{ id: "nairobi",     name: "Nairobi",         latitude:  -1.2921, longitude:   36.8219  },
	{ id: "kyiv",        name: "Kyiv",            latitude:  50.4501, longitude:   30.5234  },
	{ id: "tel_aviv",    name: "Tel Aviv",        latitude:  32.0853, longitude:   34.7818  },
	{ id: "islamabad",   name: "Islamabad",       latitude:  33.6844, longitude:   73.0479  },
	{ id: "brasilia",    name: "Brasília",        latitude: -15.8267, longitude:  -47.9218  },
	{ id: "los_angeles", name: "Los Angeles",     latitude:  34.0522, longitude: -118.2437  },
	{ id: "chicago",     name: "Chicago",         latitude:  41.8781, longitude:  -87.6298  },
];

exports.getWeatherRegions = async () => {
	logger.info("Returning curated weather regions list", "weather.service");
	return REGIONS;
};

/* ────────────────────── Open-Meteo forecast ──────────────────────── */
// Open-Meteo is free, no API key required.

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

// Build the query params Open-Meteo expects
const buildParams = ({ latitude, longitude, days, hourly }) => ({
	latitude,
	longitude,
	current: [
		"temperature_2m",
		"relative_humidity_2m",
		"wind_speed_10m",
		"precipitation_probability",
		"weather_code",
	].join(","),
	hourly: hourly || "temperature_2m",
	forecast_days: Math.min(Math.max(Number(days) || 7, 1), 16),
	timezone: "auto",
});

exports.getWeatherForecast = async ({ latitude, longitude, days = 7, hourly = "temperature_2m" }) => {
	logger.info(`Fetching Open-Meteo forecast for (${latitude}, ${longitude}) — ${days}d`, "weather.service");

	try {
		const res = await axios.get(OPEN_METEO_BASE, {
			params: buildParams({ latitude, longitude, days, hourly }),
			timeout: 12000,
		});

		const d = res.data;

		return {
			current: d.current     ?? null,
			hourly:  d.hourly      ?? null,
			units:   d.current_units ?? {},
		};
	} catch (err) {
		logger.error(`Open-Meteo fetch failed: ${err.message}`, "weather.service");
		throw err;
	}
};
