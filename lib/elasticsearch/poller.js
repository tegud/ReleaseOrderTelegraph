"use strict";

const indicies = require('./indicies');
const elasticsearch = require('elasticsearch');
const moment = require('moment');
const _ = require('lodash');
const EventEmitter = require('events');

function getStateFromEs(client, config, queryBuilder, indexBuilder) {
    return new Promise(resolve => {
        const today = moment();

        client.search(_.merge(queryBuilder(), { index: indexBuilder.get(today) }))
            .then(res => resolve(res))
            .catch(err => {
                console.log('Couldnt contact Elasticsearch', err);
                resolve({ error: err })
            });
    });
}

module.exports = function elasticsearchPoller(config, queryBuilder) {
    const client = new elasticsearch.Client({
        host: `${config.elasticsearch.host}:${config.elasticsearch.port}`
    });
    const query = getStateFromEs.bind(undefined, client, config, queryBuilder, new indicies(config.elasticsearch.index));
    const eventEmitter = new EventEmitter();
    let lastResponse;
    let pollTimeout;
    let currentPromise;

    function executeQuery() {
        return (currentPromise = query()).then(response => new Promise(resolve => {
            lastResponse = response;

            eventEmitter.emit('response', lastResponse);

            if(config.elasticsearch.poll) {
                setTimeout(executeQuery, config.elasticsearch.poll);
            }

            resolve();
        }));
    }

    return {
        start: () => executeQuery(),
        stop: () => {
            if(currentPromise) {
                return currentPromise.then(() => new Promise(resolve => resolve(clearTimeout(pollTimeout))));
            }

            return new Promise(resolve => resolve(clearTimeout(pollTimeout)));
        },
        on: (event, handler) => eventEmitter.on(event, handler),
        getLastResult: () => lastResponse
    };
}
