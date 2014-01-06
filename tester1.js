var logger = require('./callbackLogger');
//logger.activate();
logger.startCallBack('l3');
var APP;//The server app
var BODIES_RECEIVED = [];//all bodies received in the current test.
var CUR_ROOT_RESOURCE = "";//The root resource for the cur test.
var CUR_FILES_TO_GET = [];//the files to get (in the request) in a test.
var CUR_COMPARE_FUNCTION = {}; //Current function for data compare.
var FS = require('fs');//The fs module.
var GET_FILES_NUM_OF_TIMES= 1;//Time toget a single file in a test.
var HTTP = require('http');//The http module.
var MINI_EXPRESS = require('./miniExpress');//The mini express module.
var NET = require('net');//The net module.
var PORT_NUM = 1200;//The port num the server listens to in the tests.
var	RESPS_RECEIVED = [];//all responses headers received in the current test
var REQ_INDEXES = [];//The index of the cur request in the test.
var ROOT_FOLDER = 'www';//The root folder (object) for the test.
//preparation functions of tests
var SERVER_PREP = [prepareServer_simplePrep,prepareServer_simplePrep,
        prepareServer_simplePrep, prepareServer_simplePrep,
        prepareServer_noUse,prepareServer_simplePrep, prepareServer_simplePrep,
        prepareServer_simplePrep, prepareServer_simplePrep,
        prepareServer_simplePrep, prepareServer_simplePrep,
        prepareServer_simplePrep, prepareServer_simplePrep];
// The order of tests to run
var TESTS_TO_RUN = [test_urlEncoding,test_parsing,test_validSingleRequest,
        test_validMultipleRequests, test_404_noUse_neg,
        test_404_fileNotExist_neg,
        test_404_outOfRoot, test_twoSecsNoReqTimeout,
        test_connectionCloseVer1p0(),
        test_connectionCloseVer1p1(), test_connectionNoConnectionTypeVer1p0()];
var TEST_NUM = 0;//The next test to run.
//function sleep(ms) {
//    var unixtime_ms = new Date().getTime();
//    while ( new Date().getTime() < unixtime_ms + ms) {}
//}

function prepareServer_simplePrep() {

    APP = MINI_EXPRESS();

    APP.use(CUR_ROOT_RESOURCE ,MINI_EXPRESS.static(ROOT_FOLDER));
    APP.listen(PORT_NUM);
}


function prepareServer_noUse() {

    APP = MINI_EXPRESS();
    APP.listen(PORT_NUM);
}

//closeAfter - close connection after compare or not.
function compareOneResp_pos(resp, respData, stat, dataRead) {

    var headers = resp.headers;//Headers of the response
    var time;//The last-modified date in a GMT format

    if (resp.statusCode !== 200) {
//        console.trace('The body data is wrong: status code 200');
        throw 'The body data is wrong: status code 200';
    }
    time = (new Date(stat['mtime'])).toUTCString();
    if (headers['last-modified'] !== ''+time) {
        throw 'the response header, last-modified,  is ' +
                headers['last-modified'] + ', instead of ' + time;
    }
    if (respData.length!==dataRead.length) {
        throw 'The body data is wrong length';
    }
    for (var i=0;i<respData.length;i++) {
        if (respData[i]!==dataRead[i]) {
            throw 'The body data is wrong';
        }
    }
}

