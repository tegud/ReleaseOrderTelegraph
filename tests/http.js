"use strict";

const http = require('http');
const should = require('should');
const _ = require('lodash');

const Server = require('../lib/server');

describe('responds to http requests', function() {
    let server;

    beforeEach(done => {
        server = new Server({
            port: 1234
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

    it('returns the state green to requests to "/currentState"', () =>
        makeRequestAndAssertOnResponse({
            path: '/currentState',
            method: 'GET'
        })
        .then(response => new Promise(resolve => resolve(JSON.parse(response.data))))
        .should.eventually.eql({ signal: "green", checks: [] }));

    it('returns a statusCode of 200 to "/currentState"', () =>
        makeRequestAndAssertOnResponse({
            path: '/currentState',
            method: 'GET'
        })
        .then(response => new Promise(resolve => resolve(response.response.statusCode)))
        .should.eventually.equal(200));
});
