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

const BALANCED_REGIONS = [
	"Africa",
	"Asia",
	"Middle East",
	"Europe",
	"Americas",
	"Oceania",
	"Global",
];

const balanceByRegion = (articles = [], maxArticles = 120) => {
	const buckets = new Map(BALANCED_REGIONS.map((region) => [region, []]));
	const other = [];

	for (const article of articles) {
		const region = article.sourceRegion || "Global";
		if (buckets.has(region)) buckets.get(region).push(article);
		else other.push(article);
	}

	if (other.length) buckets.get("Global").push(...other);

	const selected = [];
	const selectedUrls = new Set();
	const perRegionTarget = Math.max(1, Math.floor(maxArticles / BALANCED_REGIONS.length));

	for (const region of BALANCED_REGIONS) {
		const bucket = buckets.get(region) || [];
		for (const article of bucket.slice(0, perRegionTarget)) {
			if (selected.length >= maxArticles) break;
			if (selectedUrls.has(article.url)) continue;
			selected.push(article);
			selectedUrls.add(article.url);
		}
	}

	let cursor = 0;
	while (selected.length < maxArticles) {
		const region = BALANCED_REGIONS[cursor % BALANCED_REGIONS.length];
		const bucket = buckets.get(region) || [];
		const next = bucket.find((article) => !selectedUrls.has(article.url));
		if (next) {
			selected.push(next);
			selectedUrls.add(next.url);
		}

		cursor += 1;
		if (cursor > BALANCED_REGIONS.length * maxArticles) break;
	}

	const counts = selected.reduce((acc, article) => {
		const region = article.sourceRegion || "Global";
		acc[region] = (acc[region] || 0) + 1;
		return acc;
	}, {});

	logger.info(`Balanced source regions: ${JSON.stringify(counts)}`, "news.aggregator");
	return selected;
};

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
		const dateA = new Date(a.publishedAt || a.published_at || a.timestamp || 0);
		const dateB = new Date(b.publishedAt || b.published_at || b.timestamp || 0);
		return dateB - dateA;
	});

	const bounded = balanceByRegion(deduped, maxArticles);

	logger.info(
		`Total aggregated articles: ${allArticles.length} → deduped ${deduped.length} → bounded ${bounded.length}`,
		"news.aggregator",
	);

	return bounded;
};