function compareRespsList_pos() {

    var buffer; //a buffer to read the file to.
    var bytesRead;//bytes read from the file
    var j = 0;
    var i ;//= 0;
    var stat; //The file data

    for (i = 0; i < CUR_FILES_TO_GET.length * GET_FILES_NUM_OF_TIMES; i++) {
        j = i % CUR_FILES_TO_GET.length;
        var fd = FS.openSync(ROOT_FOLDER + '\\' + CUR_FILES_TO_GET[j], 'r');
        if (fs != undefined) {
            stat = FS.fstatSync(fd);
            if (stat != undefined) {
                buffer = new Buffer(stat.size);
                bytesRead = FS.readSync(fd, buffer, 0, stat.size, 0);
                if (bytesRead == stat.size) {
                    compareOneResp_pos(RESPS_RECEIVED[j], BODIES_RECEIVED[j],
                            stat, buffer);
                }
            }
        }
    }
}
function wrapedGetResponse(responsedFile,reqNum) {
    return function (resp) {
        logger.startCallBack('l103');
        getResponse(resp,responsedFile,reqNum);
    };
}
function getResponse(resp,responsedFile, reqNum) { 
    
    var fulldata;//joined reponse chunks
    var index; //index of request index in indexes aray
    var responseParts = [];//chunks of the response received
    var buffer; //The buffer to put the reponse body in

    resp.on("data", function (chunk) {
        logger.startCallBack('l115');
        //add this chunk to the output to send
        responseParts.push(chunk);
    });
    resp.on("end", function () {
        logger.startCallBack('l20');
        index = REQ_INDEXES.indexOf(reqNum);

        if (index != -1) {
            REQ_INDEXES.splice(index, 1);
        } else {
            console.log("Test fail: response " + reqNum +
                    " was received more than once");
            goToNextTest();
            return;
        }
        //now send your complete response
        fulldata = Buffer.concat(responseParts);
        FS.open(ROOT_FOLDER + '\\'+responsedFile, 'r', function (err,fd) {
            logger.startCallBack('l134');
            if (err) {
                return;
            }
            FS.fstat(fd, function (err,stat) {
                logger.startCallBack('l139');
                buffer = new Buffer(stat.size);
                if (stat.size === 0) {
                    compareOneResp_pos(resp, fulldata, stat, buffer);
                    return;
                }
                FS.read(fd, buffer, 0, stat.size, 0,
                        function(err, bytesRead, buffer) {
                            logger.startCallBack('l147');
                            if (err) {
                                return;
                            }
                            compareOneResp_pos(resp, fulldata, stat, buffer);


                });
            });
        });
        RESPS_RECEIVED.push(resp);	
        if (RESPS_RECEIVED.length === CUR_FILES_TO_GET.length *
                GET_FILES_NUM_OF_TIMES && REQ_INDEXES.length == 0) { 
            //empty arrays for next test
            RESPS_RECEIVED = [];
            REQ_INDEXES = [];
            //call next test 
            goToNextTest();
        }
    });
}

function getResponse_404(resp) { 

    var fulldata; //the response body
    var headers = resp.headers;//the response headers
    var gotData = false;//was data received from the socket
    var responseParts = [];//chunks of the response received

    resp.on("data", function (chunk) {
        logger.startCallBack('l175');
        gotData = true;
        //add this chunk to the output to send
        responseParts.push(chunk);

    });
    resp.on("end", function () {
        logger.startCallBack('l182');
        fulldata = Buffer.concat(responseParts);//we may loose data if we do string join

        if (fulldata === "") {
            console.log('Test failed: There should be an explanation about the error in the body');
        }

        if (headers['content-length'] != fulldata.length) {
            console.log('Test failed: the content length field is different than the ody field');
        }
    });

    //compare response header
    if ( resp.statusCode !== 404) {
        console.log('Test failed: The body data is wrong');
        goToNextTest();
        return;
    }
    setTimeout(function () {
        logger.startCallBack('l201');
        if (!gotData){//if body wasn't received
            console.log(' Test failed: There should be an explanation about the error in the body');
        }
        goToNextTest();
    },2000);
}

function goToNextTest() {
    console.log("finish test");
//    APP.close();
    TEST_NUM = TEST_NUM + 1;
    if (TESTS_TO_RUN.length > TEST_NUM) {
        (TESTS_TO_RUN[TEST_NUM])();
    }
}

function test_urlEncoding() {

    var reqOptions;//request options and headers
//    var req;//the request
    
    console.log("- Running test_urlEncoding");
    CUR_FILES_TO_GET = ['good morning.txt'];
    CUR_ROOT_RESOURCE = '/';
    GET_FILES_NUM_OF_TIMES = 1;
    REQ_INDEXES = [0];
    (SERVER_PREP[TEST_NUM])();
    reqOptions = {  hostname : 'localhost',
                    port     : PORT_NUM,
                    path     : '/'+encodeURIComponent(CUR_FILES_TO_GET[0]),
                    Connection: 'keep-alive',
                    Host: 'www.host1.com', //must write it in http 1.1
                    httpVersion : '1.1'};
    HTTP.get(reqOptions, wrapedGetResponse('/'+CUR_FILES_TO_GET[0],
            0)).on('error', function (e) {
            logger.startCallBack('l237');
        console.log("Got error: " + e.message);
    });

}


