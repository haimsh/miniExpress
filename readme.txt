1. What was hard in this ex?
The hard thing to implement was supporting pipelined HTTP requests without
interleaving responses (i.e. 2 200 OK messages, and when each file is piped
comes its contents). To solve the problem I gave id to each respond, and
keep trace on current respond in output.
Another issue: the http headers are easier to parse line by line, while
the body (which we ignore on this ex.) should be processed differently.
The main problem was to support lines ended with CRLF and LF.
I changed the readline module to split only on LF, and handled the CR char
inside my module. I still had to figure (somehow) that readline differ on
runs from webstorm and in cmd prompt and I need to set tty manually to false.
The change in readline.js file is in line 298.

2. What was fun in this ex?
That it somehow works.

3. What did I do in order to make your server efficient
Not much, except the fact that I don't have blocking I/O operations.
In addition, in case of unnecessary large body in requests, the server will
start the respond immediately (since body is not necessary), and the large
body will only delay the next (if exist) request.
When sending large file, my module don't read the entire file to memory, but
open it as read-stream and pipe the content directly to socket.