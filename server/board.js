// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var fs = require('fs');
//var sqlite3 = require('sqlite3');
//var dbfile = 'brainshop-pro.sqlite';
//var db = new sqlite3.Database(dbfile);

var DefaultBoardName = 'Brainstorm';

var boards = {};


Array.prototype.insertBefore = function (idx, item) {
  this.splice(idx, 0, item);
}

var Idea = function (data) {
  this.type = 'idea';
  this.id = data.id;
  this.text = data.text;
  this.group = data.group;
  this.user = data.user;
  this.board = data.board;
  this.date = data.date;
}

var Group = function (ideas) {
  this.ideas = ideas || [];
}
Group.prototype.addIdea = function (idea) {
  if (typeof idea.next === 'number' && idea.next >= 0)
    this.ideas.insertBefore(this.indexOf(idea.next), idea);
  else
    this.ideas.push(idea);
}
Group.prototype.getIdea = function (id) {
  var i, idea, N = this.ideas.length;
  for (i = 0; i < N; ++i) {
    if (id === this.ideas[i].id) {
      idea = this.ideas[i];
      idea.likes = idea.likes || [];
      idea.dislikes = idea.dislikes || [];
      idea.group = idea.group || 0;
      return idea;
    }
  }
  return null;
}
Group.prototype.removeIdea = function (id) {
  var idx = this.indexOf(id);
  if (idx >= 0)
    this.ideas.splice(idx, 1);
}
Group.prototype.indexOf = function (id) {
  var N = this.ideas.length;
  for (var i = 0; i < N; ++i)
    if (this.ideas[i].id === id)
      return i;
  return -1;
}
Group.prototype.isEmpty = function () {
  return this.ideas.length === 0;
}
Group.prototype.moveIdea = function (idea) {
  var currentIdx = this.indexOf(idea.id), nextIdx;
  if (currentIdx < 0)
    return;
  if (typeof idea.next !== 'number')
    return;
  this.ideas.splice(currentIdx, 1);
  if (idea.next < 0) {
    this.ideas.push(idea);
  }
  else {
    nextIdx = this.indexOf(idea.next);
    if (nextIdx < 0)
      this.ideas.push(idea);
    else
      this.ideas.insertBefore(nextIdx, idea);
  }
}

var Board = function (name) {
  this.name = name;
  this.fileName = this.makeFileName();
  this.users = [];
  this.lastId = 0;
  this.groups = {};
  if (typeof name === 'string')
    this.load();
}
//Board.initDatabase = function () {
//  db.serialize(function () {
//    if (!fs.existsSync(dbfile)) {
//      db.run('CREATE TABLE brainshoppro (' +
//        'id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,' +
//        'board TEXT,' +
//        'entry TEXT,' +
//        'group INTEGER,' +
//        'created DATETIME,' +
//        'user TEXT' +
//        ')'
//        );
//    }
//  });
//}
Board.loadAll = function () {
  var board;
  fs.readdirSync('boards').each(function (i, boardFileName) {
    var m = boardFileName.match(/(.+)\.json$/), name, board;
    if (m && m.length > 1) {
      name = m[1];
      board = new Board(name);
      board.addToBoards();
    }
  });
  if (boards.length === 0) {
    board = new Board(DefaultBoardName);
    board.addToBoards();
  }
}
Board.all = function (board) {
  return (typeof board === 'string')? boards[board] : boards;
}
Board.set = function (boardName, board) {
  boards[boardName] = board;
}
Board.removeUser = function (user) {
  var boardNames = Object.keys(boards);
  boardNames.each(function (i, boardName) {
    boards[boardName].users.remove(user);
  });
};
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
Board.prototype.group = function (id) {
  return this.groups[id];
}
Board.prototype.incId = function () {
  return ++this.lastId;
}
Board.prototype.getLastId = function () {
  var lastId = 0;
  this.groups.each(function (i, group) {
    group.ideas.each(function (j, idea) {
      if (idea.id > lastId)
        lastId = idea.id;
    });
  });
  this.lastId = lastId;
}
Board.prototype.load = function () {
  var groups = {};
  var exists = fs.existsSync(this.fileName);
  var all = exists ? JSON.parse(fs.readFileSync(this.fileName, { encoding: 'utf8' })) : {};
  all.each(function (i, ideas) {
    if (ideas.length > 0)
      groups[i] = new Group(ideas);
  });
  this.groups = groups;
  if (Object.keys(this.groups).length === 0)
    this.groups['0'] = new Group;
  this.getLastId();
  console.log('Board "%s" loaded (lastId = %d)', this.name, this.lastId, this.groups);
}
Board.prototype.save = function () {
  var data = {}, i;
  this.groups.each(function (i, group) {
    if (!group.isEmpty())
      data[i] = group.ideas;
  });
  fs.writeFileSync(this.fileName, JSON.stringify(data), { flag: 'w+', encoding: 'utf8' });
}
Board.prototype.isEmpty = function () {
  return Object.keys(this.groups).length === 0;
}
Board.prototype.addUser = function (user) {
  this.users.push(user);
}
Board.prototype.addToBoards = function () {
  boards[this.name] = this;
}
Board.prototype.getIdea = function (id) {
  var i, idea, group, keys = Object.keys(this.groups), N = keys.length;
  for (i = 0; i < N; ++i) {
    idea = this.groups[keys[i]].getIdea(id);
    if (idea !== null)
      return idea;
  }
  return null;
}
Board.prototype.setIdea = function (idea) {
  this.groups[idea.group].setIdea(idea);
}
Board.prototype.addIdea = function (idea) {
  this.groups[idea.group].addIdea(idea);
}
Board.prototype.moveIdea = function (idea) {
  var group, groupIdx, i, newGroup, keys = Object.keys(this.groups), N = keys.length;
  for (i = 0; i < N; ++i) {
    groupIdx = keys[i];
    group = this.groups[groupIdx];
    if (typeof group === 'undefined')
      continue;
    if (group.indexOf(idea.id) < 0)
      continue; // because group doesn't contain this idea
    if (idea.group === i) {
      // idea hasn't moved to another group
      group.moveIdea(idea);
    }
    else {
      // idea has moved to another group
      group.removeIdea(idea.id);
      if (group.isEmpty())
        delete this.groups[groupIdx];
      this.groups[idea.group] = this.groups[idea.group] || new Group;
      this.groups[idea.group].addIdea(idea);
    }
  }
}
Board.prototype.removeIdea = function (id) {
  var i, group, groupIdx, keys = Object.keys(this.groups), N = keys.length;
  for (i = 0; i < N; ++i) {
    groupIdx = keys[i];
    group = this.groups[groupIdx];
    if (typeof group === 'object') {
      group.removeIdea(id);
      if (group.isEmpty())
        delete this.groups[groupIdx];
    }
  }
}
Board.prototype.sendToAllUsers = function (message) {
  console.log('sendToAllUsers() -> ', message);
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
