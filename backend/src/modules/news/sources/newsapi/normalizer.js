const logger = require("../../../../utils/logger.js");

exports.normalizeNewsAPI = (articles = []) => {
	logger.info("Normalizing NewsAPI data...", "newsapi.normalizer");

	const normalized = articles
		.filter((a) => a && a.title && a.description && a.url)
		.map((a) => ({
			title: a.title,
			description: a.description,
			url: a.url,
			source: a.source?.name || "unknown",
			publishedAt: a.publishedAt,
		}));

	logger.info(
		`Normalized ${articles.length} → ${normalized.length}`,
		"newsapi.normalizer",
	);

	return normalized;
};