function test_parsing() {

    var connection; //The current socket for the test
    var expectedString; //the current string expected
    var expectedStringList = []; // a list of expected strings to get
                                    //from the serve
     var isConnectionOver; // did we get an end event or not
    
    console.log("- Running test_parsing");
    CUR_FILES_TO_GET = ['/profile.html'];
    CUR_ROOT_RESOURCE = '/';
    (SERVER_PREP[TEST_NUM])();
    connection = NET.createConnection(PORT_NUM);
    connection.setNoDelay();
    isConnectionOver = false;
    connection.on('data',function (data) {
        logger.startCallBack('l260');
        if (expectedStringList.length == 0) {
            console.log("Test Failed : server sent information when " +
                    "we weren't expecting any");
        }
        expectedString = expectedStringList.shift();
        console.log("got data from server, expecting : "+expectedString);
        if (data.toString().indexOf(expectedString)==-1) {
            console.log("Test Failed : server did not send error " +
                    expectedString + " and sent the following instead:");
            console.log(data.toString());
        }

        if (expectedStringList.length == 0) { 
            if (!isConnectionOver) {
                connection.destroy();
            }
            test_parsing_part2();
        }
    });
    connection.on('end',function () {
        logger.startCallBack('l281');
        isConnectionOver = true;
        if (expectedStringList.length > 0) {
            console.log("Test Failed : server closed connection " +
                    "on us before end of test");
        }

    });
    //check that we handle split messages
    expectedStringList.push("200");
    setTimeout(function (){logger.startCallBack('l291');connection.write('GET '+CUR_ROOT_RESOURCE +
            '\profile.html'+' HTTP/1.1 ');	},1000);
    setTimeout(function () {logger.startCallBack('l293');connection.write('\r\nparam1:ok'); }, 1100);
    setTimeout(function () {logger.startCallBack('l294');connection.write('\r\n\r\n'); }, 1200);

    //fail on wrong param
    expectedStringList.push('<html>');
    expectedStringList.push("500");
    setTimeout(function () {
        logger.startCallBack('l300');
        setTimeout(function () {logger.startCallBack('l301');connection.write('GET ' + CUR_ROOT_RESOURCE +
                '\profile.html'+' HTTP/1.1 '); }, 1000);
        setTimeout(function (){logger.startCallBack('l303');connection.write('\r\nparam1ok\r\n\r\n'); }, 1010);
    }, 300);

}
function test_parsing_part2() {

    var connection; //the current used socket
    var expectedString; //current expected string;
    var expectedStringList = [];//a list of string responses the
                                        //test expects to get

    console.log("- Running test_parsing_part2");
    //fail on wrong messages
    connection = NET.createConnection(PORT_NUM);
    connection.setNoDelay();
    connection.on('data',function (data) {
        logger.startCallBack('l319');
        if (expectedStringList.length == 0) {
            console.log("Test Failed : server sent information when" +
                    " we weren't expecting any");
        }
        expectedString = expectedStringList.shift();
        console.log("got data from server, expecting : "+expectedString);		
        if (data.toString().indexOf(expectedString) == -1) {
            console.log("Test Failed : server did not send error " +
                    expectedString+" and sent the following instead:");
            console.log(data.toString());
        }

        if (expectedStringList.length == 0) { 
            goToNextTest();
        }
    });
    connection.on('end',function () {
        logger.startCallBack('l337');
        if (expectedStringList.length > 0) {
            console.log("Test Failed : server closed connection on us " +
                    "before end of test");
        }

    });
    expectedStringList.push("500");
    setTimeout(function () {logger.startCallBack('l345');connection.write('bad main header'); }, 1000);
    setTimeout(function () {
        logger.startCallBack('l346');
        try {
        connection.write('\r\nparam1:ok');
        } catch (er) {}
    }, 1100);
    setTimeout(function () {
        logger.startCallBack('l347');
        try {
            connection.write('\r\n');
        } catch (er) {}

    }, 1200);
    setTimeout(function () {
        logger.startCallBack('l348');
        try {
            connection.end();
        } catch (er) {}

    }, 1300);
}

