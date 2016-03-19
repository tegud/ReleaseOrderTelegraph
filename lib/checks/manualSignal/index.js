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

module.exports = function(config) {
    const client = new elasticsearch.Client({
        host: `${config.elasticsearch.host}:${config.elasticsearch.port}`
    });

    let currentState = 'green';

    return {
        start: () => {
            const today = moment();

            return client.search({
                index: getIndices(today, config.elasticsearch.index),
                q: `_type: ${config.elasticsearch.type} AND @timestamp: [${today.format("YYYY-MM-DD")} TO *]`,
                sort: '@timestamp:desc'
            }).then(res => {
                if(!res.hits.total) {
                    return currentState = 'green';
                }

                currentState = res.hits.hits[0]['_source'].newSignal;
            }).catch(err => {
                console.log('Couldnt contact Elasticsearch', err);
                currentState = 'unknown'
            });
        },
        getState: () => new Promise(resolve => resolve({ signal: currentState }))
    };
};
