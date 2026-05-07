/**
 * weatherCache.service.js — Weather events cache (Redis + MongoDB fallback)
 *
 * Uses the shared cacheFactory to avoid code duplication with cache.service.
 */

const createCacheService = require("./cacheFactory");
const {
  getEventsByDate,
  getAvailableDatesFromDb,
  isDatabaseEnabled,
} = require("../db/weather.repository");

const service = createCacheService({
  keyPrefix: "weather_events",
  archiveIndex: "weather_archive_dates",
  getEventsByDate,
  getAvailableDatesFromDb,
  isDatabaseEnabled,
});

module.exports = service;
