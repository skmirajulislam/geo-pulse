const logger = require("../../utils/logger");
const { getCacheOnly } = require("../../cache/weatherCache.service");
const { getRecentDuplicateCandidates } = require("../../db/weather.repository");
const { buildEventIdentity, isLikelyDuplicate } = require("../../utils/articleIdentity");

const getDateKey = (timestamp) => {
  const d = timestamp ? new Date(timestamp) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
};

const buildIndexFromEvents = (events = []) => {
  const index = {
    urls: new Set(),
    strict: new Set(),
    coarse: new Set(),
    identities: [],
  };

  for (const event of events) {
    const identity = buildEventIdentity(event);
    if (identity.canonicalUrl) index.urls.add(identity.canonicalUrl);
    if (identity.strictFingerprint) index.strict.add(identity.strictFingerprint);
    if (identity.coarseFingerprint) index.coarse.add(identity.coarseFingerprint);
    index.identities.push(identity);
  }

  return index;
};

const existsInIndex = (identity, index) => {
  if (!identity || !index) return false;

  if (identity.canonicalUrl && index.urls.has(identity.canonicalUrl)) return true;
  if (identity.strictFingerprint && index.strict.has(identity.strictFingerprint)) return true;
  if (identity.coarseFingerprint && index.coarse.has(identity.coarseFingerprint)) return true;

  return index.identities.some((candidate) => isLikelyDuplicate(identity, candidate));
};

const appendToIndex = (identity, index) => {
  if (!identity || !index) return;
  if (identity.canonicalUrl) index.urls.add(identity.canonicalUrl);
  if (identity.strictFingerprint) index.strict.add(identity.strictFingerprint);
  if (identity.coarseFingerprint) index.coarse.add(identity.coarseFingerprint);
  index.identities.push(identity);
};

exports.selectUniqueFifo = async (events = []) => {
  const selected = [];
  const rejected = [];
  const cacheIndexByDate = new Map();

  // DB index is loaded once; cache check still happens first per-event as required.
  const dbCandidates = await getRecentDuplicateCandidates();
  const dbIndex = buildIndexFromEvents(dbCandidates);
  const selectedIndex = buildIndexFromEvents([]);

  for (const event of events) {
    const identity = buildEventIdentity(event);
    const eventDate = getDateKey(identity.timestamp);

    if (!cacheIndexByDate.has(eventDate)) {
      const cachedEvents = (await getCacheOnly(eventDate)) || [];
      cacheIndexByDate.set(eventDate, buildIndexFromEvents(cachedEvents));
    }

    const cacheIndex = cacheIndexByDate.get(eventDate);

    // 1) FIFO within current run (first accepted wins).
    if (existsInIndex(identity, selectedIndex)) {
      rejected.push({ event, reason: "run_duplicate" });
      continue;
    }

    selected.push({
      ...event,
      canonical_url: identity.canonicalUrl,
      title_fingerprint: identity.strictFingerprint,
      coarse_fingerprint: identity.coarseFingerprint,
    });

    appendToIndex(identity, selectedIndex);
  }

  logger.info(
    `FIFO selector (weather) accepted ${selected.length}/${events.length}, rejected ${rejected.length}`,
    "weather.selector"
  );

  return { selected, rejected };
};
