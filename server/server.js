// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var fs = require('fs');
var wss;
var WebSocketServer = require('ws').Server;
var mime = require('mime');
var url = require('url');
var http = require('http');
var Board = require('./board').Board;

function pad0(x) {
  return ('00' + x.toFixed()).slice(-2);
}

Array.prototype.each = function (callback) {
  var i, N = this.length;
  for (i = 0; i < N; ++i)
    callback(i, this[i]);
}
Object.prototype.each = function (callback) {
  var i, p, props = Object.getOwnPropertyNames(this);
  for (i = 0; i < props.length; ++i) {
    p = props[i];
    callback(p, this[p]);
  }
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
  http.createServer(function httpServer(req, res) {
    var pathName = url.parse(req.url).pathname;
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
  }).listen(8888);

  // Board.initDatabase();
  Board.loadAll();

  wss = new WebSocketServer({ port: 8889 });
  wss.on('connection', function (ws) {
    function sendToClient(msg) {
      console.log('sendToClient() -> ', msg);
      ws.send(JSON.stringify(msg));
    }
    ws.on('close', function (message) {
      Board.removeUser(ws);
    });
    ws.on('message', function (message) {
      var data = JSON.parse(message || '{}'), idea, ideas, now, i, board, lastGroupId;
      console.log('message received -> ', data);
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
            data.last = true;
            board.sendToAllUsers(data);
            idea = data;
          }
          else {
            // update entry
            idea = board.getIdea(data.id);
            idea.group = data.group;
            idea.text = data.text;
            idea.next = data.next;
            board.moveIdea(idea);
            idea.last = true;
            board.sendToAllUsers(idea);
          }
          delete idea.next;
          delete idea.last;
          board.save();
          break;
        case 'command':
          switch (data.command) {
            case 'init':
              if (typeof data.board === 'undefined' || data.board === '')
                return;
              board = Board.all(data.board);
              if (typeof board === 'undefined') {
                board = new Board(data.board);
                Board.set(data.board, board);
                board.save();
                Board.informAllUsers();
              }
              else {
                sendToClient({ type: 'board-list', boards: Object.keys(Board.all()) });
              }
              board.addUser(ws);
              lastGroupId = Object.keys(board.groups).slice(-1);
              console.log('lastGroupId = ', lastGroupId);
              board.groups.each(function (groupId, group) {
                if (typeof group === 'object') {
                  console.log('Processing group# %d ...', groupId);
                  if (group.ideas.length > 0) {
                    group.ideas.each(function (j, idea) {
                      idea.last = (j === group.ideas.length - 1) && (groupId == lastGroupId);
                      idea.group = groupId;
                      sendToClient(idea);
                      delete idea.last;
                    });
                  }
                  else {
                    sendToClient({ type: 'idea', last: true, group: groupId });
                  }
                }
              });
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
