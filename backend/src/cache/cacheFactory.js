/**
 * cacheFactory.js — Shared factory for Redis-backed date-keyed event caches.
 *
 * Eliminates the 98% code duplication between cache.service.js and
 * weatherCache.service.js by parameterizing the key prefix, archive index,
 * and repository import.
 */

const redis = require("../config/redis.js");
const logger = require("../utils/logger.js");
const stringSimilarity = require("string-similarity");

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

/**
 * Create a cache service bound to a specific key prefix and repository.
 *
 * @param {Object} options
 * @param {string} options.keyPrefix      — Redis key prefix, e.g. "geopolitics_events"
 * @param {string} options.archiveIndex   — Redis set key for archive dates, e.g. "geopolitics_archive_dates"
 * @param {Function} options.getEventsByDate     — repository method
 * @param {Function} options.getAvailableDatesFromDb — repository method
 * @param {Function} options.isDatabaseEnabled       — repository method
 */
module.exports = function createCacheService({
  keyPrefix,
  archiveIndex,
  getEventsByDate,
  getAvailableDatesFromDb,
  isDatabaseEnabled,
}) {
  const getDailyKey = (dateStr) => `${keyPrefix}:${dateStr}`;

  // ---------- INTERNAL: read raw envelope { date, events } ----------
  const _readEnvelope = async (key) => {
    let raw = null;
    try {
      raw = await redis.get(key);
    } catch (err) {
      logger.warn(`Redis GET failed for key "${key}": ${err.message}`, "cache");
      return null;
    }
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
    const timeDiff = Math.abs(new Date(a.timestamp) - new Date(b.timestamp)) / (1000 * 60 * 60);
    const similarity = stringSimilarity.compareTwoStrings(a.title.toLowerCase(), b.title.toLowerCase());
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

  const _pruneExpiredArchiveDates = async () => {
    if (RETENTION_DAYS <= 0) return;
    let dates = [];
    try {
      dates = await redis.smembers(archiveIndex);
    } catch (err) {
      logger.warn(`Redis SMEMBERS failed for "${archiveIndex}": ${err.message}`, "cache");
      return;
    }
    if (!dates || dates.length === 0) return;
    const cutoff = _cutoffDateString();
    const expiredDates = dates.filter((d) => d < cutoff);
    if (expiredDates.length === 0) return;
    const expiredKeys = expiredDates.map(getDailyKey);
    try {
      await redis.del(...expiredKeys);
      await redis.srem(archiveIndex, ...expiredDates);
    } catch (err) {
      logger.warn(`Redis prune failed for "${archiveIndex}": ${err.message}`, "cache");
      return;
    }
    logger.info(
      `Retention prune evicted ${expiredDates.length} Redis archive date keys older than ${RETENTION_DAYS} days`,
      "cache"
    );
  };

  const _pruneArchiveIndex = async () => {
    if (MAX_ARCHIVE_DATES <= 0) return;
    let dates = [];
    try {
      dates = (await redis.smembers(archiveIndex)).sort();
    } catch (err) {
      logger.warn(`Redis SMEMBERS failed for "${archiveIndex}": ${err.message}`, "cache");
      return;
    }
    if (dates.length <= MAX_ARCHIVE_DATES) return;
    const evictDates = dates.slice(0, dates.length - MAX_ARCHIVE_DATES);
    if (evictDates.length === 0) return;
    const keysToDelete = evictDates.map(getDailyKey);
    try {
      await redis.del(...keysToDelete);
      await redis.srem(archiveIndex, ...evictDates);
    } catch (err) {
      logger.warn(`Redis archive eviction failed for "${archiveIndex}": ${err.message}`, "cache");
      return;
    }
    logger.info(`Cache replacement evicted ${evictDates.length} archive date keys`, "cache");
  };

  const _writeEnvelope = async (envelope) => {
    const dateStr = envelope.date || todayString();
    const key = getDailyKey(dateStr);
    const json = JSON.stringify(envelope);
    try {
      await redis.set(key, json, "EX", CACHE_TTL_SECONDS);
      await redis.sadd(archiveIndex, dateStr);
      await _pruneExpiredArchiveDates();
      await _pruneArchiveIndex();
      logger.info(
        `Cache written mapped to date: ${dateStr} — ${envelope.events.length} events archived`,
        "cache"
      );
    } catch (err) {
      logger.warn(`Redis write failed for key "${key}": ${err.message}`, "cache");
    }
  };

  // ---------- PUBLIC API ----------
  const getAvailableDates = async () => {
    let redisDates = [];
    try {
      await _pruneExpiredArchiveDates();
      redisDates = await redis.smembers(archiveIndex);
    } catch (err) {
      logger.error(`Redis SMEMBERS error: ${err.message}`, "cache");
    }

    if (redisDates && redisDates.length > 0) {
      return redisDates.sort();
    }

    if (isDatabaseEnabled()) {
      try {
        const dbDates = await getAvailableDatesFromDb();
        if (dbDates.length > 0) {
          try {
            await redis.sadd(archiveIndex, ...dbDates);
            await _pruneArchiveIndex();
          } catch (err) {
            logger.warn(`Redis SADD failed for "${archiveIndex}": ${err.message}`, "cache");
          }
          return dbDates;
        }
      } catch (err) {
        logger.warn(`MongoDB dates fallback failed: ${err.message}`, "cache");
      }
    }

    return [todayString()];
  };

  const getCache = async (targetDate) => {
    const dateStr = targetDate || todayString();
    const key = getDailyKey(dateStr);
    logger.info(`Checking Redis cache for target date: ${dateStr}...`, "cache");

    const envelope = await _readEnvelope(key);
    if (envelope) {
      logger.info(`Cache hit (${dateStr}) — ${envelope.events.length} events`, "cache");
      return envelope.events;
    }

    if (isDatabaseEnabled()) {
      try {
        const dbEvents = await getEventsByDate(dateStr);
        if (dbEvents.length > 0) {
          logger.info(`Cache miss (${dateStr}) resolved from MongoDB (${dbEvents.length} events)`, "cache");
          await _writeEnvelope({ date: dateStr, events: dbEvents });
          return dbEvents;
        }
      } catch (err) {
        logger.warn(`MongoDB lookup failed for ${dateStr}: ${err.message}`, "cache");
      }
    }

    if (!targetDate || targetDate === todayString()) {
      logger.warn(`No DB records exactly matching ${dateStr}. Searching fallback index.`, "cache");
      const availableDates = await getAvailableDates();
      if (availableDates.length > 0) {
        const fallbackDate = availableDates[availableDates.length - 1];
        const fallbackKey = getDailyKey(fallbackDate);
        const fallbackEnvelope = await _readEnvelope(fallbackKey);
        if (fallbackEnvelope && fallbackEnvelope.events) return fallbackEnvelope.events;
        if (isDatabaseEnabled()) {
          try {
            const fallbackDbEvents = await getEventsByDate(fallbackDate);
            if (fallbackDbEvents.length > 0) {
              await _writeEnvelope({ date: fallbackDate, events: fallbackDbEvents });
              return fallbackDbEvents;
            }
          } catch (err) {
            logger.warn(`MongoDB fallback lookup failed for ${fallbackDate}: ${err.message}`, "cache");
          }
        }
      }
    }

    logger.warn(`No valid cache available for date ${dateStr}`, "cache");
    return null;
  };

  const getCacheOnly = async (targetDate) => {
    try {
      const dateStr = targetDate || todayString();
      const envelope = await _readEnvelope(getDailyKey(dateStr));
      return envelope?.events || null;
    } catch (err) {
      logger.error(`Redis getCacheOnly error: ${err.message}`, "cache");
      return null;
    }
  };

  const mergeAndSetCache = async (newEvents = []) => {
    try {
      logger.info(`mergeAndSetCache called with ${newEvents.length} new events`, "cache");
      const today = todayString();
      let existingEvents = [];
      const todayKey = getDailyKey(today);
      const envelope = await _readEnvelope(todayKey);
      if (envelope && envelope.date === today) {
        existingEvents = envelope.events || [];
        logger.info(`Merging with ${existingEvents.length} existing events from today`, "cache");
      } else if (envelope) {
        logger.info("New day detected — starting fresh accumulation", "cache");
      }
      const merged = _mergeDedup(existingEvents, newEvents);
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

  const setCache = async (data) => {
    try {
      logger.info("setCache (full overwrite) called", "cache");
      await _writeEnvelope({ date: todayString(), events: data });
    } catch (err) {
      logger.error(`setCache error: ${err.message}`, "cache");
    }
  };

  return {
    getAvailableDates,
    getCache,
    getCacheOnly,
    mergeAndSetCache,
    setCache,
  };
};
