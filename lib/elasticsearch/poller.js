"use strict";

const elasticsearch = require('elasticsearch');
const indicies = require('./indicies');
const moment = require('moment');
const _ = require('lodash');

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
    let lastResponse;
    let pollTimeout;
    let currentPromise;

    function executeQuery() {
        return (currentPromise = query()).then(response => {
            lastResponse = response;

            if(config.elasticsearch.poll) {
                setTimeout(executeQuery, config.elasticsearch.poll);
            }
        });
    }

    return {
        start: () => executeQuery(),
        stop: () => {
            if(currentPromise) {
                return currentPromise.then(() => new Promise(resolve => resolve(clearTimeout(pollTimeout))));
            }

            return new Promise(resolve => resolve(clearTimeout(pollTimeout)));
        },
        getLastResult: () => lastResponse
    };
}
