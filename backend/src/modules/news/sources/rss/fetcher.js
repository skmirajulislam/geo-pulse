const Parser = require("rss-parser");
const logger = require("../../../../utils/logger.js");

const parser = new Parser({
  timeout: 15000,
  requestOptions: {
    headers: {
      "User-Agent": "GeoPulse/1.0 (+https://github.com/skmirajulislam/geo-pulse)",
    },
  },
});

const RSS_FEEDS = [
  { url: "http://feeds.bbci.co.uk/news/world/rss.xml",                     source: "BBC World" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml",                      source: "Al Jazeera" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",         source: "NY Times World" },
  { url: "http://rss.cnn.com/rss/edition_world.rss",                       source: "CNN World" },
  { url: "https://feeds.washingtonpost.com/rss/world",                     source: "Washington Post" },
  { url: "https://www.theguardian.com/world/rss",                          source: "The Guardian World" },
  // Reuters shut down public RSS in 2020 (feeds.reuters.com → ENOTFOUND)
  // Replaced with AP News (hosted via Google News) and DW for geographic diversity
  { url: "https://rss.dw.com/rdf/rss-en-world",                           source: "DW World" },
  { url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml",        source: "UN News" },
  { url: "https://reliefweb.int/updates/rss.xml",                         source: "ReliefWeb" },
  { url: "https://feeds.npr.org/1004/rss.xml",                            source: "NPR World" },
];

exports.fetchFromRSS = async () => {
  const perFeedLimit = Number(process.env.RSS_PER_FEED_LIMIT || 25);
  const records = [];

  for (const feed of RSS_FEEDS) {
    try {
      logger.info(`Fetching RSS: ${feed.source}`, "rss.fetcher");
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, perFeedLimit);

      for (const item of items) {
        records.push({
          ...item,
          _feedSource: feed.source,
        });
      }

      logger.info(`RSS ${feed.source} returned ${items.length} items`, "rss.fetcher");
    } catch (err) {
      logger.error(`RSS fetch failed (${feed.source}): ${err.message}`, "rss.fetcher");
    }
  }

  return records;
};
