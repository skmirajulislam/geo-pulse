const logger = require("../../utils/logger");
const crypto = require("crypto");

const COUNTRY_MAP = {
	us: "United States",
	usa: "United States",
	uk: "United Kingdom",
	iran: "Iran",
	israel: "Israel",
	lebanon: "Lebanon",
	russia: "Russia",
	china: "China",
	gaza: "Gaza",
};

const COORDS_MAP = {
	"United States": [37.1, -95.7],
	"United Kingdom": [55.3, -3.4],
	Iran: [32.4, 53.7],
	Israel: [31.0, 35.0],
	Lebanon: [33.8, 35.8],
	Gaza: [31.5, 34.4],
	Russia: [61.5, 105.3],
	China: [35.8, 104.1],
};

const normalizeCountry = (country) => {
	if (!country) return "Global";
	return COUNTRY_MAP[country.toLowerCase()] || country;
};

const buildStableEventId = (event) => {
	const raw = `${event.url || ""}::${event.title || ""}::${event.country || "Global"}`;
	const hash = crypto.createHash("sha1").update(raw).digest("hex").slice(0, 12);
	return `evt_${hash}`;
};

exports.transformEvents = (events = []) => {
	logger.info("Transforming events...", "news.transformer");

	const transformed = events
		.map((e) => {
			const country = normalizeCountry(e.country);

			// 1. Prefer LLM's dynamic target-specific coordinates
			// 2. Fallback to broad static country mapping
			// 3. Handle nulls safely
			let coords = e.coordinates;
			if (!coords || !Array.isArray(coords) || coords.length !== 2) {
				coords = COORDS_MAP[country];
			}
			if (!coords || !Array.isArray(coords) || coords.length !== 2) {
				// Handle null/unmappable coordinates by giving generic default
				coords = [0, 0];
			}

			return {
				id: buildStableEventId(e),

				type: e.event_type,
				country,
				coords,

				severity: e.severity,
				confidence: e.confidence,
				timestamp: e.timestamp,

				title: e.title,
				description: e.description,

				sources: [
					{
						name: e.source,
						url: e.url,
					},
				],
			};
		})
		.filter(Boolean);

	logger.info(
		`Transformed ${events.length} → ${transformed.length}`,
		"news.transformer",
	);

	return transformed;
};
