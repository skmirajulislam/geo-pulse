const axios = require("axios");
const logger = require("../../../../utils/logger.js");

const GDELT_API_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

exports.fetchFromGDELT = async () => {
	try {
		logger.info("Fetching from GDELT...", "gdelt.fetcher");

		const res = await axios.get(GDELT_API_URL, {
			params: {
				query: '(war OR military OR diplomacy OR politics OR election OR sanctions OR crisis OR attack OR disaster OR protest) sourcelang:eng',
				mode: "artlist",
				format: "json",
				maxrecords: 50,
				sort: "DateDesc"
			},
		});

		const articles = res.data.articles || [];

		logger.info(
			`GDELT returned ${articles.length} articles`,
			"gdelt.fetcher",
		);

		return articles;
	} catch (err) {
		logger.error(`GDELT fetch failed: ${err.message}`, "gdelt.fetcher");

		return []; // fail gracefully
	}
};
