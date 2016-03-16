var http = require('http');
var expect = require('expect.js');
var _ = require('lodash');

var Server = require('../lib/server');

describe('responds to http requests', function() {
    var server = new Server();

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

    it('returns the state green to requests to "/currentState"', done => {
        makeRequestAndAssertOnResponse({
            path: '/currentState',
            method: 'GET'
        }).then(response => {
            expect(JSON.parse(response.data)).to.eql({ signal: "green" });
            done();
        });
    });

    it('returns a statusCode of 200 to "/currentState"', done => {
        makeRequestAndAssertOnResponse({
            path: '/currentState',
            method: 'GET'
        }).then(response => {
            expect(response.response.statusCode).to.eql(200);
            done();
        });
    });
});
