"use strict";

const http = require('http');
const should = require('should');
const _ = require('lodash');
const proxyquire = require('proxyquire');

let startCalled;
let stopCalled;

function fakeTest(signal) {
    return {
        getState: () => new Promise(resolve => resolve({ signal: signal }))
    };
}

function fakeTestWithStart() {
    return {
        start: () => startCalled = true
    };
}

function fakeTestWithStop() {
    return {
        stop: () => stopCalled = true
    };
}

const checks = proxyquire('../lib/checks', {
    './test_red': fakeTest.bind(undefined, 'red'),
    './test_amber': fakeTest.bind(undefined, 'amber'),
    './test_green': fakeTest.bind(undefined, 'green'),
    './test_with_start': fakeTestWithStart,
    './test_with_stop': fakeTestWithStop
});

const Server = proxyquire.noCallThru().noPreserveCache().load('../lib/server', {
	'../checks': checks
});

describe('responds to check changes', () => {
    let server;

    function startServer(config) {
        return (server = new Server(_.defaults(config, { port: 1234 }))).start();
    }

    beforeEach(() => {
        startCalled = false;
        stopCalled = false;
    });

    afterEach(done => server.stop().then(() => done()));

    it('returns the state red', () =>
        startServer({
                checks: [
                    { type: 'test_red' }
                ]
            })
            .then(new Promise(resolve => resolve()))
            .then(response => new Promise(resolve => resolve(JSON.parse(response.data).signal))
            .should.eventually.equal('red')));
});
