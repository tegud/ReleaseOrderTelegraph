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

function getFirstScheduleForDay(config, day, notSignal, startsAfter) {
    const dayOfWeek = day.format('dddd');
    const daySchedule = config.schedule[dayOfWeek];

    if(!daySchedule) {
        return;
    }

    const schedulesForDay = daySchedule.map(schedule => {
        const fromForDay = moment(day).set(utilities.parseTime(schedule.from));
        const toForDay = moment(day).set(utilities.parseTime(schedule.to));
        return {
            from: fromForDay,
            to: toForDay,
            signal: schedule.signal,
            reason: schedule.reason
        }
    });

    const firstSchedule = _.chain(schedulesForDay).filter(schedule =>
        notSignal !== (schedule.signal || 'green') && (!startsAfter || schedule.from.isAfter(startsAfter) || schedule.from.isSame(startsAfter))).first().value();

    return firstSchedule;
}

function getNextValidSchedule(maxTries, config, startDay, currentSignal, currentTime) {
    let nextSchedule;
    let x = 0;

    while(!nextSchedule && x < maxTries) {
        nextSchedule = getFirstScheduleForDay(config, startDay, currentSignal, currentTime);
        startDay = startDay.add(1, 'd');
        x++;
    }

    return nextSchedule;
}

function setNextChange(config, currentTime, result) {
    const today = moment(currentTime).startOf('day');
    const dayOfWeek = today.format('dddd');
    const daySchedule = config.schedule[dayOfWeek];
    let nextSchedule;

    if(daySchedule) {
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

        const matchingSchedule = utilities.matchPeriodWithinList(schedulesForToday, currentTime);

        if(matchingSchedule) {
            const nextSchedule = utilities.matchPeriodWithinList(schedulesForToday, matchingSchedule.to);

            result.nextChange = {
                changeAt: matchingSchedule.to.format(),
                toSignal: nextSchedule ? nextSchedule.signal : 'red'
            };
        }
        else {
            nextSchedule = getNextValidSchedule(10, config, moment(today), result.signal, currentTime);
        }
    }
    else {
        nextSchedule = getNextValidSchedule(10, config, moment(today), result.signal, currentTime);
    }

    if(nextSchedule) {
        result.nextChange = {
            changeAt: nextSchedule.from.format(),
            toSignal: nextSchedule.signal || 'green'
        };
    }

    return new Promise(resolve => resolve(result));
}

module.exports = function(config) {
    config = _.defaults(config || {}, { schedule: [], defaultReasons: {} });

    return {
        getState: () => {
            const currentTime = moment();

            const matchingSchedule = matchSchedule(config, currentTime);
            const matchingOverride = matchOverride(config, currentTime);

            return buildCheckResponse(config, matchingSchedule, matchingOverride)
                .then(setNextChange.bind(undefined, config, currentTime));
        }
    };
};
