// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var APP_NAME = 'BrainShop Pro';

var fs = require('fs');
var ws = require('nodejs-websocket');
var mime = require('mime');
var url = require('url');
var https = require('https');
var auth = require('http-auth');
var pad0 = require('./utility').pad0;
var Board = require('./board').Board;

function main() {
  var privateKey = fs.readFileSync(__dirname + '/privatekey.pem').toString(),
    certificate = fs.readFileSync(__dirname + '/certificate.pem').toString(),
    basicAuth = auth.basic({
      realm: APP_NAME,
      file: __dirname + '/../data/users.htpasswd'
    }),
    httpsOptions = {
      key: privateKey,
      cert: certificate
    },
    wssOptions = {
      key: privateKey,
      cert: certificate,
      secure: true
    };

  function httpServer(req, res) {
    var pathName = url.parse(req.url).pathname, file;
    if (pathName === '/')
      pathName = '/index.html';
    file = __dirname + '/../client' + pathName;
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

  function wsServer(ws) {
    function sendToClient(msg) {
      ws.sendText(JSON.stringify(msg));
    }
    ws.on('close', function (message) {
      Board.removeUser(ws);
    });
    ws.on('text', function (message) {
      var data = JSON.parse(message || '{}'), idea, ideas, now, board;
      switch (data.type) {
        case 'idea':
          now = new Date;
          data.date = now.getFullYear() + '-' + pad0(now.getMonth() + 1) + '-' + pad0(now.getDate()) + ' ' + pad0(now.getHours()) + ':' + pad0(now.getMinutes());
          board = Board.all()[data.board];
          if (typeof data.id === 'undefined') { // new entry
            data.id = board.incId();
            data.likes = [];
            data.dislikes = [];
            board.addIdea(data);
            board.sendToAllUsers(data);
            idea = data;
          }
          else { // update entry
            idea = board.getIdea(data.id);
            idea.group = data.group;
            idea.text = data.text;
            idea.next = data.next;
            board.moveIdea(idea);
            board.sendToAllUsers(idea);
          }
          delete idea.next;
          board.save();
          break;
        case 'command':
          switch (data.command) {
            case 'init':
              ideas = [];
              if (typeof data.board === 'string' && data.board.length > 0) {
                board = Board.all(data.board);
                if (typeof board === 'undefined') {
                  console.log('Board "%s" does not exist.', data.board);
                  board = new Board(data.board);
                  Board.set(data.board, board);
                  board.save();
                  Board.broadcastAllBoards();
                }
                board.addUser(ws);
                board.groups.each(function (groupId, group) {
                  if (typeof group === 'object') {
                    if (group.ideas.length > 0) {
                      group.ideas.each(function (j, idea) {
                        idea.group = groupId;
                        ideas.push(idea);
                      });
                    }
                  }
                });
              }
              sendToClient({ type: 'init',
                data: [
                  { type: 'board-list', boards: Object.keys(Board.all()) },
                  { type: 'ideas', ideas: ideas }
                ]
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
              idea.last = true;
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
              idea.last = true;
              board.sendToAllUsers(idea);
              board.save();
              break;
            case 'delete-board':
              Board.delete(data.name);
              Board.broadcastAllBoards();
              break;
          }
          break;
      }
    });
  }


  Board.loadAll();

  https.createServer(basicAuth, httpsOptions, httpServer).listen(8888);
  ws.createServer(wssOptions, wsServer).listen(8889);
}

main();
