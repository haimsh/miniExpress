/**
 * Created by ShachorFam on 15/12/13.
 */
var net = require('net');
var miniExpress = require('./miniExpress');

function openServer(port, duration) {
    var app = miniExpress();
    app.use('/', miniExpress.static(__dirname + '\\www'));
    var srv = app.listen(port);
    setTimeout(function () {
        srv.close();
    }, duration);
}

function loadTest() {
    var i;
    var fails = 0;
    var lastCheck = false;
    function connect() {
        var content = '';
        var sock = net.connect({
            host: 'localhost',
            port: 8079
        }, function () {
            sock.write('GET  /smallFile.txt HTTP/1.1\r\n\r\n');
        });
        sock.on('data', function (data) {
            content += data;
        });
        sock.on('error', function() {
            ++fails;
            if (lastCheck) {
                console.error("server didn't respond 8 secs after attack");
            }
        });
        sock.on('end', function () {
            var lines = content.split('\r\n');
            if (!(lines.length >= 8 && lines[0] === 'HTTP/1.1 200 OK' &&
                lines[1] === 'Server: miniExpress/0.3' &&
                lines[2] === 'Content-Type: text/plain' &&
                lines[3] === 'Content-Length: 21' &&
                lines[lines.length - 3] === 'Connection: keep-alive' &&
                lines[lines.length - 2] === '' &&
                lines[lines.length - 1] === 'very short text file.')) {
                console.error( ++fails + ' ' + content);
            }
        });
    }
    openServer(8079, 10000);
    const ATTACK_NUMBER = 2048;
    for (i = 0 ; i < ATTACK_NUMBER; i++) {
        connect();
    }
    setTimeout(function () {
        lastCheck = true;
        connect()
    }, 8000);
    setTimeout(function () {
        console.error('On attack of ' + ATTACK_NUMBER + ' adjoint ' +
            'connections,  the server failed on ' + fails);
    }, 10000);
}

exports.load = loadTest;