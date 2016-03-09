var moment = require('moment');

var schedule = [
    { start: 900, end: 1600 },
    { start: 900, end: 1600 },
    { start: 900, end: 1600 },
    { start: 900, end: 1600 },
    { start: 900, end: 1230 }
];

module.exports = () => new Promise(resolve => {
    var today = moment();
    var dayOfWeek = today.format('E') - 1;
    var todaysSchedule = schedule[dayOfWeek];

    if(!todaysSchedule) {
        return resolve({ state: 'red', reason: 'Cannot release on a weekend' });
    }

    var hourAndMinute = parseInt(today.format('HHmm'), 10);

    console.log(hourAndMinute);

    if(hourAndMinute < todaysSchedule.start || hourAndMinute > todaysSchedule.end) {
        return resolve({ state: 'red', reason: 'Release outside of allowed times' });
    }

    return resolve({ state: 'green' });
});
