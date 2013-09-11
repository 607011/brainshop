// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var DATAFILE = 'data.json';
var fs = require('fs');
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({ port: 8000 });
var users = [];
var fileContents = fs.existsSync(DATAFILE) ? fs.readFileSync(DATAFILE, { encoding: 'utf8' }) : '[]';
var ideas = JSON.parse(fileContents);

function sendAll(ws) {
  for (var i = 0; i < ideas.length; ++i)
    ws.send(JSON.stringify(ideas[i]));
}

wss.on('connection', function (ws) {
  users.push(ws);
  sendAll(ws);
  ws.on('message', function (message) {
    var data = JSON.parse(message || '{}');
    data.date = new Date;
    ideas.push(data);
    for (var i = 0; i < users.length; ++i)
      users[i].send(JSON.stringify(data));
    fs.writeFileSync(DATAFILE, JSON.stringify(ideas), { flag: 'w+', encoding: 'utf8' });
  });
});