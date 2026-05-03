const {
	getRooms,
	joinRoom,
	leaveRoom,
	kickUser,
	deleteRoom,
	markRoomInteraction,
	cleanupInactiveRooms,
	getRoomById,
} = require("../db/chatRooms.repository");
const logger = require("../utils/logger");

const ROOM_PREFIX = "chat-room:";
const USER_SOCKET_MAP = new Map();

const roomChannel = (roomId) => `${ROOM_PREFIX}${roomId}`;

const normalizeMessage = (text) => {
	const value = (text || "").trim();
	if (!value) return null;
	return value.slice(0, 1000);
};

const emitRoomsUpdated = async (io) => {
	try {
		const rooms = await getRooms();
		io.emit("chat:rooms-updated", { rooms });
	} catch (err) {
		logger.error(`Failed to emit room updates: ${err.message}`, "chat.socket");
	}
};

const attachSocketUser = (socketId, roomId, userId) => {
	if (!USER_SOCKET_MAP.has(socketId)) {
		USER_SOCKET_MAP.set(socketId, []);
	}
	const current = USER_SOCKET_MAP.get(socketId);
	const exists = current.some((entry) => entry.roomId === roomId && entry.userId === userId);
	if (!exists) current.push({ roomId, userId });
};

const detachSocketUser = (socketId, roomId = null, userId = null) => {
	const current = USER_SOCKET_MAP.get(socketId) || [];
	const filtered = current.filter((entry) => {
		if (roomId && entry.roomId !== roomId) return true;
		if (userId && entry.userId !== userId) return true;
		return false;
	});

	if (!filtered.length) {
		USER_SOCKET_MAP.delete(socketId);
		return [];
	}

	USER_SOCKET_MAP.set(socketId, filtered);
	return filtered;
};

