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
        }).then(res => {
            if(!res.hits.total) {
                resolve('green');
            }

            resolve(res.hits.hits[0]['_source'].newSignal);
        }).catch(err => {
            console.log('Couldnt contact Elasticsearch', err);
            resolve('unknown')
        });
    });
}

module.exports = function(config) {
    const client = new elasticsearch.Client({
        host: `${config.elasticsearch.host}:${config.elasticsearch.port}`
    });

    let currentState = 'green';

    return {
        start: () => {
            if(config.elasticsearch.poll) {
                setTimeout(() => {
                    getStateFromEs(client, config).then(newState => {
                        console.log(newState);
                        currentState = newState;
                    });
                }, config.elasticsearch.poll);
            }

            return getStateFromEs(client, config).then(newState => currentState = newState);
        },
        getState: () => new Promise(resolve => resolve({ signal: currentState }))
    };
};
