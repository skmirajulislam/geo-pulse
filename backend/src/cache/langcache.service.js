/**
 * langcache.service.js — Redis LangCache semantic caching for LLM responses
 *
 * Uses the Redis LangCache REST API to avoid redundant LLM calls.
 * When the same (or semantically similar) prompt has been asked before,
 * the cached response is returned instantly without calling the LLM.
 *
 * Features:
 *   - Circuit breaker: disables itself after consecutive failures (DNS, network)
 *   - Configurable base URL via LANGCACHE_BASE_URL env var
 *   - Non-blocking: errors never stop the LLM pipeline
 *
 * API endpoints (Redis LangCache v1):
 *   POST /v1/caches/{cache_id}/entries/search  — semantic search
 *   POST /v1/caches/{cache_id}/entries          — store new entry
 */

const axios = require("axios");
const logger = require("../utils/logger");

// ---------- CONFIG ----------
const LANGCACHE_API_KEY = process.env.LANGCACHE_API_KEY || "";
const LANGCACHE_ID = process.env.LANGCACHE_ID || "";
const SIMILARITY_THRESHOLD = Number(process.env.LANGCACHE_SIMILARITY_THRESHOLD || 0.95);
const LANGCACHE_BASE_URL = process.env.LANGCACHE_BASE_URL || "";

// ---------- CIRCUIT BREAKER ----------
const CIRCUIT_BREAKER_THRESHOLD = 3;      // disable after N consecutive failures
const CIRCUIT_BREAKER_RESET_MS = 5 * 60 * 1000; // re-enable after 5 minutes

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

const isEnabled = () => {
	if (!LANGCACHE_API_KEY || !LANGCACHE_ID || !LANGCACHE_BASE_URL) return false;
	if (Date.now() < circuitOpenUntil) return false;
	return true;
};

const onSuccess = () => {
	consecutiveFailures = 0;
};

const onFailure = (err) => {
	consecutiveFailures++;
	if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
		circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_RESET_MS;
		logger.warn(
			`LangCache circuit OPEN — ${consecutiveFailures} consecutive failures. ` +
			`Disabling for ${CIRCUIT_BREAKER_RESET_MS / 1000}s. Last error: ${err.message}`,
			"langcache"
		);
	}
};

// Shared Axios instance (lazy — only created if base URL is set)
let client = null;
const getClient = () => {
	if (client) return client;
	if (!LANGCACHE_BASE_URL) return null;
	client = axios.create({
		baseURL: LANGCACHE_BASE_URL,
		timeout: 3000,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${LANGCACHE_API_KEY}`,
		},
	});
	return client;
};

// ---------- HELPERS ----------

/**
 * Build a single string key from an array of OpenAI-format messages.
 * We use the last user message as the primary semantic key,
 * prefixed with the system prompt hash for scope isolation.
 */
const buildPromptKey = (messages = []) => {
	const userMessages = messages.filter((m) => m.role === "user");
	const systemMsg = messages.find((m) => m.role === "system");

	// Primary: last user message content
	const lastUser = userMessages[userMessages.length - 1]?.content || "";

	// If there's a system prompt, include a truncated version for scope
	const systemPrefix = systemMsg
		? systemMsg.content.slice(0, 100).replace(/\s+/g, " ").trim()
		: "";

	return systemPrefix ? `[${systemPrefix}] ${lastUser}` : lastUser;
};

// ---------- PUBLIC API ----------

/**
 * Search the cache for a semantically similar prompt.
 * Returns the cached response string, or null if no match.
 */
const search = async (messages) => {
	if (!isEnabled()) return null;

	const http = getClient();
	if (!http) return null;

	try {
		const promptKey = buildPromptKey(messages);
		if (!promptKey) return null;

		const res = await http.post(
			`/v1/caches/${LANGCACHE_ID}/entries/search`,
			{
				prompt: promptKey,
				similarityThreshold: SIMILARITY_THRESHOLD,
				searchStrategies: ["semantic"],
			}
		);

		const results = res.data?.data || [];
		if (results.length > 0 && results[0].response) {
			const entry = results[0];
			onSuccess();
			logger.info(
				`LangCache HIT — similarity ${(entry.similarity || entry.score || 0).toFixed(3)}`,
				"langcache"
			);
			return {
				content: entry.response,
				cached: true,
				similarity: entry.similarity || entry.score || 0,
			};
		}

		onSuccess();
		return null;
	} catch (err) {
		// 404 = no match found (expected for cache miss)
		if (err.response?.status === 404) {
			onSuccess();
			return null;
		}
		// Network/DNS error — trigger circuit breaker
		onFailure(err);
		return null;
	}
};

/**
 * Store a prompt→response pair in the cache.
 */
const store = async (messages, response) => {
	if (!isEnabled()) return;

	const http = getClient();
	if (!http) return;

	try {
		const promptKey = buildPromptKey(messages);
		if (!promptKey || !response) return;

		await http.post(`/v1/caches/${LANGCACHE_ID}/entries`, {
			prompt: promptKey,
			response,
		});

		onSuccess();
		logger.info(
			`LangCache STORED — prompt (${promptKey.length} chars)`,
			"langcache"
		);
	} catch (err) {
		// Non-fatal — trigger circuit breaker
		onFailure(err);
	}
};

/**
 * Log the enabled/disabled status on startup.
 */
const logStatus = () => {
	if (!LANGCACHE_API_KEY || !LANGCACHE_ID) {
		logger.info(
			"LangCache disabled — LANGCACHE_API_KEY or LANGCACHE_ID not set",
			"langcache"
		);
	} else if (!LANGCACHE_BASE_URL) {
		logger.warn(
			"LangCache disabled — LANGCACHE_BASE_URL not set. " +
			"Get your endpoint URL from Redis Cloud dashboard → LangCache → API Endpoint.",
			"langcache"
		);
	} else {
		logger.info(
			`LangCache enabled — endpoint: ${LANGCACHE_BASE_URL} | cache ID: ${LANGCACHE_ID.slice(0, 8)}… | threshold: ${SIMILARITY_THRESHOLD}`,
			"langcache"
		);
	}
};

module.exports = {
	search,
	store,
	isEnabled,
	logStatus,
};
