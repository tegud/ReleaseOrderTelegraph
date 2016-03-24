"use strict";

let fakeCurrentDate;

const should = require('should');
const moment = require('moment');
const proxyquire = require('proxyquire');
const http = require('http');
const express = require('express');
const fakeMoment = require('../../lib/fakeMoment')();

const concurrentReleasesCheck = proxyquire('../../../lib/checks/concurrentReleases', {
    'moment': fakeMoment.moment
});

describe('concurrent releases check startup', () => {
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

    it('signal is set to green when no releases are in progress', () => {
        fakeMoment.setDate('2016-03-14T09:00:00');

        const concurrentReleases = new concurrentReleasesCheck({
            elasticsearch: {
                host: '127.0.0.1',
                port: 9200,
                index: 'releases-${YYYY}.${MM}',
                type: ''
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

        return concurrentReleases.start().then(() => concurrentReleases.getState())
            .should.eventually.eql({ signal: 'green' });
    });

    it('signal is set to the specified level when number of releases is over configured limit', () => {
        fakeMoment.setDate('2016-03-14T09:00:00');

        const concurrentReleases = new concurrentReleasesCheck({
            thresholds: [
                { signal: 'amber', limit: 2 }
            ],
            elasticsearch: {
                host: '127.0.0.1',
                port: 9200,
                index: 'releases-${YYYY}.${MM}',
                type: ''
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
                            "total": 2,
                            "max_score": 1,
                            "hits": []
                            }
                        }))

            }
        ]);

        return concurrentReleases.start().then(() => concurrentReleases.getState())
            .should.eventually.eql({ signal: 'amber' });
    });

    it('signal is set to the green when number of releases is under all configured limit', () => {
        fakeMoment.setDate('2016-03-14T09:00:00');

        const concurrentReleases = new concurrentReleasesCheck({
            thresholds: [
                { signal: 'amber', limit: 2 }
            ],
            elasticsearch: {
                host: '127.0.0.1',
                port: 9200,
                index: 'releases-${YYYY}.${MM}',
                type: ''
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
                            "total": 1,
                            "max_score": 1,
                            "hits": []
                            }
                        }))

            }
        ]);

        return concurrentReleases.start().then(() => concurrentReleases.getState())
            .should.eventually.eql({ signal: 'green' });
    });

    it('signal is set to the last matched threshold', () => {
        fakeMoment.setDate('2016-03-14T09:00:00');

        const concurrentReleases = new concurrentReleasesCheck({
            thresholds: [
                { signal: 'amber', limit: 2 },
                { signal: 'amber', limit: 3 }
            ],
            elasticsearch: {
                host: '127.0.0.1',
                port: 9200,
                index: 'releases-${YYYY}.${MM}',
                type: ''
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
                            "total": 5,
                            "max_score": 1,
                            "hits": []
                            }
                        }))

            }
        ]);

        return concurrentReleases.start().then(() => concurrentReleases.getState())
            .should.eventually.eql({ signal: 'amber' });
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

            const concurrentReleases = new concurrentReleasesCheck({
                elasticsearch: {
                    host: '127.0.0.1',
                    port: 9200,
                    index: 'releases-${YYYY}.${MM}',
                    type: ''
                }
            });

            concurrentReleases.start();
        });

        it('queries the correct index by day', done => {
            fakeMoment.setDate('2016-02-14T09:00:01');

            setFakeEsResponses([
                {
                    path: '/releases-2016.02.14/_search',
                    handler: () => done()
                }
            ]);

            const concurrentReleases = new concurrentReleasesCheck({
                elasticsearch: {
                    host: '127.0.0.1',
                    port: 9200,
                    index: 'releases-${YYYY}.${MM}.${DD}',
                    type: ''
                }
            });

            concurrentReleases.start();
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
            ])).should.eventually.equal("_type: release AND environment: live AND isComplete: false");

            const concurrentReleases = new concurrentReleasesCheck({
                elasticsearch: {
                    host: '127.0.0.1',
                    port: 9200,
                    index: 'releases-${YYYY}.${MM}',
                    type: 'release'
                }
            });

            concurrentReleases.start();

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

            const concurrentReleases = new concurrentReleasesCheck({
                elasticsearch: {
                    host: '127.0.0.1',
                    port: 9200,
                    index: 'releases-${YYYY}.${MM}',
                    type: ''
                }
            });

            concurrentReleases.start();

            return testPromise;
        });
    });
});
