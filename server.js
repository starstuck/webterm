/*global require, exports */

var spawn = require('child_process').spawn,
    pty = require('pty.js'),
    ws = require('ws'),

    cmd = 'bash',
    cmd_args = [],
    termName = 'xterm-color',
    server = new ws.Server({port: 8080});

server.on('connection', function (sock) {

    var term = pty.spawn(cmd, cmd_args, {
        name: termName,
        cwd: process.env.HOME,
        env: process.env
    });

    console.log('Connection opened');
    
    term.on('data', function (chunk) {
        sock.send(chunk.toString());
    });

    // TODO: term.resize

    sock.on('message', function (msg) {
        term.write(msg);
    });

    sock.on('close', function () {
        console.log('Connection closed');
        term.end();
    });
});

