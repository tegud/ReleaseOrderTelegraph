"use strict";

const _ = require('lodash');

const statePriority = {
    'green': 0,
    'amber': 1,
    'red': 2
};

let checks = [];

function executeHandlerOnChecks(checks, handler) {
    return Promise.all(checks.reduce((checks, check) => {
        if(check[handler]) {
            checks.push(check);
        }
        return checks;
    }, []).map(check => check[handler]()))
}

module.exports = {
    config: config => {
        checks = config.checks.map(checkConfig => _.merge({
            type: checkConfig.type,
            name: checkConfig.name
        }, require(`./${checkConfig.type}`)(checkConfig)));

        return executeHandlerOnChecks(checks, 'start');
    },
    getCurrent: () => Promise.all(checks.map(check => check.getState().then(result => new Promise(resolve => resolve({
        name: check.name,
        type: check.type,
        result: result
    })))))
        .then(results => results.reduce((current, check) => {
            const result = check.result;
            current.checks.push(_.merge({
                type: check.type,
                name: check.name
            }, check.result));

            if(statePriority[current.signal] > statePriority[result.signal]) {
                return current;
            }

            current.signal = result.signal;

            return current;
        }, { signal: 'green', checks: [] })),
    stop: () => executeHandlerOnChecks(checks, 'stop')
};
