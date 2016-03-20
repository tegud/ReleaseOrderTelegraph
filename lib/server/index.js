"use strict";

const _ = require('lodash');
const WebServer = require('./web');
const checks = require('../checks');
const fs = require('fs');

function loadConfig(config) {
    return new Promise(resolve => {
        if(typeof config === 'string') {
            config = JSON.parse(fs.readFileSync(`${__dirname}/${config}`, 'utf-8'));
        }

        resolve(_.defaults(config, { checks: [] }));
    });
}

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
            }))),
        stop: () => Promise.all([
            httpServer.stop(),
            checks.stop()
        ])
    }
};
