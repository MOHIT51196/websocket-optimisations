import logger from "../utils/logger.js";
import createClient from "./client.js";
import assert from "node:assert";
import express from "express";
import morgan from "morgan";
import { StatusCodes, ReasonPhrases } from "http-status-codes";

const CLIENT_SPAWN_COUNT = process.env.CLIENT_SPAWN_COUNT || 1;
const SERVER_BASE_URL = process.env.SERVER_BASE_URL;
const PORT = process.env.PORT || 5000;

// bulk client execution
async function createClients() {
    const clients = new Map();
    for (let i = 0; i < CLIENT_SPAWN_COUNT; i++) {
        setTimeout(() => {
            try {
                const wsId = `ws-${process.pid}-${i}`;
                const client = createClient(wsId);
                clients.set(wsId, client);
            } catch (err) {
                logger.error(
                    `Error occured in creating client ${wsId} : ${JSON.stringify(err)}`
                );
            }
        }, 2 * i);
    }
    return clients;
}

// verification
function verifyConnections() {
    assert.equal(process.connections.size, CLIENT_SPAWN_COUNT);

    fetch(`http://${SERVER_BASE_URL}/stats`)
        .then((res) => res.json())
        .then(({ activeConnections }) =>
            assert(activeConnections, CLIENT_SPAWN_COUNT)
        );

    logger.info(`${CLIENT_SPAWN_COUNT} clients running successfully`);
}

function createServer() {
    const app = express();
    app.use(express.json());
    app.use(morgan("tiny"));

    app.post("/message", (req, res) => {
        const { wsId, msg } = req.body;

        if (!wsId?.trim()?.length) {
            return res.status(StatusCodes.OK).json({
                msg: `Property 'wsId' is required and should be string`,
                wsId,
            });
        }
        if (!process.connections?.has(wsId)) {
            return res.status(StatusCodes.OK).json({
                msg: `No such connection exists`,
                wsId,
            });
        }
        if (!msg) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                error: ReasonPhrases.BAD_REQUEST,
                msg: `Property 'msg' is required`,
                wsId,
            });
        }

        let resStatus = StatusCodes.OK;
        let resBody = {
            msg: `Message sent successfully`,
            wsId,
        };

        process.connections
            ?.get(wsId)
            .send(
                typeof msg === "object" ? JSON.stringify(msg) : String(msg),
                (err) => {
                    if(err) {
                        logger.error(
                            `Failed to send msg via connection ${wsId} : ${JSON.stringify(err)}`
                        );
                        resStatus = StatusCodes.INTERNAL_SERVER_ERROR;
                        resBody = {
                            error: ReasonPhrases.INTERNAL_SERVER_ERROR,
                            msg: `Failed to send the message`,
                            wsId,
                            cause: err,
                        };
                        return;
                    }
                    logger.debug(`Message sent succesfully to wsId ${wsId}`);
                }
            );

        res.status(resStatus).json(resBody);
    });

    // additional safeguards
    app.use((req, res) => {
        logger.info(`${req.path} is not supported by the server`);
        res.status(StatusCodes.NOT_FOUND).json({ error: ReasonPhrases.NOT_FOUND });
    });

    process.on("SIGINT", () => {
        logger.info("Client manager is shutting down");
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        logger.error("Client manager is forcefully terminated");
        process.exit(1);
    });

    return app;
}

const server = createServer();

server.listen(PORT, async () => {
    logger.info(`Running client handling server on port ${PORT}`);
    process.connections = await createClients();
    // setTimeout(verifyConnections, CLIENT_SPAWN_COUNT * 2);
});
