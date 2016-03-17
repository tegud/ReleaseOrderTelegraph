module.exports = function() {
    return {
        start: () => new Promise(resolve => resolve()),
        getState: () => new Promise(resolve => resolve({ signal: 'red' }))
    };
};
