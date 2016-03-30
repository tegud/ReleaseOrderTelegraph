"use strict";

const moment = require('moment');
const ElasticsearchPoller = require('../../elasticsearch/poller');
const _ = require('lodash');

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

            if(lastResponse.hits.hits[0]['_source'].setUntil && moment().isAfter(moment(lastResponse.hits.hits[0]['_source'].setUntil))) {
                return resolve({ signal: 'green' });
            }

            const result = _.merge({ signal: lastResponse.hits.hits[0]['_source'].newSignal }, _.pick(lastResponse.hits.hits[0]['_source'], ['reason', 'setBy', 'setUntil']));

            resolve(result);
        });
    }

    return {
        start: () => query.start(),
        getState: () => getCurrentSignal(),
        stop: () => query.stop()
    };
};
