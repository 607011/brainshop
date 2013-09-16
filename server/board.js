// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var fs = require('fs');
var sqlite3 = require('sqlite3');
var dbfile = 'brainshop-pro.sqlite';
var db = new sqlite3.Database(dbfile);

var boards = {};

var Board = function (name) {
  this.name = name;
  this.fileName = this.makeFileName();
  this.users = [];
  this.ideas = [];
  this.lastId = 0;
  if (typeof name === 'string')
    this.load(name);
}
Board.initDatabase = function () {
  db.serialize(function () {
    if (!fs.existsSync(dbfile)) {
      db.run('CREATE TABLE brainshoppro (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,' +
        'board TEXT,' +
        'entry TEXT,' +
        'seq INTEGER,' +
        'group INTEGER,' +
        'created DATETIME,' +
        'user TEXT' +
        ')'
        );
    }
  });
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
Board.all = function (board) {
  return (typeof board === 'string')? boards[board] : boards;
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
      if (typeof idea.group === 'undefined')
        idea.group = 0;
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

exports.Board = Board;
