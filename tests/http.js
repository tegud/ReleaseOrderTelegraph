var http = require('http');
var expect = require('expect.js');

var Server = require('../lib/server');

describe('responds to http requests', function() {
    it('returns the state green to requests to "/currentState"', done => {
        var server = new Server();

        server.start()
            .then(() => {
            var request =  http.request({
                host: 'localhost',
                port: 1234,
                path: '/currentState',
                method: 'GET'
            }, function(response) {
                var allData = '';

                response.on('data', function (chunk) {
                    allData += chunk;
                });

                response.on('end', function () {
                    expect(JSON.parse(allData)).to.eql({ signal: "green" });
                    console.log('END');
                    server.stop().then(() => done());
                });
            });

            request.end();
        });
    });
});
