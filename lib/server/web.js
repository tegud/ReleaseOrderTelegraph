"use strict";

const checks = require('../checks');
const express = require('express');
const moment = require('moment');
const webserver = express();

webserver.get('/', (req, res) => {
    res.status(200).send(JSON.stringify({
        "name": "ReleaseOrderTelegraph",
        "serverTime": moment().format()
    }));
});

webserver.get('/currentState', (req, res) => {
    checks.getCurrent().then(currentState => res
        .set('Access-Control-Allow-Origin', '*')
        .status(200)
        .send(JSON.stringify(currentState)));
});

module.exports = function (config) {
    let httpServer;

    return {
        start: () => new Promise((resolve, reject) => {
            httpServer = webserver.listen(config.port, (err) => {
                if(err) {
                    reject(err);
                }

                console.log(`Release Order Telegraph Started, listening on port ${config.port}`);

                resolve();
            });
        }),
        stop: () => new Promise(resolve => {
            httpServer.close();
            resolve();
        })
    };
};
