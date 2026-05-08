const WebSocket = require('ws');
const logger = require('../../utils/logger');
const redisClient = require('../../config/redis');
const { upsertShips, getShipsFromDb } = require('../../db/ships.repository');

const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY || '';
const SHIPS_REDIS_KEY = 'global_ships_data';

/**
 * Fetch vessel data from aisstream.io by sampling the live stream for 10 seconds
 */
exports.fetchAndCacheShips = async () => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!AISSTREAM_API_KEY || AISSTREAM_API_KEY === 'your_aisstream_api_key') {
                logger.warn("API KEY is not set. Using mock ship data.", "ships.service");
                const shipsData = generateMockShips();
                await cacheData(shipsData);
                return resolve(shipsData);
            }

            logger.info("Opening WebSocket to aisstream.io...", "ships.service");
            const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
            const shipsMap = new Map();
            let timeoutId;

            ws.on("open", () => {
                logger.info("Connected to aisstream.io. Subscribing for 10 seconds...", "ships.service");
                
                // Subscribe to global bounding box
                const subscriptionMessage = {
                    APIKey: AISSTREAM_API_KEY,
                    BoundingBoxes: [[[-90, -180], [90, 180]]],
                    FilterMessageTypes: ["PositionReport"]
                };
                ws.send(JSON.stringify(subscriptionMessage));

                // Close after 10 seconds and save what we got
                timeoutId = setTimeout(async () => {
                    ws.close();
                    
                    const shipsData = Array.from(shipsMap.values());
                    logger.info(`Collected ${shipsData.length} live ships from aisstream.io.`, "ships.service");
                    
                    if (shipsData.length > 0) {
                        await cacheData(shipsData);
                    } else {
                        logger.warn("No ships collected. Using mock fallback.", "ships.service");
                        const mockData = generateMockShips();
                        await cacheData(mockData);
                        resolve(mockData);
                        return;
                    }
                    resolve(shipsData);
                }, 10000);
            });

            ws.on("message", (data) => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.MessageType === "PositionReport" && parsed.MetaData && parsed.Message?.PositionReport) {
                        const meta = parsed.MetaData;
                        const report = parsed.Message.PositionReport;
                        
                        // Deduplicate by MMSI (Ship ID)
                        shipsMap.set(meta.MMSI, {
                            id: meta.MMSI.toString(),
                            name: (meta.ShipName || 'Unknown Vessel').trim(),
                            type: getShipType(report.ShipType) || 'Vessel',
                            heading: report.TrueHeading || report.Cog || 0,
                            speed: report.Sog || 0,
                            destination: 'Unknown', // Not always in PositionReport, usually in ShipStaticData
                            location: {
                                lat: meta.latitude,
                                lng: meta.longitude
                            },
                            last_updated: Date.now()
                        });
                    }
                } catch (err) {
                    // ignore parse errors for individual messages
                }
            });

            ws.on("error", (err) => {
                logger.error(`WebSocket error: ${err.message}`, "ships.service");
                if (timeoutId) clearTimeout(timeoutId);
                reject(err);
            });

        } catch (error) {
            logger.error(`Error fetching ships: ${error.message}`, "ships.service");
            reject(error);
        }
    });
};

/**
 * Retrieve cached ships from Redis, fallback to DB
 */
exports.getCachedShips = async () => {
    try {
        const data = await redisClient.get(SHIPS_REDIS_KEY);
        if (data) {
            return JSON.parse(data);
        }
        
        // Fallback to database
        logger.info("Cache miss for ships. Fetching from DB...", "ships.service");
        const dbData = await getShipsFromDb();
        if (dbData && dbData.length > 0) {
            await redisClient.setex(SHIPS_REDIS_KEY, 7200, JSON.stringify(dbData));
            return dbData;
        }
        
        return [];
    } catch (error) {
        logger.error(`Error retrieving ships from cache: ${error.message}. Falling back to DB.`, "ships.service");
        try {
            const dbData = await getShipsFromDb();
            return Array.isArray(dbData) ? dbData : [];
        } catch (dbError) {
            logger.error(`Error retrieving ships from DB fallback: ${dbError.message}`, "ships.service");
            return [];
        }
    }
};

async function cacheData(shipsData) {
    // Cache the data in Redis for 2 hours
    if (shipsData.length > 0) {
        await redisClient.setex(SHIPS_REDIS_KEY, 7200, JSON.stringify(shipsData));
        // Also persist to MongoDB
        await upsertShips(shipsData);
    }
}

/**
 * Map raw ShipType numbers to human readable strings if we had them.
 * (PositionReport usually lacks this, so we default to 'Vessel', 
 * but this is here for future expansion if we subscribe to ShipStaticData).
 */
function getShipType(typeCode) {
    if (!typeCode) return 'Cargo';
    if (typeCode >= 70 && typeCode <= 79) return 'Cargo';
    if (typeCode >= 80 && typeCode <= 89) return 'Tanker';
    if (typeCode >= 60 && typeCode <= 69) return 'Passenger';
    return 'Vessel';
}

/**
 * Generate mock ship data around major choke points for demonstration
 */
function generateMockShips() {
    const chokePoints = [
        { lat: 1.25, lng: 103.8 }, // Singapore Strait
        { lat: 27.9, lng: 34.5 },  // Red Sea / Suez
        { lat: 9.0, lng: -79.5 },  // Panama Canal
        { lat: 35.9, lng: -5.3 },  // Strait of Gibraltar
        { lat: 50.9, lng: 1.5 },   // English Channel
        { lat: 25.2, lng: 55.3 },  // Strait of Hormuz
    ];

    const ships = [];
    let idCounter = 10000;

    chokePoints.forEach(point => {
        const numShips = Math.floor(Math.random() * 6) + 5;
        for (let i = 0; i < numShips; i++) {
            const spreadLat = (Math.random() - 0.5) * 2;
            const spreadLng = (Math.random() - 0.5) * 2;
            
            ships.push({
                id: (idCounter++).toString(),
                name: `Vessel ${idCounter}`,
                type: Math.random() > 0.5 ? 'Cargo' : 'Tanker',
                heading: Math.floor(Math.random() * 360),
                speed: Math.floor(Math.random() * 20) + 5,
                destination: 'Global Port',
                location: {
                    lat: point.lat + spreadLat,
                    lng: point.lng + spreadLng
                },
                last_updated: Date.now()
            });
        }
    });

    return ships;
}
