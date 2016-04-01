"use strict";

const patternMatchers = [
    { pattern: /\$\{YYYY\}/, format: 'YYYY' },
    { pattern: /\$\{MM\}/, format: 'MM' },
    { pattern: /\$\{DD\}/, format: 'DD' }
];

module.exports = function(indexPattern) {
    return {
        get: (day) => {
            const indicies = [];

            indicies.push(patternMatchers.reduce((current, matcher) =>
                current.replace(matcher.pattern, day.format(matcher.format)), indexPattern));

            return indicies;
        }
    };
};
