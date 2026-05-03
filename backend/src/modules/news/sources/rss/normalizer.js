const logger = require("../../../../utils/logger.js");

const stripHtml = (input = "") =>
  String(input).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

exports.normalizeRSS = (items = []) => {
  logger.info("Normalizing RSS data...", "rss.normalizer");

  const normalized = items
    .filter((item) => item && item.title && item.link)
    .map((item) => {
      const description =
        stripHtml(item.contentSnippet || item.content || item.summary || item.title) || item.title;
      const publishedAt = item.isoDate || item.pubDate || new Date().toISOString();

      return {
        title: String(item.title).trim(),
        description: description.slice(0, 600),
        url: item.link,
        source: item.creator || item._feedSource || "RSS",
        publishedAt,
      };
    });

  logger.info(
    `Normalized RSS ${items.length} → ${normalized.length}`,
    "rss.normalizer"
  );

  return normalized;
};
