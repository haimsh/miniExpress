/**
 * Created by ShachorFam on 04/12/13.
 */

/*
 TODO list:
 1. implement modified.
 */

var logger = require('./callbackLogger');
logger.startCallBack('miniExpress.js:fileProcess');
var http = require('./miniHTTP');
//http = require('http');
var fs = require('fs');
var url = require('url');
var path = require('path');
var queryString = require('querystring');

function parsePattern(pattern) {
    var inParam = /\/(:\w+)\//g;
    var endParam = /(:\w+)$/;
    var capture;
    var keys = [];
    var endSlash = '\\/';
    var regPattern = '^' + pattern.replace(/\//g, '\\/') + endSlash + '?$';
    while ((capture = inParam.exec(pattern)) != null) {
        keys.push({name: capture[1].substring(1), optional: false});
        regPattern = regPattern.replace(capture[1], '(?:([^\\/]+?))' );
    }
    capture = endParam.exec(pattern);
    if (capture != null) {
        keys.push({name: capture[1].substring(1), optional: false});
        regPattern = regPattern.replace(capture[1],'(?:([^\\/]+?))' );
    }
    return {keys: keys, regexp: new RegExp(regPattern, 'i')};
}

const supportedFiles = {
    '.js': 'application/javascript',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif'
};

function SourceUse(srcPattern, method, callback) {
    var self = this;
    var parsedPattern = parsePattern(srcPattern);
    self.path = srcPattern;
    self.method = method;
    self.callbacks = [callback];
    self.keys = parsedPattern.keys;
    self.regexp = parsedPattern.regexp;
}
SourceUse.prototype.match = function (currUrl) {
    var i;
    for (i = currUrl.length; i >= 0; i--) {
        if (this.regexp.test(currUrl.substring(0, i))) {
            return i;
        }
    }
    return -1;
};

SourceUse.prototype.prepareParams = function (url) {
    var match = this.regexp.exec(url);
    var params = [];
    if (!match || match.length-1 != this.keys.length) {
        throw Error;
    }
    for (var i = 1; i < match.length; i++) {
        params[this.keys[i - 1].name] = match[i].toLowerCase();
    }
    return params;
} ;

SourceUse.prototype.invoke = function (request, respond, next) {
    var slice = this.match(request.url);
    if (slice < 0) {
        // TODO: we got a problem ...
        respond.send(500);
    }
    request.usePattern = this.path;
    request.params = this.prepareParams(request.url.substring(0, slice));
    try {
        this.callbacks[0](request, respond, next);
    } catch (e) {
        console.error(e);
    }
};

function expressReq(request) {
    var parsedUrl = url.parse(request.url, true);
    var self = Object.create(request);
//    self.__proto__ = request;
    self.query = parsedUrl.query || {};
    self.body = {};
    self.cookies = {};
    var buffers = [];
    self.content = null;
    request.on('data', function (data) {
        buffers.push(data);
    });
    request.on('end', function () {
//        buffers.push(data);
        self.content = Buffer.concat(buffers).toString(); // assuming ascii.
    });
    self.path = parsedUrl.pathname;
    self.host = request.headers.host;
    self.protocol = 'http';
    self.params = {};
    self.get = function (header) {
        return request.headers[header.toLowerCase()];
    };
    self.param = function (paramName) {
        paramName = paramName.toLowerCase();
        if (self.params.hasOwnProperty(paramName)) {
            return self.params[paramName];
        }
        if (self.body.hasOwnProperty(paramName)) {
            return self.body[paramName];
        }
        return self.query[paramName];
    };
    self.is = function (pattern) {
        try {
            var contentType = self.get('Content-Type').split('/');
            var splitPat = pattern.split('/');
            return pattern === contentType[1] || (splitPat[0] === contentType[0] &&
                (splitPat[1] === '*' || splitPat[1] === contentType[1]));

        } catch (er) {
            console.log(er);
            return undefined;
        }
    };
    return self;
}

function Cookie(name, value, options) {
    var self = this;
    var privateData = {};
    privateData[name] = typeof value === 'string' ? value : JSON.stringify(value);
    privateData.noContent = [];
    if (typeof options !== 'undefined') {

        for (var key in options) {
            switch (key.toLowerCase()) {
                case 'path':
                    privateData.Path = options[key].toString();
                    break;
                case 'domain':
                    privateData.Domain = options[key].toString();
                    break;
                case 'expires':
                    privateData.Expires = options[key].toUTCString();
                    break;
                case 'maxage':
                    privateData.Expires = new Date(Date.now() + options[key]).toUTCString();
                    break;
                case 'secure':
                    if (options[key] === true) {
                        privateData.noContent.push('Secure');
                    }
                    break;
                case 'httponly':
                    if (options[key] === true) {
                        privateData.noContent.push('HttpOnly');
                    }
            }
        }
    }
    self.parseCookie = function () {
        var ret = '';
        for (var key in privateData) {
            if (key !== 'noContent') {
                ret += key + '=' + privateData[key] + '; ';
            } else {
                for (var flag in privateData[key]) {
                    ret += privateData[key][flag] + '; ';
                }
            }
        }
        return ret.substring(0, ret.length - 2); // delete last "; "
    };
}

function expressRes(httpResponse) {
    var self = Object.create(httpResponse);
    var headers = {};
    var statusCode;
    self.set = function (field, value) {
        if (typeof value !== "undefined") {
            headers[field] = value;
            return self;
        }
        for (var key in field) {
            if (field.hasOwnProperty(key)) {
                headers[key] = field[key].toString();
            }
        }
        return self;
    };

    self.status = function (code) {
        statusCode = code;
        return self;
    };

    self.get = function (field) {
        if (headers.hasOwnProperty(field)) {    // quick access.
            return headers[field];
        }
        for (var key in headers) {
            if (key.toLowerCase() === field.toLowerCase()) {
                return headers[key];
            }
        }
    };
    self.cookie = function (name, value, option) {
        self.set('Set-Cookie', new Cookie(name, value, option).parseCookie());
        return self;
    };
    self.send = function (status, body) {
        if (typeof status !== 'number') {
            body = status;
            status = body ? statusCode || 200 : 500;
        }
        switch (typeof body) {
            case 'undefined':
                body = http.STATUS_CODES[status];
            case 'string':
                self.set('Content-Type', self.get('Content-Type') || 'text/html');
                break;
            case 'object':
                if (Buffer.isBuffer(body)) {
                    self.set('Content-Type', self.get('Content-Type') || 'application/octet-stream');
                } else {
                    self.set('Content-Type', self.get('Content-Type') || 'application/json');
                    body = JSON.stringify(body);
                }
        }
        self.set('Content-Length', self.get('Content-Length') || body.length);
        self.writeHead(status, headers);
        self.end(body);
        return self;
    };
    self.json = function (status, body) {
        if (typeof status !== 'number') {
            body = status;
            status = body ? statusCode || 200 : 500;
        }
        self.set('Content-Type', self.get('Content-Type') || 'application/json');
        body = JSON.stringify(body);
        self.send(status, body);
    }
    return self;
}

function miniExpress() {
    var rootSources = {};

    /**
     * Find the first match use for given url.
     * @param startPoint the start point to search.
     * @param method the method to search.
     * @param url the url to match.
     */
    function findUse(startPoint, method, url) {
        method = method.toLowerCase();
        if (rootSources.hasOwnProperty(method)) {
            for (; startPoint < rootSources[method].length; startPoint++) {
                if (rootSources[method][startPoint].match(url) >= 0) {
                    return startPoint;
                }
            }
        }
        return -1;
    }

    function invokeNext(request, respond, startPoint, method, send404) {
        return function () {
            var nextUse = findUse(startPoint, method, request.url);
            if (nextUse >= 0) {
                rootSources[method.toLowerCase()][nextUse].invoke(request, respond,
                    invokeNext(request, respond, nextUse + 1, method, true));
            } else {
                if (send404) {
                    respond.send(404, "No use for this request");
                }
            }
        }
    }

    function self(request, respond) {
        logger.startCallBack('miniExpress.js:ProcessHttpRequest');
        var expRequest = expressReq(request);
        var expResponse = expressRes(respond);
        var wantedSource = request.url;
        var method = request.method;
//        var source;
        console.log('request arrived, looking for ' + wantedSource);
        var f = invokeNext(expRequest, expResponse, 0, method, true);
        f();
        logger.endCallBack('miniExpress.js:ProcessHttpRequest');
    }

    self.routes = {};

    const METHODS = ['get', 'put', 'delete', 'post'];
    for (var elem in  METHODS) {
        if (!METHODS.hasOwnProperty(elem)) {
            continue;
        }
        (function (elem) {
            self[METHODS[elem]] = function (rootSource, func, ruoted) {
                if (typeof func === 'undefined') {
                    func = rootSource;
                    rootSource = '/';
                }
                if (!rootSources.hasOwnProperty(METHODS[elem])) {
                    rootSources[METHODS[elem]] = [];
                }
                var sourceUse = new SourceUse(rootSource, METHODS[elem], func);
                rootSources[METHODS[elem]].push(sourceUse);
                if (typeof ruoted === 'undefined') {
                    if (!self.routes.hasOwnProperty(METHODS[elem])) {
                        self.routes[METHODS[elem]] = [];
                    }
                    self.routes[METHODS[elem]].push(sourceUse);

                }
                return self;
            };
        }(elem))
    }
    self['use'] = function (rootSource, func) {
        for (elem in METHODS) {
            if (METHODS.hasOwnProperty(elem)) {
                self[METHODS[elem]](rootSource, func, true);
            }
        }
        return self;
    };
    self.listen = function (port, callback) {
        var server = http.createServer(self);
        server.listen(port, callback);
        console.log("Server is listening on port " + port + "...");
        return server;
    };
    return self;
}

function sendErr(respond, status, explain, headers) {
    respond.set(headers).set('Content-Type', supportedFiles['.txt']
    ).send(status, explain);
}

miniExpress.static = function (rootFolder) {
    return function (request, respond, next) {
        var headers = {
            'Server': 'miniExpress/0.4'
        };
        var sourceFolder = request.usePattern;
        console.log('processing request');
        if (request.method !== 'GET') {
            next();
        }
        var wantedSource = url.parse(request.url).path;
        var fileName = path.normalize(wantedSource.replace(new RegExp('^' + sourceFolder), rootFolder + '/'));
        if (fileName.substring(0, rootFolder.length) !== path.normalize(rootFolder)) {
            sendErr(respond, 404, "You don't have permission for the file: " + wantedSource + "\r\n", headers);
            console.log('client requested for ' + fileName + ' when root is ' + rootFolder);
//            next();
            return;
        }

        var extName = path.extname(fileName);
        console.log('file type is ' + extName);
        if (extName in supportedFiles) {
            headers['Content-Type'] = supportedFiles[extName];
        }
        fs.stat(fileName, function (err, stats) {
            logger.startCallBack('miniExpress.js:FileStatOpen: ' + fileName);
            if (err || stats.isDirectory() || !stats.isFile()) {
//                sendErr(respond, 404, "File not found: " + wantedSource + ".\r\n", headers);
//                console.log("File not found: " + fileName);
                next();
                return;
            }
            headers['Content-Length'] = stats.size;
            headers['Last-Modified'] = stats.mtime.toUTCString();
            var fileReader = fs.createReadStream(fileName);
            fileReader.on('open', function () {
                logger.startCallBack('miniExpress.js:FileReaderOpen: ' + fileName);
                respond.writeHead(200, headers);
                fileReader.pipe(respond);
                logger.endCallBack('miniExpress.js:FileReaderOpen: ' + fileName);
            });
            fileReader.on('error', function () {
                logger.startCallBack('miniExpress.js:FileReaderError: ' + fileName);
                sendErr(respond, 404, "File not found: " + wantedSource + ".\r\n", headers);
                console.log("File not found: " + fileName);
                logger.endCallBack('miniExpress.js:FileReaderError: ' + fileName);
            });
            logger.endCallBack('miniExpress.js:FileStatOpen: ' + fileName);
        });
    };
};

miniExpress.cookieParser = function () {
    return function (req, res, next) {
        var cookies = {};
        var cookie = req.get('Cookie');
        if (typeof cookie === 'string') {
            var values = cookie.split('; ');
            for (var elem in values) {
                var keyVal = values[elem].split('=');
                if (keyVal.length === 2) {
                    cookies[keyVal[0]] = keyVal[1];
                }
            }
        }
        req.cookies = cookies;
        next();
    }
};

miniExpress.json = function () {
    return function (req, res, next) {
        if (req.get('Content-Type') !== 'application/json') {
            next();
        }
        function parse() {
            try {
                req.body = JSON.parse(req.content);
            } catch (e) {}
            next();
        }
        if (req.content !== null) {
            parse();
        } else {    // make sure we are after other listeners.
            req.on('end', function () {
                setTimeout(parse, 1);
            });
        }
    }
};

miniExpress.urlencoded = function () {
    const CONTENT_TYPE = 'application/x-www-form-urlencoded';
    return function (req, res, next) {
        var type = req.get('Content-Type');
        if (!type || type.lastIndexOf(CONTENT_TYPE) < 0) {
            next();
        }
        function parse() {
            req.body = queryString.parse(req.content);
            next();
        }
        if (req.content !== null) {
            parse();
        } else {    // make sure we are after other listeners.
            req.on('end', function () {
                setTimeout(parse, 1);
            });
        }
    }
};

miniExpress.bodyParser = function () {
    var jsonMiddleware = miniExpress.json();
    var urlMiddleware = miniExpress.urlencoded();
    return function (req, res, next) {
        function invokeUrlencoded() {
            urlMiddleware(req, res, next);
        }
        jsonMiddleware(req, res, invokeUrlencoded);
    }
};

module.exports = miniExpress;
logger.startCallBack('miniExpress.js:fileProcess');