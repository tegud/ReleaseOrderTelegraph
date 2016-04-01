const _ = require('lodash');

const timeRegex = /([0-9]{1,2}):([0-9]{1,2})/;

exports.parseTime = function parseTime(input) {
    const timeMatches = input.match(timeRegex);

    return {
        hour: parseInt(timeMatches[1], 10),
        minute: parseInt(timeMatches[2], 10),
        second: 0
    };
}

exports.matchPeriodWithinList = function matchPeriodWithinList(listOfPeriod, currentTime) {
    return _.chain(listOfPeriod).filter(schedule => currentTime.isSame(schedule.from) || currentTime.isBetween(schedule.from, schedule.to)).last().value();
}
