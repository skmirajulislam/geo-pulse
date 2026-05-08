/**
 * llm.js — Multi-provider LLM with automatic failover and multi-key rotation
 *
 * Supports Groq (OpenAI-compatible) and Google Gemini.
 * Rotates through multiple Groq keys. If all Groq keys are exhausted,
 * it instantly falls back to rotating through multiple Gemini keys.
 * Tracks cooldown periods per-key.
 */

const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../utils/logger");
const langcache = require("../cache/langcache.service");

// ---------- CONFIG ----------
const rawGroqKeys = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "";

const rawGeminiKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const PLACEHOLDER_PATTERNS = ["your_", "xxx", "placeholder", "changeme", "todo"];
const isUsableApiKey = (key = "") => {
	const value = key.trim();
	if (!value) return false;
	return !PLACEHOLDER_PATTERNS.some((pattern) => value.toLowerCase().includes(pattern));
};

const groqKeys = rawGroqKeys.split(",").map(k => k.trim()).filter(isUsableApiKey);
const geminiKeys = rawGeminiKeys.split(",").map(k => k.trim()).filter(isUsableApiKey);

const GROQ_MODEL = process.env.LLM_MODEL || "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const LLM_TIMEOUT = Number(process.env.LLM_TIMEOUT || 30000);
const KEY_USAGE_SWITCH_THRESHOLD = Number(process.env.LLM_KEY_USAGE_SWITCH_THRESHOLD || 0.8);

// Cooldown: how long (ms) to skip an API key after a quota error (default 60s)
const QUOTA_COOLDOWN_MS = Number(process.env.LLM_QUOTA_COOLDOWN_MS || 60000);

// ---------- STATE & CLIENTS ----------
// Store state per type per key
const pool = {
	groq: groqKeys.map((key, idx) => ({
		id: `Groq-${idx + 1}`,
		client: new OpenAI({
			apiKey: key,
			baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
			timeout: LLM_TIMEOUT,
		}),
		cooldownUntil: 0,
		provider: "groq",
		model: GROQ_MODEL,
	})),
	gemini: geminiKeys.map((key, idx) => ({
		id: `Gemini-${idx + 1}`,
		client: new GoogleGenerativeAI(key),
		cooldownUntil: 0,
		provider: "gemini",
		model: GEMINI_MODEL,
	})),
};

// State to track which key we used last (round-robin)
let currentGroqIndex = 0;
let currentGeminiIndex = 0;

// ---------- HELPERS ----------
const isQuotaError = (err) => {
	const status = err?.status || err?.response?.status || err?.code;
	const msg = (err?.message || "").toLowerCase();
	return (
		status === 429 ||
		status === 503 ||
		msg.includes("rate limit") ||
		msg.includes("quota") ||
		msg.includes("resource exhausted") ||
		msg.includes("too many requests")
	);
};

const markKeyExhausted = (poolObject) => {
	poolObject.cooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
	logger.warn(
		`[llm-pool] Key "${poolObject.id}" quota exhausted — cooldown for ${QUOTA_COOLDOWN_MS / 1000}s`,
		"llm"
	);
};

const parseResetMs = (value) => {
	if (!value) return QUOTA_COOLDOWN_MS;
	const text = String(value).trim().toLowerCase();
	const numeric = Number(text.replace(/[^0-9.]/g, ""));
	if (!Number.isFinite(numeric)) return QUOTA_COOLDOWN_MS;
	if (text.includes("ms")) return numeric;
	if (text.includes("s")) return numeric * 1000;
	if (text.includes("m")) return numeric * 60 * 1000;
	if (text.includes("h")) return numeric * 60 * 60 * 1000;
	return numeric * 1000;
};

