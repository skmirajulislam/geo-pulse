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

// ---------- CONFIG ----------
const rawGroqKeys = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "";
const groqKeys = rawGroqKeys.split(",").map(k => k.trim()).filter(Boolean);

const rawGeminiKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const geminiKeys = rawGeminiKeys.split(",").map(k => k.trim()).filter(Boolean);

const GROQ_MODEL = process.env.LLM_MODEL || "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const LLM_TIMEOUT = Number(process.env.LLM_TIMEOUT || 30000);

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
	const response = await poolObject.client.chat.completions.create({
		model: poolObject.model,
		messages,
		max_tokens: maxTokens,
		temperature,
	});
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
 * Iterates through Groq keys, then Gemini keys on failover.
 * @param {Array<{role: string, content: string}>} messages - OpenAI-format messages
 * @param {Object} opts - { maxTokens, temperature }
 */
const chat = async (messages, opts = {}) => {
	const errors = [];
	
	// 1. Try Groq Pool
	let groqIndexRef = { value: currentGroqIndex };
	let groqHealthy;
	
	while ((groqHealthy = getHealthyKey(pool.groq, groqIndexRef)) !== null) {
		currentGroqIndex = groqIndexRef.value; // Store the advanced index state globally
		try {
			logger.info(`[llm-pool] Trying ${groqHealthy.id}`, "llm");
			const result = await callGroq(groqHealthy, messages, opts);
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
	return {
		groq: {
			totalKeys: pool.groq.length,
			availableKeys: pool.groq.filter(k => now >= k.cooldownUntil).length,
			model: GROQ_MODEL,
		},
		gemini: {
			totalKeys: pool.gemini.length,
			availableKeys: pool.gemini.filter(k => now >= k.cooldownUntil).length,
			model: GEMINI_MODEL,
		},
	};
};

module.exports = {
	chat,
	queryLLM,
	getProviderStatus,
};
