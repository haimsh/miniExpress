/**
 * Created by ShachorFam on 06/01/14.
 */

// invoke static tester from ex3 (old-version compatability).
require('./staticTester');
//    require('./callbackLogger').activate();
var express = require('./miniExpress');
var http = require('http');

function testParams() {
    var app = express();
    var server = app.listen(5000);
    const PARAM1 = 'some_text_for_param1!$t[]&';
    const PARAM2 = 'text|for|param|2';
    const BODY_PARAM = 'body_param';
    const QUERY_PARAM = 'queryValue';
    app.use(express.urlencoded());
    app.get('/paramTester/:param1/somePathBetween/:param2', function (req, res) {
        if (req.param('param1') !== PARAM1 || req.param('PARam2') !== PARAM2 ||
            req.param('body') !== BODY_PARAM || req.param('query') !== QUERY_PARAM) {
            console.error("some params didn't pass");
        } else {
            console.error("params test passed");
        }
    });

    var messageBody = 'body=' + BODY_PARAM;
    var myHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': messageBody.length
    };
    var rquestOption = {
        host: 'localhost',
        port: '5000',
        path: '/paramTester/' + PARAM1 + '/somePathBetween/' + PARAM2 + '/?query=' + QUERY_PARAM,
        headers: myHeaders
    };
    http.request(rquestOption).end(messageBody);
    setTimeout(function () {server.close();}, 2000);
}

function testCookies() {
    var app = express();
    var server = app.listen(5001);
    setTimeout(function () {server.close();}, 2000);
    app.use(express.cookieParser());
    app.put('/cookieTester/', function (req, res) {
        var cookies = req.cookies;
        if (cookies.key1 !== 'val1' || cookies.key2 !== 'val2') {
            console.error("cookies test failed on server.");
        } else {
            console.error("cookies test passed on server.");
        }
        res.cookie('key3', 'val3', {httpOnly: true});
        res.send(200);
    });
    var myHeaders = {
        Cookie: 'key1=val1; key2=val2'
    };
    var rquestOption = {
        host: 'localhost',
        port: '5001',
        path: '/cookieTester/',
        method: 'PUT',
        headers: myHeaders
    };
    var req = http.request(rquestOption);
    req.write('');
    req.on('response', function (res) {
        if (res.statusCode != '200' || res.headers['set-cookie'][0] !== 'key3=val3; HttpOnly') {
            console.error("cookies test failed on client");
        } else {
            console.error("cookies test passed on client");
        }
    });
    setTimeout(req.end.bind(req), 5000);
}

function testJSON() {
    var app = express();
    var server = app.listen(5002);
    const OBJECT = { a: 'a', b: 1, c: {'d': ['d']}};
    setTimeout(function () {server.close();}, 2000);
    app.use(express.json());
    app.get('/json/', function (req, res) {
        if (req.body.a !== OBJECT.a || req.body.b != OBJECT.b ||
            req.body.c['d'][0] !== OBJECT.c['d'][0] ||
            JSON.stringify(OBJECT) !== JSON.stringify(req.body)) {
            console.error('json test failed');
            console.log(req.body);
        } else {
            console.error('json test passed.');
        }
    });
    var messageBody = JSON.stringify(OBJECT);
    var myHeaders = {
        'Content-Type': 'application/json',
        'Content-Length': messageBody.length
    };
    var rquestOption = {
        host: 'localhost',
        port: '5002',
        path: '/json/',
        headers: myHeaders
    };
    http.request(rquestOption).end(messageBody);
}

function test() {
    testParams();
    testCookies();
    testJSON();
    setTimeout(process.exit, 30000);
}

test();