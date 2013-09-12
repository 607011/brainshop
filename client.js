// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var BS = (function () {
  var HOST = 'localhost';
  var PORT = 8000;
  var URL = 'ws://' + HOST + ':' + PORT + '/';
  var socket;
  var connectionEstablished = false;
  var RETRY_SECS = 11;
  var retry_secs;
  var reconnectTimer = null;

  function send(message) {
    console.log(message);
    var msg = {
      type: 'idea',
      text: message,
      user: 'ola'
    };
    socket.send(JSON.stringify(msg));
  }

  function sendInput() {
    send($('#input').val());
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
      $('#board').append($('<div class="message">'
        + '<span class="idea">' + data.text + '</span>'
        + '<span class="date">' + data.date + '</span>'
        + '<span class="user">' + data.user + '</span>'
        + '</div>'));
    }
  }

  return {
    init: function () {
      openSocket();
      $('#input').bind('keypress', function (e) {
        if (e.keyCode === 13)
          sendInput();
        if (e.target.value.length > 100)
          e.preventDefault();
      });
    }
  };

})();

  $(document).ready(function() {
    BS.init();
  });