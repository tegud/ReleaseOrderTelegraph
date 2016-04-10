"use strict";

const moment = require('moment');
const ElasticsearchPoller = require('../../elasticsearch/poller');
const _ = require('lodash');

function getSignalFromResponse(response) {
    return new Promise(resolve => {
        console.log(response);
        if(response.error) {
            return resolve({ signal: 'unknown' });
        }

        if(!response.hits.total) {
            return resolve({ signal: 'green' });
        }

        if(response.hits.hits[0]['_source'].setUntil && moment().isAfter(moment(response.hits.hits[0]['_source'].setUntil))) {
            return resolve({ signal: 'green' });
        }

        const result = _.merge({ signal: response.hits.hits[0]['_source'].newSignal }, _.pick(response.hits.hits[0]['_source'], ['reason', 'setBy', 'setUntil']));

        resolve(result);
    });
}

function CompareToLastResult() {
    let lastResult;

    return {
        hasChanged: newSignal => {
            if(!lastResult) {
                lastResult = newSignal;

                return false;
            }

            if(lastResult.signal !== newSignal.signal) {
                lastResult = newSignal;
                return true;
            }
        }
    }
}

module.exports = function(config, eventEmitter) {
    const query = new ElasticsearchPoller(config, () => {
        const today = moment();

        return {
            q: `_type: ${config.elasticsearch.type} AND @timestamp: [${today.format("YYYY-MM-DD")} TO *]`,
            sort: '@timestamp:desc'
        };
    });
    const compareToLastResult = new CompareToLastResult();

    function getCurrentSignal() {
        return getSignalFromResponse(query.getLastResult());
    }

    query.on('response', (response) => getSignalFromResponse(response)
        .then(newSignal => {
            if(compareToLastResult.hasChanged(newSignal)) {
                eventEmitter.emit('newSignal', {
                    name: config.name,
                    type: config.type,
                    signal: newSignal
                });
            }
        }));

    return {
        start: () =>
            query.start(),
        getState: () => getCurrentSignal(),
        stop: () => query.stop()
    };
};
