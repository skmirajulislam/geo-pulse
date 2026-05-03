/**
 * cluster.js — Load-balanced entry point
 *
 * Spawns one worker per CPU (or CLUSTER_WORKERS env var).
 * Each worker runs the full Express server (server.js).
 * The cron pipeline runs only on the PRIMARY worker (worker id=1)
 * to avoid duplicate pipeline executions across workers.
 *
 * Rate limits are shared via Redis so all workers enforce the same limits.
 *
 * Usage:
 *   node src/cluster.js          ← production
 *   npm run start:cluster        ← via npm script
 *
 * For PM2:
 *   pm2 start ecosystem.config.js
 */
require("dotenv").config();

const cluster = require("cluster");
const os = require("os");
const logger = require("./utils/logger");

const NUM_WORKERS = Number(process.env.CLUSTER_WORKERS || os.cpus().length);
const MAX_WORKERS = Math.min(NUM_WORKERS, os.cpus().length); // never exceed physical cores

if (cluster.isPrimary) {
	logger.info(
		`Primary process ${process.pid} starting — forking ${MAX_WORKERS} workers`,
		"cluster"
	);

	// Track which worker is the pipeline runner
	let pipelineWorkerId = null;

	const spawnWorker = (isPipelineWorker = false) => {
		const env = isPipelineWorker
			? { ...process.env, PIPELINE_ENABLED: "true" }
			: { ...process.env, PIPELINE_ENABLED: "false" };

		const w = cluster.fork(env);
		if (isPipelineWorker) pipelineWorkerId = w.id;

		w.on("exit", (code, signal) => {
			logger.warn(
				`Worker ${w.process.pid} (id=${w.id}) exited — code=${code} signal=${signal}. Respawning...`,
				"cluster"
			);
			// Respawn; if the pipeline worker died, make the new one the pipeline runner
			const wasScheduler = w.id === pipelineWorkerId;
			spawnWorker(wasScheduler);
		});

		return w;
	};

	// First worker runs the cron pipeline
	spawnWorker(true);

	// Remaining workers are pure API servers
	for (let i = 1; i < MAX_WORKERS; i++) {
		spawnWorker(false);
	}

	// Graceful shutdown: kill all workers cleanly
	const shutdown = (signal) => {
		logger.warn(`Primary received ${signal} — shutting down workers`, "cluster");
		for (const id in cluster.workers) {
			cluster.workers[id].kill("SIGTERM");
		}
		setTimeout(() => process.exit(0), 5000);
	};

	process.on("SIGINT", () => shutdown("SIGINT"));
	process.on("SIGTERM", () => shutdown("SIGTERM"));
} else {
	// ── WORKER PROCESS ─────────────────────────────────────────
	logger.info(
		`Worker ${process.pid} started — pipeline=${process.env.PIPELINE_ENABLED}`,
		"cluster"
	);
	// Load server.js — it reads PIPELINE_ENABLED to decide whether to start cron
	require("./server");
}
