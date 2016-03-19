"use strict";

const statePriority = {
    'green': 0,
    'amber': 1,
    'red': 2
};

let checks = [];

module.exports = {
    config: config => {
        checks = config.checks.map(checkConfig => require(`./${checkConfig.type}`)(checkConfig));

        return Promise.all(checks.reduce((checks, check) => {
            if(check.start) {
                checks.push(check);
            }
            return checks;
        }, []).map(check => check.start()));
    },
    getCurrent: () => Promise.all(checks.map(check => check.getState()))
        .then(results => results.reduce((current, result) => {
            if(statePriority[current.signal] > statePriority[result.signal]) {
                return current;
            }

            return { signal: result.signal };
        }, { signal: 'green' }))
};
