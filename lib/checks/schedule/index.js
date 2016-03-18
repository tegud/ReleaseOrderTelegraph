"use strict";

const moment = require('moment');
const _ = require('lodash');

const timeRegex = /([0-9]{1,2}):([0-9]{1,2})/;

function parseTime(input) {
    const timeMatches = input.match(timeRegex);

    return {
        hour: parseInt(timeMatches[1], 10),
        minute: parseInt(timeMatches[2], 10),
        second: 0
    };
}

function buildCheckResponse(config, matchingSchedule, matchingOverride) {
    let signal = 'red';
    let reason;

    if (matchingOverride) {
        signal = matchingOverride.signal;
        reason = matchingOverride.reason;
    }
    else if(matchingSchedule) {
        signal = matchingSchedule.signal || 'green';
        reason = matchingSchedule.reason;
    }

    const checkResponse = {
        signal: signal
    };

    if(reason || config.defaultReasons[signal]) {
        checkResponse.reason = reason || config.defaultReasons[signal];
    }

    return new Promise(resolve => resolve(checkResponse));
}

function matchPeriodWithinList(listOfPeriod, currentTime) {
    return _.chain(listOfPeriod).filter(schedule => currentTime.isSame(schedule.from) || currentTime.isBetween(schedule.from, schedule.to)).last().value();
}

function matchSchedule(config, currentTime) {
    const today = moment(currentTime).startOf('day');
    const daySchedule = config.schedule[today.format('dddd')];

    if(!daySchedule) {
        return;
    }

    const schedulesForToday = daySchedule.map(schedule => {
        const fromForToday = moment(today).set(parseTime(schedule.from));
        const toForToday = moment(today).set(parseTime(schedule.to));
        return {
            from: fromForToday,
            to: toForToday,
            signal: schedule.signal,
            reason: schedule.reason
        }
    });

    return matchPeriodWithinList(schedulesForToday, currentTime);
}

function matchOverride(config, currentTime) {
    return matchPeriodWithinList(config.overrides, currentTime);
}

module.exports = function(config) {
    config = _.defaults(config, { schedule: [], defaultReasons: {} });

    return {
        start: () => new Promise(resolve => resolve()),
        getState: () => {
            const currentTime = moment();
            
            const matchingSchedule = matchSchedule(config, currentTime)
            const matchingOverride = matchOverride(config, currentTime)

            return buildCheckResponse(config, matchingSchedule, matchingOverride);
        }
    };
};
