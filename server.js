// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({ port: 8000 });
var users = [];
var ideas = [];

function sendAll(ws) {
  for (var i = 0; i < ideas.length; ++i) {
    ws.send(JSON.stringify(ideas[i]));
  }
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
  });
});