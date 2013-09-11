// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var BS = (function () {
  var HOST = 'localhost';
  var PORT = 8000;
  var URL = 'ws://' + HOST + ':' + PORT + '/';
  var socket;
  var connectionEstablished = false;
  var RETRY_SECS = 10;
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
      if (connectionEstablished) {
        retry_secs = RETRY_SECS;
        if (reconnectTimer !== null)
          clearInterval(reconnectTimer);
        reconnectTimer = setInterval(function retryCountdown() {
          // connectionEstablished = false;
          if (--retry_secs > 0) {
            $('#status').text('connection lost. trying to reconnect ... ' + retry_secs);
          }
          else {
            clearInterval(reconnectTimer);
            retry_secs = RETRY_SECS;
            openSocket();
          }
        }, 1000);
      }
    };
    socket.onmessage = function (e) {
      var data = JSON.parse(e.data);
      $('#board').append($('<div class="message">'
        + '<span class="idea">' + data.text + '</span>'
        + '<span class="user">' + data.user + '</span>'
        + '<span class="date">' + data.date + '</span>'
        + '</div>'));
    }
  }

  return {
    init: function () {
      openSocket();
      $('#input').bind('keyup', function (e) {
        if (e.keyCode === 13)
          sendInput();
      });
    }
  };

})();

  $(document).ready(function() {
    BS.init();
  });