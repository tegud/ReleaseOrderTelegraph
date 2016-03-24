"use strict";

let fakeCurrentDate;

const should = require('should');
const moment = require('moment');
const proxyquire = require('proxyquire');
const http = require('http');
const express = require('express');
const fakeMoment = require('../../lib/fakeMoment')();

const concurrentReleasesCheck = proxyquire('../../../lib/checks/concurrentReleases', {
    '../../elasticsearch/poller': proxyquire('../../../lib/elasticsearch/poller', {
        'moment': fakeMoment.moment
    }),
    'moment': fakeMoment.moment
});

function waitFor(timeInMs) {
    return () => new Promise(resolve => setTimeout(() => resolve(), timeInMs));
}

describe('concurrentReleases polling', () => {
    let server;
    let stubEsServer;
    let check;

    function setFakeEsResponses(handlers) {
        handlers.forEach(handler => stubEsServer[handler.method || 'all'](handler.path, handler.handler));
    }

    beforeEach(done => {
        stubEsServer = express();

        server = stubEsServer.listen(9200, () => done());
    });

    afterEach(done => {
        check.stop().then(() => {
            fakeMoment.clear();
            server.close();
            done();
        });
    });

    it('signal after elasticsearch is polled for a new value', () => {
        check = new concurrentReleasesCheck({
            thresholds: [
                { signal: 'red', limit: 2 }
            ],
            elasticsearch: {
                host: '127.0.0.1',
                port: 9200,
                index: 'releases-${YYYY}.${MM}',
                type: 'release_order_signal',
                poll: 1
            }
        });

        let requestCount = 0;

        setFakeEsResponses([
            {
                path: '/releases-2016.03/_search',
                handler: (req, res) => {
                    res.status(200)
                        .set('Content-Type', 'application/json; charset=UTF-8')
                        .send(JSON.stringify({
                        "took": 418,
                        "timed_out": false,
                        "_shards": {
                            "total": 5,
                            "successful": 5,
                            "failed": 0
                        },
                        "hits": {
                            "total": requestCount,
                            "max_score": 1,
                            "hits": []
                            }
                        }))

                    requestCount++;
                }
            }
        ]);

        return check.start().then(waitFor(50)).then(() => check.getState())
            .should.eventually.eql({ signal: 'red' });
    });
});
