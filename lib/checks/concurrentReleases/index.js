"use strict";

const elasticsearch = require('elasticsearch');
const moment = require('moment');
const _ = require('lodash');

function getIndices(day, indexPattern) {
    const indicies = [];

    indexPattern = indexPattern.replace(/\$\{YYYY\}/, day.format('YYYY'));
    indexPattern = indexPattern.replace(/\$\{MM\}/, day.format('MM'));
    indexPattern = indexPattern.replace(/\$\{DD\}/, day.format('DD'));

    indicies.push(indexPattern);

    return indicies;
}

function getStateFromEs(client, config) {
    return new Promise(resolve => {
        const today = moment();

        client.search({
            index: getIndices(today, config.elasticsearch.index),
            q: `_type: ${config.elasticsearch.type} AND environment: live AND isComplete: false`,
            sort: '@timestamp:desc'
        })
            .then(res => resolve(res))
            .catch(err => {
                console.log('Couldnt contact Elasticsearch', err);
                resolve({ error: err })
            });
    });
}

function elasticsearchPoller(config) {
    const client = new elasticsearch.Client({
        host: `${config.elasticsearch.host}:${config.elasticsearch.port}`
    });
    const query = getStateFromEs.bind(undefined, client, config);
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

module.exports = function(config) {
    config = _.defaults(config, { thresholds: [] });

    const query = new elasticsearchPoller(config);

    function getCurrentSignal() {
        const lastResponse = query.getLastResult();

        return new Promise(resolve => {
            if(!lastResponse.hits.total) {
                return resolve({ signal: 'green' });
            }

            resolve(config.thresholds.reduce((current, threshold)  => {
                if(lastResponse.hits.total >= threshold.limit) {
                    return { signal: threshold.signal };
                }

                return current;
            }, { signal: 'green' }));
        });
    }

    return {
        start: () => query.start(),
        getState: () => getCurrentSignal(),
        stop: () => query.stop()
    };
};
