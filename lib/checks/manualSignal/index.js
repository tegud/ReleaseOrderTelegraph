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

            const result = { signal: lastResponse.hits.hits[0]['_source'].newSignal };

            if(lastResponse.hits.hits[0]['_source'].reason) {
                result.reason = lastResponse.hits.hits[0]['_source'].reason;
            }

            if(lastResponse.hits.hits[0]['_source'].setBy) {
                result.setBy = lastResponse.hits.hits[0]['_source'].setBy;
            }

            if(lastResponse.hits.hits[0]['_source'].setUntil) {
                result.setUntil = lastResponse.hits.hits[0]['_source'].setUntil;
            }

            resolve(result);
        });
    }

    return {
        start: () => query.start(),
        getState: () => getCurrentSignal(),
        stop: () => query.stop()
    };
};
