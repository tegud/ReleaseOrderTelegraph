"use strict";

const should = require('should');
const _ = require('lodash');
const scheduleCheck = require('../../lib/checks/schedule');

describe('schedule', () => {
    it('should return red when current date is outside the configured schedule', () => {
        const schedule = scheduleCheck();

        return schedule.start().then(() => schedule.getState())
            .should.eventually.eql({ signal: 'red' });
    });
});
