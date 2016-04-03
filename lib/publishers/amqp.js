"use strict";

const amqp = require('amqp');

module.exports = config => {
    let exchange;
    let connected;

    function connectionReady(resolve, reject, connection) {
        if (connected) {
            return;
        }

        connected = true;
        console.log('Connected to Rabbit MQ');

        connection.exchange(config.exchange, {
            type: 'fanout',
            durable: false,
            autoDelete: false
        }, exchangeReady.bind(undefined, resolve));
    }

    function exchangeReady(resolve, theExchange) {
        console.log('Connected to Exchange');

        exchange = theExchange;

        resolve();
    }

    function startUp(resolve, reject) {
        console.log('Creating AMQP publisher connection');

        const connection = amqp.createConnection({
            host: config.host
        });

        connection.on('error', err => {
            console.log(`Could not connect to: ${config.host}, error: ${err}`);

            return reject(new Error('AMQP publisher could not connect to queue.'));
        });

        connection.on('ready', connectionReady.bind(undefined, resolve, reject, connection));
    }

    function start(eventEmitter) {
        eventEmitter.on('newSignalState', (data) => {
            const message = JSON.stringify(data);
            exchange.publish('', message);
        });

        return new Promise(startUp);
    }

    return {
        start: start
    };
};
