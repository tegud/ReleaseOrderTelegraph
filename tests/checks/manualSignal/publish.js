"use strict";

let fakeCurrentDate;

const should = require('should');
const moment = require('moment');
const proxyquire = require('proxyquire');
const http = require('http');
const express = require('express');
const fakeMoment = require('../../lib/fakeMoment')();
const EventEmitter = require('events');
const _ = require('lodash');

const manualSignalCheck = proxyquire('../../../lib/checks/manualSignal', {
    '../../elasticsearch/poller': proxyquire('../../../lib/elasticsearch/poller', {
        'moment': fakeMoment.moment
    }),
    'moment': fakeMoment.moment
});

function waitFor(timeInMs) {
    return () => new Promise(resolve => setTimeout(() => resolve(), timeInMs));
}

describe('manual signal', () => {
    let server;
    let stubEsServer;
    let manualSignal;

    function createManualSignal(eventEmitter) {
        return new Promise(resolve => resolve(manualSignal = new manualSignalCheck({
            type: 'manualSignal',
            name: 'manualSignal',
            elasticsearch: {
                host: '127.0.0.1',
                port: 9200,
                index: 'releases-${YYYY}.${MM}',
                type: 'release_order_signal',
                poll: 1
            }
        }, eventEmitter)));
    }

    function setFakeEsResponses(handlers) {
        handlers.forEach(handler => stubEsServer[handler.method || 'all'](handler.path, handler.handler));
    }

    function setSignalResponses(responses) {
        function getHitsForRequestIndex(index) {
            if(index > responses.length - 1) {
                index = responses.length - 1;
            }

            const currentResponse = responses[index];

            if(typeof currentResponse === 'string') {
                if(currentResponse === 'green') {
                    return {
                        "total": 0,
                        "max_score": 1,
                        "hits": []
                    };
                }
                else {
                    return {
                        "total": 1,
                        "max_score": 1,
                        "hits": [{
                            "_index": "releases-2016.03",
                            "_type": "release_order_signal",
                            "_id": "AVNgt4GFQRYe6m_Jj4Gl",
                            "_score": 1,
                            "_source": {
                                "@timestamp": "2016-03-14T08:29:11+00:00",
                                "newSignal": currentResponse
                            }
                        }]
                    };
                }
            }

            return {
                "total": 1,
                "max_score": 1,
                "hits": [{
                    "_index": "releases-2016.03",
                    "_type": "release_order_signal",
                    "_id": "AVNgt4GFQRYe6m_Jj4Gl",
                    "_score": 1,
                    "_source": _.merge({
                        "@timestamp": "2016-03-14T08:29:11+00:00"
                    }, currentResponse)
                }]
            };
        }

        return new Promise(resolve => {
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
                            "hits": getHitsForRequestIndex(requestCount)
                        }))

                        requestCount++;
                    }
                }
            ]);

            resolve();
        })
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

    describe('emits newSignal event', () => {
        it('emits event on signal change', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T09:00:00')
                .then(() => setSignalResponses(['green', 'red']))
                .then(() => createManualSignal(eventEmitter))
                .then(manualSignal => manualSignal.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal);
                })).should.eventually.eql({
                    name: 'manualSignal',
                    type: 'manualSignal',
                    signal: {
                        signal: 'red'
                    }
                });
        });

        it('emits event on reason change', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T09:00:00')
                .then(() => setSignalResponses(['red', { newSignal: 'red', reason: 'Reason 2' }]))
                .then(() => createManualSignal(eventEmitter))
                .then(manualSignal => manualSignal.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal);
                })).should.eventually.eql({
                    name: 'manualSignal',
                    type: 'manualSignal',
                    signal: {
                        signal: 'red',
                        reason: 'Reason 2'
                    }
                });
        });

        it('emits event on setUntil change', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T09:00:00')
                .then(() => setSignalResponses(['red', { newSignal: 'red', setUntil: '2016-03-14T19:00:00' }]))
                .then(() => createManualSignal(eventEmitter))
                .then(manualSignal => manualSignal.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal);
                })).should.eventually.eql({
                    name: 'manualSignal',
                    type: 'manualSignal',
                    signal: {
                        signal: 'red',
                        setUntil: '2016-03-14T19:00:00'
                    }
                });
        });

        it('emits event on setBy change', () => {
            const eventEmitter = new EventEmitter();

            fakeMoment.setDate('2016-03-14T09:00:00')
                .then(() => setSignalResponses(['red', { newSignal: 'red', setBy: 'Steve' }]))
                .then(() => createManualSignal(eventEmitter))
                .then(manualSignal => manualSignal.start());

            return new Promise(resolve =>
                eventEmitter.on('newSignal', function(signal) {
                    resolve(signal);
                })).should.eventually.eql({
                    name: 'manualSignal',
                    type: 'manualSignal',
                    signal: {
                        signal: 'red',
                        setBy: 'Steve'
                    }
                });
        });
    });

    it('does not emits event if state does not change', () => {
        const eventEmitter = new EventEmitter();

        fakeMoment.setDate('2016-03-14T09:00:00')
            .then(() => setSignalResponses(['green', 'green', 'red']))
            .then(() => createManualSignal(eventEmitter))
            .then(manualSignal => manualSignal.start());

        return new Promise(resolve =>
            eventEmitter.on('newSignal', function(signal) {
                resolve(signal);
            })).should.eventually.eql({
                name: 'manualSignal',
                type: 'manualSignal',
                signal: {
                    signal: 'red'
                }
            });
        });
});
