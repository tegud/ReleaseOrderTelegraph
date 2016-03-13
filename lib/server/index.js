"use strict";

const express = require('express');
const webserver = express();

const port = 1234;

webserver.get('/currentState', (req, res) => {
    res.status(200).send(JSON.stringify({ "signal": "green" }));
});

module.exports = function() {
    return {
        start: () => new Promise((resolve, reject) => webserver.listen(port, '127.0.0.1', (err) => {
            if(err) {
                reject(err);
            }

            resolve();
        })),
        stop: () => new Promise((resolve) => {
            resolve();
        })
    }
};
