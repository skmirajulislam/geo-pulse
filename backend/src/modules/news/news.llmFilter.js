const logger = require("../../utils/logger");
const { queryLLM } = require("../../config/llm");

// ---------- EXPANDED EVENT TYPES ----------
const ALLOWED_TYPES = [
	// Armed conflict
	"airstrike",
	"attack",
	"battle",
	"conflict",
	"military",
	"war",
	"clash",
	"bombing",
	"shelling",
	"invasion",
	"siege",
	"insurgency",
	"assassination",
	"ambush",
	"hostage",

	// Geopolitics & diplomacy
	"sanction",
	"diplomacy",
	"negotiation",
	"threat",
	"operation",
	"tension",
	"summit",
	"treaty",
	"alliance",
	"embargo",
	"blockade",
	"espionage",

	// Political events
	"coup",
	"election",
	"protest",
	"uprising",
	"riot",
	"crackdown",
	"referendum",
	"regime change",
	"rebellion",
	"strike",

	// Humanitarian
	"crisis",
	"humanitarian",
	"refugee",
	"displacement",
	"famine",
	"evacuation",
	"mass-death",

	// Cyber & intelligence
	"cyberattack",
	"hacking",
	"surveillance",

	// Trade & economic
	"tradewar",
	"tariff",
	"armsdeal",
	"economy",
	"business",

	// Health, Environment & Politics
	"pandemic",
	"disaster",
	"environment",
	"politics",
];

// ---------- MAJOR EVENT DETECTOR ----------
const isMajorEvent = (title = "") => {
	const keywords = [
		// Conflict & geopolitics
		"war", "blockade", "nuclear", "sanction", "military", "attack",
		"strike", "ceasefire", "troops", "missile", "invasion", "crisis",
		"coup", "bomb", "killed", "dead", "explosion", "shoot", "terror",
		"rebellion",

		// Major globally impactful terms
		"economy", "market", "breaking", "emergency", "disaster", "earthquake",
		"pandemic", "election", "scandal", "breakthrough", "historic", "global",
		"mass-death", "policy", "legislation", "reform", "law", "government"
	];

	const lower = title.toLowerCase();
	return keywords.some((k) => lower.includes(k));
};

// ---------- PROMPT ----------
const buildPrompt = (articles) => {
	const formatted = articles
		.map((a, i) => {
			return `ARTICLE ${i}:
TITLE: ${a.title}
DESCRIPTION: ${a.description}`;
		})
		.join("\n\n");

	return `You are a global intelligence and major world news classifier. Your job is to identify important, impactful news articles related to:
- Geopolitics: Armed conflicts, diplomacy, politics, humanitarian crises, terrorism
- Major policy changes, impactful legislation, sweeping reforms, and significant government rulings
- Major global events, natural disasters, environmental crises
- Major economic, financial, or business shifts

Be HIGHLY INCLUSIVE of any major news involving the world and people. 
CRITICAL: Do NOT over-filter! Only exclude literal consumer product reviews/gadgets, sports scores, and celebrity gossip. If it is a real news event, include it!

Return EXACTLY ${articles.length} JSON objects in an array (same order as input).

Each object:
{
  "relevant": true/false,
  "event_type": "string (e.g. conflict, diplomacy, election, disaster, economy, pandemic, crisis, politics, etc.)",
  "country": "string (The physical country WHERE the event took place, or Global)",
  "coordinates": "[latitude, longitude] array of numbers (The exact geographical [lat, lng] coordinates of the event's location. Extremely important for map placement! Approx city center if exact target unknown. Use null only if purely digital/global)",
  "severity": 1-5,
  "confidence": 0.0-1.0
}

Rules:
- Return ONLY the JSON array, no explanation
- Do not skip any article
- Do not reorder articles
- If it is pure consumer tech (smartphones/gadgets), gossip, or literal sports scores → { "relevant": false }
- Default to "relevant": true for almost any real news article. Be highly permissive.

Articles:
${formatted}`;
};

// ---------- JSON EXTRACTION ----------
const extractJSON = (text) => {
	try {
		const match = text.match(/\[[\s\S]*\]/);
		if (!match) return null;
		return JSON.parse(match[0]);
	} catch {
		return null;
	}
};

const normalizeEventType = (type) =>
	type.toLowerCase().replace(/[\s_-]+/g, "");

const cleanCountry = (country) => {
	if (!country) return "Global";

	const cleaned = country.split(/[;,]/)[0].trim();
	return cleaned || "Global";
};

const COUNTRY_HINTS = [
	{ country: "India", coords: [20.5937, 78.9629], terms: ["india", "new delhi", "delhi", "mumbai", "kashmir", "modi"] },
	{ country: "Pakistan", coords: [30.3753, 69.3451], terms: ["pakistan", "islamabad", "lahore", "karachi"] },
	{ country: "Bangladesh", coords: [23.685, 90.3563], terms: ["bangladesh", "dhaka"] },
	{ country: "Sri Lanka", coords: [7.8731, 80.7718], terms: ["sri lanka", "colombo"] },
	{ country: "Nepal", coords: [28.3949, 84.124], terms: ["nepal", "kathmandu"] },
	{ country: "Myanmar", coords: [21.9162, 95.956], terms: ["myanmar", "yangon", "naypyidaw"] },
	{ country: "Afghanistan", coords: [33.9391, 67.71], terms: ["afghanistan", "kabul", "taliban"] },
	{ country: "China", coords: [35.8617, 104.1954], terms: ["china", "beijing", "taiwan"] },
	{ country: "Russia", coords: [61.524, 105.3188], terms: ["russia", "moscow", "kremlin"] },
	{ country: "Ukraine", coords: [48.3794, 31.1656], terms: ["ukraine", "kyiv", "zelensky"] },
	{ country: "Israel", coords: [31.0461, 34.8516], terms: ["israel", "jerusalem", "tel aviv"] },
	{ country: "Gaza", coords: [31.5017, 34.4668], terms: ["gaza", "hamas"] },
	{ country: "Iran", coords: [32.4279, 53.688], terms: ["iran", "tehran"] },
	{ country: "United States", coords: [37.0902, -95.7129], terms: ["united states", "u.s.", "us ", "america", "washington"] },
	{ country: "United Kingdom", coords: [55.3781, -3.436], terms: ["united kingdom", "uk ", "britain", "london"] },
];

