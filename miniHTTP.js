/**
 * Created by ShachorFam on 12/12/13.
 */

/*
 TODO list (for more similarity to node.http module):
  1. Other methods of headers (multi-lines).
  2. Implement continue.
*/
var logger = require('./callbackLogger');
logger.startCallBack('http.js:fileProcess');

var lineReader = require('readline');
var net = require('net');
var stream = require('stream');

var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();
var util = require('util');

const httpStatus = {
    '200': ' OK',
    '400': ' Bad Request',
    '404': ' Not Found',
    '405': ' Method Not Allowed',
    '500': ' Internal Server Error'
};

function HttpServer(tcpServer) {
    var tcpSrv = tcpServer;
    var self = new EventEmitter();
    self.listen = function (port, callback) {
        try {
            tcpSrv.listen(port, callback);
        } catch (e) {
            self.close();
        }
        return self;
    };
    self.close = function () {
        tcpSrv.close();
    };
    tcpServer.on('close', function () {
        self.emit('close');
    });
    return self;
}

function HTTPIncomingRequest(httpTitle) {
    const METHODS = ['GET', 'PUT', 'HEAD', 'DELETE', 'POST', 'DELETE', 'TRACE',
        'OPTIONS', 'CONNECT', 'PATCH'];
    stream.Transform.call(this);
    var self = this;
    var tokens = httpTitle.split(/\s+/);
    console.log(httpTitle);
    if (tokens.length <2){
        throw new Error();
    }
    self.method = tokens[0];
    if (METHODS.indexOf(self.method) < 0) {
        throw new Error();
    }
    self.url = tokens[1];
    self.httpVersion = (tokens.length === 2 ||
        tokens[2].substring(0, 5) !== 'HTTP/') ?
            '1.0' : tokens[2].substring(5);
//    self.body = '';
    self.keep = function () {
        return ('connection' in self.headers) ?
            (self.headers['connection'] === 'keep-alive') :
            (self.httpVersion !== '1.0');
    };
    self.headers = {};
    self._transform  = function (chunk, encoding, callback) {
        self.push(chunk, encoding);
        callback();
    };

    self._flush = function (callback) {
        self.emit('end');
        self.close();
        callback();
    };
}
util.inherits(HTTPIncomingRequest, stream.Transform);

function headers2str(headers) {
    var str = '';
    var elem;
    for (elem in headers) {
        if (!headers.hasOwnProperty(elem)) {
            continue;
        }
        str += elem + ': ' + headers[elem] + '\r\n';
    }
    return str;
}

function createHttpRespond(sock, keep, connection) {
    var messageId = connection.getNewRespondCounter();
    var socket = sock;
    var self = new stream.Writable();
    var myHeaders = {
        'Date': new Date().toUTCString(),
        'Connection': (keep ? 'keep-alive' : 'close')
    };
    function actualWrite(chunk, encoding, callback) {
        try {
            socket.write(chunk, encoding, callback);
        } catch (er) {
            socket.end();
        }
    }

    function myWrite(chunk, encoding, callback) {
        if (connection.getCurrWriteRespond() === messageId) {
            actualWrite(chunk, encoding, callback);
        } else {
            emitter.on('newRes', function (resId) {
                if (resId !== messageId) {
                    return ;
                }
                actualWrite(chunk, encoding, callback);
            });
        }
    }

    self._write = function (chunk, encoding, callback) {
        myWrite(chunk, encoding, callback);
    };
    self.on('error', function (er) {
        console.log(er.toString());
        self.end();
    });
    self.writeHead = function (status, headers) {
                myWrite('HTTP/1.1 ' + status + httpStatus[status] +
                    '\r\n' + headers2str(headers) + headers2str(myHeaders) +
                    '\r\n');
    };
    self.end = function (data) {
        if (!data) {
            data = new Buffer(0);
        }
        try {
            myWrite(data, function () {
                logger.startCallBack('http.js:respondEnd');
                connection.endMessage(keep);
                logger.endCallBack('http.js:respondEnd');
            });
        } catch (er) {
            socket.end();
        }

    };
    return self;
}

function Increment() {
    var i = 0;
    this.inc = function () {
        i++;
    };
    this.get = function () {
        return i;
    };
}

function HttpParser() {
    stream.Transform.call(this);
    var self = this;
    var bytesToRead = 0;
    var currRequest = null;
    var lineEnding = /\r?\n|\r(?!\n)/;
//    var
    self.readBody = function (request, size) {
        bytesToRead = size;
        currRequest = request;
    };
    function processData(chunk, encoding, callback) {
        if (currRequest !== null && bytesToRead > 0) {
            if (bytesToRead > chunk.length) {
                currRequest.write(chunk);
                bytesToRead -= chunk.length;
                return;
            } else {
                currRequest.write(chunk.slice(0, bytesToRead));
                chunk = chunk.slice(bytesToRead);
                bytesToRead = 0;
                currRequest.emit('end');
                currRequest = null;
            }
        }
        if (lineEnding.test(chunk)) {
            var match = lineEnding.exec(chunk);
            self.push(chunk.slice(0, match.index + match[0].length), encoding);
            if (match.index === 0) {
                setTimeout(function () {
                    processData(chunk.slice(match.index + match[0].length), encoding, callback);
                }, 10);
            } else {
                processData(chunk.slice(match.index + match[0].length), encoding, callback);
            }
        } else {
            self.push(chunk, encoding);
            callback();
        }
    }
    self._transform = function (chunk, encoding, callback) {
        logger.startCallBack("miniHTTP: tansform");
        processData(chunk, encoding, callback);
        logger.endCallBack("miniHTTP: tansform");
    };
    self._flush = function (callback) {
        self.emit('end');
        callback();
    };
}
util.inherits(HttpParser, stream.Transform);

