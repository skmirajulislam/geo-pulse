const logger = require("../../../../utils/logger.js");

exports.normalizeGuardian = (articles = []) => {
	logger.info("Normalizing Guardian data...", "guardian.normalizer");

	const normalized = articles
		.filter((a) => a && a.webTitle && a.webUrl)
		.map((a) => ({
			title: a.fields?.headline || a.webTitle,
			description: a.fields?.standfirst || a.webTitle,
			url: a.webUrl,
			source: "The Guardian",
			publishedAt: a.webPublicationDate || new Date().toISOString(),
		}));

	logger.info(
		`Normalized ${articles.length} → ${normalized.length}`,
		"guardian.normalizer",
	);

	return normalized;
};
