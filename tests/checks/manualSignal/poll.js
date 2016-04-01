"use strict";

let fakeCurrentDate;

const should = require('should');
const moment = require('moment');
const proxyquire = require('proxyquire');
const http = require('http');
const express = require('express');
const fakeMoment = require('../../lib/fakeMoment')();

const manualSignalCheck = proxyquire('../../../lib/checks/manualSignal', {
    '../../elasticsearch/poller': proxyquire('../../../lib/elasticsearch/poller', {
        'moment': fakeMoment.moment
    }),
    'moment': fakeMoment.moment
});

function waitFor(timeInMs) {
    return () => new Promise(resolve => setTimeout(() => resolve(), timeInMs));
}

describe('manual signal startup', () => {
    let server;
    let stubEsServer;
    let manualSignal;

    function setFakeEsResponses(handlers) {
        handlers.forEach(handler => stubEsServer[handler.method || 'all'](handler.path, handler.handler));
    }

    beforeEach(done => {
        stubEsServer = express();

        server = stubEsServer.listen(9200, () => done());
    });

    afterEach(done => {
        manualSignal.stop().then(() => {
            fakeMoment.clear();
            server.close();
            done();
        });
    });

    it('signal after elasticsearch is polled for a new value', () => {
        fakeMoment.setDate('2016-03-14T09:00:00');
        
        manualSignal = new manualSignalCheck({
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
                            "hits": requestCount ? [{
                                    "_index": "releases-2016.03",
                                    "_type": "release_order_signal",
                                    "_id": "AVNgt4GFQRYe6m_Jj4Gl",
                                    "_score": 1,
                                    "_source": {
                                        "@timestamp": "2016-03-14T08:29:11+00:00",
                                        "newSignal": "red"
                                    }
                                }] : []
                            }
                        }))

                    requestCount++;
                }
            }
        ]);

        return manualSignal.start().then(waitFor(50)).then(() => manualSignal.getState())
            .should.eventually.eql({ signal: 'red' });
    });
});
