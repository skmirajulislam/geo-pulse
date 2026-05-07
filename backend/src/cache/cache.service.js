/**
 * cache.service.js — Geopolitical events cache (Redis + MongoDB fallback)
 *
 * Uses the shared cacheFactory to avoid code duplication with weatherCache.
 */

const createCacheService = require("./cacheFactory");
const {
  getEventsByDate,
  getAvailableDatesFromDb,
  isDatabaseEnabled,
} = require("../db/events.repository");

const service = createCacheService({
  keyPrefix: "geopolitics_events",
  archiveIndex: "geopolitics_archive_dates",
  getEventsByDate,
  getAvailableDatesFromDb,
  isDatabaseEnabled,
});

module.exports = service;
