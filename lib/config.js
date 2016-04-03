"use strict";

const _ = require('lodash');
const fs = require('fs');

function loadFromFile(configPath) {
    return new Promise((resolve, reject) => fs.readFile(`${__dirname}/../${configPath}`, 'utf-8', (err, data) => {
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

function setDefaults(config) {
    return new Promise(resolve => resolve(_.defaults(config, { checks: [], publishers: [] })));
}

function getConfigHandler(config) {
    return new Promise(resolve => resolve((typeof config === 'string' ? loadFromFile : loadFromObject).bind(undefined, config)));
}

module.exports = (config) => getConfigHandler(config)
        .then(configLoader => configLoader())
        .then(loadedConfig => setDefaults(loadedConfig));
