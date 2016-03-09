var express = require('express');
var webserver = express();
var checks = require('./lib/checks')

var port = 1235

function waitFor(timeOut) {
    return (() =>
        new Promise((resolve) =>
            setTimeout(() => resolve(), timeOut))).bind(undefined);
}

(function check() {
    checks.refresh()
        .then(newState => console.log(`All checks complete, new state is ${newState}`))
        .then(waitFor(5000))
        .then(check);
})();

webserver.get('/', function(req, res, next){
    res.status(200).send(JSON.stringify({ "signal": "green" }));
});

webserver.listen(port, '127.0.0.1', function (err) {
    console.log(`Web server listening on ${port}.`);
});
