"use strict";

const EventEmitter = require('events');
const should = require('should');
const moment = require('moment');
const proxyquire = require('proxyquire');
const fakeMoment = require('../lib/fakeMoment')();

const scheduleCheck = proxyquire('../../lib/checks/schedule', {
    'moment': fakeMoment.moment
});

function createScheduleCheck(config, eventEmitter) {
    return new Promise(resolve => resolve(new scheduleCheck(config, eventEmitter)));
}

function createSchedule(config, eventEmitter) {
    return () => createScheduleCheck(config, eventEmitter);
}

function getState() {
    return schedule => schedule.getState();
}

describe('schedule', () => {
    afterEach(() => {
        fakeMoment.clear();
    });

    it('should return red when current date is outside the configured schedule', () => {
        const eventEmitter = new EventEmitter();

        createScheduleCheck({}, eventEmitter)
            .then(check => check.start());

        return new Promise(resolve =>
            eventEmitter.on('newSignal', function(signal) {
                resolve(signal.signal.signal);
            })).should.eventually.eql('red');
    });

    it('should return green when current date is the start of the configured schedule', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T09:00:00')
                .then(() => createScheduleCheck({
                    schedule: {
                        'Monday': [{ from: '09:00', to: '16:00' }]
                    }
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal.signal);
                })).should.eventually.eql('green');
    });

    it('should return green when current date is inside of the configured schedule', () => {
        const eventEmitter = new EventEmitter();

        fakeMoment.setDate('2016-03-14T09:00:01')
            .then(() => createScheduleCheck({
                schedule: {
                    'Monday': [{ from: '09:00', to: '16:00' }]
                }
            }, eventEmitter))
            .then(check => check.start());

        return new Promise(resolve =>
            eventEmitter.on('newSignal', function(signal) {
                resolve(signal.signal.signal);
            })).should.eventually.eql('green');
    });


    it('should return red when current date is on schedule day, but outside the schedule', () => {
        const eventEmitter = new EventEmitter();

        fakeMoment.setDate('2016-03-14T08:59:59')
            .then(() => createScheduleCheck({
                schedule: {
                    'Monday': [{ from: '09:00', to: '16:00' }]
                }
            }, eventEmitter))
            .then(check => check.start());

        return new Promise(resolve =>
            eventEmitter.on('newSignal', function(signal) {
                resolve(signal.signal.signal);
            })).should.eventually.eql('red');
    });

    it('should return amber when amber signal is specified on the schedule item', () => {
        const eventEmitter = new EventEmitter();

        fakeMoment.setDate('2016-03-14T09:00:00')
            .then(() => createScheduleCheck({
                schedule: {
                    'Monday': [{ from: '09:00', to: '16:00', signal: 'amber' }]
                }
            }, eventEmitter))
            .then(check => check.start());

        return new Promise(resolve =>
            eventEmitter.on('newSignal', function(signal) {
                resolve(signal.signal.signal);
            })).should.eventually.eql('amber');
    });

    it('should return signal of the last matched schedule', () => {
        const eventEmitter = new EventEmitter();

        fakeMoment.setDate('2016-03-14T12:00:00')
            .then(() => createScheduleCheck({
                schedule: {
                    'Monday': [
                        { from: '09:00', to: '16:00' },
                        { from: '12:00', to: '13:00', signal: 'amber' }
                    ]
                }
            }, eventEmitter))
            .then(check => check.start());

        return new Promise(resolve =>
            eventEmitter.on('newSignal', function(signal) {
                resolve(signal.signal.signal);
            })).should.eventually.eql('amber');
    });

    it('should emit new signal at transition of schedule state', () => {
        const eventEmitter = new EventEmitter();

        fakeMoment.setDate('2016-03-14T15:59:59.990')
            .then(() => createScheduleCheck({
                schedule: {
                    'Monday': [
                        { from: '09:00', to: '16:00' }
                    ]
                }
            }, eventEmitter))
            .then(check => check.start());

        let signals = 0;

        return new Promise(resolve =>
            eventEmitter.on('newSignal', signal => {
                if(!signals) {
                    fakeMoment.setDate('2016-03-14T16:00:00.900', 'YYYY-MM-DDTHH:mm:ss.sss')
                    signals++;
                }

                if(signal.signal.signal === 'red') {
                    resolve(signal.signal.signal);
                }
            }));
    });

    it.skip('should emit new signal at transition of overlapped schedule state', () => {
        const eventEmitter = new EventEmitter();

        fakeMoment.setDate('2016-03-14T11:59:59')
            .then(() => createScheduleCheck({
                schedule: {
                    'Monday': [
                        { from: '09:00', to: '16:00' },
                        { from: '12:00', to: '13:00', signal: 'amber' }
                    ]
                }
            }, eventEmitter))
            .then(check => check.start());

        return new Promise(resolve =>
            eventEmitter.on('newSignal', signal => {
                if(signal.signal.signal === 'amber') {
                    resolve(signal.signal.signal);
                }
            })).should.eventually.eql('amber');
    });

    it('sets reason to matching schedule', () => {
        const eventEmitter = new EventEmitter();

        fakeMoment.setDate('2016-03-14T12:00:00')
            .then(() => createScheduleCheck({
                schedule: {
                    'Monday': [
                        { from: '09:00', to: '16:00' },
                        { from: '12:00', to: '13:00', signal: 'amber', reason: 'Reduced support during lunch' }
                    ]
                }
            }, eventEmitter))
            .then(check => check.start());

        return new Promise(resolve =>
            eventEmitter.on('newSignal', function(signal) {
                resolve(signal.signal.reason);
            })).should.eventually.eql('Reduced support during lunch');
    });

    describe('defaultReasons', () => {
        it('sets reason to default reason for unmatched schedule, matching signal', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T00:00:00')
                .then(() => createScheduleCheck({
                    defaultReasons: {
                        'red': 'Cannot release outside of permitted schedule.'
                    },
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    }
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal.reason);
                })).should.eventually.eql('Cannot release outside of permitted schedule.');
        });

        it('sets reason to default reason for matching schedule and matching signal', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T09:00:00')
                .then(() => createScheduleCheck({
                    defaultReasons: {
                        'green': 'Ok to release during scheduled hours'
                    },
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    }
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal.reason);
                })).should.eventually.eql('Ok to release during scheduled hours');
        });
    });

    describe('nextChange is set to next scheduled change', () => {
        it('before day\'s schedule start', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T08:00:00')
                .then(() => createScheduleCheck({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    }
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal.nextChange);
                })).should.eventually.eql({ 'toSignal': 'green', 'changeAt': '2016-03-14T09:00:00+00:00' });
        });

        it('during current day\'s schedule', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T09:00:00')
                .then(() => createScheduleCheck({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    }
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal.nextChange);
                })).should.eventually.eql({ 'toSignal': 'red', 'changeAt': '2016-03-14T16:00:00+00:00' });
        });

        it('next schedule after matching current day\'s schedule', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T09:00:00')
                .then(() => createScheduleCheck({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '15:00' },
                            { from: '15:00', to: '16:00', signal: 'amber' }
                        ]
                    }
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal.nextChange);
                })).should.eventually.eql({ 'toSignal': 'amber', 'changeAt': '2016-03-14T15:00:00+00:00' });
        });

        it('after current day\'s schedule', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T16:00:00')
                .then(() => createScheduleCheck({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ],
                        'Tuesday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    }
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal.nextChange);
                })).should.eventually.eql({ 'toSignal': 'green', 'changeAt': '2016-03-15T09:00:00+00:00' });
        });

        it('after several days of no schedule', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-12T16:00:00')
                .then(() => createScheduleCheck({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    }
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    console.log(signal);
                    resolve(signal.signal.nextChange);
                })).should.eventually.eql({ 'toSignal': 'green', 'changeAt': '2016-03-14T09:00:00+00:00' });
        });
    });

    describe('overrides', () => {
        it('matching overrides are applied', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T13:00:00')
                .then(() => createScheduleCheck({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    },
                    overrides: [
                        { from: '2016-03-14T12:00:00', to: '2016-03-14T16:00:00', signal: 'red', 'reason': 'Change Freeze for easter period' }
                    ]
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal);
                })).should.eventually.have.properties({ signal: 'red', reason: 'Change Freeze for easter period' });
        });

        it('start of matching override is applied', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T12:00:00')
                .then(() => createScheduleCheck({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    },
                    overrides: [
                        { from: '2016-03-14T12:00:00', to: '2016-03-14T16:00:00', signal: 'red', 'reason': 'Change Freeze for easter period' }
                    ]
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal);
                })).should.eventually.have.properties({ signal: 'red', reason: 'Change Freeze for easter period' });
        });

        it('override applies outside of matching schedule', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T12:00:00')
                .then(() => createScheduleCheck({
                    schedule: { },
                    overrides: [
                        { from: '2016-03-14T12:00:00', to: '2016-03-14T16:00:00', signal: 'red', 'reason': 'Change Freeze for easter period' }
                    ]
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal);
                })).should.eventually.have.properties({ signal: 'red', reason: 'Change Freeze for easter period' });
        });

        it('non-matching override is not applied', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T11:59:59')
                .then(() => createScheduleCheck({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    },
                    overrides: [
                        { from: '2016-03-14T12:00:00', to: '2016-03-14T16:00:00', signal: 'red', 'reason': 'Change Freeze for easter period' }
                    ]
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal);
                })).should.eventually.have.properties({ signal: 'green' });
        });

        it('applies the last of multiple matching overrides', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T13:00:00')
                .then(() => createScheduleCheck({
                    schedule: {
                        'Monday': [
                            { from: '09:00', to: '16:00' }
                        ]
                    },
                    overrides: [
                        { from: '2016-03-14T12:00:00', to: '2016-03-14T16:00:00', signal: 'red', 'reason': 'Change Freeze for easter period' },
                        { from: '2016-03-14T13:00:00', to: '2016-03-14T14:00:00', signal: 'red', 'reason': 'Extra special change Freeze for easter period' }
                    ]
                }, eventEmitter))
                .then(check => check.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal.signal);
                })).should.eventually.have.properties({ signal: 'red', reason: 'Extra special change Freeze for easter period' });
        });
    });
});
