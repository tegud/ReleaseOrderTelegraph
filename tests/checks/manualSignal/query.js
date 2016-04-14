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

describe('manual signal polling', () => {
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
