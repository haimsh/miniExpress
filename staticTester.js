/**
 * Created by ShachorFam on 04/12/13.
 * @author Haim Shachor
 * @module tester.
 */

/*
 * In order to suppress the server output, avoid printing to stdout.
 * Upon receiving error respond, print will be via stderr.
 */
console.log = console.info = function (t) {};

var logger = require('./callbackLogger');

// Uncomment to see log of callbacks start and end.
// Currently commented for cleaner log.
//logger.activate();
logger.startCallBack('staticTester.js:main');

var miniExpress = require('./miniExpress');
var http = require('http');
var fs = require('fs');
var path = require('path');
var net = require('net');
var readline = require('readline');

/**
 * Close the miniExpress app after given time.
 * @method closeApp.
 * @param app miniExpress app object to close.
 * @param duration time (in ms.) until close is done.
 */
function closeApp(app, duration) {
    setTimeout(function () {
        logger.startCallBack('staticTester.js: Closing app server');
        app.close();
        logger.endCallBack('staticTester.js: Closing app server');
    }, duration);
}

/**
 * Open static server on www folder.
 * @method openServer.
 * @param port the port the server will listen.
 * @param duration time until the server will close.
 */
function openServer(port, duration) {
    var app = miniExpress();
    console.log('tester: starting the server');
    app.get('/', miniExpress.static(__dirname + '\\www'));
    var srv = app.listen(port);
//    srv.listen(port);
    closeApp(srv, duration);
}


/**
 * Test the server by downloading all files in www folder.
 * The tester read the www folder, and for each file, create http request for
 * the file, and compare the response to the file content.
 * @method testSite.
 */
function testSite() {
    var file;
    var testDir;
    var requestOption;

    // 1. Open the server
    openServer(8080, 50000);

    // 2. Test the www folder
    testDir = __dirname + '\\www';
    requestOption = {
        host: 'localhost',
        port: '8080'
    };
    fs.readdir(testDir, function (err, files) {
        logger.startCallBack('staticTester.js:wwwFilesIterator');
        if (err) {
            throw err;
        }
        for (file in files) {
            if (!files.hasOwnProperty(file)) {
                continue;
            }
            (function (fileName) {
                requestOption.path = fileName;
                http.request(requestOption, function (respond) {
                    logger.startCallBack('staticTester.js:respondFromServer for ' +
                        fileName);
                    var content = [];
                    respond.on('data', function (data) {
                        logger.startCallBack('staticTester.js:dataOnRespond for ' +
                            fileName);
                        content.push(data);
                        logger.endCallBack('staticTester.js:dataOnRespond for ' +
                            fileName);
                    });
                    respond.on('end', function () {
                        logger.startCallBack('staticTester.js:endRespond for ' +
                            fileName);
                        var contentBuffer = Buffer.concat(content);
                        fs.readFile(path.normalize(testDir + fileName),
                            function (err, data) {
                            if (err) {
                                throw err;
                            }
                            logger.startCallBack('staticTester.js:compareContent ' +
                                'for' + fileName);
                            if (JSON.stringify(data) ===
                                JSON.stringify(contentBuffer)) {
                                console.log("file " + fileName + " returned " +
                                    "successfully by server.");
                            } else {
                                console.error("testSite: file " + fileName +
                                    " failed.");
                            }
                            logger.endCallBack('staticTester.js:compareContent for' +
                                fileName);
                        });
                    });
                    logger.endCallBack('staticTester.js:respondFromServer for ' +
                        fileName);
                }).end();
            }('/' + files[file]));
        }
        logger.endCallBack('staticTester.js:wwwFilesIterator');
    });
}

/**
 * Test server with different url path.
 * The tester use the same miniExpress app for several rootFolders (all
 * reference to www folder), and try to request small file via http module.
 * @method multiServer.
 */
function multiServer() {
    var statSite = miniExpress.static(__dirname + '\\www');
    var app = miniExpress();
    var srv = app.listen(8081);
    var site;
    function testSourceSite(site){
        app.use(site, statSite);
        var requestOption = {
            host: 'localhost',
            port: '8081',
            path: site + '/smallFile.txt'
        };
        http.request(requestOption, function (res) {
            logger.startCallBack('staticTester.js: multiServer respond for site ' +
                site);
            if (res.statusCode === 200) {
                console.error('Site ' + site + ' was tested and found OK');
            } else {
                console.error('multiServer: Site ' + site +
                    ' returned error respond: ' + res.statusCode);
                res.pipe(process.stderr);
            }
            logger.endCallBack('staticTester.js: multiServer respond for site ' +
                site);

        }).end();
    }

    const SITES = ['/x/y', '/y'];
    for (site in  SITES) {
        if (SITES.hasOwnProperty(site)) {
            testSourceSite(SITES[site]);
        }
    }
    closeApp(srv, 5000);
}

