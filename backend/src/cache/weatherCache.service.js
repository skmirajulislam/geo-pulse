const redis = require("../config/redis.js");
const logger = require("../utils/logger.js");
const stringSimilarity = require("string-similarity");
const {
  getEventsByDate,
  getAvailableDatesFromDb,
  isDatabaseEnabled,
} = require("../db/weather.repository");

const ARCHIVE_INDEX = "weather_archive_dates";
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 15);
const CACHE_TTL_SECONDS = Number(
  process.env.REDIS_CACHE_TTL_SECONDS || RETENTION_DAYS * 24 * 60 * 60
);
const MAX_ARCHIVE_DATES = Number(process.env.REDIS_MAX_ARCHIVE_DATES || 45);

// Returns today's date as "YYYY-MM-DD" shifted to the local system timezone instead of strict UTC.
const todayString = () => {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzOffset).toISOString().slice(0, 10);
};

// Compute dynamic key
const getDailyKey = (dateStr) => `weather_events:${dateStr}`;

// ---------- INTERNAL: read raw envelope { date, events } ----------
const _readEnvelope = async (key) => {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { date: key.split(':')[1] || todayString(), events: parsed };
    if (parsed && Array.isArray(parsed.events)) return parsed;
    return null;
  } catch {
    return null;
  }
};

// ---------- INTERNAL: deduplicate across two event lists ----------
const _isSameEvent = (a, b) => {
  if (!a.title || !b.title) return false;

  const sameCountry = (a.country || "") === (b.country || "");
  const sameType = (a.type || "") === (b.type || "");

  const timeDiff =
    Math.abs(new Date(a.timestamp) - new Date(b.timestamp)) / (1000 * 60 * 60);

  const similarity = stringSimilarity.compareTwoStrings(
    a.title.toLowerCase(),
    b.title.toLowerCase()
  );

  return sameCountry && sameType && timeDiff < 24 && similarity > 0.7;
};

const _mergeDedup = (existing, incoming) => {
  const merged = existing.map(e => ({ ...e }));

  for (const evt of incoming) {
    const match = merged.find(m => _isSameEvent(m, evt));
    if (match) {
      const existingUrls = new Set((match.sources || []).map(s => s.url));
      for (const src of (evt.sources || [])) {
        if (!existingUrls.has(src.url)) {
          match.sources.push(src);
          existingUrls.add(src.url);
        }
      }
      match.severity = Math.max(match.severity, evt.severity);
      match.confidence = (match.confidence + evt.confidence) / 2;
    } else {
      merged.push({ ...evt });
    }
  }

  return merged;
};