const EVENT_TYPE_HINTS = [
	{ event_type: "conflict", severity: 4, terms: ["war", "attack", "missile", "bomb", "military", "troops", "ceasefire", "clash"] },
	{ event_type: "diplomacy", severity: 3, terms: ["diplomacy", "summit", "talks", "treaty", "foreign minister"] },
	{ event_type: "politics", severity: 3, terms: ["election", "parliament", "government", "minister", "court", "law", "policy"] },
	{ event_type: "crisis", severity: 4, terms: ["crisis", "refugee", "humanitarian", "famine", "displacement"] },
	{ event_type: "economy", severity: 3, terms: ["tariff", "sanction", "economy", "trade", "market", "business"] },
	{ event_type: "disaster", severity: 4, terms: ["earthquake", "flood", "cyclone", "storm", "wildfire", "disaster"] },
	{ event_type: "cyberattack", severity: 3, terms: ["cyber", "hack", "ransomware", "surveillance"] },
];

const includesAny = (text, terms) => terms.some((term) => text.includes(term));

const buildHeuristicEvent = (article) => {
	const text = `${article.title || ""} ${article.description || ""}`.toLowerCase();
	const countryHint = COUNTRY_HINTS.find((hint) => includesAny(text, hint.terms));
	const typeHint = EVENT_TYPE_HINTS.find((hint) => includesAny(text, hint.terms));

	if (!countryHint && !typeHint && !isMajorEvent(article.title || "")) return null;

	return {
		event_type: typeHint?.event_type || "politics",
		country: countryHint?.country || "Global",
		coordinates: countryHint?.coords || null,
		severity: typeHint?.severity || 2,
		confidence: countryHint || typeHint ? 0.55 : 0.4,
		title: article.title,
			description: article.description,
			source: article.source,
			sourceRegion: article.sourceRegion,
			url: article.url,
		timestamp: new Date(article.publishedAt || Date.now()).toISOString(),
	};
};

// ---------- MAIN ----------
exports.llmFilter = async (articles = []) => {
	logger.info("Running LLM filter...", "news.llmFilter");

	const BATCH_SIZE = Number(process.env.LLM_BATCH_SIZE || 5);
	const MAX_LLM_CALLS = Number(process.env.MAX_LLM_CALLS_PER_RUN || 30);
	const MIN_CONFIDENCE = Number(process.env.LLM_CONFIDENCE_THRESHOLD || 0.35);
	const results = [];
	let llmCalls = 0;

	for (let i = 0; i < articles.length; i += BATCH_SIZE) {
		if (llmCalls >= MAX_LLM_CALLS) {
			logger.warn("LLM call budget reached. Skipping remaining batches.", "news.llmFilter");
			break;
		}

		const batch = articles.slice(i, i + BATCH_SIZE);

		try {
			const prompt = buildPrompt(batch);

			llmCalls += 1;
			let raw = await queryLLM(prompt);
			let parsed = extractJSON(raw);

			if (!parsed && llmCalls < MAX_LLM_CALLS) {
				llmCalls += 1;
				raw = await queryLLM(prompt);
				parsed = extractJSON(raw);
			}

			if (!parsed || !Array.isArray(parsed)) {
				throw new Error("Invalid LLM response");
			}

			batch.forEach((original, idx) => {
				const item = parsed[idx];

				if (!item || !item.relevant || !item.event_type) {
					return;
				}

				// Lower threshold: only skip non-major events with very low confidence
				if (!isMajorEvent(original.title) && item.confidence < MIN_CONFIDENCE) {
					return;
				}

				const type = normalizeEventType(item.event_type);

				// Accept the event even if type isn't in our list — use LLM's type as-is
				results.push({
					event_type: type,
					country: cleanCountry(item.country),
					coordinates: Array.isArray(item.coordinates) && item.coordinates.length === 2 && typeof item.coordinates[0] === "number" ? item.coordinates : null,
					severity: Math.min(Math.max(item.severity || 2, 1), 5),
					confidence: Math.min(
						Math.max(item.confidence || 0.6, 0),
						1,
					),

					title: original.title,
					description: original.description,
					source: original.source,
					sourceRegion: original.sourceRegion,
					url: original.url,
					timestamp: new Date(original.publishedAt).toISOString(),
				});
			});
		} catch (err) {
			logger.error("LLM batch failed; using heuristic fallback", "news.llmFilter");
			batch.forEach((article) => {
				const fallback = buildHeuristicEvent(article);
				if (fallback) results.push(fallback);
			});
		}
	}

	logger.info(
		`LLM processed ${articles.length} → ${results.length} (calls: ${llmCalls}/${MAX_LLM_CALLS})`,
		"news.llmFilter",
	);

	return results;
};
