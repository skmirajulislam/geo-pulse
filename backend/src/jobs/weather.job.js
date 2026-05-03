const logger = require("../utils/logger");

const { aggregateWeather }   = require("../modules/weather/weather.aggregator");
const { deduplicateEvents }  = require("../modules/weather/weather.deduplicator");
const { selectUniqueFifo }   = require("../modules/weather/weather.selector");
const { scoreEvents }        = require("../modules/weather/weather.scorer");
const { upsertWeatherEvents } = require("../db/weather.repository");
const { mergeAndSetCache }   = require("../cache/weatherCache.service");

exports.runWeatherPipeline = async () => {
  logger.info("Running WEATHER pipeline with structured native APIs...", "weather.job");

  try {
    // ── 1. FETCH & AGGREGATE natively mapped events ─────────────────────────
    const rawEvents = await aggregateWeather();

    // ── 2. DEDUPLICATE + SELECT + SCORE ─────────────────────────────────────
    const unique       = deduplicateEvents(rawEvents);
    const { selected }   = await selectUniqueFifo(unique);
    const scored       = scoreEvents(selected);

    // ── 5. PERSIST ──────────────────────────────────────────────────────────
    try {
      const dbResult = await upsertWeatherEvents(scored);
      logger.info(
        `Persisted to MongoDB: upserted=${dbResult.upserted}, modified=${dbResult.modified}`,
        "weather.job"
      );
    } catch (err) {
      logger.error(`MongoDB persistence failed: ${err.message}`, "weather.job");
    }

    await mergeAndSetCache(scored);

    logger.info(
      `Weather pipeline complete — ${scored.length} events written to cache + DB.`,
      "weather.job"
    );
  } catch (err) {
    logger.error(`Job failed: ${err.message}`, "weather.job");
  }
};
