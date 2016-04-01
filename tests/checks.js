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

    function makeRequest(requestOptions, body) {
        return new Promise(resolve => {
            var request =  http.request(_.merge({}, {
                host: 'localhost',
                port: 1234
            }, requestOptions), response => {
                var allData = '';

                response.on('data', function (chunk) {
                    allData += chunk;
                });

                response.on('end', function () {
                    resolve({
                        response: response,
                        data: allData
                    })
                });
            });

            if(body) {
                request.write(body);
            }

            request.end();
        })
    }

    it('executes check start handler', () =>
        startServer({
                checks: [
                    { type: 'test_with_start' }
                ]
            })
            .then(() => new Promise(resolve => resolve(startCalled)))
            .should.eventually.equal(true));

    it('executes check start handler', () =>
        startServer({
                checks: [
                    { type: 'test_with_stop' }
                ]
            })
            .then(server.stop)
            .then(() => new Promise(resolve => resolve(stopCalled)))
            .should.eventually.equal(true));

    it('returns the state red', () =>
        startServer({
                checks: [
                    { type: 'test_red' }
                ]
            })
            .then(makeRequest.bind(undefined, {
                path: '/currentState',
                method: 'GET'
            }))
            .then(response => new Promise(resolve => resolve(JSON.parse(response.data).signal))
            .should.eventually.equal('red')));

    it('sets check name', () =>
        startServer({
                checks: [
                    { type: 'test_red', name: 'Red Test' }
                ]
            })
            .then(makeRequest.bind(undefined, {
                path: '/currentState',
                method: 'GET'
            }))
            .then(response => new Promise(resolve => resolve(JSON.parse(response.data).checks[0].name))
            .should.eventually.equal('Red Test')));

    it('sets check type', () =>
        startServer({
                checks: [
                    { type: 'test_red' }
                ]
            })
            .then(makeRequest.bind(undefined, {
                path: '/currentState',
                method: 'GET'
            }))
            .then(response => new Promise(resolve => resolve(JSON.parse(response.data).checks[0].type))
            .should.eventually.equal('test_red')));

    it('returns the check status', () =>
        startServer({
                checks: [
                    { type: 'test_red' }
                ]
            })
            .then(makeRequest.bind(undefined, {
                path: '/currentState',
                method: 'GET'
            }))
            .then(response => new Promise(resolve => resolve(JSON.parse(response.data).checks))
            .should.eventually.eql([
                { type: 'test_red', signal: 'red' }
            ])));

    describe('applies check states in order of precedence', () => {
        function checkOutputOrder() {
            const checkOrder = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments));
            return startServer({
                    checks: checkOrder.map(check => { return { type: `test_${check}` }; })
                })
                .then(makeRequest.bind(undefined, {
                    path: '/currentState',
                    method: 'GET'
                }))
                .then(response => new Promise(resolve => resolve(JSON.parse(response.data).signal)));
        }

        it('red overrides green',
            () => checkOutputOrder('red', 'green').should.eventually.equal('red'));

        it('amber overrides green',
            () => checkOutputOrder('amber', 'green').should.eventually.equal('amber'));

        it('red overrides amber',
            () => checkOutputOrder('amber', 'red').should.eventually.equal('red'));

        it('amber overrides green',
            () => checkOutputOrder('green', 'amber').should.eventually.equal('amber'));
    });
});
