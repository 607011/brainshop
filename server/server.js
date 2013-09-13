// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var fs = require('fs');
var WebSocketServer = require('ws').Server;
var http = require('http');
var https = require('https');
var url = require('url');
var board = { 'Brainstorm': { 'ideas': [], 'users': [] , 'lastId': 0 } }
var lastId = {};
var board = {};
var users = {};
var wss;

function pad0(x) {
  return ('00' + x.toFixed()).slice(-2);
}

function makeBoardFileName(boardName) {
  return 'boards/' + boardName + '.json';
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
  var fileName = makeBoardFileName(boardName);
  var ideas = board[boardName] || [];
  fs.writeFileSync(fileName, JSON.stringify(ideas), { flag: 'w+', encoding: 'utf8' });
}

function loadIdeas(boardName) {
  var fileName = makeBoardFileName(boardName);
  board[boardName] = (fs.existsSync(fileName)) ? JSON.parse(fs.readFileSync(fileName, { encoding: 'utf8' })) : [];
  getLastId(boardName);
}

function loadBoards() {
}

function sendToAllUsers(boardName, message) {
  var msg = JSON.stringify(message), invalid = {}, i;
  for (i = 0; i < users[boardName].length; ++i) {
    try {
      users[boardName][i].send(msg);
    }
    catch (ex) {
      invalid[i] = true;
    }
  }
  var u = [];
  for (i = 0; i < users[boardName].length; ++i) {
    if (!(i in invalid))
      u.push(users[boardName][i]);
  }
  users[boardName] = u;
}

function main() {
  function httpServer(req, res) {
    var pathName = url.parse(req.url).pathname;
    if (pathName === '/all') {
      // TODO: send JSON file with board contents
    }
    else {
      if (pathName === '/')
        pathName = '/index.html';
      var file = '../client' + pathName;
      fs.exists(file, function (exists) {
        if (exists) {
          res.writeHead(200);
          res.write(fs.readFileSync(file));
          res.end();
        }
        else {
          res.writeHead(404);
          res.end();
        }
      });
    }
  }

  var privateKey = fs.readFileSync('privatekey.pem').toString();
  var certificate = fs.readFileSync('certificate.pem').toString();
  https.createServer({ key: privateKey, cert: certificate }, httpServer).listen(8887);
  http.createServer(httpServer).listen(8888);

  loadBoards();

  wss = new WebSocketServer({ port: 8889 });
  wss.on('connection', function (ws) {
    ws.on('message', function (message) {
      var data = JSON.parse(message || '{}'), idea, ideas, now, i;
      switch (data.type) {
        case 'idea':
          now = new Date;
          data.date = now.getFullYear() + '-' + pad0(now.getMonth() + 1) + '-' + pad0(now.getDate()) + ' ' + pad0(now.getHours()) + ':' + pad0(now.getMinutes());
          if (typeof data.id === 'undefined') {
            // new entry
            data.id = ++lastId[data.board];
            board[data.board].push(data);
          }
          else {
            // update entry
            ideas = board[data.board];
            ideas[getIdeaIndex(data.board, data.id)] = data;
          }
          sendToAllUsers(data.board, data);
          saveIdeas(data.board);
          break;
        case 'command':
          switch (data.command) {
            case 'init':
              if (typeof board[data.board] === 'undefined')
                loadIdeas(data.board);
              ideas = board[data.board];
              if (typeof users[data.board] === 'undefined')
                users[data.board] = [];
              users[data.board].push(ws);
              for (i = 0; i < ideas.length; ++i)
                ws.send(JSON.stringify(ideas[i]));
              ws.send(JSON.stringify({ type: 'board-list', boards: Object.keys(board) }));
              break;
            case 'delete':
              sendToAllUsers(data.board, { type: 'command', board: data.board, command: 'delete', id: data.id });
              removeIdea(data.board, data.id);
              saveIdeas(data.board);
              break;
            case 'like':
              idea = getIdea(data.board, data.id);
              idea.likes = idea.likes || 0;
              ++idea.likes;
              sendToAllUsers(data.board, idea);
              saveIdeas(data.board);
              break;
            case 'dislike':
              idea = getIdea(data.board, data.id);
              idea.dislikes = idea.dislikes || 0;
              ++idea.dislikes;
              sendToAllUsers(data.board, idea);
              saveIdeas(data.board);
              break;
          }
          break;
      }
    });
  });
}

main();
