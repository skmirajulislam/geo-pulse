const axios = require("axios");
const config = require("../../../../config/env.js");
const logger = require("../../../../utils/logger.js");

const NEWS_URL = "https://newsapi.org/v2/everything";

exports.fetchFromNewsAPI = async () => {
	try {
		logger.info("Fetching from NewsAPI...", "newsapi.fetcher");

		const res = await axios.get(NEWS_URL, {
			params: {
				q: "world OR global OR policy OR legislation OR reform OR breaking OR crisis OR diplomacy OR economy OR politics OR humanitarian OR military OR war OR attack OR assassination OR bombing OR invasion OR insurgency OR sanction OR negotiation OR summit OR alliance OR blockade OR coup OR election OR protest OR riot OR regime-change OR refugee OR cyberattack OR tradewar OR armsdeal OR business OR pandemic OR disaster OR environment",
				language: "en",
				sortBy: "publishedAt",
				pageSize: 50,
				apiKey: config.NEWS_API_KEY,
			},
		});

		const articles = res.data.articles || [];

		logger.info(
			`NewsAPI returned ${articles.length} articles`,
			"newsapi.fetcher",
		);

		return articles;
	} catch (err) {
		logger.error(`NewsAPI fetch failed: ${err.message}`, "newsapi.fetcher");

		return []; // fail gracefully
	}
};
