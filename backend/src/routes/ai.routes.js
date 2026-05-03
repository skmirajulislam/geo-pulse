const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");
const { getProviderStatus, chat } = require("../config/llm");
const { eventsLimiter } = require("../middleware/rateLimiter");
const { getRealMarketData } = require("../modules/finance/market.service");

// ---------- SYSTEM PROMPTS ----------
const CHAT_SYSTEM_PROMPT = `You are an expert geopolitical intelligence analyst for the World Monitor dashboard.
You have deep knowledge of international relations, military conflicts, diplomacy, economic sanctions, 
cybersecurity, terrorism, and global politics.

When answering:
- Be concise and analytical — like a professional intelligence briefing
- Use bullet points for multi-part answers
- Cite specific countries, regions and events when relevant
- Assess risks on a scale (low/medium/high/critical) when appropriate
- If asked about predictions, frame them as probability assessments
- Keep responses under 300 words unless the question demands more detail`;

const SIMULATION_SYSTEM_PROMPT = `You are a geopolitical simulation engine for the World Monitor intelligence platform.
Given a "what-if" scenario, produce a structured analysis in STRICT JSON format.

Return ONLY a valid JSON object with this exact structure (no markdown, no code fences):
{
  "summary": "2-3 sentence executive summary of the scenario outcome",
  "probability": 0.0-1.0,
  "severity": 1-10,
  "timeline": "e.g. '1-3 months' or 'immediate'",
  "chain_reactions": [
    {"step": 1, "event": "description", "category": "conflict|economic|diplomacy|security|humanitarian", "delay": "e.g. 'immediate' or '1-2 weeks'"}
  ],
  "market_impact": {
    "oil": "up|down|stable",
    "gold": "up|down|stable",
    "stocks": "up|down|stable",
    "description": "1-sentence market analysis"
  },
  "affected_regions": [
    {"region": "name", "impact": "high|medium|low", "description": "1-sentence"}
  ]
}

Be realistic and data-driven. Base assessments on historical precedents.`;

const FINANCE_SYSTEM_PROMPT = `You are a financial analyst correlating geopolitical events with market movements.
Given a list of current geopolitical events and the REAL current market price changes, analyze potential impacts.

Return ONLY a valid JSON object. No markdown. No code fences. No explanation. Just JSON:
{"correlations":[{"symbol":"CL","name":"Crude Oil","direction":"up","change_pct":2.5,"reason":"Supply concerns"},{"symbol":"GC","name":"Gold","direction":"up","change_pct":1.8,"reason":"Safe haven demand"},{"symbol":"SPX","name":"SP500","direction":"down","change_pct":-1.2,"reason":"Risk off sentiment"},{"symbol":"DXY","name":"US Dollar Index","direction":"up","change_pct":0.5,"reason":"Flight to safety"},{"symbol":"BTC","name":"Bitcoin","direction":"down","change_pct":-3.0,"reason":"Risk aversion"}],"risk_level":"high","summary":"Markets are reacting to escalating tensions with a flight to safety."}

CRITICAL: The user will provide the REAL 'change_pct' and 'direction' for each symbol based on live market data. You MUST use those exact numbers in your JSON output. Your job is ONLY to provide the 'reason' (based on the geopolitical events) and the overall 'summary' and 'risk_level'.`;

