// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var DATAFILE = 'data.json';
var lastId = 0;
var fs = require('fs');
var WebSocketServer = require('ws').Server;
var http = require('http');
var net = require('net');
var url = require('url');
var wss;
var users = [];
var ideas = [];
var app;

function pad0(x) {
  return ('00' + x.toFixed()).slice(-2);
}

function getIdea(id) {
  for (var i = 0; i < ideas.length; ++i)
    if (id === ideas[i].id)
      return ideas[i];
}

function removeIdea(id) {
  for (var i = 0; i < ideas.length; ++i)
    if (id === ideas[i].id)
      ideas.splice(i, 1);
}

function getLastId() {
  lastId = 0;
  for (var i = 0; i < ideas.length; ++i)
    if (ideas[i].id > lastId)
      lastId = ideas[i].id;
}

function saveIdeas() {
  fs.writeFileSync(DATAFILE, JSON.stringify(ideas), { flag: 'w+', encoding: 'utf8' });
}

function sendToAllUsers(message) {
  var msg = JSON.stringify(message), invalid = {}, i;
  for (i = 0; i < users.length; ++i) {
    try {
      users[i].send(msg);
    }
    catch (ex) {
      invalid[i] = true;
    }
  }
  var u = [];
  for (i = 0; i < users.length; ++i) {
    if (!(i in invalid))
      u.push(users[i]);
  }
  users = u;
}

function main() {
  if (fs.existsSync(DATAFILE))
    ideas = JSON.parse(fs.readFileSync(DATAFILE, { encoding: 'utf8' }));

  app = http.createServer(function (req, res) {
    var pathname = url.parse(req.url).pathname;
    if (pathname === '/')
      pathname = '/client.html';
    var file = '.' + pathname;
    fs.exists(file, function (exists) {
      if (exists) {
        res.writeHead(200);
        res.write(fs.readFileSync('.' + pathname));
        res.end();
      }
      else {
        res.writeHead(404);
        res.end();
      }
    });
  }).listen(8888);

  wss = new WebSocketServer({ port: 8889 });
  wss.on('connection', function (ws) {
    getLastId();
    users.push(ws);
    for (var i = 0; i < ideas.length; ++i)
      ws.send(JSON.stringify(ideas[i]));
    ws.on('message', function (message) {
      var data = JSON.parse(message || '{}');
      var idea;
      switch (data.type) {
        case 'idea':
          var now = new Date;
          data.date = now.getFullYear() + '-' + pad0(now.getMonth()) + '-' + pad0(now.getDay());
          data.id = ++lastId;
          ideas.push(data);
          sendToAllUsers(data);
          saveIdeas();
          break;
        case 'command':
          switch (data.command) {
            case 'delete':
              sendToAllUsers({ type: 'command', command: 'delete', id: data.id });
              removeIdea(data.id);
              saveIdeas();
              break;
            case 'like':
              idea = getIdea(data.id);
              idea.likes = idea.likes || 0;
              ++idea.likes;
              sendToAllUsers(idea);
              saveIdeas();
              break;
            case 'dislike':
              idea = getIdea(data.id);
              idea.dislikes = idea.dislikes || 0;
              ++idea.dislikes;
              sendToAllUsers(idea);
              saveIdeas();
              break;
          }
          break;
      }
    });
  });
}

main();
