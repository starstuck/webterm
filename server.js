/*global require, exports, process */

var http = require('http'),
    spawn = require('child_process').spawn,
    pty = require('pty.js'),
    ws = require('ws'),
    express = require('express'),

    cmd = 'bash',
    cmd_args = [],
    termName = 'xterm-color',
    port = 8080,
    app = express(),
    webServer,
    sockServer;

app
    .use('/lib', express.static('lib'))
    .use('/node_modules/requirejs', express.static('node_modules/requirejs'))
    .get(/\/(index.html|term.css)/, function(req, res) {
        res.sendfile('./' + req.params[0]);
    })
    .get('/', function(req, res) {
        res.redirect('/index.html');
    });

webServer = http.createServer(app);
sockServer = new ws.Server({server: webServer});

sockServer.on('connection', function (sock) {

    var shell = pty.spawn(cmd, cmd_args, {
        name: termName,
        cwd: process.env.HOME,
        env: process.env
    });

    console.log('Connection opened');
    
    shell.on('data', function (chunk) {
        sock.send(chunk.toString());
    });

    // TODO: term.resize
    sock.on('message', function (msg) {
        shell.write(msg);
    });

    sock.on('close', function () {
        console.log('Connection closed');
        shell.end();
    });
});

if (require.main === module) {
    webServer.listen(port);
    console.log('Preview server running at http://localhost:' + port);
}
