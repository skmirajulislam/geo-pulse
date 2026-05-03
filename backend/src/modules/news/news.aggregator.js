const logger = require("../../utils/logger.js");

// Sources
const { fetchFromRSS } = require("./sources/rss/fetcher.js");
const { normalizeRSS } = require("./sources/rss/normalizer.js");

const { fetchFromNewsAPI } = require("./sources/newsapi/fetcher.js");
const { normalizeNewsAPI } = require("./sources/newsapi/normalizer.js");

const { fetchFromGDELT } = require("./sources/gdelt/fetcher.js");
const { normalizeGDELT } = require("./sources/gdelt/normalizer.js");

const { fetchFromGuardian } = require("./sources/guardian/fetcher.js");
const { normalizeGuardian } = require("./sources/guardian/normalizer.js");

exports.aggregateNews = async () => {
	logger.info("Starting news aggregation...", "news.aggregator");
	const maxArticles = Number(process.env.MAX_ARTICLES_PER_RUN || 120);

	let allArticles = [];

	// ---------- RSS ----------
	try {
		const raw = await fetchFromRSS();
		const normalized = normalizeRSS(raw);
		allArticles.push(...normalized);
	} catch (err) {
		logger.error("RSS pipeline failed", "news.aggregator");
	}

	// ---------- NewsAPI ----------
	try {
		const raw = await fetchFromNewsAPI();
		const normalized = normalizeNewsAPI(raw);
		allArticles.push(...normalized);
	} catch (err) {
		logger.error("NewsAPI pipeline failed", "news.aggregator");
	}

	// ---------- GDELT ----------
	try {
		const raw = await fetchFromGDELT();
		const normalized = normalizeGDELT(raw);
		allArticles.push(...normalized);
	} catch (err) {
		logger.error("GDELT pipeline failed", "news.aggregator");
	}

	// ---------- The Guardian ----------
	try {
		const raw = await fetchFromGuardian();
		const normalized = normalizeGuardian(raw);
		allArticles.push(...normalized);
	} catch (err) {
		logger.error("Guardian pipeline failed", "news.aggregator");
	}

	const deduped = [];
	const seenUrls = new Set();
	for (const article of allArticles) {
		if (!article?.url || seenUrls.has(article.url)) continue;
		seenUrls.add(article.url);
		deduped.push(article);
	}

	// Sort by published date descending (newest first) to ensure fresh news beats old news
	deduped.sort((a, b) => {
		const dateA = new Date(a.published_at || a.timestamp || 0);
		const dateB = new Date(b.published_at || b.timestamp || 0);
		return dateB - dateA;
	});

	const bounded = deduped.slice(0, maxArticles);

	logger.info(
		`Total aggregated articles: ${allArticles.length} → deduped ${deduped.length} → bounded ${bounded.length}`,
		"news.aggregator",
	);

	return bounded;
};
