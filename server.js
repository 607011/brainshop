// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var DATAFILE = 'data.json';
var fs = require('fs');
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({ port: 8000 });
var users = [];
var fileContents = fs.existsSync(DATAFILE) ? fs.readFileSync(DATAFILE, { encoding: 'utf8' }) : '[]';
var ideas = JSON.parse(fileContents);

function pad0(x) {
  return ('00' + x.toFixed()).slice(-2);
}

wss.on('connection', function (ws) {
  users.push(ws);
  for (var i = 0; i < ideas.length; ++i)
    ws.send(JSON.stringify(ideas[i]));

  ws.on('message', function (message) {
    var data = JSON.parse(message || '{}');
    switch (data.type) {
      case 'idea':
        var now = new Date;
        data.date = now.getFullYear() + '-' + pad0(now.getMonth()) + '-' + pad0(now.getDay());
        ideas.push(data);
        for (var i = 0; i < users.length; ++i)
          users[i].send(JSON.stringify(data));
        fs.writeFileSync(DATAFILE, JSON.stringify(ideas), { flag: 'w+', encoding: 'utf8' });
        break;
      case 'like':
        break;
    }
  });
});