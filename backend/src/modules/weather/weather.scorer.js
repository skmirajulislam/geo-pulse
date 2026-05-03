const logger = require("../../utils/logger");

// Weight configuration
const WEIGHTS = {
  severity: 0.5,
  confidence: 0.2,
  sources: 0.2,
  recency: 0.1
};

const getRecencyScore = (timestamp) => {
  const hoursAgo =
    (Date.now() - new Date(timestamp)) / (1000 * 60 * 60);

  if (hoursAgo < 2) return 1;
  if (hoursAgo < 6) return 0.8;
  if (hoursAgo < 12) return 0.6;
  if (hoursAgo < 24) return 0.4;
  return 0.2;
};

exports.scoreEvents = (events = []) => {
  logger.info("Scoring events...", "news.scorer");

  const scored = events.map((e) => {
    const severityScore = e.severity / 5;
    const confidenceScore = e.confidence;
    const sourceScore = Math.min(e.sources.length / 5, 1);
    const recencyScore = getRecencyScore(e.timestamp);

    const score =
      severityScore * WEIGHTS.severity +
      confidenceScore * WEIGHTS.confidence +
      sourceScore * WEIGHTS.sources +
      recencyScore * WEIGHTS.recency;

    return {
      ...e,
      score: Number(score.toFixed(3))
    };
  });

  // sort descending
  scored.sort((a, b) => b.score - a.score);

  logger.info("Scoring complete", "news.scorer");

  return scored;
};