// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var Brainstorm = (function () {
  "use strict";

  var HOST = document.location.hostname;
  var PORT = 8889;
  var URL = 'ws://' + HOST + ':' + PORT + '/';
  var socket;
  var connectionEstablished = false;
  var RETRY_SECS = 11;
  var retry_secs;
  var reconnectTimer = null;
  var user;
  var boardName = 'Brainstorm';

  String.prototype.trimmed = function () {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function send(message) {
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
  }

  function updateIdea(data) {
    $('#likes-' + data.id).text(data.likes);
    $('#dislikes-' + data.id).text(data.dislikes);
    $('#idea-text-' + data.id).html(data.text);
    $('#idea-' + data.id).addClass('blink-once');
    setTimeout(function () {
      $('#idea-' + data.id).removeClass('blink-once');
    }, 300);
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
      $('#board').empty();
      send({ type: 'command', command: 'init', board: boardName });
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
      var data = JSON.parse(e.data), i;
      switch (data.type) {
        case 'idea':
          if ($('#idea-' + data.id).length > 0) {
            updateIdea(data);
          }
          else {
            var header = $('<div class="header"></div>')
              .append($('<span>' + (data.likes || 0) + '</span>').attr('id', 'likes-' + data.id))
              .append($('<span class="icon thumb-up" title="Gefällt mir"></span>')
                .click(function (e) {
                  send({ type: 'command', command: 'like', board: boardName, id: data.id });
                })
              )
              .append($('<span>' + (data.dislikes || 0) + '</span>').attr('id', 'dislikes-' + data.id))
              .append($('<span class="icon thumb-down" title="Nicht so doll"></span>')
                .click(function (e) {
                  send({ type: 'command', command: 'dislike', board: boardName, id: data.id });
                })
              )
              .append($('<span class="icon trash" title="in den Müll"></span>')
                .click(function (e) {
                  var ok = confirm("Wirklich löschen?");
                  if (ok) {
                    send({ type: 'command', board: boardName, command: 'delete', id: data.id });
                  }
                }
              )
            );
            var idea = $('<div class="message" id="idea-' + data.id + '">'
              + '<div class="body"><span class="idea" id="idea-text-' + data.id + '">' + data.text + '</span></div>'
              + '<div class="footer">'
              + '<span class="date">' + data.date + '</span>'
              + '<span class="user" id="user-' + data.id + '">' + data.user + '</span>'
              + '</div>'
              + '</div>');
            idea.prepend(header);
            $('#board').append(idea);
            $('#idea-text-' + data.id).attr('contentEditable', 'true').bind({
              keypress: function (e) {
                if (e.keyCode === 13) {
                  if (!e.shiftKey) {
                    sendIdea(data.id);
                    e.preventDefault();
                  }
                }
              }
            });
          }
          break;
        case 'board-list':
          for (i in data.boards) {
            var option = $('<option value="' + data.boards[i] + '">' + data.boards[i] + '</option>');
            $('#available-boards').append(option);
            if (data.boards[i] === boardName)
              option.attr('selected', 'selected');
          }
          $('#available-boards').change(function (e) {
            document.location.search = '?board=' + this.options[this.options.selectedIndex].value;
          });
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

  function evaluateURLParameters() {
    $.each(document.location.search.substring(1).split('&'), function (i, p) {
      var param = p.split('=');
      var key = param[0], val = param[1];
      switch (key) {
        case 'board':
          boardName = decodeURIComponent(val).trimmed();
          $('h1').text(boardName);
          break;
        default: // ignore any other parameter
          break;
      }
    });
  }

  return {
    init: function () {
      evaluateURLParameters();
      user = localStorage.getItem('user') || '';
      $('h1').text(boardName);
      if (user === '') {
        $('#uid').attr('class', 'pulse');
        alert('Du bist das erste Mal hier. Zum Mitmachen trage bitte dein Kürzel in das blinkende Feld ein.');
      }
      openSocket();
      $('#input').bind('keyup', function (e) {
        if (e.keyCode === 13)
          sendIdea();
        if (e.target.value.length > 100)
          e.preventDefault();
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
