"use strict";

const EventEmitter = require('events');
const _ = require('lodash');

const statePriority = {
    'green': 0,
    'amber': 1,
    'red': 2
};

let checks;
let checkAutoNames;

function executeHandlerOnChecks(checks, handler) {
    return Promise.all(_.reduce(checks, (checks, check) => {
        if(check[handler]) {
            checks.push(check);
        }
        return checks;
    }, []).map(check => check[handler]()))
}

function getCheckName(type, name) {
    if(name) {
        return name;
    }

    if(!checkAutoNames[type]) {
        checkAutoNames[type] = 1;
        return type;
    }

    checkAutoNames[type] = checkAutoNames[type] + 1;
    return `${type}-${checkAutoNames[type]}`;
}

function getSignal(results) {
    try {
        return results.reduce((current, check) => {
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
        }, { signal: 'green', checks: [] });
    }
    catch(e) {
        console.log(e);
    }
}

module.exports = {
    config: config => {
        const eventEmitter = new EventEmitter();
        checkAutoNames = {};

        checks = _.reduce(config.checks, (allChecks, checkConfig) => {
            const checkName = getCheckName(checkConfig.type, checkConfig.name);

            checkConfig.name = checkName;

            allChecks[checkName] = _.merge({
                type: checkConfig.type,
                name: checkName,
                result: { signal: 'unknown' }
            }, require(`./${checkConfig.type}`)(checkConfig, eventEmitter));

            return allChecks;
        }, {});

        eventEmitter.on('newSignal', data => {
            checks[data.name].result = data.signal;

            const newSignal = getSignal(_.map(checks, check => check));

            require('../publishers').newSignalState(newSignal);
        });

        return executeHandlerOnChecks(checks, 'start');
    },
    getCurrent: () => Promise.all(_.chain(checks)
        .filter(check => check.getState)
        .map(check =>
            check.getState()
                .then(result => new Promise(resolve => resolve({
                    name: check.name,
                    type: check.type,
                    result: result
                })))).value())
        .then(results => new Promise(resolve => resolve(_.map(_.merge({}, _.pick(checks, ['type', 'name', 'result']), results), check => check))))
        .then(getSignal),
    stop: () => executeHandlerOnChecks(checks, 'stop')
};
