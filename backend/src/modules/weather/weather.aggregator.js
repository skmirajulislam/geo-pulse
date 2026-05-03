const axios = require("axios");
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

exports.aggregateWeather = async () => {
	logger.info("Fetching native data from USGS and NASA EONET...", "weather.aggregator");

	const [usgsEvents, nasaEvents] = await Promise.all([
		fetchUSGS(),
		fetchEONET()
	]);

	const allEvents = [...usgsEvents, ...nasaEvents];

	logger.info(`Aggregated ${allEvents.length} total environmental payload events natively.`, "weather.aggregator");
	return allEvents;
};
