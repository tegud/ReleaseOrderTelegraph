var Promise = require('bluebird');

var checks = [
    require('./schedule'),
    require('./concurrent_releases'),
    require('./user_set')
];

var statePriority = {
    'green': 0,
    'amber': 1,
    'red': 2
};

function processResults(results) {
    var newState = results.reduce((current, result) => {
        if(statePriority[current] > statePriority[result.state]) {
            return current;
        }

        return result.state;
    }, 'green');
    return new Promise(resolve => resolve(newState));
}

module.exports = {
    refresh: () => {
        return Promise.map(checks, check => check()).then(processResults)
    }
};
