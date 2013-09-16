// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var fs = require('fs');
var wss;
var WebSocketServer = require('ws').Server;
var mime = require('mime');
var url = require('url');
var http = require('http');
// var https = require('https');
var Board = require('./board').Board;

function pad0(x) {
  return ('00' + x.toFixed()).slice(-2);
}

Array.prototype.each = function (callback) {
  for (var i = 0; i < this.length; ++i)
    callback(i, this[i]);
}
Array.prototype.contains = function (val) {
  return this.indexOf(val) >= 0;
}
Array.prototype.remove = function (val) {
  var idx = this.indexOf(val);
  if (idx >= 0)
    this.splice(idx, 1);
};
Array.prototype.add = function (val) {
  if (!this.contains(val))
    this.push(val);
};

function main() {
  function httpServer(req, res) {
    var pathName = url.parse(req.url).pathname;
    if (pathName === '/all') {
      res.writeHead(200, { 'Content-type': 'text/json' });
      // TODO: send JSON file with board contents
      res.write();
      res.end();
    }
    else {
      if (pathName === '/')
        pathName = '/index.html';
      var file = '../client' + pathName;
      fs.exists(file, function (exists) {
        if (exists) {
          res.writeHead(200, { 'Content-type': mime.lookup(file) });
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

  http.createServer(httpServer).listen(8888);
  //var privateKey = fs.readFileSync('privatekey.pem').toString();
  //var certificate = fs.readFileSync('certificate.pem').toString();
  //https.createServer({ key: privateKey, cert: certificate }, httpServer).listen(8887);

  Board.initDatabase();
  Board.loadAll();

  wss = new WebSocketServer({ port: 8889 });
  wss.on('connection', function (ws) {
    ws.on('message', function (message) {
      var data = JSON.parse(message || '{}'), idea, ideas, now, i, board;
      console.log('message received: ', message);
      switch (data.type) {
        case 'idea':
          now = new Date;
          data.date = now.getFullYear() + '-' + pad0(now.getMonth() + 1) + '-' + pad0(now.getDate()) + ' ' + pad0(now.getHours()) + ':' + pad0(now.getMinutes());
          board = Board.all()[data.board];
          if (typeof data.id === 'undefined') {
            // new entry
            data.id = board.incId();
            data.likes = [];
            data.dislikes = [];
            board.addIdea(data);
            board.sendToAllUsers(data);
            console.log('new entry: ', data);
          }
          else {
            // update entry
            idea = board.getIdea(data.id);
            idea.group = data.group;
            idea.text = data.text;
            idea.seq = data.seq;
            board.setIdea(idea);
            board.sendToAllUsers(idea);
            console.log('update entry: ', idea);
          }
          board.save();
          ws.send(JSON.stringify({ type: 'finished' }));
          break;
        case 'command':
          switch (data.command) {
            case 'init':
              if (typeof data.board === 'undefined' || data.board === '')
                return;
              board = Board.all(data.board);
              if (typeof board === 'undefined') {
                board = new Board(data.board);
                Board.all()[data.board] = board;
                Board.informAllUsers();
              }
              else {
                ws.send(JSON.stringify({ type: 'board-list', boards: Object.keys(Board.all()) }));
              }
              board.addUser(ws);
              for (i = 0; i < board.ideas.length; ++i) {
                idea = board.ideas[i];
                console.log('command.init -> sending ', idea);
                ws.send(JSON.stringify(idea));
              }
              ws.send(JSON.stringify({ type: 'finished'}));
              break;
            case 'delete':
              board = Board.all(data.board);
              board.sendToAllUsers({ type: 'command', command: 'delete', board: data.board, id: data.id });
              board.removeIdea(data.id);
              board.save();
              break;
            case 'like':
              board = Board.all(data.board);
              idea = board.getIdea(data.id);
              if (idea.dislikes.contains(data.user))
                idea.dislikes.remove(data.user);
              else
                idea.likes.add(data.user);
              board.sendToAllUsers(idea);
              board.save();
              break;
            case 'dislike':
              board = Board.all(data.board);
              idea = board.getIdea(data.id);
              if (idea.likes.contains(data.user))
                idea.likes.remove(data.user);
              else
                idea.dislikes.add(data.user);
              board.sendToAllUsers(idea);
              board.save();
              break;
          }
          break;
      }
    });
  });
}

main();
