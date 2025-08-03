import logger from "../utils/logger.js";
import crypto from "node:crypto";

const KEY_ACTIVE_CONNECTIONS = 'ws:active-connections';
const isClusterCacheEnabled = process.env.CLUSTER_CACHE_ENABLED === "true" || false;

function updateConnectionCount(ws, cache, value) {
    if(isClusterCacheEnabled) {
        const callback = (err, result) => {
            if (err) {
              logger.error(`Error updating connection count : ${JSON.stringify(err)}`);
            }
            if (!result) {
              logger.error(`Failed to update connection count`);
            }
        };
        
        if (value < 0) {
        cache.decr(KEY_ACTIVE_CONNECTIONS, Math.abs(value), callback);
        } else {
        cache.incr(KEY_ACTIVE_CONNECTIONS, Math.abs(value), callback);
        }
    }
    ws.activeConnections += value;
}

function handleConnection(ws, cache) {
    updateConnectionCount(ws, cache, 1);
    logger.info("Client connected");
    ws.on("message", (msg) => {
        logger.debug(`[${process.pid}] Message received from client : ${msg.toString()}`);
        ws.send(
            JSON.stringify({
                sha: crypto.createHash("sha256").update(msg.toString()).digest("hex"),
            })
        );
    })
        .on("ping", (data) => {
            const { wsId } = JSON.parse(data.toString());
            logger.debug(`Client ${wsId} has pinged`);
        })
        .on("pong", () => {
            logger.debug(`Client ${wsId} has ponged`);
        })
        .on("close", () => {
            updateConnectionCount(ws, cache, -1);
            logger.info(`Client disconnected`);
        })
        .on("error", (error) => {
            logger.debug(`Client error : ${JSON.stringify(error, null, 4)}`);
            if (error.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH") {
                logger.error(`Message is too large to be processed`);
            }
        });
}

export default handleConnection;
