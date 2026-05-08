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
	{ id: "us-new_york", name: "New York", city: "New York", country: "United States", latitude: 40.7128, longitude: -74.0060 },
	{ id: "us-los_angeles", name: "Los Angeles", city: "Los Angeles", country: "United States", latitude: 34.0522, longitude: -118.2437 },
	{ id: "us-chicago", name: "Chicago", city: "Chicago", country: "United States", latitude: 41.8781, longitude: -87.6298 },
	{ id: "gb-london", name: "London", city: "London", country: "United Kingdom", latitude: 51.5074, longitude: -0.1278 },
	{ id: "fr-paris", name: "Paris", city: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
	{ id: "de-berlin", name: "Berlin", city: "Berlin", country: "Germany", latitude: 52.52, longitude: 13.405 },
	{ id: "ru-moscow", name: "Moscow", city: "Moscow", country: "Russia", latitude: 55.7558, longitude: 37.6173 },
	{ id: "cn-beijing", name: "Beijing", city: "Beijing", country: "China", latitude: 39.9042, longitude: 116.4074 },
	{ id: "jp-tokyo", name: "Tokyo", city: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 },
	{ id: "in-delhi", name: "New Delhi", city: "New Delhi", country: "India", latitude: 28.6139, longitude: 77.209 },
	{ id: "in-mumbai", name: "Mumbai", city: "Mumbai", country: "India", latitude: 19.076, longitude: 72.8777 },
	{ id: "ae-dubai", name: "Dubai", city: "Dubai", country: "United Arab Emirates", latitude: 25.2048, longitude: 55.2708 },
	{ id: "sg-singapore", name: "Singapore", city: "Singapore", country: "Singapore", latitude: 1.3521, longitude: 103.8198 },
	{ id: "au-sydney", name: "Sydney", city: "Sydney", country: "Australia", latitude: -33.8688, longitude: 151.2093 },
	{ id: "eg-cairo", name: "Cairo", city: "Cairo", country: "Egypt", latitude: 30.0444, longitude: 31.2357 },
	{ id: "ke-nairobi", name: "Nairobi", city: "Nairobi", country: "Kenya", latitude: -1.2921, longitude: 36.8219 },
	{ id: "ua-kyiv", name: "Kyiv", city: "Kyiv", country: "Ukraine", latitude: 50.4501, longitude: 30.5234 },
	{ id: "il-tel_aviv", name: "Tel Aviv", city: "Tel Aviv", country: "Israel", latitude: 32.0853, longitude: 34.7818 },
	{ id: "pk-islamabad", name: "Islamabad", city: "Islamabad", country: "Pakistan", latitude: 33.6844, longitude: 73.0479 },
	{ id: "br-brasilia", name: "Brasília", city: "Brasília", country: "Brazil", latitude: -15.8267, longitude: -47.9218 },
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