/**
 * This tester test handle of requests with body.
 * It open net connection to server, and simulate HTTP request with body, and
 * second adjoin HTTP request. The server should reply succesfully to both
 * requests.
 * @method testBody.
 */
function testBody() {
    var socket;
    var reader;
    var ok = 0;
    openServer(8082, 5000);
    socket = net.connect({
        host: 'localhost',
        port: 8082
    }, function () {
        logger.startCallBack('staticTester.js: body - connect');
        socket.write('GET /smallFile.txt HTTP/1.1\r\nContent-Length: 12\r\n' +
            '\r\nblablabla\r\nbGET /prototype.js HTTP/1.1\r\n\r\n');
        logger.endCallBack('staticTester.js: body - connect');
    });
    reader = readline.createInterface(socket, process.stdout, false, false);
    reader.on('line', function (line) {
        logger.startCallBack('staticTester.js: body - respond line read');
        console.log(line);
        if (line.lastIndexOf('200 OK') >= 0 && ++ok === 2) {
            console.log('Server succeed to get two piped messages.');
        }
        logger.endCallBack('staticTester.js: body - respond line read');
    });
    socket.on('end', function () {
        logger.startCallBack('staticTester.js: body - respond end');
        console.log(ok!== 2);
        if (ok !== 2) {
            console.error("TestBody: server didn't send two OK messages.");
        } else {
            console.error('testBody passed');
        }
        logger.endCallBack('staticTester.js: body - respond end');
    });
}

/**
 * This tester test handle of requests with body.
 * It open net connection to server, and simulate HTTP request with body, and
 * second adjoin HTTP request. The server should reply succesfully to both
 * requests.
 * @method testKeepAlive.
 * @param httpVer the HTTP version to simulate.
 * @param connection the connection header (should be close / keep-alive /
 * none).
 * @param wantedResult the wanted result connection header.
 */
function testKeepAlive(httpVer, connection, wantedResult) {
    var connectionHeader = false;
    var reader;
    var socket;

    socket = net.connect({
        host: 'localhost',
        port: 8083
    }, function () {
        logger.startCallBack('staticTester.js: keep - connect');
        socket.write('GET /smallFile.txt HTTP/'+httpVer + '\r\n' +
            (connection !== 'none' ? 'Connection: ' + connection + '\r\n' : '')
            + '\r\n', function () {});
        logger.endCallBack('staticTester.js: keep - connect');
    });
    reader = readline.createInterface(socket, process.stdout, false, false);
    reader.on('line', function (line) {
        logger.startCallBack('staticTester.js: keep - line in respond');
        if (line.substring(0, 10) === 'Connection') {
            connectionHeader = true;
            if (line.substring(12) !== wantedResult) {
                console.error('testKeep: Returned connection header was ' +
                    'wrong!');
            } else {
                console.error('testKeep: Returned connection header was ' +
                    'right!');
            }
        }
        logger.endCallBack('staticTester.js: keep - line in respond');
    });
    reader.on('end', function () {
        logger.startCallBack('staticTester.js: keep - respond end');
        if (!connectionHeader) {
            console.error('testKeep: No Connection header returned');
        }
        logger.endCallBack('staticTester.js: keep - respond end');
    });

}

/**
 * Test various option of persistent-connection settings.
 * @method test10.
 */
function test10(){
    openServer(8083, 5000);
    testKeepAlive('1.0', 'close', 'close');
    testKeepAlive('1.1', 'close', 'close');
    testKeepAlive('1.0', 'keep-alive', 'keep-alive');
    testKeepAlive('1.1', 'keep-alive', 'keep-alive');
    testKeepAlive('1.0', 'none', 'close');
    testKeepAlive('1.1', 'none', 'keep-alive');

}

/**
 * Run all testers.
 * @method test.
 */
function test() {
    testSite();
    multiServer();
    test10();
    setTimeout(testBody, 5000);
    setTimeout(require('./load').load, 10000);
}

console.log('tester: running tests...');
test();

logger.endCallBack('tester main');