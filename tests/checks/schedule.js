"use strict";

const should = require('should');
const moment = require('moment');
const proxyquire = require('proxyquire');
const fakeMoment = require('../lib/fakeMoment')();

const scheduleCheck = proxyquire('../../lib/checks/schedule', {
    'moment': fakeMoment.moment
});

function createScheduleCheck(config) {
    return new Promise(resolve => resolve(scheduleCheck(config)));
}

function createSchedule(config) {
    return () => createScheduleCheck(config);
}

function getState() {
    return schedule => schedule.getState();
}

describe('schedule', () => {
    afterEach(() => {
        fakeMoment.clear();
    });

    it('should return red when current date is outside the configured schedule', () =>
        createScheduleCheck()
            .then(getState()).should.eventually.eql({ signal: 'red' }));

    it('should return green when current date is the start of the configured schedule', () =>
        fakeMoment.setDate('2016-03-14T09:00:00')
            .then(createSchedule({
                schedule: {
                    'Monday': [{ from: '09:00', to: '16:00' }]
                }
            }))
            .then(getState()).should.eventually.eql({ signal: 'green' }));

    it('should return green when current date is inside of the configured schedule', () =>
        fakeMoment.setDate('2016-03-14T09:00:01')
            .then(createSchedule({
                schedule: {
                    'Monday': [{ from: '09:00', to: '16:00' }]
                }
            }))
            .then(getState()).should.eventually.eql({ signal: 'green' }));

    it('should return red when current date is on schedule day, but outside the schedule', () => 
        fakeMoment.setDate('2016-03-14T08:59:59')
            .then(createSchedule({
                schedule: {
                    'Monday': [{ from: '09:00', to: '16:00' }]
                }
            }))
            .then(getState()).should.eventually.eql({ signal: 'red' }));

    it('should return amber when amber signal is specified on the schedule item', () =>
        fakeMoment.setDate('2016-03-14T09:00:00')
            .then(createSchedule({
                schedule: {
                    'Monday': [{ from: '09:00', to: '16:00', signal: 'amber' }]
                }
            }))
            .then(getState()).should.eventually.eql({ signal: 'amber' }));

    it('should return signal of the last matched schedule', () =>
        fakeMoment.setDate('2016-03-14T12:00:00')
            .then(createSchedule({
                schedule: {
                    'Monday': [
                        { from: '09:00', to: '16:00' },
                        { from: '12:00', to: '13:00', signal: 'amber' }
                    ]
                }
            }))
            .then(getState()).should.eventually.eql({ signal: 'amber' }));

    it('sets reason to matching schedule', () =>
        fakeMoment.setDate('2016-03-14T12:00:00')
            .then(createSchedule({
                schedule: {
                    'Monday': [
                        { from: '09:00', to: '16:00' },
                        { from: '12:00', to: '13:00', signal: 'amber', reason: 'Reduced support during lunch' }
                    ]
                }
            }))
            .then(getState()).should.eventually.eql({ signal: 'amber', reason: 'Reduced support during lunch' }));

    describe('defaultReasons', () => {
        it('sets reason to default reason for unmatched schedule, matching signal', () =>
            fakeMoment.setDate('2016-03-14T00:00:00')
                .then(createSchedule({
                    defaultReasons: {
                        'red': 'Cannot release outside of permitted schedule.'
                    },
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    }
                }))
                .then(getState()).should.eventually.eql({ signal: 'red', reason: 'Cannot release outside of permitted schedule.' }));

        it('sets reason to default reason for matching schedule and matching signal', () =>
            fakeMoment.setDate('2016-03-14T09:00:00')
                .then(createSchedule({
                    defaultReasons: {
                        'green': 'Ok to release during scheduled hours'
                    },
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    }
                }))
                .then(getState()).should.eventually.eql({ signal: 'green', reason: 'Ok to release during scheduled hours' }));
    });

    describe('overrides', () => {
        it('matching overrides are applied', () =>
            fakeMoment.setDate('2016-03-14T13:00:00')
                .then(createSchedule({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    },
                    overrides: [
                        { from: '2016-03-14T12:00:00', to: '2016-03-14T16:00:00', signal: 'red', 'reason': 'Change Freeze for easter period' }
                    ]
                }))
                .then(getState()).should.eventually.eql({ signal: 'red', reason: 'Change Freeze for easter period' }));

        it('start of matching override is applied', () =>
            fakeMoment.setDate('2016-03-14T12:00:00')
                .then(createSchedule({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    },
                    overrides: [
                        { from: '2016-03-14T12:00:00', to: '2016-03-14T16:00:00', signal: 'red', 'reason': 'Change Freeze for easter period' }
                    ]
                }))
                .then(getState()).should.eventually.eql({ signal: 'red', reason: 'Change Freeze for easter period' }));

        it('override applies outside of matching schedule', () =>
            fakeMoment.setDate('2016-03-14T12:00:00')
                .then(createSchedule({
                    schedule: { },
                    overrides: [
                        { from: '2016-03-14T12:00:00', to: '2016-03-14T16:00:00', signal: 'red', 'reason': 'Change Freeze for easter period' }
                    ]
                }))
                .then(getState()).should.eventually.eql({ signal: 'red', reason: 'Change Freeze for easter period' }));

        it('non-matching override is not applied', () =>
            fakeMoment.setDate('2016-03-14T11:59:59')
                .then(createSchedule({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    },
                    overrides: [
                        { from: '2016-03-14T12:00:00', to: '2016-03-14T16:00:00', signal: 'red', 'reason': 'Change Freeze for easter period' }
                    ]
                }))
                .then(getState()).should.eventually.eql({ signal: 'green' }));

        it('applies the last of multiple matching overrides', () =>
            fakeMoment.setDate('2016-03-14T13:00:00')
                .then(createSchedule({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    },
                    overrides: [
                        { from: '2016-03-14T12:00:00', to: '2016-03-14T16:00:00', signal: 'red', 'reason': 'Change Freeze for easter period' },
                        { from: '2016-03-14T13:00:00', to: '2016-03-14T14:00:00', signal: 'red', 'reason': 'Extra special change Freeze for easter period' }
                    ]
                }))
                .then(getState()).should.eventually.eql({ signal: 'red', reason: 'Extra special change Freeze for easter period' }));
    });
});
