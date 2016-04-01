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
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.signal)))
            .should.eventually.eql('red'));

    it('should return green when current date is the start of the configured schedule', () =>
        fakeMoment.setDate('2016-03-14T09:00:00')
            .then(createSchedule({
                schedule: {
                    'Monday': [{ from: '09:00', to: '16:00' }]
                }
            }))
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.signal)))
            .should.eventually.eql('green'));

    it('should return green when current date is inside of the configured schedule', () =>
        fakeMoment.setDate('2016-03-14T09:00:01')
            .then(createSchedule({
                schedule: {
                    'Monday': [{ from: '09:00', to: '16:00' }]
                }
            }))
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.signal)))
            .should.eventually.eql('green'));

    it('should return red when current date is on schedule day, but outside the schedule', () =>
        fakeMoment.setDate('2016-03-14T08:59:59')
            .then(createSchedule({
                schedule: {
                    'Monday': [{ from: '09:00', to: '16:00' }]
                }
            }))
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.signal)))
            .should.eventually.eql('red'));

    it('should return amber when amber signal is specified on the schedule item', () =>
        fakeMoment.setDate('2016-03-14T09:00:00')
            .then(createSchedule({
                schedule: {
                    'Monday': [{ from: '09:00', to: '16:00', signal: 'amber' }]
                }
            }))
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.signal)))
            .should.eventually.eql('amber'));

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
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.signal)))
            .should.eventually.eql('amber'));

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
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.reason)))
            .should.eventually.eql('Reduced support during lunch'));

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
                .then(getState())
                .then(result => new Promise(resolve => resolve(result.reason)))
                .should.eventually.eql('Cannot release outside of permitted schedule.'));

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
                .then(getState())
                .then(result => new Promise(resolve => resolve(result.reason)))
                .should.eventually.eql('Ok to release during scheduled hours'));
    });

    describe('nextChange is set to next scheduled change', () => {
        it('before day\'s schedule start', () => fakeMoment.setDate('2016-03-14T08:00:00')
            .then(createSchedule({
                schedule: {
                    'Monday': [
                        { from: '09:00', to: '16:00' }
                    ]
                }
            }))
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.nextChange)))
            .should.eventually.eql({ 'toSignal': 'green', 'changeAt': '2016-03-14T09:00:00+00:00' }));

        it('during current day\'s schedule', () => fakeMoment.setDate('2016-03-14T09:00:00')
            .then(createSchedule({
                schedule: {
                    'Monday': [
                        { from: '09:00', to: '16:00' }
                    ]
                }
            }))
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.nextChange)))
            .should.eventually.eql({ 'toSignal': 'red', 'changeAt': '2016-03-14T16:00:00+00:00' }));

        it('next schedule after matching current day\'s schedule', () => fakeMoment.setDate('2016-03-14T09:00:00')
            .then(createSchedule({
                schedule: {
                    'Monday': [
                        { from: '09:00', to: '15:00' },
                        { from: '15:00', to: '16:00', signal: 'amber' }
                    ]
                }
            }))
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.nextChange)))
            .should.eventually.eql({ 'toSignal': 'amber', 'changeAt': '2016-03-14T15:00:00+00:00' }));

        it('after current day\'s schedule', () => fakeMoment.setDate('2016-03-14T16:00:00')
            .then(createSchedule({
                schedule: {
                    'Monday': [
                        { from: '09:00', to: '16:00' }
                    ],
                    'Tuesday': [
                        { from: '09:00', to: '16:00' }
                    ]
                }
            }))
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.nextChange)))
            .should.eventually.eql({ 'toSignal': 'green', 'changeAt': '2016-03-15T09:00:00+00:00' }));

        it('after several days of no schedule', () => fakeMoment.setDate('2016-03-12T16:00:00')
            .then(createSchedule({
                schedule: {
                    'Monday': [
                        { from: '09:00', to: '16:00' }
                    ]
                }
            }))
            .then(getState())
            .then(result => new Promise(resolve => resolve(result.nextChange)))
            .should.eventually.eql({ 'toSignal': 'green', 'changeAt': '2016-03-14T09:00:00+00:00' }));

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
                .then(getState()).should.eventually.have.properties({ signal: 'red', reason: 'Change Freeze for easter period' }));

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
                .then(getState()).should.eventually.have.properties({ signal: 'red', reason: 'Change Freeze for easter period' }));

        it('override applies outside of matching schedule', () =>
            fakeMoment.setDate('2016-03-14T12:00:00')
                .then(createSchedule({
                    schedule: { },
                    overrides: [
                        { from: '2016-03-14T12:00:00', to: '2016-03-14T16:00:00', signal: 'red', 'reason': 'Change Freeze for easter period' }
                    ]
                }))
                .then(getState()).should.eventually.have.properties({ signal: 'red', reason: 'Change Freeze for easter period' }));

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
                .then(getState()).should.eventually.have.properties({ signal: 'green' }));

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
                .then(getState()).should.eventually.have.properties({ signal: 'red', reason: 'Extra special change Freeze for easter period' }));
    });
});
