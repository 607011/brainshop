// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

Number.prototype.clamp = function (a, b) {
  return (this < a) ? a : ((this > b) ? b : this);
};

String.prototype.trimmed = function () {
  return this.replace(/^\s+/, '').replace(/\s+$/, '');
};

var Brainstorm = (function () {
  'use strict';

  var HOST = document.location.hostname,
    PORT = 8889, URL = 'ws://' + HOST + ':' + PORT + '/',
    socket,
    RETRY_SECS = 5 + 1, retry_secs,
    reconnectTimer = null,
    user, boardName, prevBoardName, boards = [],
    currentGroup = 0, lastGroupAdded = 0, connectionEstablished = false;

  jQuery.fn.moveBetweenGroups = function (el) {
    var handle = this, target = $(el), placeholder = null;
    this.bind({
      mousedown: function (e) {
        if (!connectionEstablished)
          return;
        var pos = target.offset(), dx = e.pageX - pos.left, dy = e.pageY - pos.top,
          targetW = target.width(), targetH = target.height();
        target.css('cursor', 'move').css('z-index', 9999);
        $(document).bind({
          selectstart: function () { return false; },
          mousemove: function (e) {
            var closest, maxX, maxY, x, y, display, below, group;
            maxX = $(window).width() - targetW;
            maxY = $(window).height() - targetH;
            x = (e.pageX - dx).clamp(0, maxX - 8);
            y = (e.pageY - dy).clamp(0, maxY - 8);
            display = target.css('display');
            target.css('display', 'none'); // Trick 17
            below = $(document.elementFromPoint(e.pageX, e.pageY));
            group = below.filter('.group');
            if (group.length === 0)
              group = below.parents('.group');
            if (placeholder === null)
              placeholder = $('<span class="placeholder"></span>').css('width', (targetW - 2) + 'px').css('height', (targetH - 2) + 'px');
            if (group.length === 0) {
              $.event.trigger({ type: 'newgroup', message: { target: placeholder } });
            }
            else {
              closest = below.closest('.message');
              if (e.pageX < (below.offset().left + below.width() / 2))
                closest.before(placeholder);
              else
                closest.after(placeholder);
            }
            target.css('display', display).css('position', 'absolute').css('left', x + 'px').css('top', y + 'px');
          }
        });
      },
      mouseup: function (e) {
        var groupId;
        if (!connectionEstablished)
          return;
        $(document).unbind('mousemove').unbind('selectstart');
        target.removeAttr('style');
        if (placeholder !== null) {
          groupId = placeholder.parents('.group').attr('data-id');
          target.attr('data-group', groupId);
          placeholder.replaceWith(target);
          $.event.trigger({ type: 'ideamoved', message: { target: target } });
          placeholder = null;
        }
      }
    });
    return this;
  }

  function send(message) {
    if (typeof message.user === 'undefined')
      message.user = user;
    console.log('send() ->', message);
    showLoaderIcon();
    socket.send(JSON.stringify(message));
  }

  var mix = function (a, b) {
    if (typeof a === 'object' && typeof b === 'object')
      Object.keys(b).forEach(function (i) { a[i] = b[i]; });
    return a;
  }

  function sendIdea(id, optional) {
    var msg;
    if (user === '')
      return;
    if (typeof id === 'undefined') {
      msg = mix({ board: boardName, type: 'idea', group: $('#new-idea').attr('data-group'), text: $('#input').val().trimmed(), user: user }, optional);
      send(msg);
      $('#input').val('');
    }
    else {
      msg = mix({ board: boardName, type: 'idea', id: id, group: $('#idea-' + id).attr('data-group'), text: $('#idea-text-' + id).html().trimmed(), user: $('#user-' + id).text() }, optional);
      send(msg);
    }
    $('#new-idea').remove();
  }

  function updateIdea(data) {
    var box = $('#idea-' + data.id), group = $('#group-' + data.group);
    box.find('#likes-' + data.id).text((data.likes || []).length);
    box.find('#dislikes-' + data.id).text((data.dislikes || []).length);
    box.find('#idea-text-' + data.id).html(data.text);
    if (group.length === 0) {
      group = newGroup(data.group);
      group.append(box);
    }
    else {
      if (typeof data.next === 'number') {
        if (data.next < 0) {
          if (group.children().last().attr('id') === 'new-idea')
            box.insertBefore($('#new-idea'));
          else
            group.append(box);
        }
        else {
          box.insertBefore($('#idea-' + data.next));
        }
      }
      cleanGroups();
    }
    box.addClass('blink-once');
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

  function storeGroup(group) {
    var g = localStorage.getItem('lastGroup'), lastGroup = {};
    if (g !== null && g !== '')
      lastGroup = JSON.parse(g);
    lastGroup[boardName] = group;
    localStorage.setItem('lastGroup', JSON.stringify(lastGroup));
    currentGroup = group;
  }

  function getGroup() {
    var g = localStorage.getItem('lastGroup');
    if (g !== null && g !== '') {
      try { return JSON.parse(g)[boardName]; }
      catch (e) { console.error(e); }
    }
    return currentGroup;
  }

  function setBoard(name) {
    showLoaderIcon();
    prevBoardName = boardName;
    boardName = name;
    localStorage.setItem('lastBoardName', boardName);
    boardChanged();
  }

  function switchToMostRecentBoard() {
    setBoard(prevBoardName);
  }

  function focusOnInput() {
    $('#input').trigger('focus');
  }

  function openSocket() {
    showLoaderIcon();
    $('#status').removeAttr('class').html('connecting&nbsp;&hellip;');
    try {
      socket = new WebSocket(URL);
    }
    catch (e) {
      $('body').empty().append('<p class="fatal">' + e + '</p>');
      return;
    }
    socket.onopen = function () {
      connectionEstablished = true;
      $('#main').removeClass('disconnected');
      $('#board').removeClass('disconnected');
      $('#input').removeAttr('disabled');
      $('#uid').removeAttr('disabled');
      $('#new-board').removeAttr('disabled');
      $('#status').attr('class', 'ok').text('connected');
      if (reconnectTimer !== null) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
      boardChanged();
    };
    socket.onerror = function (error) {
      connectionEstablished = false;
      $('#main').addClass('disconnected');
      $('#board').addClass('disconnected');
      $('#input').attr('disabled', 'disabled');
      $('#uid').attr('disabled', 'disabled');
      $('#new-board').attr('disabled', 'disabled');
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
      var data = JSON.parse(e.data), i, idea, ok, board, name, header, group;
      console.log('received -> ', data);
      switch (data.type) { 
        case 'idea':
          if ($('#idea-' + data.id).length > 0) {
            updateIdea(data);
            if (data.last)
              newIdeaBox();
          }
          else {
            data.likes = data.likes || [];
            data.dislikes = data.dislikes || [];
            data.group = data.group || 0;
            group = $('#group-' + data.group);
            if (group.length === 0)
              group = newGroup(data.group);
            if (typeof data.id !== 'undefined') {
              header = $('<span class="header"></span>').append($('<span class="menu"></span>')
                .append($('<span>' + data.likes.length + '</span>').attr('id', 'likes-' + data.id))
                .append($('<span class="icon thumb-up" title="Gefällt mir"></span>')
                  .click(function (e) {
                    if (!connectionEstablished)
                      return;
                    send({ type: 'command', command: 'like', board: boardName, id: data.id, group: data.group });
                  })
                )
                .append($('<span>' + data.dislikes.length + '</span>').attr('id', 'dislikes-' + data.id))
                .append($('<span class="icon thumb-down" title="Nicht so doll"></span>')
                  .click(function (e) {
                    if (!connectionEstablished)
                      return;
                    send({ type: 'command', command: 'dislike', board: boardName, id: data.id });
                  })
                )
                .append($('<span class="icon trash" title="in den Müll"></span>')
                  .click(function (e) {
                    if (!connectionEstablished)
                      return;
                    ok = confirm('Eintrag "' + data.text + '" (#' + data.id + ') wirklich löschen?');
                    if (ok)
                      send({ type: 'command', board: boardName, command: 'delete', id: data.id, group: data.group });
                  }
                )
              ));
              idea = $('<span class="message" id="idea-' + data.id + '">'
                + '<span class="body"><span class="idea" id="idea-text-' + data.id + '">' + data.text + '</span></span>'
                + '<span class="footer">'
                + '<span class="date">' + data.date + '</span>'
                + '<span class="user" id="user-' + data.id + '">' + data.user + '</span>'
                + '</span>'
                + '</span>');
              idea.prepend(header).attr('data-group', data.group).attr('data-id', data.id);
              if (typeof data.next === 'number' && data.next >= 0)
                $('#idea-' + data.next).before(idea);
              else
                group.append(idea);
              $('<span class="handle"></span>').moveBetweenGroups('#idea-' + data.id).appendTo(header);
              $('#idea-text-' + data.id).attr('contentEditable', 'true').bind({
                keypress: function (e) {
                  if (!connectionEstablished)
                    return;
                  if (e.keyCode === 13 && !e.shiftKey) {
                    sendIdea(data.id);
                    e.preventDefault();
                  }
                }
              });
            }
            if (data.last) {
              group = $('#group-' + data.group);
              if (group.length === 0) {
                group = newGroup(currentGroup);
                $('#board').append(group);
              }
              newIdeaBox();
            }
            $('#new-idea').prependTo($('#group-' + getGroup()));
            if (currentGroup > lastGroupAdded)
              lastGroupAdded = currentGroup;
            focusOnInput();
          }
          break;
        case 'board-list':
          Object.keys(boards).forEach(function (id) {
            var name = boards[id], found = data.boards.some(function (val) { return val === name; });
            if (!found) {
              console.log('MUST NOW DELETE BOARD ' + name);
              // delete boards[id];
              if (boardName === name)
                console.log('DELETED BOARD IS ACTIVE!');
            }
          });
          $('#available-boards').empty();
          boards = data.boards;
          Object.keys(boards).forEach(function (id) {
            var name = boards[id];
            header = $('<span class="header"></span>');
            header.append($('<span class="icon trash" title="in den Müll"></span>')
                .click(function (e) {
                  if (!connectionEstablished)
                    return;
                  var ok = confirm('Das Board "' + name + '" wirklich löschen?');
                  if (ok) {
                    if (localStorage.getItem('lastBoardName') === name)
                      localStorage.removeItem('lastBoardName');
                    if (boardName === name) {
                      if (typeof prevBoardName === 'string')
                        setBoard(prevBoardName);
                    }
                    send({ type: 'command', command: 'delete-board', name: name });
                  }
                  e.preventDefault();
                }
              ));
            board = $('<span class="board" title="' + name + '">')
              .append($('<span class="body">' + name + '</span>').click(function (e) {
                if (!connectionEstablished)
                  return;
                setBoard(name);
              }))
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
            if (!connectionEstablished)
              return;
            if (e.target.value.length > 20) {
              e.preventDefault();
              return;
            }
            if (e.keyCode === 13 && e.target.value != '')
              setBoard(e.target.value);
          })
          break;
        case 'command':
          switch (data.command) {
            case 'delete':
              $('#board').find('#idea-' + data.id).addClass('deleting');
              setTimeout(function () {
                $('#board').find('#idea-' + data.id).remove();
                cleanGroups();
              }, 300);
              focusOnInput();
              break;
            default:
              break;
          }
          break;
        default:
          break;
      }
      hideLoaderIcon();
    }
  }

  function newIdeaBox() {
    if ($('#new-idea').length > 0)
      return;
    var idea = $('<span class="message" id="new-idea">'
      + '<span class="body">'
      + '<input type="text" id="input" placeholder="meine tolle Idee" />'
      + '</span>'
      + '</span>').attr('data-group', currentGroup);
    $('<span class="header" style="cursor:pointer"></span>').moveBetweenGroups(idea).prependTo(idea);
    $('#group-' + getGroup()).prepend(idea);
    $('#input').bind('keyup', function (e) {
      if (!connectionEstablished)
        return;
      if (e.target.value.length > 100) {
        e.preventDefault();
        return;
      }
      if (e.keyCode === 13 && e.target.value.length > 0) {
        sendIdea();
        e.preventDefault();
      }
    });
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
    var target = e.message.target, group = newGroup(++lastGroupAdded);
    if (group.children().length === 0)
      group.append(target);
    cleanGroups();
  }

  function onIdeaMoved(e) {
    var target = e.message.target, ideaId, nextIdeaId;
    if (target.attr('id').match(/^idea-/)) {
      ideaId = parseInt(target.attr('data-id'));
      nextIdeaId = parseInt($('#idea-' + ideaId).next().attr('data-id')) || -1;
      sendIdea(ideaId, { next: nextIdeaId });
    }
    else if (target.attr('id') === 'new-idea') {
      storeGroup(target.attr('data-group'));
    }
    cleanGroups();
    focusOnInput();
  }

  function showLoaderIcon() {
    $('#loader-icon').css('display', 'inline-block').css('position', 'absolute').css('left', Math.floor(($(window).width() - 25) / 2) + 'px').css('top', Math.floor(($(window).height() - 25) / 2) + 'px');
    $('#app-name').addClass('progressbar');
  }

  function hideLoaderIcon() {
    $('#loader-icon').css('display', 'none');
    $('#app-name').removeClass('progressbar');
  }

  return {
    init: function () {
      user = localStorage.getItem('user') || '';
      boardName = localStorage.getItem('lastBoardName') || 'Brainstorm';
      openSocket();
      if (typeof socket === 'object') {
        $(window).bind({
          newgroup: newGroupEvent,
          ideamoved: onIdeaMoved
        });
        $('#uid').val(user).bind({
          keypress: function (e) {
            if (!connectionEstablished)
              return;
            if (e.target.value.length > 4)
              e.preventDefault();
          },
          keyup: function (e) {
            if (!connectionEstablished)
              return;
            if (e.target.value !== '') {
              user = e.target.value.trimmed();
              localStorage.setItem('user', user);
              $('#uid').removeClass('pulse');
            }
          }
        });
        if (user === '') {
          $('#uid').attr('class', 'pulse');
          alert('Du bist zum ersten Mal hier. Trage bitte dein Kürzel in das blinkende Feld ein.');
        }
      }
    }
  };

})();


$(document).ready(function () {
  Brainstorm.init();
});
