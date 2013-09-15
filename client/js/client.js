// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

jQuery.fn.draggit = function (el) {
  var thisdiv = this;
  var target = $(el);
  var relX, relY;
  var targetW = target.width();
  var targetH = target.height();
  thisdiv.bind('mousedown', function (e) {
    var pos = $(el).offset();
    relX = e.pageX - pos.left;
    relY = e.pageY - pos.top;
    $(document).bind('mousemove', function (e) {
      target.css('position', 'absolute').css('z-index', '9999').css('cursor', 'move');
      var maxX = $(window).width() - targetW - 10;
      var maxY = $(window).height() - targetH - 10;
      var left = e.pageX - relX;
      var top = e.pageY - relY;
      // restrict to document bounds ...
      if (left < 0) left = 0;
      else if (left > maxX) left = maxX;
      if (top < 0) top = 0;
      else if (top > maxY) top = maxY;
      $(el).css('top', top + 'px');
      $(el).css('left', left + 'px');
      console.log(document.elementFromPoint(x, y));
    });
  });
  $(window).bind('mouseup', function (e) {
    $(document).unbind('mousemove');
  });
  return this;
}


var Brainstorm = (function () {
  'use strict';

  var HOST = document.location.hostname;
  var PORT = 8889;
  var URL = 'ws://' + HOST + ':' + PORT + '/';
  var socket;
  var connectionEstablished = false;
  var RETRY_SECS = 11;
  var retry_secs;
  var reconnectTimer = null;
  var user;
  var boardName;

  String.prototype.trimmed = function () {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function send(message) {
    if (typeof message.user === 'undefined')
      message.user = user;
    socket.send(JSON.stringify(message));
  }

  function sendIdea(id) {
    if (user === '')
      return;
    if (typeof id === 'undefined') {
      send({ board: boardName, type: 'idea', text: $('#input').val().trimmed(), user: user });
      $('#input').val('');
    }
    else {
      send({ board: boardName, type: 'idea', id: id, text: $('#idea-text-' + id).html().trimmed(), user: $('#user-' + id).text() });
    }
    $('#new-idea').remove();
  }

  function updateIdea(data) {
    $('#likes-' + data.id).text(data.likes.length);
    $('#dislikes-' + data.id).text(data.dislikes.length);
    $('#idea-text-' + data.id).html(data.text);
    $('#idea-' + data.id).addClass('blink-once');
    setTimeout(function () {
      $('#idea-' + data.id).removeClass('blink-once');
    }, 300);
  }

  function clear() {
    $('#available-boards').empty();
    $('#board').empty();
  }

  function boardChanged() {
    clear();
    send({ type: 'command', command: 'init', board: boardName });
  }

  function setBoard(name) {
    boardName = name;
    localStorage.setItem('lastBoardName', boardName);
    boardChanged();
  }

  function openSocket() {
    $('#status').removeAttr('class').html('connecting&nbsp;&hellip;');
    socket = new WebSocket(URL);
    socket.onopen = function () {
      $('.message').css('opacity', 1);
      $('#input').removeAttr('disabled').trigger('focus');
      $('#uid').removeAttr('disabled');
      $('#status').attr('class', 'ok').text('connected');
      if (reconnectTimer !== null) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
      connectionEstablished = true;
      boardChanged();
    };
    socket.onerror = function (error) {
      $('.message').css('opacity', 0.3);
      $('#input').attr('disabled', 'disabled');
      $('#uid').attr('disabled', 'disabled');
      $('#status').removeAttr('class').text('connection failed').addClass('error');
      retry_secs = RETRY_SECS;
      if (reconnectTimer !== null)
        clearInterval(reconnectTimer);
      reconnectTimer = setInterval(function retryCountdown() {
        if (--retry_secs > 0) {
          $('#status').removeAttr('class').addClass('reconnect').empty()
            .append($('<span>trying to reconnect&nbsp;&hellip; ' + retry_secs + '</span>'))
            .append($('<span> (<a href="#">reconnect now</a>)</span>').click(
            function (e) {
              e.preventDefault();
              clearInterval(reconnectTimer);
              openSocket();
            }));
        }
        else {
          clearInterval(reconnectTimer);
          retry_secs = RETRY_SECS;
          openSocket();
        }
      }, 1000);
    };

    socket.onmessage = function (e) {
      var data = JSON.parse(e.data), i, ok, board, name, header;
      switch (data.type) {
        case 'idea':
          if ($('#idea-' + data.id).length > 0) {
            updateIdea(data);
          }
          else {
            data.likes = data.likes || [];
            data.dislikes = data.dislikes || [];
            var header = $('<span class="header"></span>')
              .append($('<span>' + data.likes.length + '</span>').attr('id', 'likes-' + data.id))
              .append($('<span class="icon thumb-up" title="Gefällt mir"></span>')
                .click(function (e) {
                  send({ type: 'command', command: 'like', board: boardName, id: data.id });
                })
              )
              .append($('<span>' + data.dislikes.length + '</span>').attr('id', 'dislikes-' + data.id))
              .append($('<span class="icon thumb-down" title="Nicht so doll"></span>')
                .click(function (e) {
                  send({ type: 'command', command: 'dislike', board: boardName, id: data.id });
                })
              )
              .append($('<span class="icon trash" title="in den Müll"></span>')
                .click(function (e) {
                  ok = confirm('Eintrag "' + data.text + '" (#' + data.id + ') wirklich löschen?');
                  if (ok)
                    send({ type: 'command', board: boardName, command: 'delete', id: data.id });
                }
              )
            );
            var idea = $('<span class="message" id="idea-' + data.id + '">'
              + '<span class="body"><span class="idea" id="idea-text-' + data.id + '">' + data.text + '</span></span>'
              + '<span class="footer">'
              + '<span class="date">' + data.date + '</span>'
              + '<span class="user" id="user-' + data.id + '">' + data.user + '</span>'
              + '</span>'
              + '</span>');
            idea.prepend(header);
            $('#board').append(idea);
            header.draggit('#idea-' + data.id);
            $('#idea-text-' + data.id).attr('contentEditable', 'true').bind({
              keypress: function (e) {
                if (e.keyCode === 64) {
                  if (!e.shiftKey) {
                    sendIdea(data.id);
                    e.preventDefault();
                  }
                }
              }
            });
            $('#new-idea').appendTo('#board');
          }
          break;
        case 'board-list':
          $('#available-boards').empty();
          for (i in data.boards) {
            name = data.boards[i];
            header = $('<span class="header"></span>')
              .append($('<span class="icon trash" title="in den Müll"></span>')
                .click(function (e) {
                  alert('nicht implementiert');
                  e.preventDefault();
                }
              ));
            board = $('<span class="board" title="' + name + '">'
              + '<span class="body">' + name + '</span>'
              + '</span>')
              .click(function (e) {
                setBoard($(this).text());
              });
            if (name === boardName)
              board.addClass('active');
            board.prepend(header);
            $('#available-boards').append(board);
          }
          board = $('<span class="board">'
            + '<span class="header">neues Board</span>'
            + '<span class="body"><input type="text" id="new-board" placeholder="..." size="7" /></span>'
            + '</span>');
          $('#available-boards').append(board);
          // $('.board.active').prependTo($('#available-boards'));
          $('#new-board').bind('keyup', function (e) {
            if (e.keyCode === 13) {
              if (e.target.value != '') {
                setBoard(e.target.value);
              }
            }
            if (e.target.value.length > 20)
              e.preventDefault();
          })
          break;
        case 'finished':
          newIdeaBox();
          break;
        case 'command':
          switch (data.command) {
            case 'delete':
              $('#board').find('#idea-' + data.id).addClass('deleting');
              setTimeout(function () {
                $('#board').find('#idea-' + data.id).remove();
              }, 300);
              break;
            default:
              break;
          }
          break;
        default:
          break;
      }
    }
  }

  function newIdeaBox() {
    var idea = $('<span class="message" id="new-idea">'
      + '<span class="header"></span>'
      + '<span class="body">'
      + '<input type="text" id="input" placeholder="meine tolle Idee" />'
      + '</span>'
      + '</span>');
    $('#board').append(idea);
    $('#input').bind('keyup', function (e) {
      if (e.keyCode === 13)
        sendIdea();
      if (e.target.value.length > 100)
        e.preventDefault();
    }).trigger('focus');
  }

  return {
    init: function () {
      user = localStorage.getItem('user') || '';
      boardName = localStorage.getItem('lastBoardName') || 'Brainstorm';
      if (user === '') {
        $('#uid').attr('class', 'pulse');
        alert('Du bist das erste Mal hier. Zum Mitmachen trage bitte dein Kürzel in das blinkende Feld ein.');
      }
      openSocket();
      $('#uid').val(user).bind({
        keypress: function (e) {
          if (e.target.value.length > 4)
            e.preventDefault();
        },
        keyup: function (e) {
          if (e.target.value !== '') {
            user = e.target.value.trimmed();
            localStorage.setItem('user', user);
            $('#uid').removeClass('pulse');
          }
        }
      });
    }
  };

})();


$(document).ready(function () {
  Brainstorm.init();
});
