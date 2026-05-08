const axios = require("axios");
const Parser = require("rss-parser");
const logger = require("../../utils/logger");

// Normalized Schema expected by rest of pipeline:
// {
// 	id: string,
// 	type: string,
// 	country: string,
// 	coords: [lat, lng],
// 	severity: number (1-5),
// 	confidence: number (0.0-1.0),
// 	title: string,
// 	description: string,
// 	url: string,
// 	timestamp: ISOString
// }

const gdacsParser = new Parser({
	requestOptions: {
		headers: {
			"User-Agent": "GeoPulse/1.0 (+https://github.com/skmirajulislam/geo-pulse)",
		},
	},
	customFields: {
		item: [
			["georss:point", "geoPoint"],
			["gdacs:eventtype", "eventType"],
			["gdacs:alertlevel", "alertLevel"],
			["gdacs:severity", "severityRaw"],
			["dc:subject", "subject"],
		],
	},
});

const inferCountryFromText = (text = "") => {
	const cleaned = String(text).trim();
	if (!cleaned) return "Global";
	const inMatch = cleaned.match(/\sin\s([^,]+?)(?:\s\d{2}\/\d{2}\/\d{4}|,|$)/i);
	if (inMatch?.[1]) return inMatch[1].trim();
	const commaParts = cleaned.split(",");
	return commaParts.length > 1 ? commaParts[commaParts.length - 1].trim() : "Global";
};

const parseGeoPoint = (geoPoint) => {
	if (!geoPoint || typeof geoPoint !== "string") return null;
	const parts = geoPoint.trim().split(/\s+/).map(Number);
	if (parts.length < 2) return null;
	const [lat, lng] = parts;
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
	return [lat, lng];
};

const mapGdacsType = (eventType, subject, title = "") => {
	const code = String(eventType || subject || "").toUpperCase();
	const t = String(title).toLowerCase();
	if (code.includes("EQ") || t.includes("earthquake")) return "earthquake";
	if (code.includes("TC") || t.includes("cyclone") || t.includes("storm") || t.includes("hurricane") || t.includes("typhoon")) return "storm";
	if (code.includes("FL") || t.includes("flood")) return "flood";
	if (code.includes("WF") || t.includes("wildfire")) return "wildfire";
	if (code.includes("VO") || t.includes("volcano")) return "volcano";
	if (code.includes("DR") || t.includes("drought")) return "drought";
	return "weather";
};

const mapGdacsAlertSeverity = (alertLevel = "") => {
	const level = String(alertLevel).toLowerCase();
	if (level === "red") return 5;
	if (level === "orange") return 4;
	if (level === "yellow") return 3;
	return 2; // green/unknown
};

const mapGdacsConfidence = (alertLevel = "") => {
	const level = String(alertLevel).toLowerCase();
	if (level === "red") return 0.95;
	if (level === "orange") return 0.9;
	if (level === "yellow") return 0.8;
	return 0.7;
};

const isValuableEvent = (event) => {
	if (!event || !event.id || !event.title || !event.type) return false;
	if (!Array.isArray(event.coords) || event.coords.length !== 2) return false;
	if (!Array.isArray(event.sources) || event.sources.length === 0 || !event.sources[0]?.url) return false;
	if (!Number.isFinite(event.severity) || event.severity < 2) return false;
	if (!Number.isFinite(event.confidence) || event.confidence < 0.6) return false;

	const ts = Date.parse(event.timestamp);
	if (Number.isNaN(ts)) return false;

	// Keep feed high-signal and timely
	const ageMs = Date.now() - ts;
	if (ageMs > 7 * 24 * 60 * 60 * 1000) return false;
	return true;
};

