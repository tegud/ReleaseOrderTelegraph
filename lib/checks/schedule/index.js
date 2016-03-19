"use strict";

const utilities = require('./utilities');
const moment = require('moment');
const _ = require('lodash');

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

function matchSchedule(config, currentTime) {
    const today = moment(currentTime).startOf('day');
    const daySchedule = config.schedule[today.format('dddd')];

    if(!daySchedule) {
        return;
    }

    const schedulesForToday = daySchedule.map(schedule => {
        const fromForToday = moment(today).set(utilities.parseTime(schedule.from));
        const toForToday = moment(today).set(utilities.parseTime(schedule.to));
        return {
            from: fromForToday,
            to: toForToday,
            signal: schedule.signal,
            reason: schedule.reason
        }
    });

    return utilities.matchPeriodWithinList(schedulesForToday, currentTime);
}

function matchOverride(config, currentTime) {
    return utilities.matchPeriodWithinList(config.overrides, currentTime);
}

module.exports = function(config) {
    config = _.defaults(config, { schedule: [], defaultReasons: {} });

    return {
        getState: () => {
            const currentTime = moment();

            const matchingSchedule = matchSchedule(config, currentTime);
            const matchingOverride = matchOverride(config, currentTime);

            return buildCheckResponse(config, matchingSchedule, matchingOverride);
        }
    };
};
