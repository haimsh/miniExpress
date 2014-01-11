1. What was hard in this ex?
Somehow, although the design separate the HTTP module from the Express module,
I couldn't make my miniExpress to work with Node HTTP module (uncommenting line
13 in miniExpress.js). I'm not sure where is the problem, since I kept the node
original API. The hard part is to debug the node code, which I eventually stopped,
and left this part uncomplete.
2. What was fun in this ex?
That it somehow works.

3. If I were a hacker...
The first thought was to make the server stack on sync IO commands, something
like that:
 function scanEntireFileSystem(req, res) {
  var fs = require('fs');
  function scanFolder(fold) {
   var files = fs.readdirSync(fold);
   for (var file in files) {
    var stat = fs.readStatSync(fold + '\\' + file);
    if (stat.isDirectory()) {
     scanFolder(fold + '\\' + file);
    }
   }
  }
  scanFolder('C:\\');
 }
This code will scan the entire C disk in sync, so the server will stack.
Another way is directly make unended code, something like:
 function doNotReturn(req, res) {
  while(true){}
 }
In order to execute, we need to put in server code the command
app.use('/hello/hacker/', funcName); // funcName is scanEntireFileSystem or doNotReturn
and when the server is up and listening, we should open any internet browser, and
type in the address line the address "http://<the server domain/ip address>[:<port if != 80>]/hello/hacker/"
This will cause the browser to send http request, which will cause the execution of funcName.