function test_validSingleRequest() {

    var reqOptions; //the request options and headers
//    var req; //the current request

    console.log("- Running test_validSingleRequest");

    CUR_COMPARE_FUNCTION = compareRespsList_pos;
    CUR_FILES_TO_GET = ['/profile.html'];
    CUR_ROOT_RESOURCE = '/';
    GET_FILES_NUM_OF_TIMES = 1;
    REQ_INDEXES = [0];

    (SERVER_PREP[TEST_NUM])();

    reqOptions = {  hostname : 'localhost',
                    port    : PORT_NUM,
                    path    : CUR_FILES_TO_GET[0],
                    Connection: 'keep-alive',
                    Host: 'www.host1.com', //must write it in http 1.1
                    httpVersion : '1.1'};

    HTTP.get(reqOptions,
            wrapedGetResponse(CUR_FILES_TO_GET[0], 0)).on('error',
                function (e) {
                    logger.startCallBack('l376');
        console.log("Got error: " + e.message);
    });
}

function test_validMultipleRequests() {
    return;
    var i;
    var j;
    var loops = 1; //number of times to ask for the  all files
    var req; // the current request
    var reqOptions; //the request options and headers

    console.log("- Running test_validMultipleRequests");
    CUR_FILES_TO_GET = ['/haim2.jpg', '/profile.html', '/calculator.js',
            '/icon.png','/empty.txt'];
    GET_FILES_NUM_OF_TIMES = loops;
    CUR_ROOT_RESOURCE = '/';

    for (i = 0; i < loops * CUR_FILES_TO_GET.length; i++) {
        REQ_INDEXES.push(i);
    }

    (SERVER_PREP[TEST_NUM])();

    reqOptions = {  hostname : 'localhost',
                    port    : PORT_NUM,
                    path    : CUR_FILES_TO_GET[0],
                    Connection: 'keep-alive',
                    Host: 'www.host1.com', //must write it in http 1.1
                    httpVersion : '1.1'};

    for ( i = 0; i < loops; i++) {	
        for (j = 0; j < CUR_FILES_TO_GET.length; j++) {
            reqOptions.path = CUR_FILES_TO_GET[j];
            req = HTTP.get(reqOptions, wrapedGetResponse(CUR_FILES_TO_GET[j],
                    i * (CUR_FILES_TO_GET.length)+j)).on('error',
                            function(e) {
                                logger.startCallBack('l414');
                console.log("Got error: " + e.message);
            });
        }
    }
}


function test_404_outOfRoot() {

//    var req; // the current request
    var reqOptions; //the options and headers for the request

    console.log("- Running test_outOfRoot");
    //CUR_COMPARE_FUNCTION = compare404_neg_outOfRoot;
    CUR_FILES_TO_GET = ['/../miniExpress.js'];
    CUR_ROOT_RESOURCE = '/';

    (SERVER_PREP[TEST_NUM])();
    
    reqOptions = {  hostname : 'localhost',
                    port    : PORT_NUM,
                    path    : CUR_FILES_TO_GET[0],
                    Connection: 'keep-alive',
                    Host: 'www.host1.com', //must write it in http 1.1
                    httpVersion : '1.1'};

    HTTP.get(reqOptions, getResponse_404).on('error', function (e) {
        logger.startCallBack('l442');
        console.log("Got error: " + e.message);
    });

}

function test_404_noUse_neg() {

//    var req; // the current request
    var reqOptions; //the options and headers for the request

    console.log("- Running test_404_noUse_neg");
    CUR_FILES_TO_GET = ['/profile.html'];
    CUR_ROOT_RESOURCE = '/';

    //use is not called
    (SERVER_PREP[TEST_NUM])();

    reqOptions = {  hostname : 'localhost',
                    port    : PORT_NUM,
                    path    : CUR_FILES_TO_GET[0],
                    Connection: 'keep-alive',
                    Host: 'www.host1.com',
                    httpVersion : '1.1'};

    HTTP.get(reqOptions, getResponse_404).on('error', function (e) {
        logger.startCallBack('l468');
            console.log("Got error: " + e.message);
    });
}

