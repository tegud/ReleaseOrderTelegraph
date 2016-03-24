"use strict";

const moment = require('moment');
const ElasticsearchPoller = require('../../elasticsearch/poller');

module.exports = function(config) {
    const query = new ElasticsearchPoller(config, () => {
        const today = moment();

        return {
            q: `_type: ${config.elasticsearch.type} AND @timestamp: [${today.format("YYYY-MM-DD")} TO *]`,
            sort: '@timestamp:desc'
        };
    });

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
