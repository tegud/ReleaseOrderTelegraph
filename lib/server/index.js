"use strict";

const WebServer = require('./web');
const checks = require('../checks');
const loadConfig = require('../config');

module.exports = function(config) {
    let httpServer;

    return {
        start: () => loadConfig(config)
            .then(config => new Promise(resolve => {
                httpServer = new WebServer(config);
                resolve(config);
            }))
            .then(config => Promise.all([
                checks.config(config),
                httpServer.start()
            ]).then(() => new Promise(resolve => {
                resolve();
            })))
            .catch(err => console.log(err)),
        stop: () => Promise.all([
            httpServer.stop(),
            checks.stop()
        ])
    }
};
