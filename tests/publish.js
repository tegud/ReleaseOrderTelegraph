"use strict";

const http = require('http');
const should = require('should');
const _ = require('lodash');
const proxyquire = require('proxyquire');
const amqpSub = require('./lib/fakeAmqp');

let fakeTestSignal;
let publishNewSignalFromTest;

function fakeTest(signal, config, eventEmitter) {
    fakeTestSignal = signal;

    return {
        start: () => new Promise(resolve => {
            publishNewSignalFromTest = signal => {
                eventEmitter.emit('newSignal', {
                    name: config.name,
                    type: config.type,
                    signal: {
                        signal: signal
                    }
                });
            };
            resolve();
        }),
        getState: () => new Promise(resolve => resolve({ signal: fakeTestSignal }))
    };
}

const checks = proxyquire('../lib/checks', {
    './test_check': fakeTest.bind(undefined, 'red')
});

const Server = proxyquire.noCallThru().noPreserveCache().load('../lib/server', {
	'../checks': checks
});

describe('responds to check changes', () => {
    let server;

    function startServer(config) {
        return (server = new Server(_.defaults(config, { port: 1234 }))).start();
    }

    function interceptAmqpMessages(options, handler) {
        const mockAmqpServer = amqpSub.mock({ host: options.host || '127.0.0.1', port: options.port || 5672 });
		mockAmqpServer.exchange(options.exchange, handler);
    }

    afterEach(done => server.stop().then(() => done()));

    it('sends release_order_signal_change event when signal changes', done => {
        startServer({
            publishers: [
                { type: 'amqp', host: '127.0.0.1', port: 5672, exchange: 'test' }
            ],
            checks: [
                { type: 'test_check' }
            ]
        })
        .then(() => {
            publishNewSignalFromTest('green');
        });

        interceptAmqpMessages({ exchange: 'test' }, (routingKey, msg) => {
            const data = msg.data.toString('utf-8');
            const parsedData = JSON.parse(data);

            parsedData.should.eql({ signal: "green", checks: [ { type: 'test_check', name: 'test_check', signal: 'green' } ] });

            done();
        });
    });
});
