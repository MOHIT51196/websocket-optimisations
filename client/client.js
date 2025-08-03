import WebSocket from "ws";
import logger from "../utils/logger.js";

const DEFAULT_HEARTBEAT_INTERVAL_MS =
  process.env.DEFAULT_HEARTBEAT_INTERVAL_MS || 1000;

function startHeartBeat(ws) {
  setInterval(
    () => ws.ping(JSON.stringify({ wsId: ws.wsId })),
    DEFAULT_HEARTBEAT_INTERVAL_MS
  );
}

function createClient(wsId) {
  const ws = new WebSocket(`ws://${process.env.SERVER_BASE_URL}`);
  ws.wsId = wsId;
  ws.on("open", () => {
    logger.info(`[${wsId}] Connection is opened`);
    startHeartBeat(ws);
  })
    .on("message", (msg) => {
      logger.info(`[${wsId}] Message received from server : ${msg.toString()}`);
    })
    .on("close", () => {
      logger.info(`[${wsId}] Connection is closed`);
    })
    .on("error", (err) => {
      logger.error(
        `[${wsId}] Connection error : ${JSON.stringify(err, null, 4)}`
      );
    })
    .on("ping", () => {
      logger.debug(`[${wsId}] Server has pinged`);
    })
    .on("pong", () => {
      logger.debug(`[${wsId}] Server has ponged`);
    });
  return ws;
}

export default createClient;