const dedupeByIdOrTitle = (events = []) => {
	const seen = new Set();
	const out = [];
	for (const e of events) {
		const key = `${e.id}::${String(e.title).toLowerCase().slice(0, 120)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(e);
	}
	return out;
};

const fetchUSGS = async () => {
	try {
		// Fetch 4.5+ magnitude earthquakes from the past day
		const res = await axios.get("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson", { timeout: 10000 });
		const features = res.data.features || [];

		return features.map((feature) => {
			const props = feature.properties;
			const geom = feature.geometry;
			
			// USGS returns [longitude, latitude, depth]
			const lng = geom.coordinates[0];
			const lat = geom.coordinates[1];
			
			// Map magnitude to our 1-5 severity scale
			let severity = 2;
			if (props.mag >= 7.0) severity = 5;
			else if (props.mag >= 6.0) severity = 4;
			else if (props.mag >= 5.0) severity = 3;

			// Extract country rough string from "M 5.2 - 20 km W of City, Country"
			let country = "Global";
			if (props.place && props.place.includes(", ")) {
				country = props.place.split(", ").pop()?.trim() || "Global";
			}

			return {
				id: feature.id,
				type: "earthquake",
				country,
				coords: [lat, lng],
				severity,
				confidence: 1.0, 
				title: props.title,
				description: `USGS Earthquake Event: Magnitude ${props.mag} near ${props.place}. Depth: ${geom.coordinates[2]}km.`,
				sources: [
					{
						name: "USGS Earthquake Hazards Tracker",
						url: props.url,
					}
				],
				timestamp: new Date(props.time).toISOString()
			};
		});
	} catch (err) {
		logger.error(`USGS Fetch Failed: ${err.message}`, "weather.aggregator");
		return [];
	}
};

const fetchEONET = async () => {
	try {
		// Fetch all open events tracked by NASA
		const res = await axios.get("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=3", { timeout: 10000 });
		const events = res.data.events || [];

		return events.map((event) => {
			const category = event.categories[0]?.id || "weather"; 
			// NASA mapping: severeStorms -> storm, wildfires -> wildfire, volcanoes -> volcano
			let mappedType = "weather";
			if (category.toLowerCase().includes("storm")) mappedType = "storm";
			if (category.toLowerCase().includes("fire")) mappedType = "wildfire";
			if (category.toLowerCase().includes("volcano")) mappedType = "volcano";
			if (category.toLowerCase().includes("flood")) mappedType = "flood";
			if (category.toLowerCase().includes("ice")) mappedType = "blizzard";
			if (category.toLowerCase().includes("drought")) mappedType = "drought";

			// Get the most recent geometry coordinate (EONET returns [lng, lat])
			let lat = null;
			let lng = null;
			if (event.geometry && event.geometry.length > 0) {
				const recentGeom = event.geometry[event.geometry.length - 1];
				if (recentGeom.type === "Point") {
					lng = recentGeom.coordinates[0];
					lat = recentGeom.coordinates[1];
				}
			}

			// EONET usually doesn't provide severity mapping natively, defaulting to 3
			const severity = 3; 

			return {
				id: event.id,
				type: mappedType,
				country: "Global",
				coords: lat && lng ? [lat, lng] : null,
				severity,
				confidence: 1.0,
				title: event.title,
				description: `NASA EONET Active Event: ${event.title}`,
				sources: [
					{
						name: "NASA EONET",
						url: event.sources?.[0]?.url || "https://eonet.gsfc.nasa.gov/",
					}
				],
				timestamp: event.geometry?.[0]?.date || new Date().toISOString()
			};
		}).filter(e => e.coords !== null); // Drop if no coords
	} catch (err) {
		logger.error(`NASA EONET Fetch Failed: ${err.message}`, "weather.aggregator");
		return [];
	}
};

const fetchGDACS = async () => {
	try {
		const perFeedLimit = Math.max(10, Math.min(120, Number(process.env.WEATHER_GDACS_LIMIT || 80)));
		const feed = await gdacsParser.parseURL("https://www.gdacs.org/xml/rss.xml");
		const items = (feed.items || []).slice(0, perFeedLimit);

		return items
			.map((item) => {
				const coords = parseGeoPoint(item.geoPoint);
				if (!coords) return null;

				const type = mapGdacsType(item.eventType, item.subject, item.title);
				const severity = mapGdacsAlertSeverity(item.alertLevel);
				const confidence = mapGdacsConfidence(item.alertLevel);
				const title = String(item.title || "").trim();
				const description = String(item.contentSnippet || item.content || title).slice(0, 500);
				const timestamp = item.isoDate || item.pubDate || new Date().toISOString();

				return {
					id: item.guid || `${item.eventType || "GDACS"}-${timestamp}`,
					type,
					country: inferCountryFromText(title),
					coords,
					severity,
					confidence,
					title,
					description,
					sources: [
						{
							name: "GDACS",
							url: item.link || "https://www.gdacs.org/",
						},
					],
					timestamp: new Date(timestamp).toISOString(),
				};
			})
			.filter(Boolean);
	} catch (err) {
		logger.error(`GDACS Fetch Failed: ${err.message}`, "weather.aggregator");
		return [];
	}
};

exports.aggregateWeather = async () => {
	logger.info("Fetching trusted natural-event sources (USGS, NASA EONET, GDACS)...", "weather.aggregator");

	const [usgsEvents, nasaEvents, gdacsEvents] = await Promise.all([
		fetchUSGS(),
		fetchEONET(),
		fetchGDACS(),
	]);

	const allEvents = [...usgsEvents, ...nasaEvents, ...gdacsEvents];
	const valuableEvents = dedupeByIdOrTitle(allEvents).filter(isValuableEvent);

	logger.info(
		`Aggregated weather events: raw=${allEvents.length}, kept=${valuableEvents.length}`,
		"weather.aggregator"
	);
	return valuableEvents;
};
