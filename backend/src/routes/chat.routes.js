const express = require("express");
const router = express.Router();

const logger = require("../utils/logger");
const { eventsLimiter } = require("../middleware/rateLimiter");
const {
	getRooms,
	createRoom,
	isChatDatabaseEnabled,
} = require("../db/chatRooms.repository");

router.get("/chat/rooms", eventsLimiter, async (_req, res) => {
	try {
		if (!isChatDatabaseEnabled()) {
			return res.status(503).json({
				success: false,
				error: "Chat requires MongoDB to be configured",
			});
		}

		const rooms = await getRooms();
		res.json({
			success: true,
			count: rooms.length,
			data: rooms,
		});
	} catch (err) {
		logger.error(`List chat rooms error: ${err.message}`, "chat.routes");
		res.status(500).json({ success: false, error: "Internal Server Error" });
	}
});

router.post("/chat/rooms", eventsLimiter, async (req, res) => {
	try {
		if (!isChatDatabaseEnabled()) {
			return res.status(503).json({
				success: false,
				error: "Chat requires MongoDB to be configured",
			});
		}

		const { roomName, topic, ownerName } = req.body || {};
		const room = await createRoom({ roomName, topic, ownerName });
		res.status(201).json({
			success: true,
			data: room,
		});
	} catch (err) {
		if (err.message === "Room name already exists") {
			return res.status(409).json({ success: false, error: err.message });
		}
		if (
			err.message === "Room name is required" ||
			err.message === "Owner name is required"
		) {
			return res.status(400).json({ success: false, error: err.message });
		}
		logger.error(`Create chat room error: ${err.message}`, "chat.routes");
		res.status(500).json({ success: false, error: "Internal Server Error" });
	}
});

module.exports = router;
