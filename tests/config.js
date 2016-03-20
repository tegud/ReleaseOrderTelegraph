"use strict";

const http = require('http');
const should = require('should');
const _ = require('lodash');
const proxyquire = require('proxyquire');

let startCalled;
let testConfigFileData;

function fakeTestWithStart() {
    return {
        start: () => startCalled = true
    };
}

const checks = proxyquire('../lib/checks', {
    './test_with_start': fakeTestWithStart
});

const Server = proxyquire.noCallThru().noPreserveCache().load('../lib/server', {
	'../checks': checks,
    'fs': {
        'readFileSync': () => testConfigFileData,
        'readFile': (file, encoding, callback) => callback(null, testConfigFileData) 
    }
});

describe('config', () => {
    let server;

    function startServer(config) {
        return (server = new Server('test-config.json')).start();
    }

    beforeEach(() => {
        startCalled = false;
    });

    afterEach(done => server.stop().then(() => done()));

    it('loads from file', () => {
        testConfigFileData = `{
            "port": 1234,
            "checks": [
                { "type": "test_with_start" }
            ]
        }`;

        startServer({
                checks: [
                    { type: 'test_with_start' }
                ]
            })
            .then(() => new Promise(resolve => resolve(startCalled)))
            .should.eventually.equal(true);
    });
});
