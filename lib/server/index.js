"use strict";

const _ = require('lodash');
const WebServer = require('./web');
const checks = require('../checks');

module.exports = function(config) {
    _.defaults(config, { checks: [] });

    const httpServer = new WebServer(config);

    return {
        start: () => Promise.all([
            checks.config(config),
            httpServer.start()
        ]).then(() => new Promise(resolve => {
            resolve();
        })),
        stop: () => Promise.all([httpServer.stop()])
    }
};