const _cutoffDateString = () => {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  const yyyy = cutoff.getUTCFullYear();
  const mm = String(cutoff.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cutoff.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// ---------- INTERNAL: prune dates older than retention ----------
const _pruneExpiredArchiveDates = async () => {
  if (RETENTION_DAYS <= 0) return;

  const dates = await redis.smembers(ARCHIVE_INDEX);
  if (!dates || dates.length === 0) return;

  const cutoff = _cutoffDateString();
  const expiredDates = dates.filter((d) => d < cutoff);
  if (expiredDates.length === 0) return;

  const expiredKeys = expiredDates.map(getDailyKey);
  await redis.del(...expiredKeys);
  await redis.srem(ARCHIVE_INDEX, ...expiredDates);

  logger.info(
    `Retention prune evicted ${expiredDates.length} Redis archive date keys older than ${RETENTION_DAYS} days`,
    "cache"
  );
};

// ---------- INTERNAL: keep archive index bounded (cache replacement) ----------
const _pruneArchiveIndex = async () => {
  if (MAX_ARCHIVE_DATES <= 0) return;

  const dates = (await redis.smembers(ARCHIVE_INDEX)).sort();
  if (dates.length <= MAX_ARCHIVE_DATES) return;

  const evictDates = dates.slice(0, dates.length - MAX_ARCHIVE_DATES);
  if (evictDates.length === 0) return;

  const keysToDelete = evictDates.map(getDailyKey);
  await redis.del(...keysToDelete);
  await redis.srem(ARCHIVE_INDEX, ...evictDates);

  logger.info(
    `Cache replacement evicted ${evictDates.length} archive date keys`,
    "cache"
  );
};

// ---------- INTERNAL: write envelope to target date key & index ----------
const _writeEnvelope = async (envelope) => {
  const dateStr = envelope.date || todayString();
  const key = getDailyKey(dateStr);
  const json = JSON.stringify(envelope);

  await redis.set(key, json, "EX", CACHE_TTL_SECONDS);
  await redis.sadd(ARCHIVE_INDEX, dateStr);
  await _pruneExpiredArchiveDates();
  await _pruneArchiveIndex();

  logger.info(
    `Cache written mapped to date: ${dateStr} — ${envelope.events.length} events archived`,
    "cache"
  );
};

// ---------- PUBLIC: list all archived dates ----------
exports.getAvailableDates = async () => {
  try {
    await _pruneExpiredArchiveDates();
    const dates = await redis.smembers(ARCHIVE_INDEX);
    if (dates && dates.length > 0) return dates.sort();

    if (isDatabaseEnabled()) {
      const dbDates = await getAvailableDatesFromDb();
      if (dbDates.length > 0) {
        await redis.sadd(ARCHIVE_INDEX, ...dbDates);
        await _pruneArchiveIndex();
        return dbDates;
      }
    }

    return [todayString()];
  } catch (err) {
    logger.error(`Redis SMEMBERS error: ${err.message}`, "cache");
    return [todayString()];
  }
};

// ---------- PUBLIC: get (accept optional specific YYYY-MM-DD parameter) ----------
exports.getCache = async (targetDate) => {
  try {
    const dateStr = targetDate || todayString();
    const key = getDailyKey(dateStr);

    logger.info(`Checking Redis cache for target date: ${dateStr}...`, "cache");

    let envelope = await _readEnvelope(key);

    if (envelope) {
      logger.info(`Cache hit (${dateStr}) — ${envelope.events.length} events`, "cache");
      return envelope.events;
    }

    if (isDatabaseEnabled()) {
      const dbEvents = await getEventsByDate(dateStr);
      if (dbEvents.length > 0) {
        logger.info(`Cache miss (${dateStr}) resolved from MongoDB (${dbEvents.length} events)`, "cache");
        await _writeEnvelope({ date: dateStr, events: dbEvents });
        return dbEvents;
      }
    }

    // Attempt cold-start fallback (try finding ANY data if strictly looking for today)
    if (!targetDate || targetDate === todayString()) {
      logger.warn(`No DB records exactly matching ${dateStr}. Searching fallback index.`, "cache");
      const availableDates = await exports.getAvailableDates();
      if (availableDates.length > 0) {
        const fallbackDate = availableDates[availableDates.length - 1];
        const fallbackKey = getDailyKey(fallbackDate);
        const fallbackEnvelope = await _readEnvelope(fallbackKey);
        if (fallbackEnvelope && fallbackEnvelope.events) return fallbackEnvelope.events;

        if (isDatabaseEnabled()) {
          const fallbackDbEvents = await getEventsByDate(fallbackDate);
          if (fallbackDbEvents.length > 0) {
            await _writeEnvelope({ date: fallbackDate, events: fallbackDbEvents });
            return fallbackDbEvents;
          }
        }
      }
    }

    logger.warn(`No valid cache available for date ${dateStr}`, "cache");
    return null;
  } catch (err) {
    logger.error(`Redis GET error: ${err.message}`, "cache");
    return null;
  }
};

// ---------- PUBLIC: redis-only read (no DB fallback) ----------
exports.getCacheOnly = async (targetDate) => {
  try {
    const dateStr = targetDate || todayString();
    const envelope = await _readEnvelope(getDailyKey(dateStr));
    return envelope?.events || null;
  } catch (err) {
    logger.error(`Redis getCacheOnly error: ${err.message}`, "cache");
    return null;
  }
};

// ---------- PUBLIC: merge new events with existing ones, then save ----------
exports.mergeAndSetCache = async (newEvents = []) => {
  try {
    logger.info(
      `mergeAndSetCache called with ${newEvents.length} new events`,
      "cache"
    );

    const today = todayString();

    // Read what is already cached for today
    let existingEvents = [];
    const todayKey = getDailyKey(today);
    const envelope = await _readEnvelope(todayKey);

    if (envelope && envelope.date === today) {
      // Same day — accumulate
      existingEvents = envelope.events || [];
      logger.info(
        `Merging with ${existingEvents.length} existing events from today`,
        "cache"
      );
    } else if (envelope) {
      // Different day — should not happen with dynamic keys, but just in case
      logger.info("New day detected — starting fresh accumulation", "cache");
    }

    // Merge + deduplicate
    const merged = _mergeDedup(existingEvents, newEvents);

    // Sort by score descending (same ordering as news.scorer)
    merged.sort((a, b) => (b.score || 0) - (a.score || 0));

    logger.info(
      `Merged: ${existingEvents.length} existing + ${newEvents.length} new → ${merged.length} unique events`,
      "cache"
    );

    await _writeEnvelope({ date: today, events: merged });
  } catch (err) {
    logger.error(`mergeAndSetCache error: ${err.message}`, "cache");
  }
};

// ---------- PUBLIC: full overwrite (kept for manual use / testing) ----------
exports.setCache = async (data) => {
  try {
    logger.info("setCache (full overwrite) called", "cache");
    await _writeEnvelope({ date: todayString(), events: data });
  } catch (err) {
    logger.error(`setCache error: ${err.message}`, "cache");
  }
};