exports.registerChatSocket = (io) => {
	io.on("connection", (socket) => {
		logger.info(`Socket connected: ${socket.id}`, "chat.socket");

		socket.on("chat:rooms:get", async (_, ack = () => {}) => {
			try {
				const rooms = await getRooms();
				ack({ ok: true, rooms });
			} catch (err) {
				ack({ ok: false, error: err.message || "Failed to fetch rooms" });
			}
		});

		socket.on("chat:join", async (payload = {}, ack = () => {}) => {
			try {
				const { roomId, username, userId } = payload;
				const joined = await joinRoom({ roomId, username, userId, socketId: socket.id });

				socket.join(roomChannel(roomId));
				attachSocketUser(socket.id, roomId, joined.member.userId);

				io.to(roomChannel(roomId)).emit("chat:presence", {
					type: "join",
					room: joined.room,
					user: joined.member,
				});
				await emitRoomsUpdated(io);

				ack({ ok: true, room: joined.room, user: joined.member });
			} catch (err) {
				ack({ ok: false, error: err.message || "Failed to join room" });
			}
		});

		socket.on("chat:leave", async (payload = {}, ack = () => {}) => {
			try {
				const { roomId, userId } = payload;
				const room = await leaveRoom({ roomId, userId, socketId: socket.id });
				detachSocketUser(socket.id, roomId, userId);
				socket.leave(roomChannel(roomId));

				if (room) {
					io.to(roomChannel(roomId)).emit("chat:presence", {
						type: "leave",
						room,
						user: { userId },
					});
				}
				await emitRoomsUpdated(io);

				ack({ ok: true, room });
			} catch (err) {
				ack({ ok: false, error: err.message || "Failed to leave room" });
			}
		});

		socket.on("chat:send", async (payload = {}, ack = () => {}) => {
			try {
				const { roomId, userId, username, message } = payload;
				const content = normalizeMessage(message);
				if (!content) throw new Error("Message is required");

				const room = await getRoomById(roomId);
				if (!room) throw new Error("Room not found");
				const member = room.members.find((entry) => entry.userId === userId);
				if (!member) throw new Error("You are not part of this room");

				await markRoomInteraction(roomId);

				const messagePayload = {
					id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
					roomId,
					userId,
					username: member.username || username,
					message: content,
					timestamp: new Date().toISOString(),
				};
				io.to(roomChannel(roomId)).emit("chat:message", messagePayload);
				await emitRoomsUpdated(io);

				ack({ ok: true, message: messagePayload });
			} catch (err) {
				ack({ ok: false, error: err.message || "Failed to send message" });
			}
		});

		socket.on("chat:kick", async (payload = {}, ack = () => {}) => {
			try {
				const { roomId, ownerUserId, targetUserId } = payload;
				const result = await kickUser({ roomId, ownerUserId, targetUserId });

				if (result?.removedUser?.socketId) {
					detachSocketUser(result.removedUser.socketId, roomId, targetUserId);
					io.to(result.removedUser.socketId).emit("chat:removed", {
						roomId,
						reason: "Removed by room owner",
					});
				}

				io.to(roomChannel(roomId)).emit("chat:presence", {
					type: "kick",
					room: result.room,
					user: { userId: targetUserId, username: result.removedUser?.username },
				});
				await emitRoomsUpdated(io);

				ack({ ok: true, room: result.room });
			} catch (err) {
				ack({ ok: false, error: err.message || "Failed to remove user" });
			}
		});

		socket.on("chat:delete-room", async (payload = {}, ack = () => {}) => {
			try {
				const { roomId, ownerUserId } = payload;
				const removed = await deleteRoom({ roomId, ownerUserId });
				if (!removed) {
					ack({ ok: false, error: "Room not found" });
					return;
				}

				io.to(roomChannel(roomId)).emit("chat:room-deleted", {
					roomId,
					reason: "Deleted by owner",
				});
				for (const [socketId, entries] of USER_SOCKET_MAP.entries()) {
					const filtered = entries.filter((entry) => entry.roomId !== roomId);
					if (!filtered.length) USER_SOCKET_MAP.delete(socketId);
					else USER_SOCKET_MAP.set(socketId, filtered);
				}
				await emitRoomsUpdated(io);

				ack({ ok: true, roomId });
			} catch (err) {
				ack({ ok: false, error: err.message || "Failed to delete room" });
			}
		});

		socket.on("disconnect", async () => {
			const entries = USER_SOCKET_MAP.get(socket.id) || [];
			USER_SOCKET_MAP.delete(socket.id);

			for (const entry of entries) {
				try {
					const room = await leaveRoom({
						roomId: entry.roomId,
						userId: entry.userId,
						socketId: socket.id,
					});
					if (room) {
						io.to(roomChannel(entry.roomId)).emit("chat:presence", {
							type: "leave",
							room,
							user: { userId: entry.userId },
						});
					}
				} catch (err) {
					logger.error(`Disconnect cleanup failed: ${err.message}`, "chat.socket");
				}
			}

			await emitRoomsUpdated(io);
			logger.info(`Socket disconnected: ${socket.id}`, "chat.socket");
		});
	});
};

exports.startInactiveRoomCleanup = (io) => {
	const intervalMinutes = Number(process.env.CHAT_ROOM_INACTIVE_MINUTES || 10);
	const cleanupMs = Math.max(1, intervalMinutes) * 60 * 1000;

	setInterval(async () => {
		try {
			const removedRooms = await cleanupInactiveRooms({ inactiveMinutes: intervalMinutes });
			if (!removedRooms.length) return;

			for (const room of removedRooms) {
				io.to(roomChannel(room.id)).emit("chat:room-deleted", {
					roomId: room.id,
					reason: "Room removed due to inactivity",
				});
				for (const [socketId, entries] of USER_SOCKET_MAP.entries()) {
					const filtered = entries.filter((entry) => entry.roomId !== room.id);
					if (!filtered.length) USER_SOCKET_MAP.delete(socketId);
					else USER_SOCKET_MAP.set(socketId, filtered);
				}
			}
			await emitRoomsUpdated(io);
			logger.info(`Removed ${removedRooms.length} inactive chat room(s)`, "chat.socket");
		} catch (err) {
			logger.error(`Inactive room cleanup failed: ${err.message}`, "chat.socket");
		}
	}, cleanupMs);
};
