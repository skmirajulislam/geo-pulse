const logger = require("../utils/logger");

const { runNewsPipeline }    = require("./news.job");
const { runWeatherPipeline } = require("./weather.job");

exports.runAllPipelines = async () => {
	logger.info("Initializing unified pipeline (News + Weather)...", "job.orchestrator");

	try {
		// 1. Process the primary Geopolitics pipeline
		logger.info("Firing Geopolitics pipeline...", "job.orchestrator");
		await runNewsPipeline();

		// 2. Process the specialized Weather pipeline (bypassing LLM natively inside)
		logger.info("Firing Weather pipeline...", "job.orchestrator");
		await runWeatherPipeline();

		logger.info("All pipelines fully executed.", "job.orchestrator");
	} catch (err) {
		logger.error(`Unified pipeline fatal error: ${err.message}`, "job.orchestrator");
	}
};
