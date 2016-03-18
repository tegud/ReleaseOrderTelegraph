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

function buildCheckResponse(config, matchingSchedule) {
    let signal = 'red';

    if(matchingSchedule) {
        signal = matchingSchedule.signal || 'green';
    }

    const checkResponse = {
        signal: signal
    };

    if(matchingSchedule && matchingSchedule.reason) {
        checkResponse.reason = matchingSchedule.reason;
    }
    else if (matchingSchedule && config.defaultReasons[signal]) {
        checkResponse.reason = config.defaultReasons[signal];
    }
    else if(!matchingSchedule && config.defaultReasons[signal]) {
        checkResponse.reason = config.defaultReasons[signal];
    }

    return checkResponse;
}

module.exports = function(config) {
    config = _.defaults(config, { schedule: [], defaultReasons: {} });

    return {
        start: () => new Promise(resolve => resolve()),
        getState: () => new Promise(resolve => {
            const currentTime = moment();
            const today = moment(currentTime).startOf('day');
            const daySchedule = config.schedule[today.format('dddd')];

            if(!daySchedule) {
                return resolve(buildCheckResponse(config));
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

            const matchingSchedule = _.chain(schedulesForToday).filter(schedule => currentTime.isSame(schedule.from) || currentTime.isBetween(schedule.from, schedule.to)).last().value();

            if(!matchingSchedule) {
                return resolve(buildCheckResponse(config));
            }

            resolve(buildCheckResponse(config, matchingSchedule));
        })
    };
};
