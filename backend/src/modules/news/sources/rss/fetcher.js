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
  // Global baseline
  { region: "Global", url: "http://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World" },
  { region: "Global", url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera" },
  { region: "Global", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", source: "NY Times World" },
  { region: "Global", url: "https://rss.dw.com/rdf/rss-en-world", source: "DW World" },
  { region: "Global", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", source: "UN News" },
  { region: "Global", url: "https://reliefweb.int/updates/rss.xml", source: "ReliefWeb" },

  // Africa
  { region: "Africa", url: "http://feeds.bbci.co.uk/news/world/africa/rss.xml", source: "BBC Africa" },
  { region: "Africa", url: "https://www.france24.com/en/africa/rss", source: "France 24 Africa" },
  { region: "Africa", url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", source: "AllAfrica" },

  // Asia
  { region: "Asia", url: "http://feeds.bbci.co.uk/news/world/asia/rss.xml", source: "BBC Asia" },
  { region: "Asia", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511", source: "CNA Asia" },
  { region: "Asia", url: "https://thediplomat.com/feed/", source: "The Diplomat" },
  { region: "Asia", url: "https://asia.nikkei.com/rss/feed/nar", source: "Nikkei Asia" },
  { region: "Asia", url: "https://indianexpress.com/section/india/feed/", source: "Indian Express India" },
  { region: "Asia", url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml", source: "Hindustan Times India" },
  { region: "Asia", url: "https://www.thehindu.com/news/national/feeder/default.rss", source: "The Hindu India" },

  // Middle East
  { region: "Middle East", url: "http://feeds.bbci.co.uk/news/world/middle_east/rss.xml", source: "BBC Middle East" },
  { region: "Middle East", url: "https://www.france24.com/en/middle-east/rss", source: "France 24 Middle East" },
  { region: "Middle East", url: "https://www.al-monitor.com/rss", source: "Al-Monitor" },

  // Europe
  { region: "Europe", url: "http://feeds.bbci.co.uk/news/world/europe/rss.xml", source: "BBC Europe" },
  { region: "Europe", url: "https://www.france24.com/en/europe/rss", source: "France 24 Europe" },
  { region: "Europe", url: "https://www.politico.eu/feed/", source: "Politico Europe" },

  // Americas
  { region: "Americas", url: "http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml", source: "BBC US & Canada" },
  { region: "Americas", url: "http://feeds.bbci.co.uk/news/world/latin_america/rss.xml", source: "BBC Latin America" },
  { region: "Americas", url: "https://feeds.npr.org/1004/rss.xml", source: "NPR World" },

  // Oceania / Australia-Pacific
  { region: "Oceania", url: "https://www.abc.net.au/news/feed/51120/rss.xml", source: "ABC Australia" },
  { region: "Oceania", url: "https://www.rnz.co.nz/rss/news.xml", source: "RNZ News" },
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
          _feedRegion: feed.region,
        });
      }

      logger.info(`RSS ${feed.source} returned ${items.length} items`, "rss.fetcher");
    } catch (err) {
      logger.error(`RSS fetch failed (${feed.source}): ${err.message}`, "rss.fetcher");
    }
  }

  return records;
};
