const logger = require("../../utils/logger.js");

// Geopolitical keywords (must match at least one)
const WHITELIST = [
	// Armed conflict
	"war",
	"military",
	"conflict",
	"attack",
	"bombing",
	"troops",
	"invasion",
	"coup",
	"missile",
	"drone",
	"airstrike",
	"ceasefire",
	"nuclear",
	"terror",
	"violence",
	"clashes",
	"insurgent",
	"rebel",
	"militia",
	"ambush",
	"shelling",
	"artillery",
	"offensive",
	"siege",
	"hostage",
	"kidnap",
	"assassination",
	"explosive",

	// Diplomacy & politics
	"sanctions",
	"diplomacy",
	"diplomatic",
	"treaty",
	"summit",
	"alliance",
	"embargo",
	"blockade",
	"geopolitic",
	"nato",
	"united nations",
	"security council",
	"foreign minister",
	"defense minister",
	"prime minister",
	"president",
	"election",
	"referendum",
	"parliament",
	"authoritarian",
	"regime",
	"opposition",

	// Unrest & humanitarian
	"protest",
	"uprising",
	"riot",
	"crackdown",
	"martial law",
	"curfew",
	"refugee",
	"humanitarian",
	"crisis",
	"famine",
	"displacement",
	"evacuation",

	// Intelligence & cyber
	"espionage",
	"spy",
	"intelligence",
	"cyber attack",
	"hacking",
	"surveillance",

	// Trade & economic warfare
	"trade war",
	"tariff",
	"arms deal",
	"weapons",
	"defense",
	"defence",
];

// Non-geopolitical keywords (reject if ONLY these appear)
const BLACKLIST = [
	"celebrity gossip",
	"box office",
	"sports score",
	"recipe",
	"reality tv",
	"horoscope",
	"dating",
	"workout",
	"diet",
	"smartphone",
	"gadget",
	"gaming",
	"app update",
	"esports"
];

// Normalize text safely
const normalizeText = (text) => {
	return (text || "").toLowerCase();
};

// Keyword match helper
const containsKeyword = (text, keywords) => {
	return keywords.some((keyword) => text.includes(keyword));
};

// Main pre-filter function
exports.preFilter = (articles = []) => {
	logger.info("Running pre-filter...", "news.preFilter");

	if (!Array.isArray(articles) || articles.length === 0) {
		logger.warn("No articles received for filtering", "news.preFilter");
		return [];
	}

	const filtered = articles.filter((article) => {
		// ❌ Reject invalid structure early
		if (!article || !article.title || !article.description) {
			return false;
		}

		const title = normalizeText(article.title);
		const description = normalizeText(article.description);

		const combinedText = `${title} ${description}`;

		const hasWhitelist = containsKeyword(combinedText, WHITELIST);
		const hasBlacklist = containsKeyword(combinedText, BLACKLIST);

		// Final decision
		return hasWhitelist && !hasBlacklist;
	});

	logger.info(
		`Filtered ${articles.length} → ${filtered.length}`,
		"news.preFilter",
	);

	return filtered;
};
