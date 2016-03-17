"use strict";

const checks = require('../checks');
const express = require('express');
const _ = require('lodash');
const webserver = express();

webserver.get('/', (req, res) => {
    res.status(200).send(JSON.stringify({
        "name": "ReleaseOrderTelegraph"
    }));
});

webserver.get('/currentState', (req, res) => {
    const currentState = checks.getCurrent();

    res.status(200).send(JSON.stringify(currentState));
});

let httpServer;

module.exports = function(config) {
    _.defaults(config, { checks: [] });

    config.checks.forEach(check => checks.register(check));

    return {
        start: () => new Promise((resolve, reject) => httpServer = webserver.listen(config.port, (err) => {
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
