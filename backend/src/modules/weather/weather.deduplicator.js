const logger = require("../../utils/logger");
const stringSimilarity = require("string-similarity");

const isSameEvent = (a, b) => {
	const sameCountry = a.country === b.country;
	const sameType = a.type === b.type;

	const timeDiff =
		Math.abs(new Date(a.timestamp) - new Date(b.timestamp)) /
		(1000 * 60 * 60);

	const similarity = stringSimilarity.compareTwoStrings(
		a.title.toLowerCase(),
		b.title.toLowerCase(),
	);

	return sameCountry && sameType && timeDiff < 3 && similarity > 0.3;
};

exports.deduplicateEvents = (events = []) => {
	logger.info("Deduplicating events...", "news.deduplicator");

	const merged = [];

	for (const event of events) {
		let found = false;

		for (const existing of merged) {
			if (isSameEvent(event, existing)) {
				existing.sources = existing.sources || [];
				if (Array.isArray(event.sources)) {
					existing.sources.push(...event.sources);
				}

				existing.severity = Math.max(existing.severity, event.severity);

				existing.confidence =
					(existing.confidence + event.confidence) / 2;

				found = true;
				break;
			}
		}

		if (!found) {
			merged.push({ ...event });
		}
	}

	logger.info(
		`Deduplicated ${events.length} → ${merged.length}`,
		"news.deduplicator",
	);

	return merged;
};
