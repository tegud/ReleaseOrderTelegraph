"use strict";

const http = require('http');
const expect = require('expect.js');
const _ = require('lodash');
const proxyquire = require('proxyquire');
const Server = proxyquire.noCallThru().noPreserveCache().load('../lib/server', {
	'../checks': proxyquire('../lib/checks', {
		'./test': () => {
            return {
                start: () => new Promise(resolve => resolve()),
                getState: () => { return { signal: 'red' }; }
            };
        }
	})
});

describe('responds to check changes', done => {
    let server;

    beforeEach(done => {
        server = new Server({
            port: 1234,
            checks: [
                { type: 'test' }
            ]
        });

        server.start().then(() => done());
    });

    afterEach(done => server.stop().then(() => done()));

    function makeRequestAndAssertOnResponse(requestOptions, body) {
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

    it('returns the state red', done => {
        makeRequestAndAssertOnResponse({
            path: '/currentState',
            method: 'GET'
        }).then(response => {
            expect(JSON.parse(response.data)).to.eql({ signal: "red" });
            done();
        });
    });
});
