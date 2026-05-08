const logger = require('../utils/logger');
const shipsService = require('../modules/ships/ships.service');

exports.runShipsPipeline = async () => {
    logger.info("Initializing Ship Tracking pipeline...", "job.ships");
    try {
        const ships = await shipsService.fetchAndCacheShips();
        logger.info(`Ship pipeline completed. Synced ${ships.length} ships.`, "job.ships");
    } catch (err) {
        logger.error(`Ship pipeline fatal error: ${err.message}`, "job.ships");
    }
};
