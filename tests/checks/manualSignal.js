"use strict";

let fakeCurrentDate;

const should = require('should');
const moment = require('moment');
const proxyquire = require('proxyquire');
const http = require('http');
const express = require('express');
const fakeMoment = require('../lib/fakeMoment')();

const manualSignalCheck = proxyquire('../../lib/checks/manualSignal', {
    'moment': fakeMoment.moment
});

describe('manual signal', () => {
    let server;
    let stubEsServer;

    function setFakeEsResponses(handlers) {
        handlers.forEach(handler => stubEsServer[handler.method || 'all'](handler.path, handler.handler));
    }

    beforeEach(done => {
        stubEsServer = express();

        server = stubEsServer.listen(9200, () => done());
    });

    afterEach(() => {
        fakeMoment.clear();
        server.close();
    });

    it('signal is set to unknown when Elasticsearch responds with an error', () => {
        const manualSignal = new manualSignalCheck({
            elasticsearch: {
                host: '127.0.0.1',
                port: 9200,
                index: 'releases-${YYYY}.${MM}',
                type: 'release_order_signal'
            }
        });

        return manualSignal.start().then(() => manualSignal.getState())
            .should.eventually.eql({ signal: 'unknown' });
    });

    it('signal is set to green with no manual set entries for the day', () => {
        const manualSignal = new manualSignalCheck({
            elasticsearch: {
                host: '127.0.0.1',
                port: 9200,
                index: 'releases-${YYYY}.${MM}',
                type: 'release_order_signal'
            }
        });

        setFakeEsResponses([
            {
                path: '/releases-2016.03/_search',
                handler: (req, res) =>
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
                            "total": 0,
                            "max_score": 1,
                            "hits": []
                            }
                        }))

            }
        ]);

        return manualSignal.start().then(() => manualSignal.getState())
            .should.eventually.eql({ signal: 'green' });
    });

    it('signal is set to last manual set entry for the day ', () => {
        fakeMoment.setDate('2016-03-14T09:00:01');

        setFakeEsResponses([
            {
                path: '/releases-2016.03/_search',
                handler: (req, res) =>
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
                            "total": 17,
                            "max_score": 1,
                            "hits": [{
                                    "_index": "releases-2016.03",
                                    "_type": "release_order_signal",
                                    "_id": "AVNgt4GFQRYe6m_Jj4Gl",
                                    "_score": 1,
                                    "_source": {
                                        "@timestamp": "2016-03-14T08:29:11+00:00",
                                        "newSignal": "red"
                                    }
                                }]
                            }
                        }))

            }
        ]);

        const manualSignal = new manualSignalCheck({
            elasticsearch: {
                host: '127.0.0.1',
                port: 9200,
                index: 'releases-${YYYY}.${MM}',
                type: 'release_order_signal'
            }
        });

        return manualSignal.start().then(() => manualSignal.getState())
            .should.eventually.eql({ signal: 'red' });
    });

    describe('query', () => {
        it('queries the correct index by month', done => {
            fakeMoment.setDate('2016-02-14T09:00:01');

            setFakeEsResponses([
                {
                    path: '/releases-2016.02/_search',
                    handler: () => done()
                }
            ]);

            const manualSignal = new manualSignalCheck({
                elasticsearch: {
                    host: '127.0.0.1',
                    port: 9200,
                    index: 'releases-${YYYY}.${MM}',
                    type: 'release_order_signal'
                }
            });

            manualSignal.start();
        });

        it('queries the correct index by day', done => {
            fakeMoment.setDate('2016-02-14T09:00:01');

            setFakeEsResponses([
                {
                    path: '/releases-2016.02.14/_search',
                    handler: () => done()
                }
            ]);

            const manualSignal = new manualSignalCheck({
                elasticsearch: {
                    host: '127.0.0.1',
                    port: 9200,
                    index: 'releases-${YYYY}.${MM}.${DD}',
                    type: 'release_order_signal'
                }
            });

            manualSignal.start();
        });

        it('creates correct lucene query for the _type and day', () => {
            fakeMoment.setDate('2016-02-14T09:00:01');

            const testPromise = new Promise(resolve => setFakeEsResponses([
                {
                    path: '/releases-2016.02/_search',
                    handler: req => {
                        resolve(req.query.q);
                    }
                }
            ])).should.eventually.equal("_type: release_order_signal AND @timestamp: [2016-02-14 TO *]");

            const manualSignal = new manualSignalCheck({
                elasticsearch: {
                    host: '127.0.0.1',
                    port: 9200,
                    index: 'releases-${YYYY}.${MM}',
                    type: 'release_order_signal'
                }
            });

            manualSignal.start();

            return testPromise;
        });

        it('sorts by @timestamp desc', () => {
            fakeMoment.setDate('2016-02-14T09:00:01');

            const testPromise = new Promise(resolve => setFakeEsResponses([
                {
                    path: '/releases-2016.02/_search',
                    handler: req => {
                        resolve(req.query.sort);
                    }
                }
            ])).should.eventually.equal("@timestamp:desc");

            const manualSignal = new manualSignalCheck({
                elasticsearch: {
                    host: '127.0.0.1',
                    port: 9200,
                    index: 'releases-${YYYY}.${MM}',
                    type: 'release_order_signal'
                }
            });

            manualSignal.start();

            return testPromise;
        });
    });
});
