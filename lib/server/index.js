"use strict";

const express = require('express');
const webserver = express();

webserver.get('/currentState', (req, res) => {
    res.status(200).send(JSON.stringify({ "signal": "green" }));
});

let httpServer;

module.exports = function(config) {
    return {
        start: () => new Promise((resolve, reject) => httpServer = webserver.listen(config.port, '127.0.0.1', (err) => {
            if(err) {
                reject(err);
            }

            console.log(`Release Order Telegraph Started, listening on port ${config.port}`);

            resolve();
        })),
        stop: () => new Promise((resolve) => {
            httpServer.close();
            resolve();
        })
    }
};
