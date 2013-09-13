// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var fs = require('fs');
var WebSocketServer = require('ws').Server;
var http = require('http');
var https = require('https');
var url = require('url');
var boards = {};
var wss;

function pad0(x) {
  return ('00' + x.toFixed()).slice(-2);
}

Array.prototype.each = function (callback) {
  for (var i = 0; i < this.length; ++i)
    callback(i, this[i]);
}
Array.prototype.remove = function (val) {
  var idx = this.indexOf(val);
  if (idx >= 0)
    this.splice(idx, 1);
};
Array.prototype.add = function (val) {
  if (this.indexOf(val) < 0)
    this.push(val);
};

var Board = function (name) {
  this.name = name;
  this.fileName = this.makeFileName();
  this.users = [];
  this.ideas = [];
  this.lastId = 0;
  if (typeof name === 'string')
    this.load(name);
}
Board.loadAll = function () {
  fs.readdirSync('boards').each(function (i, boardFileName) {
    var m = boardFileName.match(/(.+)\.json$/);
    if (m && m.length > 1) {
      var board = new Board(m[1]);
      board.addToBoards();
    }
  });
}
Board.informAllUsers = function () {
  var boardNames = Object.keys(boards);
  boardNames.each(function (i, boardName) {
    boards[boardName].users.each(function (i, ws) {
      try {
        ws.send(JSON.stringify({ type: 'board-list', boards: boardNames }));
      }
      catch (e) { console.error(e); }
    });
  })
}
Board.prototype.makeFileName = function () {
  return 'boards/' + this.name + '.json';
}
Board.prototype.addIdea = function (idea) {
  this.ideas.push(idea);
}
Board.prototype.addUser = function (user) {
  this.users.push(user);
}
Board.prototype.addToBoards = function () {
  boards[this.name] = this;
}
Board.prototype.load = function () {
  this.ideas = (fs.existsSync(this.fileName)) ? JSON.parse(fs.readFileSync(this.fileName, { encoding: 'utf8' })) : [];
  this.getLastId();
  console.log('Board "%s" loaded, lastId = %d', this.name, this.lastId);
}
Board.prototype.getIdea = function (id) {
  for (var i = 0; i < this.ideas.length; ++i)
    if (id === this.ideas[i].id) {
      var idea = this.ideas[i];
      if (typeof idea.likes === 'undefined')
        idea.likes = [];
      if (typeof idea.dislikes === 'undefined')
        idea.dislikes = [];
      return idea;
    }
}
Board.prototype.setIdea = function (idea) {
  this.ideas[this.getIdeaIndex(idea.id)] = idea;
}
Board.prototype.getIdeaIndex = function (id) {
  for (var i = 0; i < this.ideas.length; ++i)
    if (id === this.ideas[i].id)
      return i;
}
Board.prototype.removeIdea = function (id) {
  for (var i = 0; i < this.ideas.length; ++i)
    if (id === this.ideas[i].id)
      this.ideas.splice(i, 1);
}
Board.prototype.incId = function () {
  return ++this.lastId;
}
Board.prototype.getLastId = function () {
  this.lastId = 0;
  for (var i = 0; i < this.ideas.length; ++i)
    if (this.ideas[i].id > this.lastId)
      this.lastId = this.ideas[i].id;
}
Board.prototype.save = function () {
  fs.writeFileSync(this.fileName, JSON.stringify(this.ideas), { flag: 'w+', encoding: 'utf8' });
}
Board.prototype.sendToAllUsers = function (message) {
  var msg = JSON.stringify(message), invalid = {}, i;
  for (i = 0; i < this.users.length; ++i) {
    try {
      this.users[i].send(msg);
    }
    catch (ex) {
      invalid[i] = true;
    }
  }
  // remove invalid connections
  var u = [];
  for (i = 0; i < this.users.length; ++i) {
    if (!(i in invalid))
      u.push(this.users[i]);
  }
  this.users = u;
}

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
          board = boards[data.board];
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
            idea.text = data.text;
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
              board = boards[data.board];
              if (typeof board === 'undefined') {
                board = new Board(data.board);
                boards[data.board] = board;
                Board.informAllUsers();
              }
              else {
                ws.send(JSON.stringify({ type: 'board-list', boards: Object.keys(boards) }));
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
              board = boards[data.board];
              board.sendToAllUsers({ type: 'command', command: 'delete', board: data.board, id: data.id });
              board.removeIdea(data.id);
              board.save();
              break;
            case 'like':
              board = boards[data.board];
              idea = board.getIdea(data.id);
              idea.likes.add(data.user);
              idea.dislikes.remove(data.user);
              board.sendToAllUsers(idea);
              board.save();
              break;
            case 'dislike':
              board = boards[data.board];
              idea = board.getIdea(data.id);
              idea.dislikes.add(data.user);
              idea.likes.remove(data.user);
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
