"use strict";

const ElasticsearchPoller = require('../../elasticsearch/poller');
const _ = require('lodash');
const moment = require('moment');

module.exports = function(config) {
    config = _.defaults(config, { thresholds: [] });

    const query = new ElasticsearchPoller(config, () => {
        const today = moment().startOf('day');
        const query = `_type: ${config.elasticsearch.type} AND @timestamp: [${today.format("YYYY-MM-DD")} TO *] AND environment: live AND isComplete: false`;
        return {
            q: query,
            sort: '@timestamp:desc'
        };
    });

    function getCurrentSignal() {
        const lastResponse = query.getLastResult();

        return new Promise(resolve => {
            resolve(config.thresholds.reduce((current, threshold)  => {
                if(lastResponse.hits.total >= threshold.limit) {
                    return { signal: threshold.signal, concurrentReleases: lastResponse.hits.total, thresholds: config.thresholds };
                }

                return current;
            }, {
                signal: 'green',
                concurrentReleases: lastResponse.hits.total,
                thresholds: config.thresholds
            }));
        });
    }

    return {
        start: () => query.start(),
        getState: () => getCurrentSignal(),
        stop: () => query.stop()
    };
};
