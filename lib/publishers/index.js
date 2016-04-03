"use strict";

const EventEmitter = require('events');
let eventEmitter;

module.exports = {
    config: config => new Promise(resolve => {
        eventEmitter = new EventEmitter();
        resolve(config.publishers.map(publisherConfig => new require(`../publishers/${publisherConfig.type}`)(publisherConfig)));
    }).then(publishers => Promise.all(publishers.map(publisher => {
        if(!publisher.start) {
            return new Promise(resolve => resolve());
        }

        return publisher.start(eventEmitter);
    }))),
    newSignalState: newState => {
        eventEmitter.emit('newSignalState', newState);
    }
};
