const express = require('express');
const router = express.Router();
const shipsService = require('../modules/ships/ships.service');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

router.get(
	'/locations',
	asyncHandler(async (req, res, next) => {
		const ships = await shipsService.getCachedShips();
		res.json({ success: true, data: ships });
	})
);

// Manual trigger for testing/admin purposes
router.post(
	'/sync',
	asyncHandler(async (req, res, next) => {
		const ships = await shipsService.fetchAndCacheShips();
		res.json({
			success: true,
			message: 'Ships synced successfully',
			count: ships.length,
		});
	})
);

module.exports = router;
