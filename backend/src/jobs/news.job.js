const logger = require("../utils/logger");

const { aggregateNews }      = require("../modules/news/news.aggregator");
const { preFilter }          = require("../modules/news/news.preFilter");
const { llmFilter }          = require("../modules/news/news.llmFilter");
const { transformEvents }    = require("../modules/news/news.transformer");
const { deduplicateEvents }  = require("../modules/news/news.deduplicator");
const { selectUniqueFifo }   = require("../modules/news/news.selector");
const { scoreEvents }        = require("../modules/news/news.scorer");
const { upsertEvents }       = require("../db/events.repository");
const { mergeAndSetCache }   = require("../cache/cache.service");
const { runMemoryGuard }     = require("./memoryGuard");

exports.runNewsPipeline = async () => {
  logger.info("Running GEOPOLITICS pipeline...", "news.job");

  try {
    // ── 1. PRE-FLIGHT: memory quota check ──────────────────────────────────
    const guardResult = await runMemoryGuard();
    if (guardResult.evicted) {
      logger.info(
        `Pre-pipeline eviction done (${guardResult.dates?.join(", ")}). ` +
        `Redis now at ${guardResult.usedMB} MB. Continuing pipeline…`,
        "news.job"
      );
    }

    // ── 2. FETCH & AGGREGATE ────────────────────────────────────────────────
    const raw       = await aggregateNews();
    const filtered  = preFilter(raw);
    const llm         = await llmFilter(filtered);

    // ── 4. TRANSFORM + DEDUPLICATE + SELECT ─────────────────────────────────
    const transformed = transformEvents(llm);
    const deduped     = deduplicateEvents(transformed);
    const { selected } = await selectUniqueFifo(deduped);
    const scored      = scoreEvents(selected);

    // ── 5. PERSIST ──────────────────────────────────────────────────────────
    try {
      const dbResult = await upsertEvents(scored);
      logger.info(
        `Persisted to MongoDB: upserted=${dbResult.upserted}, modified=${dbResult.modified}`,
        "job"
      );
    } catch (err) {
      logger.error(`MongoDB persistence failed: ${err.message}`, "job");
    }

    await mergeAndSetCache(scored);

    logger.info(
      `Pipeline complete — ${scored.length} events written to cache + DB.`,
      "job"
    );
  } catch (err) {
    logger.error(`Job failed: ${err.message}`, "job");
  }
};
