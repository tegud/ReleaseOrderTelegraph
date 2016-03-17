const checks = [];

module.exports = {
    register: config => {
        console.log(`Registering ${config.type}.`);
        const check = require(`./${config.type}`)(config);
        checks.push(check);

        return check.start()
            .catch(err => console.log(err));
    },
    getCurrent: () => {
        if(!checks.length) {
            return { signal: 'green' }
        }

        return  checks[0].getState();
    }
};