const readNumericHeader = (headers, names = []) => {
	for (const name of names) {
		const value = headers?.get?.(name);
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
};

const updateKeyUsageFromHeaders = (poolObject, headers) => {
	if (!headers || !poolObject) return;

	const tokenLimit = readNumericHeader(headers, ["x-ratelimit-limit-tokens"]);
	const tokenRemaining = readNumericHeader(headers, ["x-ratelimit-remaining-tokens"]);
	const requestLimit = readNumericHeader(headers, ["x-ratelimit-limit-requests"]);
	const requestRemaining = readNumericHeader(headers, ["x-ratelimit-remaining-requests"]);

	const usageRatios = [];
	if (tokenLimit > 0 && tokenRemaining !== null) usageRatios.push(1 - tokenRemaining / tokenLimit);
	if (requestLimit > 0 && requestRemaining !== null) usageRatios.push(1 - requestRemaining / requestLimit);
	if (!usageRatios.length) return;

	const usageRatio = Math.max(...usageRatios);
	poolObject.usageRatio = usageRatio;

	if (usageRatio >= KEY_USAGE_SWITCH_THRESHOLD) {
		const resetMs = Math.max(
			parseResetMs(headers.get("x-ratelimit-reset-tokens")),
			parseResetMs(headers.get("x-ratelimit-reset-requests")),
			QUOTA_COOLDOWN_MS,
		);
		poolObject.cooldownUntil = Date.now() + resetMs;
		logger.warn(
			`[llm-pool] Key "${poolObject.id}" reached ${Math.round(usageRatio * 100)}% of reported rate window — rotating for ${Math.round(resetMs / 1000)}s`,
			"llm"
		);
	}
};

/**
 * Iterates through a specific provider pool (e.g. groq or gemini) and returning the first healthy key.
 * Advances the round-robin index.
 */
const getHealthyKey = (providerArray, currentIndexObj) => {
	if (!providerArray || providerArray.length === 0) return null;

	const now = Date.now();
	for (let i = 0; i < providerArray.length; i++) {
		// Round robin
		const index = (currentIndexObj.value + i) % providerArray.length;
		const candidate = providerArray[index];

		if (now >= candidate.cooldownUntil) {
			// Found a healthy key, advance index for next time
			currentIndexObj.value = (index + 1) % providerArray.length;
			return candidate;
		}
	}
	return null; // All keys exhausted
};

// ---------- GROQ CALL ----------
const callGroq = async (poolObject, messages, { maxTokens = 2048, temperature = 0.3 } = {}) => {
	const apiCall = poolObject.client.chat.completions.create({
		model: poolObject.model,
		messages,
		max_tokens: maxTokens,
		temperature,
	});

	const { data: response, response: rawResponse } =
		typeof apiCall.withResponse === "function"
			? await apiCall.withResponse()
			: { data: await apiCall, response: null };
	updateKeyUsageFromHeaders(poolObject, rawResponse?.headers);

	const choice = response.choices?.[0]?.message;
	return {
		content: choice?.content || choice?.reasoning || "",
		provider: poolObject.provider,
		model: poolObject.model,
		id: poolObject.id,
	};
};

// ---------- GEMINI CALL ----------
const callGemini = async (poolObject, messages, { maxTokens = 2048, temperature = 0.3 } = {}) => {
	const model = poolObject.client.getGenerativeModel({
		model: poolObject.model,
		generationConfig: {
			maxOutputTokens: maxTokens,
			temperature,
		},
	});

	// Convert OpenAI-style messages to Gemini format
	const systemMsg = messages.find((m) => m.role === "system");
	const chatMessages = messages
		.filter((m) => m.role !== "system")
		.map((m) => ({
			role: m.role === "assistant" ? "model" : "user",
			parts: [{ text: m.content }],
		}));

	const chat = model.startChat({
		history: chatMessages.slice(0, -1),
		systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
	});

	const lastMsg = chatMessages[chatMessages.length - 1];
	const result = await chat.sendMessage(lastMsg.parts[0].text);
	const text = result.response.text();

	return {
		content: text || "",
		provider: poolObject.provider,
		model: poolObject.model,
		id: poolObject.id,
	};
};

// ---------- MAIN ENTRY POINT ----------
/**
 * Universal CHAT endpoint.
 * Checks LangCache first for semantic match, then iterates through
 * Groq keys, then Gemini keys on failover. Stores result in LangCache.
 * @param {Array<{role: string, content: string}>} messages - OpenAI-format messages
 * @param {Object} opts - { maxTokens, temperature }
 */
const chat = async (messages, opts = {}) => {
	// 0. Check LangCache for a semantic hit
	const cached = await langcache.search(messages);
	if (cached) {
		return {
			content: cached.content,
			provider: "langcache",
			model: "semantic-cache",
			id: "LangCache",
			cached: true,
			similarity: cached.similarity,
		};
	}

	const errors = [];
	
	// 1. Try Groq Pool
	let groqIndexRef = { value: currentGroqIndex };
	let groqHealthy;
	
	while ((groqHealthy = getHealthyKey(pool.groq, groqIndexRef)) !== null) {
		currentGroqIndex = groqIndexRef.value; // Store the advanced index state globally
		try {
			logger.info(`[llm-pool] Trying ${groqHealthy.id}`, "llm");
			const result = await callGroq(groqHealthy, messages, opts);
			// Store in LangCache for future semantic hits
			await langcache.store(messages, result.content);
			return result;
		} catch (err) {
			logger.error(`[llm-pool] ${groqHealthy.id} failed — ${err.message}`, "llm");
			if (isQuotaError(err)) {
				markKeyExhausted(groqHealthy);
			} else {
				// Unexpected error, mark it exhausted anyway to cycle past it
				groqHealthy.cooldownUntil = Date.now() + 10000;
			}
			errors.push({ id: groqHealthy.id, error: err.message });
		}
	}

	// 2. Try Gemini Pool
	let geminiIndexRef = { value: currentGeminiIndex };
	let geminiHealthy;

	while ((geminiHealthy = getHealthyKey(pool.gemini, geminiIndexRef)) !== null) {
		currentGeminiIndex = geminiIndexRef.value;
		try {
			logger.info(`[llm-pool] Trying ${geminiHealthy.id}`, "llm");
			const result = await callGemini(geminiHealthy, messages, opts);
			// Store in LangCache for future semantic hits
			await langcache.store(messages, result.content);
			return result;
		} catch (err) {
			logger.error(`[llm-pool] ${geminiHealthy.id} failed — ${err.message}`, "llm");
			if (isQuotaError(err)) {
				markKeyExhausted(geminiHealthy);
			} else {
				geminiHealthy.cooldownUntil = Date.now() + 10000;
			}
			errors.push({ id: geminiHealthy.id, error: err.message });
		}
	}

	// 3. All pools exhausted
	const msg = errors.map((e) => `${e.id}: ${e.error}`).join("; ");
	throw new Error(`All LLM providers completely exhausted — ${msg}`);
};

/**
 * Universal RAW PROMPT endpoint. 
 * Used by the background data pipelines.
 * Simply wraps the raw text prompt in an OpenAI message format.
 */
const queryLLM = async (promptText) => {
	const messages = [{ role: "user", content: promptText }];
	const result = await chat(messages, { maxTokens: 2048, temperature: 0.1 });
	return result.content;
};

/**
 * Get the status of all providers.
 */
const getProviderStatus = () => {
	const now = Date.now();
	const summarizeKeys = (keys) => keys.map((key) => ({
		id: key.id,
		available: now >= key.cooldownUntil,
		cooldownRemainingMs: Math.max(0, key.cooldownUntil - now),
		reportedUsagePercent: key.usageRatio === undefined ? null : Math.round(key.usageRatio * 100),
	}));

	return {
		groq: {
			totalKeys: pool.groq.length,
			availableKeys: pool.groq.filter(k => now >= k.cooldownUntil).length,
			model: GROQ_MODEL,
			keys: summarizeKeys(pool.groq),
		},
		gemini: {
			totalKeys: pool.gemini.length,
			availableKeys: pool.gemini.filter(k => now >= k.cooldownUntil).length,
			model: GEMINI_MODEL,
			keys: summarizeKeys(pool.gemini),
		},
	};
};

// Log LangCache status on startup
langcache.logStatus();

module.exports = {
	chat,
	queryLLM,
	getProviderStatus,
};
