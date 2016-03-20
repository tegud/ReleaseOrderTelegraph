"use strict";

const _ = require('lodash');
const WebServer = require('./web');
const checks = require('../checks');
const fs = require('fs');

function loadFromFile(configPath) {
    return new Promise((resolve, reject) => fs.readFile(`${__dirname}/${configPath}`, 'utf-8', (err, data) => {
        if(err) {
            return reject(err);
        }

        try {
            resolve(JSON.parse(data));
        }
        catch(e) {
            reject(`Error loading config file: ${e}`);
        }
    }));
}

function loadFromObject(config) {
    return new Promise(resolve => resolve(config));
}

function loadConfig(config) {
    return (typeof config === 'string' ? loadFromFile : loadFromObject)(config)
        .then(new Promise(resolve => resolve(_.defaults(config, { checks: [] }))));
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
            })))
            .catch(err => console.log(err)),
        stop: () => Promise.all([
            httpServer.stop(),
            checks.stop()
        ])
    }
};
