import express from "express";
import morgan from "morgan";
import { WebSocketServer } from "ws";
import logger from "../utils/logger.js";
import handleConnection from "./connection.js";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import cluster from "node:cluster";
import os from "node:os";
import Memcached from "memcached";
import { error } from "node:console";

const isClusterEnabled = process.env.CLUSTER_ENABLED === "true" || false;
const isClusterCacheEnabled = process.env.CLUSTER_CACHE_ENABLED === "true" || false;
const PORT = process.env.PORT || 3000;

const KEY_ACTIVE_CONNECTIONS = 'ws:active-connections';
const cache = new Memcached('localhost:11211', {
    namespace: '',
    timeout: 1000,
    retries: 1,
    retry: 1000,
    remove: true,
    failOverServers: []
});

if (isClusterEnabled && cluster.isPrimary) {
    logger.info(`Server is running is clustered mode`);
    logger.debug(`Running master process with pid ${process.pid}`)
    const cpus = os.availableParallelism();
    logger.info(`Spawning ${cpus} child process`)
    
    // every process has its own connection count
    if(isClusterCacheEnabled) {
        cache.set(KEY_ACTIVE_CONNECTIONS, 0, 1000, function (err, isDone) {
            if (err) {
            console.error(`Error init connection count : ${JSON.stringify(err)}`);
            return;
            }
            logger.info(`Set active connect count status : ${isDone}`);
        });
    }
    for (let i = 0; i < cpus; i++) {
        cluster.fork();
    }
} else {
    const app = express();
    app.use(morgan("tiny"));

    // create HTTP server
    const server = app.listen(PORT, (err) => {
        if (err) logger.error(`Server failed to listen on port : ${JSON.stringify(err)}`);
        if (cluster.isPrimary) logger.info(`Server is listing on port ${PORT}`);
    });

    app.get("/stats", (req, res) => {
        if(isClusterEnabled) {
            if (isClusterCacheEnabled) {
                cache.get(KEY_ACTIVE_CONNECTIONS, (err, activeConnections) => {
                    if(err) {
                        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                            error: ReasonPhrases.INTERNAL_SERVER_ERROR,
                            msg: `Unable to fetch active connection count`
                        });
                    }
                    res.status(StatusCodes.OK).json({
                        activeConnections: activeConnections ?? 0,
                    });
                });
            } else {
                res.status(StatusCodes.METHOD_NOT_ALLOWED).json({
                    error: ReasonPhrases.METHOD_NOT_ALLOWED
                });
            }
        } else {
            res.status(StatusCodes.OK).json({
                activeConnections: wss.activeConnections,
            });
        }
    });
    

    // create websocket server and attach to existing HTTP server
    // to handle connection upgrade call
    const wss = new WebSocketServer({
        server,
        autoPong: true,
        maxPayload: 1024,
    });
    wss.activeConnections = 0;


    wss.on("listening", () => {
        logger.debug("Server is listening");
    });

    wss.on("error", (error) => {
        logger.error("Websocket error : ", error);
    });

    wss.on("connection", (ws) => {
        handleConnection(ws, cache);
    });

    wss.on("error", (error) => {
        logger.error(error);
    });

    wss.on("close", () => {
        logger.info("Server is closed");
    });

    // additional safeguards
    app.use((req, res) => {
        logger.info(`${req.path} is not supported by the server`);
        res.status(StatusCodes.NOT_FOUND).json({ error: ReasonPhrases.NOT_FOUND });
    });

    process.on("SIGINT", () => {
        logger.info(`Server is shutting down with pid ${process.pid}`);
        wss.close();
        server.close();
        process.exit(0);    // for child process
    });

    process.on("SIGTERM", () => {
        logger.error(`Server is forcefully terminated pid ${process.pid}`);
        wss.close();
        server.close();
        process.exit(1); // for child process
    });
}

if (isClusterEnabled && cluster.isPrimary) {
    process.on("SIGINT", () => {
        logger.info(`Server is shutting down with pid ${process.pid}`);
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        logger.error(`Server is forcefully terminated pid ${process.pid}`);
        process.exit(1);
    });
}