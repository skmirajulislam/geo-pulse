const { getDb } = require('./mongoClient');
const logger = require('../utils/logger');

let db = null;
let shipsCollection = null;

exports.connectShipsRepository = async () => {
    try {
        db = await getDb();
        if (db) {
            shipsCollection = db.collection('ships');
            await shipsCollection.createIndex({ id: 1 }, { unique: true });
            logger.info("MongoDB collection ready (ships)", "db.ships");
        }
    } catch (err) {
        logger.error(`Error connecting to ships collection: ${err.message}`, "db.ships");
    }
};

exports.upsertShips = async (ships) => {
    if (!shipsCollection || ships.length === 0) return;
    
    try {
        const bulkOps = ships.map(ship => ({
            updateOne: {
                filter: { id: ship.id },
                update: { $set: ship },
                upsert: true
            }
        }));
        
        const result = await shipsCollection.bulkWrite(bulkOps);
        logger.info(`Persisted to MongoDB: upserted=${result.upsertedCount}, modified=${result.modifiedCount}`, "db.ships");
    } catch (err) {
        logger.error(`Error upserting ships to DB: ${err.message}`, "db.ships");
    }
};

exports.getShipsFromDb = async () => {
    if (!shipsCollection) return [];
    try {
        return await shipsCollection.find({}).toArray();
    } catch (err) {
        logger.error(`Error getting ships from DB: ${err.message}`, "db.ships");
        return [];
    }
};

exports.closeShipsRepository = async () => {
    // Shared client handles actual closure
    db = null;
    shipsCollection = null;
};
