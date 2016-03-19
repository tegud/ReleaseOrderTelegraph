"use strict";

const moment = require('moment');

module.exports = () => {
    let fakeCurrentDate;

    return {
        clear: () => fakeCurrentDate = undefined,
        setDate: date => new Promise(resolve => resolve(fakeCurrentDate = date)),
        moment: date => {
            if(!date && fakeCurrentDate) {
                return moment(fakeCurrentDate);
            }

            return moment(date);
        }
    }
};
