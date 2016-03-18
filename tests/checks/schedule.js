"use strict";

let fakeCurrentDate;

const should = require('should');
const _ = require('lodash');
const moment = require('moment');
const proxyquire = require('proxyquire');
const scheduleCheck = proxyquire('../../lib/checks/schedule', {
    'moment': date => {
        if(!date && fakeCurrentDate) {
            return moment(fakeCurrentDate);
        }

        return moment(date);
    }
});

describe('schedule', () => {
    afterEach(() => {
        fakeCurrentDate = undefined;
    });

    it('should return red when current date is outside the configured schedule', () => {
        const schedule = scheduleCheck();

        return schedule.start().then(() => schedule.getState())
            .should.eventually.eql({ signal: 'red' });
    });

    it('should return green when current date is the start of the configured schedule', () => {
        fakeCurrentDate = '2016-03-14T09:00:00';

        const schedule = scheduleCheck({
            schedule: {
                'Monday': [{ from: '09:00', to: '16:00' }]
            }
        });

        return schedule.start().then(() => schedule.getState())
            .should.eventually.eql({ signal: 'green' });
    });

    it('should return green when current date is inside of the configured schedule', () => {
        fakeCurrentDate = '2016-03-14T09:00:01';

        const schedule = scheduleCheck({
            schedule: {
                'Monday': [{ from: '09:00', to: '16:00' }]
            }
        });

        return schedule.start().then(() => schedule.getState())
            .should.eventually.eql({ signal: 'green' });
    });

    it('should return red when current date is on schedule day, but outside the schedule', () => {
        fakeCurrentDate = '2016-03-14T08:59:59';

        const schedule = scheduleCheck({
            schedule: {
                'Monday': [{ from: '09:00', to: '16:00' }]
            }
        });

        return schedule.start().then(() => schedule.getState())
            .should.eventually.eql({ signal: 'red' });
    });

    it('should return amber when amber signal is specified on the schedule item', () => {
        fakeCurrentDate = '2016-03-14T09:00:00';

        const schedule = scheduleCheck({
            schedule: {
                'Monday': [{ from: '09:00', to: '16:00', signal: 'amber' }]
            }
        });

        return schedule.start().then(() => schedule.getState())
            .should.eventually.eql({ signal: 'amber' });
    });

    it('should return signal of the last matched schedule', () => {
        fakeCurrentDate = '2016-03-14T12:00:00';

        const schedule = scheduleCheck({
            schedule: {
                'Monday': [
                    { from: '09:00', to: '16:00' },
                    { from: '12:00', to: '13:00', signal: 'amber' }
                ]
            }
        });

        return schedule.start().then(() => schedule.getState())
            .should.eventually.eql({ signal: 'amber' });
    });

    it('sets reason to matching schedule', () => {
        fakeCurrentDate = '2016-03-14T12:00:00';

        const schedule = scheduleCheck({
            schedule: {
                'Monday': [
                    { from: '09:00', to: '16:00' },
                    { from: '12:00', to: '13:00', signal: 'amber', reason: 'Reduced support during lunch' }
                ]
            }
        });

        return schedule.start().then(() => schedule.getState())
            .should.eventually.eql({ signal: 'amber', reason: 'Reduced support during lunch' });
    });

    it('sets reason to default reason for unmatched schedule, matching signal', () => {
        fakeCurrentDate = '2016-03-14T00:00:00';

        const schedule = scheduleCheck({
            defaultReasons: {
                'red': 'Cannot release outside of permitted schedule.'
            },
            schedule: {
                'Monday': [
                    { from: '09:00', to: '16:00' }
                ]
            }
        });

        return schedule.start().then(() => schedule.getState())
            .should.eventually.eql({ signal: 'red', reason: 'Cannot release outside of permitted schedule.' });
    });

    it('sets reason to default reason for matching schedule and matching signal', () => {
        fakeCurrentDate = '2016-03-14T09:00:00';

        const schedule = scheduleCheck({
            defaultReasons: {
                'green': 'Ok to release during scheduled hours'
            },
            schedule: {
                'Monday': [
                    { from: '09:00', to: '16:00' }
                ]
            }
        });

        return schedule.start().then(() => schedule.getState())
            .should.eventually.eql({ signal: 'green', reason: 'Ok to release during scheduled hours' });
    });
});
