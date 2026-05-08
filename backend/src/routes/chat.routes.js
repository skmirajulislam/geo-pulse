const express = require("express");
const router = express.Router();

const logger = require("../utils/logger");
const { eventsLimiter } = require("../middleware/rateLimiter");
const asyncHandler = require("../utils/asyncHandler");
const {
	getRooms,
	createRoom,
	isChatDatabaseEnabled,
} = require("../db/chatRooms.repository");

const isChatUnavailableError = (message = "") =>
	message === "Database unavailable" ||
	/EAI_AGAIN|ECONNREFUSED|ENOTFOUND|querySrv/i.test(message);

router.get(
	"/chat/rooms",
	eventsLimiter,
	asyncHandler(async (_req, res, next) => {
		if (!isChatDatabaseEnabled()) {
			const err = new Error("Chat requires MongoDB to be configured");
			err.statusCode = 503;
			throw err;
		}

		const rooms = await getRooms();
		res.json({
			success: true,
			count: rooms.length,
			data: rooms,
		});
	})
);

router.post(
	"/chat/rooms",
	eventsLimiter,
	asyncHandler(async (req, res, next) => {
		if (!isChatDatabaseEnabled()) {
			const err = new Error("Chat requires MongoDB to be configured");
			err.statusCode = 503;
			throw err;
		}

		const { roomName, topic, ownerName } = req.body || {};
		const room = await createRoom({ roomName, topic, ownerName });
		res.status(201).json({
			success: true,
			data: room,
		});
	})
);

module.exports = router;
