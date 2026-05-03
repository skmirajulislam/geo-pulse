const axios = require("axios");
const config = require("../../../../config/env.js");
const logger = require("../../../../utils/logger.js");

const GUARDIAN_API_URL = "https://content.guardianapis.com/search";

exports.fetchFromGuardian = async () => {
	try {
		logger.info("Fetching from The Guardian...", "guardian.fetcher");

		const res = await axios.get(GUARDIAN_API_URL, {
			params: {
				q: "world OR global OR policy OR diplomacy OR economy OR politics OR crisis OR war",
				section: "world",
				"show-fields": "standfirst,headline,shortUrl",
				"page-size": 50,
				"order-by": "newest",
				"api-key": process.env.GUARDIAN_API_KEY || "test", // 'test' works for low-traffic dev
			},
		});

		const articles = res.data?.response?.results || [];

		logger.info(
			`The Guardian returned ${articles.length} articles`,
			"guardian.fetcher",
		);

		return articles;
	} catch (err) {
		logger.error(`The Guardian fetch failed: ${err.message}`, "guardian.fetcher");

		return []; // fail gracefully
	}
};
