const { MongoClient, ObjectId } = require("mongodb");
const { randomUUID } = require("crypto");
const logger = require("../utils/logger");

let client = null;
let collection = null;

const isDatabaseEnabled = () => Boolean(process.env.MONGODB_URI);

const toRoomResponse = (doc) => ({
	id: doc._id.toString(),
	name: doc.name,
	topic: doc.topic || "",
	owner: doc.owner,
	members: (doc.members || []).map((member) => ({
		userId: member.userId,
		username: member.username,
		role: member.role || "member",
		joinedAt: member.joinedAt,
	})),
	onlineCount: Array.isArray(doc.members) ? doc.members.length : 0,
	createdAt: doc.createdAt,
	lastInteractionAt: doc.lastInteractionAt,
});

const normalizeName = (value) => value.trim().toLowerCase();

const getCollection = async () => {
	if (!isDatabaseEnabled()) return null;
	if (collection) return collection;

	const mongoUri = process.env.MONGODB_URI;
	const dbName = process.env.MONGODB_DB_NAME || "world_monitor";

	client = new MongoClient(mongoUri, {
		maxPoolSize: 20,
		minPoolSize: 2,
	});
	await client.connect();

	collection = client.db(dbName).collection("chat_rooms");
	await Promise.all([
		collection.createIndex({ roomNameNormalized: 1 }, { unique: true }),
		collection.createIndex({ updatedAt: -1 }),
		collection.createIndex({ lastInteractionAt: 1 }),
	]);
	logger.info(`MongoDB connected (${dbName}.chat_rooms)`, "db.chat");
	return collection;
};

const touchRoom = async (roomId) => {
	const col = await getCollection();
	if (!col) throw new Error("Database unavailable");

	const now = new Date();
	await col.updateOne(
		{ _id: new ObjectId(roomId) },
		{ $set: { updatedAt: now, lastInteractionAt: now } }
	);
};

exports.isChatDatabaseEnabled = isDatabaseEnabled;

exports.connectChatRoomsRepository = async () => {
	try {
		await getCollection();
	} catch (err) {
		logger.error(`MongoDB connection failed: ${err.message}`, "db.chat");
		throw err;
	}
};

exports.closeChatRoomsRepository = async () => {
	if (!client) return;
	await client.close();
	client = null;
	collection = null;
};

exports.createRoom = async ({ roomName, topic = "", ownerName }) => {
	const col = await getCollection();
	if (!col) throw new Error("Database unavailable");

	const cleanRoomName = (roomName || "").trim();
	const cleanOwnerName = (ownerName || "").trim();
	const cleanTopic = (topic || "").trim();

	if (!cleanRoomName) throw new Error("Room name is required");
	if (!cleanOwnerName) throw new Error("Owner name is required");

	const owner = {
		userId: randomUUID(),
		username: cleanOwnerName,
		usernameNormalized: normalizeName(cleanOwnerName),
		role: "owner",
		joinedAt: new Date(),
	};

	const now = new Date();
	const doc = {
		name: cleanRoomName,
		roomNameNormalized: normalizeName(cleanRoomName),
		topic: cleanTopic,
		owner: {
			userId: owner.userId,
			username: owner.username,
		},
		members: [owner],
		createdAt: now,
		updatedAt: now,
		lastInteractionAt: now,
	};

	try {
		const result = await col.insertOne(doc);
		const created = await col.findOne({ _id: result.insertedId });
		return toRoomResponse(created);
	} catch (err) {
		if (err?.code === 11000) {
			throw new Error("Room name already exists");
		}
		throw err;
	}
};

exports.getRooms = async () => {
	const col = await getCollection();
	if (!col) throw new Error("Database unavailable");

	const docs = await col.find({}).sort({ updatedAt: -1 }).limit(200).toArray();
	return docs.map(toRoomResponse);
};

exports.getRoomById = async (roomId) => {
	const col = await getCollection();
	if (!col) throw new Error("Database unavailable");
	if (!ObjectId.isValid(roomId)) throw new Error("Invalid room ID");

	const doc = await col.findOne({ _id: new ObjectId(roomId) });
	if (!doc) return null;
	return toRoomResponse(doc);
};

