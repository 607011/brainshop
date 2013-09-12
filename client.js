// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var BS = (function () {
  var HOST = document.location.hostname;
  var PORT = 8889;
  var URL = 'ws://' + HOST + ':' + PORT + '/';
  var socket;
  var connectionEstablished = false;
  var RETRY_SECS = 11;
  var retry_secs;
  var reconnectTimer = null;

  function send(message) {
    socket.send(JSON.stringify(message));
  }

  function sendIdea() {
    send({ type: 'idea', text: $('#input').val(), user: 'ola' });
    $('#input').val('');
  }

  function updateIdea(data) {
    $('#likes-' + data.id).text(data.likes);
    $('#dislikes-' + data.id).text(data.dislikes);
  }

  function openSocket() {
    $('#status').removeAttr('class').html('connecting&nbsp;&hellip;');
    socket = new WebSocket(URL);
    socket.onopen = function () {
      $('#status').removeAttr('class').text('connected').addClass('ok');
      if (reconnectTimer !== null) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
      connectionEstablished = true;
      $('#board').empty();
    };
    socket.onerror = function (error) {
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
      var data = JSON.parse(e.data);
      switch (data.type) {
        case 'idea':
          if ($('#idea-' + data.id).length > 0) {
            updateIdea(data);
          }
          else {
            var header = $('<header></header>')
              .append($('<span>' + (data.likes || 0) + '</span>').attr('id', 'likes-' + data.id))
              .append($('<span class="icon thumb-up" title="Gefällt mir"></span>')
                .click(function (e) {
                  socket.send(JSON.stringify({ type: 'command', command: 'like', id: data.id }));
                })
              )
              .append($('<span>' + (data.dislikes || 0) + '</span>').attr('id', 'dislikes-' + data.id))
              .append($('<span class="icon thumb-down" title="Nicht so doll"></span>')
                .click(function (e) {
                  socket.send(JSON.stringify({ type: 'command', command: 'dislike', id: data.id }));
                })
              )
              .append($('<span class="icon trash" title="in den Müll"></span>')
                .click(function (e) {
                  var ok = confirm("Wirklich löschen?");
                  if (ok) {
                    socket.send(JSON.stringify({ type: 'command', command: 'delete', id: data.id }));
                  }
                }
              )
            );
            var idea = $('<div class="message">'
              + '<div class="body"><span class="idea">' + data.text + '</span></div>'
              + '<footer>'
              + '<span class="date">' + data.date + '</span>'
              + '<span class="user">' + data.user + '</span>'
              + '</footer>'
              + '</div>').attr('id', 'idea-' + data.id)
            idea.prepend(header);
            $('#board').append(idea);
          }
          break;
        case 'command':
          switch (data.command) {
            case 'delete':
              $('#board').find('#idea-' + data.id).remove();
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

  return {
    init: function () {
      openSocket();
      $('#input').bind('keypress', function (e) {
        if (e.keyCode === 13)
          sendIdea();
        if (e.target.value.length > 100)
          e.preventDefault();
      });
    }
  };

})();

  $(document).ready(function() {
    BS.init();
  });