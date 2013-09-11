// Copyright (c) 2013 Oliver Lau <ola@ct.de>, Heise Zeitschriften Verlag
// All rights reserved.

var BS = (function () {
  var HOST = 'localhost';
  var PORT = 8000;
  var URL = 'ws://' + HOST + ':' + PORT + '/';
  var socket;

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
    socket = new WebSocket(URL);
    socket.onopen = function () {
      $('#status').text('connected').addClass('ok');
    };
    socket.onerror = function (error) {
      $('#status').text('connection failed').addClass('error');
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
      $('#submit-button').click(function () {
        sendInput();
      });
    }
  };

})();

  $(document).ready(function() {
    BS.init();
  });