exports.joinRoom = async ({ roomId, username, userId = null, socketId = null }) => {
	const col = await getCollection();
	if (!col) throw new Error("Database unavailable");
	if (!ObjectId.isValid(roomId)) throw new Error("Invalid room ID");

	const cleanUsername = (username || "").trim();
	if (!cleanUsername) throw new Error("Username is required");

	const _id = new ObjectId(roomId);
	const room = await col.findOne({ _id });
	if (!room) throw new Error("Room not found");

	const now = new Date();
	const normalized = normalizeName(cleanUsername);

	const existingById = userId ? room.members.find((m) => m.userId === userId) : null;
	if (existingById) {
		await col.updateOne(
			{ _id, "members.userId": userId },
			{
				$set: {
					"members.$.socketId": socketId || null,
					"members.$.joinedAt": now,
					updatedAt: now,
					lastInteractionAt: now,
				},
			}
		);
		const updated = await col.findOne({ _id });
		const member = updated.members.find((m) => m.userId === userId);
		return {
			room: toRoomResponse(updated),
			member: {
				userId: member.userId,
				username: member.username,
				role: member.role || "member",
				joinedAt: member.joinedAt,
			},
		};
	}

	const usernameTaken = room.members.some((m) => m.usernameNormalized === normalized);
	if (usernameTaken) {
		throw new Error("Username already exists in this room");
	}

	const newMember = {
		userId: randomUUID(),
		username: cleanUsername,
		usernameNormalized: normalized,
		role: "member",
		socketId: socketId || null,
		joinedAt: now,
	};

	await col.updateOne(
		{ _id },
		{
			$push: { members: newMember },
			$set: { updatedAt: now, lastInteractionAt: now },
		}
	);

	const updated = await col.findOne({ _id });
	return {
		room: toRoomResponse(updated),
		member: {
			userId: newMember.userId,
			username: newMember.username,
			role: newMember.role,
			joinedAt: newMember.joinedAt,
		},
	};
};

exports.leaveRoom = async ({ roomId, userId = null, socketId = null }) => {
	const col = await getCollection();
	if (!col) throw new Error("Database unavailable");
	if (!ObjectId.isValid(roomId)) return null;

	const _id = new ObjectId(roomId);
	const room = await col.findOne({ _id });
	if (!room) return null;

	const member = room.members.find(
		(m) => (userId && m.userId === userId) || (socketId && m.socketId === socketId)
	);
	if (!member) return toRoomResponse(room);

	const now = new Date();
	await col.updateOne(
		{ _id },
		{
			$pull: { members: { userId: member.userId } },
			$set: { updatedAt: now, lastInteractionAt: now },
		}
	);

	const updated = await col.findOne({ _id });
	return updated ? toRoomResponse(updated) : null;
};

exports.kickUser = async ({ roomId, ownerUserId, targetUserId }) => {
	const col = await getCollection();
	if (!col) throw new Error("Database unavailable");
	if (!ObjectId.isValid(roomId)) throw new Error("Invalid room ID");

	const _id = new ObjectId(roomId);
	const room = await col.findOne({ _id });
	if (!room) throw new Error("Room not found");
	if (room.owner?.userId !== ownerUserId) throw new Error("Only owner can remove members");
	if (room.owner?.userId === targetUserId) throw new Error("Owner cannot remove self");

	const target = room.members.find((m) => m.userId === targetUserId);
	if (!target) throw new Error("User not found in room");

	const now = new Date();
	await col.updateOne(
		{ _id },
		{
			$pull: { members: { userId: targetUserId } },
			$set: { updatedAt: now, lastInteractionAt: now },
		}
	);

	const updated = await col.findOne({ _id });
	return {
		room: updated ? toRoomResponse(updated) : null,
		removedUser: {
			userId: target.userId,
			username: target.username,
			socketId: target.socketId || null,
		},
	};
};

exports.deleteRoom = async ({ roomId, ownerUserId }) => {
	const col = await getCollection();
	if (!col) throw new Error("Database unavailable");
	if (!ObjectId.isValid(roomId)) throw new Error("Invalid room ID");

	const _id = new ObjectId(roomId);
	const room = await col.findOne({ _id });
	if (!room) return null;
	if (room.owner?.userId !== ownerUserId) throw new Error("Only owner can delete the room");

	await col.deleteOne({ _id });
	return toRoomResponse(room);
};

exports.markRoomInteraction = async (roomId) => {
	if (!ObjectId.isValid(roomId)) return;
	await touchRoom(roomId);
};

exports.cleanupInactiveRooms = async ({ inactiveMinutes = 10 } = {}) => {
	const col = await getCollection();
	if (!col) throw new Error("Database unavailable");

	const now = new Date();
	const cutoff = new Date(now.getTime() - Math.max(1, inactiveMinutes) * 60 * 1000);
	const staleRooms = await col.find({ lastInteractionAt: { $lte: cutoff } }).toArray();

	if (!staleRooms.length) return [];

	const ids = staleRooms.map((room) => room._id);
	await col.deleteMany({ _id: { $in: ids } });
	return staleRooms.map(toRoomResponse);
};
