const logger = require("../../../../utils/logger.js");

exports.normalizeGDELT = (articles = []) => {
	logger.info("Normalizing GDELT data...", "gdelt.normalizer");

	const normalized = articles
		.filter((a) => a && a.title && a.url)
		.map((a) => {
			// GDELT seendate format: 20240418T133000Z
			let publishedAt = new Date().toISOString();
			if (a.seendate) {
				try {
					const year = a.seendate.substring(0, 4);
					const month = a.seendate.substring(4, 6);
					const day = a.seendate.substring(6, 8);
					const hour = a.seendate.substring(9, 11);
					const minute = a.seendate.substring(11, 13);
					const second = a.seendate.substring(13, 15);
					publishedAt = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
				} catch(e) {
					// fallback to current time
				}
			}

			return {
				title: a.title,
				description: a.title, // GDELT API returns minimal content, so we fallback to title
				url: a.url,
				source: a.domain || "GDELT Network",
				publishedAt: publishedAt,
			};
		});

	logger.info(
		`Normalized ${articles.length} → ${normalized.length}`,
		"gdelt.normalizer",
	);

	return normalized;
};
