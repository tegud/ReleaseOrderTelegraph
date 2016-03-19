"use strict";

const elasticsearch = require('elasticsearch');
const moment = require('moment');

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
            q: `_type: ${config.elasticsearch.type} AND @timestamp: [${today.format("YYYY-MM-DD")} TO *]`,
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
    const query = new elasticsearchPoller(config);

    function getCurrentSignal() {
        const lastResponse = query.getLastResult();

        return new Promise(resolve => {
            if(lastResponse.error) {
                return resolve({ signal: 'unknown' });
            }

            if(!lastResponse.hits.total) {
                return resolve({ signal: 'green' });
            }

            resolve({ signal: lastResponse.hits.hits[0]['_source'].newSignal });
        });
    }

    return {
        start: () => query.start(),
        getState: () => getCurrentSignal(),
        stop: () => query.stop()
    };
};
