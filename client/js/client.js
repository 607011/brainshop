// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

"use strict";

Number.prototype.clamp = function (a, b) {
  return (this < a)? a : ((this > b)? b : this);
}

String.prototype.trimmed = function () {
  return this.replace(/^\s+/, '').replace(/\s+$/, '');
}

jQuery.fn.moveBetweenGroups = function (el) {
  var handle = this, target = $(el), dx, dy, below, placeholder = null;
  this.bind({
    mousedown: function (e) {
      var pos = target.offset();
      dx = e.pageX - pos.left;
      dy = e.pageY - pos.top;
      target.css('cursor', 'move').css('z-index', 9999);
      $(document).bind({
        selectstart: function () { return false; },
        mousemove: function (e) {
          var closest;
          var maxX = $(window).width() - target.width();
          var maxY = $(window).height() - target.height();
          var x = (e.pageX - dx).clamp(0, maxX - 8);
          var y = (e.pageY - dy).clamp(0, maxY - 8);
          var display = target.css('display');
          target.css('display', 'none');
          below = $(document.elementFromPoint(e.pageX, e.pageY));
          var group = below.filter('.group');
          if (group.length === 0)
            group = below.parents('.group');
          if (group.length === 0) {
            if (placeholder === null)
              placeholder = $('<span class="placeholder"></span>').css('width', target.width() - 2);
            $.event.trigger({ type: 'newgroup', message: { target: placeholder } });
          }
          else {
            closest = below.closest('.message');
            if (placeholder === null)
              placeholder = $('<span class="placeholder"></span>').css('width', target.width() - 2);
            closest.before(placeholder);
          }
          target.css('display', display).css('position', 'absolute').css('left', x + 'px').css('top', y + 'px');
        }
      });
    },
    mouseup: function (e) {
      target.css('display', 'none');
      var groupId = placeholder.parents('.group').attr('data-id');
      target.attr('group-id', groupId);
      placeholder.replaceWith(target);
      $.event.trigger({ type: 'movebetweengroups' });
      placeholder = null;
      $(document).unbind('mousemove').unbind('selectstart');
      target.removeAttr('style');
    }
  });
  return this;
}


var Brainstorm = (function () {
  var HOST = document.location.hostname;
  var PORT = 8889;
  var URL = 'ws://' + HOST + ':' + PORT + '/';
  var socket;
  var connectionEstablished = false;
  var RETRY_SECS = 5+1;
  var retry_secs;
  var reconnectTimer = null;
  var user;
  var boardName;
  var currentGroup = 0;
  var lastGroup = 0;

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
    // TODO: change group if necessary
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
      var data = JSON.parse(e.data), i, msgbox, ok, board, name, header, group;
      switch (data.type) {
        case 'idea':
          if ($('#idea-' + data.id).length > 0) {
            updateIdea(data);
          }
          else {
            data.likes = data.likes || [];
            data.dislikes = data.dislikes || [];
            data.group = data.group || 0;
            header = $('<span class="header"></span>').append($('<span class="menu"></span>')
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
            ));
            msgbox = $('<span class="message" id="idea-' + data.id + '">'
              + '<span class="body"><span class="idea" id="idea-text-' + data.id + '">' + data.text + '</span></span>'
              + '<span class="footer">'
              + '<span class="date">' + data.date + '</span>'
              + '<span class="user" id="user-' + data.id + '">' + data.user + '</span>'
              + '</span>'
              + '</span>');
            group = $('#group-' + data.group);
            if (group.length === 0)
              group = newGroup(data.group);
            msgbox.prepend(header).attr('data-group', data.group).attr('data-id', data.id);
            group.append(msgbox);
            $('<span class="handle"></span>').moveBetweenGroups('#idea-' + data.id).appendTo(header);
            $('#idea-text-' + data.id).attr('contentEditable', 'true').bind({
              keypress: function (e) {
                if (e.keyCode === 13 && !e.shiftKey) {
                  sendIdea(data.id);
                  e.preventDefault();
                }
              }
            });
            $('#new-idea').appendTo($('#group-' + data.group)); // moves #new-idea to group
            currentGroup = data.group;
          }
          break;
        case 'board-list':
          $('#available-boards').empty();
          Object.keys(data.boards).forEach(function (i, name) {
            name = data.boards[i];
            header = $('<span class="header"></span>');
            //header.append($('<span class="icon trash" title="in den Müll"></span>')
            //    .click(function (e) {
            //      // TODO
            //      e.preventDefault();
            //    }
            //  ));
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
          });
          board = $('<span class="board">'
            + '<span class="header">neues Board</span>'
            + '<span class="body"><input type="text" id="new-board" placeholder="..." size="7" /></span>'
            + '</span>');
          $('#available-boards').append(board);
          $('#new-board').bind('keyup', function (e) {
            if (e.target.value.length > 20) {
              e.preventDefault();
              return;
            }
            if (e.keyCode === 13 && e.target.value != '')
                setBoard(e.target.value);
          })
          break;
        case 'finished':
          group = $('#group-' + currentGroup);
          if (group.length === 0) {
            group = newGroup(currentGroup);
            $('#board').append(group);
          }
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
    $('#group-' + currentGroup).append(idea);
    $('#input').bind('keyup', function (e) {
      if (e.keyCode === 13)
        sendIdea();
      if (e.target.value.length > 100)
        e.preventDefault();
    }).trigger('focus');
  }

  function cleanGroups() {
    $('.group').each(function (i, g) {
      var group = $(g);
      if (group.children().length === 0)
        group.remove();
    });
  }

  function newGroup(gID) {
    var group = $('<span id="group-' + gID + '" class="group" data-id="' + gID + '"></span>');
    $('#board').append(group);
    return group;
  }

  function newGroupEvent(e) {
    var target = e.message.target;
    var group = newGroup(++lastGroup);
    currentGroup = lastGroup;
    if (group.children().length === 0)
      group.append(target);
    cleanGroups();
  }

  return {
    init: function () {
      user = localStorage.getItem('user') || '';
      boardName = localStorage.getItem('lastBoardName') || 'Brainstorm';
      if (user === '') {
        $('#uid').attr('class', 'pulse');
        alert('Du bist zum ersten Mal hier. Trage bitte dein Kürzel in das blinkende Feld ein.');
      }
      openSocket();
      $(window).bind({
        newgroup: newGroupEvent,
        movebetweengroups: function () {
          cleanGroups();
          $('#input').trigger('focus');
        }
      });
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