function test_404_fileNotExist_neg() {

//    var req; // the current request
    var reqOptions; //the options and headers for the request

    console.log("- Running test_404_fileNotExist_neg");

    CUR_FILES_TO_GET = ['/blah.html'];
    CUR_ROOT_RESOURCE = '/';
    
    (SERVER_PREP[TEST_NUM])();

    reqOptions = {  hostname : 'localhost',
                    port    : PORT_NUM,
                    path    : CUR_FILES_TO_GET[0],
                    Connection: 'keep-alive',
                    Host: 'www.host1.com',
                    httpVersion : '1.1'};

    HTTP.get(reqOptions, getResponse_404).on('error', function (e) {
        logger.startCallBack('l493');
            console.log("Got error: " + e.message);
    });
}

function getResponseAndWait(connection, fileToGet) {

    //wait 2 seconds and send reuest
    setTimeout(function () {
        logger.startCallBack('l502');
        try {
            sendSimpleRequest(connection, fileToGet, '1.1', null);
            console.log("Test failed: server didn't close " +
                    "connection after 2 seconds.");
        } catch(e) {
            //Test passed
        }
        goToNextTest();
    }, 2000);
}

function sendSimpleRequest(connection, fileToGet, httpVersion, connectionType) {

    if (connectionType != null) {
        connectionType = "\r\nConnection:"+connectionType;
    } else {
        connectionType = "";
    }

    connection.write('GET '+CUR_ROOT_RESOURCE+fileToGet+' HTTP/'+ httpVersion +
            '\r\nHost:localhost' +
            connectionType +
            '\r\n');
}

function test_twoSecsNoReqTimeout() {

    var connection;// the socket for this test
    var fileToGet = '/profile.html'; // the file to get in this test

    console.log("- Running test_twoSecsNoReqTimeout");

    CUR_ROOT_RESOURCE = '/';

    (SERVER_PREP[TEST_NUM])();

    connection = NET.createConnection(PORT_NUM);
    connection.setNoDelay();
    connection.on('data', function () {
        logger.startCallBack('l542');
        //co nothing. must be here.
    });
    connection.on('end', function () {
        logger.startCallBack('l546');
        getResponseAndWait(connection, fileToGet);
    });
    sendSimpleRequest(connection, fileToGet, '1.1', null);
}

function test_connectionCloseVer1p0() {
    return function () {
        logger.startCallBack('l554');
        console.log("- Running test_connectionCloseVer1p0");
        connectionNotKeepAliveTest('1.0', 'close');
    }
}

function test_connectionCloseVer1p1() {
    return function () {
        logger.startCallBack('l562');
        console.log("- Running test_connectionCloseVer1p1");
        connectionNotKeepAliveTest('1.1', 'close');
    }
}

function test_connectionNoConnectionTypeVer1p0() {
    return function () {
        logger.startCallBack('l570');
        console.log("- Running test_connectionNoConnectionType");
        connectionNotKeepAliveTest('1.0', null);
    }
}

function connectionNotKeepAliveTest(httpType, connectionType) {

    var connection;// the socket for this test
    var fileToGet = '/profile.html'; //the file to get in this test

    CUR_ROOT_RESOURCE = '/';

    (SERVER_PREP[TEST_NUM])();

    connection = NET.createConnection(PORT_NUM);
    connection.setNoDelay();
    connection.on('data',function (){
        logger.startCallBack('l588');
        //co nothing. must be here.
    });

    connection.on('end',function (){
        logger.startCallBack('l593');
        try {
            sendSimpleRequest(connection, fileToGet, httpType, null);
        } catch (e){
            //test passed
        }
        goToNextTest();
    });
    sendSimpleRequest(connection, fileToGet, httpType, connectionType);
}

HTTP.globalAgent.maxSockets = 200;
testToRunFirst = TESTS_TO_RUN[0];
testToRunFirst();