function createConnection(socket, callBack) {
    var timeOutListeners = 0;
    var requestOpen = false;
    var readingBody = false;
    var bodyLeftToRead = 0;
    var currentRequest;
    var connection = {};
    var respondInQueue = new Increment();
    var respondWritten = new Increment();
    var connectionClose = false;
    var bodyParser = new HttpParser();

    socket.pipe(bodyParser);
    socket.on('end', function () {
        emitter.removeAllListeners('newRes');
    });
    function httpError(request, errMsg) {
        var keep = false && (request !== null) && request.keep();
        var res = createHttpRespond(socket, keep, connection);
        res.writeHead(500, {
            'Content-Type': 'text/plain',
            'Content-Length': errMsg.length
        });
        res.end(errMsg);
    }

    function addHeader(request, headerLine) {
        var splitPoint = headerLine.indexOf(':');
        var tokens = [headerLine.substring(0, splitPoint), headerLine.substring(splitPoint + 1)];
        if (tokens.length < 2) {
            console.log('bad header, close the connection');
            httpError(request, 'Invalid header line');
            return false;
        } else {
            request.headers[tokens[0].trim().toLowerCase()] = tokens[1].trim();
            return true;
        }
    }

    connection.processLine = function (line, cr) {
        var endLine = cr ? '\r\n' : '\n';
        var respond;
        var remainLine;
//        console.log(line + bodyLeftToRead);
        if (connectionClose) {
            return;
        }
        // we might be in 3 states: a. waiting for new request.
        // b. reading headers. c. reading body.
        // states move: a->b after one line. b->c after blank line. c->a after
        // ignore body is 0.
        if (!requestOpen) { // state a.
            requestOpen = true;
            try {
                currentRequest = new HTTPIncomingRequest(line);
            } catch (er) {
                httpError(currentRequest,
                    'Cannot parse request title\r\n');
                connectionClose = true;
            }
            return;
        }
//        if (!readingBody) {
            if (line === '') {
                readingBody = true;
                if (currentRequest.headers.hasOwnProperty('content-length')) {
                    bodyLeftToRead = Number(currentRequest.headers['content-length']);
                } else {
                    bodyLeftToRead = 0;
                }
                bodyParser.readBody(currentRequest, bodyLeftToRead);
                requestOpen = false;
                respond = createHttpRespond(socket, currentRequest.keep(),
                    connection);
                callBack(currentRequest, respond);
            } else {
                if (!addHeader(currentRequest, line)) {
                    connectionClose = true;
                }
            }
    };

    connection.getNewRespondCounter = function () {
        var id = respondInQueue.get();
        respondInQueue.inc();
        return id;
    };
    connection.getCurrWriteRespond = function () {
        return respondWritten.get();
    };
    connection.endMessage = function (keep) {
        respondWritten.inc();
        emitter.emit('newRes', respondWritten.get());
        if (!keep) {
            socket.end();
        } else {
            timeOutListeners++;
            console.log('Adding connection timeout listener for message ' +
                'end. currently ' + timeOutListeners);
            setTimeout(function () {
                logger.startCallBack('http.js:timeOutExpired. Other ' +
                    'connections: ' + (timeOutListeners - 1));
                if (--timeOutListeners === 0) {
                    socket.end();
                }
                logger.endCallBack('http.js:timeOutExpired. Other ' +
                    'connections: ' + timeOutListeners);
            }, 5000);
        }
    };

    var lr = lineReader.createInterface(bodyParser, process.stderr, false, false);
    lr.on('line', function(line) {
        var cr = false;
        logger.startCallBack('http.js:lineOnSock');
        if (line.charAt(line.length - 1) === '\r') {
            line = line.substring(0, line.length - 1);
            cr = true;
        }
        console.log(line);
        connection.processLine(line, cr);
        logger.endCallBack('http.js:lineOnSock');
    });

    return connection;
}

function createServer(callBack) {
    var server = net.createServer(function (socket) {
        socket.on('error', function () {
            socket.end();
        });
        logger.startCallBack('http.js:newTcpConnection');
        console.log('Connection arrived from ' + socket.remoteAddress);
        var httpConnection = createConnection(socket, callBack);
        logger.endCallBack('http.js:newTcpConnection');
    });
    return HttpServer(server);
}

exports.createServer = createServer;
exports.STATUS_CODES = httpStatus;
logger.endCallBack('http.js:fileProcess');