// ---------- HELPER ----------
const parseJSON = (text) => {
	// Strip markdown code fences if present
	let cleaned = text.trim();
	cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
	cleaned = cleaned.trim();

	// Remove control characters that break JSON
	cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, (c) => {
		if (c === "\n" || c === "\r" || c === "\t") return c;
		return "";
	});

	// Try direct parse first
	try {
		return JSON.parse(cleaned);
	} catch {
		// Try to extract JSON object from surrounding text
		const match = cleaned.match(/\{[\s\S]*\}/);
		if (match) {
			let jsonStr = match[0];
			// Fix common LLM JSON mistakes
			jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1"); // trailing commas
			jsonStr = jsonStr.replace(/([\w"'])\s*\n\s*"/g, '$1,"'); // missing commas between lines
			try {
				return JSON.parse(jsonStr);
			} catch (e2) {
				logger.error(`JSON parse failed after cleanup: ${e2.message}`, "ai.routes");
				logger.error(`Raw LLM output (first 300 chars): ${text.slice(0, 300)}`, "ai.routes");
			}
		}
		throw new Error("Failed to parse LLM response as JSON");
	}
};

// ---------- POST /api/chat ----------
router.post("/chat", eventsLimiter, async (req, res) => {
	try {
		const { message, history = [] } = req.body;
		if (!message || typeof message !== "string" || !message.trim()) {
			return res.status(400).json({ success: false, error: "Message is required" });
		}

		logger.info(`POST /api/chat — "${message.slice(0, 60)}..."`, "ai.routes");

		// Build messages array with conversation history
		const messages = [
			{ role: "system", content: CHAT_SYSTEM_PROMPT },
			...history.slice(-10).map((m) => ({
				role: m.role === "assistant" ? "assistant" : "user",
				content: m.content,
			})),
			{ role: "user", content: message },
		];

		const result = await chat(messages, { maxTokens: 1024, temperature: 0.4 });

		res.json({
			success: true,
			reply: result.content,
			provider: result.provider,
			model: result.model,
		});
	} catch (err) {
		logger.error(`Chat error: ${err.message}`, "ai.routes");
		res.status(500).json({
			success: false,
			error: "AI service temporarily unavailable",
			message: err.message,
		});
	}
});

// ---------- POST /api/simulate ----------
router.post("/simulate", eventsLimiter, async (req, res) => {
	try {
		const { scenario } = req.body;
		if (!scenario || typeof scenario !== "string" || !scenario.trim()) {
			return res.status(400).json({ success: false, error: "Scenario is required" });
		}

		logger.info(`POST /api/simulate — "${scenario.slice(0, 60)}..."`, "ai.routes");

		const messages = [
			{ role: "system", content: SIMULATION_SYSTEM_PROMPT },
			{ role: "user", content: `Simulate this geopolitical scenario: ${scenario}` },
		];

		const result = await chat(messages, { maxTokens: 2048, temperature: 0.3 });
		const parsed = parseJSON(result.content);

		res.json({
			success: true,
			simulation: parsed,
			provider: result.provider,
			model: result.model,
		});
	} catch (err) {
		logger.error(`Simulate error: ${err.message}`, "ai.routes");
		res.status(500).json({
			success: false,
			error: "Simulation service temporarily unavailable",
			message: err.message,
		});
	}
});

// ---------- POST /api/finance/correlations ----------
router.post("/finance/correlations", eventsLimiter, async (req, res) => {
	try {
		logger.info("POST /api/finance/correlations — Fetched exclusively via Massive API", "ai.routes");

		// Fetch real market data natively, completely bypassing the LLM
		const realMarketData = await getRealMarketData();

		if (!realMarketData || realMarketData.length === 0) {
			return res.json({
				success: true,
				data: {
					correlations: [],
					risk_level: "unknown",
					summary: "Live market data is currently unavailable from the Massive API.",
				},
				provider: "massive-api",
				model: "polygon-agg",
			});
		}

		// Map to the exact schema the frontend expects
		const correlations = realMarketData.map((m) => ({
			symbol: m.symbol,
			name: m.name,
			direction: m.direction,
			change_pct: m.changePct,
			// Provide a static reason since we bypass the LLM
			reason: `Live market trajectory recorded natively without AI sentiment.`,
		}));

		// Determine a static aggregate risk scale based purely on crude oil & SPX vectors
		const spx = correlations.find(c => c.symbol === "SPX");
		const oil = correlations.find(c => c.symbol === "CL");
		let risk = "medium";
		
		if (spx?.change_pct < -1.5 || oil?.change_pct > 2.0) {
			risk = "high";
		} else if (spx?.change_pct > 1.0) {
			risk = "low";
		}

		res.json({
			success: true,
			data: {
				correlations,
				risk_level: risk,
				summary: "Live quantitative market movements tracked directly via Massive Financial Data.",
			},
			provider: "massive-api",
			model: "polygon-agg",
		});
	} catch (err) {
		logger.error(`Finance native error: ${err.message}`, "ai.routes");
		res.status(500).json({
			success: false,
			error: "Massive API Market logic failed",
			message: err.message,
		});
	}
});

// ---------- GET /api/ai/status ----------
router.get("/ai/status", (req, res) => {
	res.json({
		success: true,
		providers: getProviderStatus(),
	});
});

module.exports = router;
