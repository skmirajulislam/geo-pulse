require("dotenv").config();

const app = require("./app");
const logger = require("./utils/logger");

const cron = require("node-cron");
const { Server } = require("socket.io");
const { runAllPipelines } = require("./jobs/main.job");
const {
	connectEventsRepository,
	closeEventsRepository,
	isDatabaseEnabled,
} = require("./db/events.repository");
const { 
	connectWeatherRepository, 
	closeWeatherRepository 
} = require("./db/weather.repository");
const {
	connectChatRoomsRepository,
	closeChatRoomsRepository,
	isChatDatabaseEnabled,
} = require("./db/chatRooms.repository");
const {
	registerChatSocket,
	startInactiveRoomCleanup,
} = require("./socket/chat.socket");

const PORT = process.env.PORT || 5000;
const PIPELINE_INTERVAL_MINUTES = Number(process.env.PIPELINE_INTERVAL_MINUTES || 15);
const CRON_PATTERN = `*/${Math.max(1, PIPELINE_INTERVAL_MINUTES)} * * * *`;

// When running under cluster.js, PIPELINE_ENABLED=true on only ONE worker.
// When running standalone (node server.js), pipeline always starts.
const PIPELINE_ENABLED = process.env.PIPELINE_ENABLED !== "false";

// ---------- START SERVER ----------
const server = app.listen(PORT, () => {
	logger.info(`Server running on port ${PORT}`, "server");
});

const corsOrigins = process.env.CORS_ORIGIN
	? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
	: "*";
const io = new Server(server, {
	cors: {
		origin: corsOrigins,
		methods: ["GET", "POST"],
	},
});
registerChatSocket(io);
startInactiveRoomCleanup(io);

// ---------- DB CONNECT ----------
(async () => {
	if (!isDatabaseEnabled()) {
		logger.warn("MongoDB is disabled (MONGODB_URI not set). Running cache-only mode.", "server");
		return;
	}

	try {
		await connectEventsRepository();
		await connectWeatherRepository();
		if (isChatDatabaseEnabled()) {
			await connectChatRoomsRepository();
		}
	} catch (err) {
		logger.error(`MongoDB unavailable, continuing in cache-only mode: ${err.message}`, "server");
	}
})();

// ---------- PIPELINE (only on designated worker) ----------
if (PIPELINE_ENABLED) {
	logger.info(
		`Pipeline enabled on PID ${process.pid} — schedule every ${PIPELINE_INTERVAL_MINUTES} min (cron: "${CRON_PATTERN}")`,
		"server"
	);
	logger.info(
		"Between pipeline runs, all API requests are served from Redis cache / MongoDB only — no external fetching.",
		"server"
	);

	const SKIP_INITIAL_PIPELINE = process.env.SKIP_INITIAL_PIPELINE === "true";

	// Run immediately on startup so the cache is populated ASAP
	if (!SKIP_INITIAL_PIPELINE) {
		(async () => {
			logger.info("Initial unified pipeline run starting...", "server");
			await runAllPipelines();
			logger.info(`Initial pipeline complete. Next scheduled run in ${PIPELINE_INTERVAL_MINUTES} min.`, "server");
		})();
	} else {
		logger.info(`Initial pipeline run explicitly skipped via SKIP_INITIAL_PIPELINE=true. Waiting ${PIPELINE_INTERVAL_MINUTES} min for first scheduled cron...`, "server");
	}

	cron.schedule(CRON_PATTERN, async () => {
		logger.info(`Cron fired — running unified pipeline (every ${PIPELINE_INTERVAL_MINUTES} min)`, "cron");
		await runAllPipelines();
		logger.info("Cron pipeline run complete. Cache + DB updated.", "cron");
	});
} else {
	logger.info(`Pipeline disabled on PID ${process.pid} — API-only worker (reads cache/DB only)`, "server");
}


// ---------- ERROR HANDLING ----------
process.on("unhandledRejection", (err) => {
	logger.error(`Unhandled Rejection: ${err.message}`, "server");
	server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
	logger.error(`Uncaught Exception: ${err.message}`, "server");
	process.exit(1);
});

// ---------- GRACEFUL SHUTDOWN ----------
process.on("SIGINT", () => {
	logger.warn("SIGINT received. Shutting down...", "server");
	server.close(() => {
		Promise.all([closeEventsRepository(), closeWeatherRepository(), closeChatRoomsRepository()])
			.then(() => {
				logger.info("Server closed", "server");
				process.exit(0);
			})
			.catch(() => process.exit(1));
	});
});

process.on("SIGTERM", () => {
	logger.warn("SIGTERM received. Shutting down...", "server");
	server.close(() => {
		Promise.all([closeEventsRepository(), closeWeatherRepository(), closeChatRoomsRepository()])
			.then(() => {
				logger.info("Server closed", "server");
				process.exit(0);
			})
			.catch(() => process.exit(1));
	});
});
