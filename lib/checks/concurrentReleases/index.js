"use strict";

const ElasticsearchPoller = require('../../elasticsearch/poller');
const _ = require('lodash');

module.exports = function(config) {
    config = _.defaults(config, { thresholds: [] });

    const query = new ElasticsearchPoller(config, () => {
        const query = `_type: ${config.elasticsearch.type} AND environment: live AND isComplete: false`;
        return {
            q: query,
            sort: '@timestamp:desc'
        };
    });

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
