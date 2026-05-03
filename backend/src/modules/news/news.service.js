const logger = require("../../utils/logger");
const { getCache } = require("../../cache/cache.service");

exports.getGeopoliticalEvents = async (targetDate) => {
	logger.info(`Request received: geopolitics${targetDate ? ` (Date: ${targetDate})` : ''}`, "news.service");

	const cached = await getCache(targetDate);

	if (cached) {
		logger.info("Returning cached data", "news.service");
		return cached;
	}

	// No cache available (rare case)
	logger.warn("No cache available yet", "news.service");

	return [];
};
