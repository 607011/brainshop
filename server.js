// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var DEFAULT_BOARD = 'Brainstorm';
var DATAFILE = DEFAULT_BOARD + '.json';
var lastId = {};
var fs = require('fs');
var WebSocketServer = require('ws').Server;
var http = require('http');
var https = require('https');
var net = require('net');
var url = require('url');
var crypto = require('crypto');
var privateKey;
var certificate;
var credentials;
var board = {};
var wss;
var users = [];
var ideas = [];
var app;

function pad0(x) {
  return ('00' + x.toFixed()).slice(-2);
}

function getIdea(boardName, id) {
  var ideas = board[boardName] || [];
  for (var i = 0; i < ideas.length; ++i)
    if (id === ideas[i].id)
      return ideas[i];
}

function getIdeaIndex(boardName, id) {
  var ideas = board[boardName] || [];
  for (var i = 0; i < ideas.length; ++i)
    if (id === ideas[i].id)
      return i;
}

function removeIdea(boardName, id) {
  var ideas = board[boardName] || [];
  for (var i = 0; i < ideas.length; ++i)
    if (id === ideas[i].id)
      ideas.splice(i, 1);
}

function getLastId(boardName) {
  lastId[boardName] = 0;
  var ideas = board[boardName] || [];
  for (var i = 0; i < ideas.length; ++i)
    if (ideas[i].id > lastId[boardName])
      lastId[boardName] = ideas[i].id;
}

function saveIdeas(boardName) {
  var fileName = boardName + '.json';
  fs.writeFileSync(fileName, JSON.stringify(ideas), { flag: 'w+', encoding: 'utf8' });
}

function loadIdeas(boardName) {
  var fileName = boardName + '.json';
  board[boardName] = (fs.existsSync(fileName)) ? JSON.parse(fs.readFileSync(fileName, { encoding: 'utf8' })) : [];
  getLastId(boardName);
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
  function httpServer(req, res) {
    var pathName = url.parse(req.url).pathname;
    if (pathName === '/')
      pathName = '/client.html';
    var file = '.' + pathName;
    fs.exists(file, function (exists) {
      if (exists) {
        res.writeHead(200);
        res.write(fs.readFileSync('.' + pathName));
        res.end();
      }
      else {
        res.writeHead(404);
        res.end();
      }
    });
  }

  privateKey = fs.readFileSync('privatekey.pem').toString();
  certificate = fs.readFileSync('certificate.pem').toString();
  https.createServer({ key: privateKey, cert: certificate }, httpServer).listen(8887);
  http.createServer(httpServer).listen(8888);

  wss = new WebSocketServer({ port: 8889 });
  wss.on('connection', function (ws) {
    users.push(ws);
    ws.on('message', function (message) {
      var data = JSON.parse(message || '{}');
      var idea;
      console.log("DATA:", data);
      switch (data.type) {
        case 'idea':
          var now = new Date;
          data.date = now.getFullYear() + '-' + pad0(now.getMonth() + 1) + '-' + pad0(now.getDate()) + ' ' + pad0(now.getHours()) + ':' + pad0(now.getMinutes());
          if (typeof data.id === 'undefined') {
            // new entry
            data.id = ++lastId[data.board];
            board[data.board].push(data);
          }
          else {
            // update entry
            ideas[getIdeaIndex(data.board, data.id)] = data;
          }
          sendToAllUsers(data);
          saveIdeas(data.board);
          break;
        case 'command':
          switch (data.command) {
            case 'init':
              if (typeof board[data.board] === 'undefined')
                loadIdeas(data.board);
              ideas = board[data.board];
              for (var i = 0; i < ideas.length; ++i)
                ws.send(JSON.stringify(ideas[i]));
              break;
            case 'delete':
              sendToAllUsers({ type: 'command', board: data.board, command: 'delete', id: data.id });
              removeIdea(data.board, data.id);
              saveIdeas(data.board);
              break;
            case 'like':
              idea = getIdea(data.board, data.id);
              idea.likes = idea.likes || 0;
              ++idea.likes;
              sendToAllUsers(idea);
              saveIdeas(data.board);
              break;
            case 'dislike':
              idea = getIdea(data.board, data.id);
              idea.dislikes = idea.dislikes || 0;
              ++idea.dislikes;
              sendToAllUsers(idea);
              saveIdeas(data.board);
              break;
          }
          break;
      }
    });
  });
}

main();
