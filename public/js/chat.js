'use strict';

const socket = io();

// Elements
const $messageForm = document.querySelector('#message-form');
const $messageFormInput = document.querySelector('input');
const $messageFormButton = document.querySelector('button');
const $locationButton = document.querySelector('#send-location');
const $messages = document.querySelector('#messages');
const $callBtn = document.querySelector('#call-btn');
const $localVideo = document.querySelector('#localVideo');
const $remoteVideo = document.querySelector('#remoteVideo');

// Templates
const messageTemplate = document.querySelector('#message-template').innerHTML;
const locationMessageTemplate = document.querySelector('#location-message-template').innerHTML;
const sidebarTemplate = document.querySelector('#sidebar-template').innerHTML;

// Options
const { username, room } = Qs.parse(location.search, { ignoreQueryPrefix: true } );

const autoScroll = () => {
    // New message element
    const $newMessage = $messages.lastElementChild;

    // height of the new message
    const newMessageStyles = getComputedStyle($newMessage);
    const newMessageMargin = parseInt(newMessageStyles.marginBottom);
    const newMessageHeight = $newMessage.offsetHeight + newMessageMargin;

    // Visible height
    const visibleHeight = $messages.offsetHeight;

    // Height of message container
    const containerHeight = $messages.scrollHeight;

    // How far have i scrolled
    const scrollOffset = $messages.scrollTop + visibleHeight;

    if (containerHeight - newMessageHeight <= scrollOffset) {
        $messages.scrollTop = $messages.scrollHeight;
    }
}

socket.on('message', (message, username = '') => {
    const html = Mustache.render(messageTemplate, {
        message: message.text,
        username,
        createdAt: moment(message.createdAt).format('h:mm a')
    });
    $messages.insertAdjacentHTML("beforeend", html);
    autoScroll();
});

socket.on('locationMessage', (message, username = '') => {

    const html = Mustache.render(locationMessageTemplate, {
        url: message.url,
        username,
        createdAt: moment(message.createdAt).format('h:mm a')
    });
    $messages.insertAdjacentHTML("beforeend", html);
    autoScroll();
});

socket.on('roomData', ({ room, users }) => {
    const html = Mustache.render(sidebarTemplate, {
        room,
        users,
        index: function() {
            return ++window['INDEX']||(window['INDEX']=0);
        }
    });
    document.querySelector('#sidebar').innerHTML = html;
});

$messageForm.addEventListener('submit', (e) => {
    e.preventDefault();

    $messageFormButton.setAttribute('disabled', 'disabled');
    // disable
    const message = e.target.elements.message;
    socket.emit('sendMessage', message.value, (error) => {
        $messageFormButton.removeAttribute('disabled');
        $messageFormInput.value = '';
        $messageFormInput.focus();

        // enable
        if (error) {
            return console.log(error);
        }
        console.log('The message was delivered:');
    });

});


$locationButton.addEventListener('click', (e) => {

    if (!navigator.geolocation) {
        return alert('Geolocation is not supported by your browser');
    }
    $locationButton.setAttribute('disabled', 'disabled');

    navigator.geolocation.getCurrentPosition((position) => {
        // console.log(position.coords);
        socket.emit('sendLocation', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        }, () => {
            $locationButton.removeAttribute('disabled');
            console.log('Location Shared!!');
        });
    });

});


socket.emit('join', { username, room }, (error) => {
    if (error) {
        alert(error);
        location.href = '/';
    }
});


var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;


var pcConfig = {
    'iceServers': [{
      'urls': 'stun:stun.l.google.com:19302'
    }]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
};

var signal_room = 'foo';

$callBtn.addEventListener('click', (e) => {
    e.preventDefault();

    // signal_room = Math.floor(100000 + Math.random() * 900000);
    $callBtn.setAttribute('disabled', 'disabled');
    console.log('Calling...' + signal_room);

    // socket.emit('connect_message', room);

    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    })
    .then(gotStream)
    .catch(function(e) {
        alert('getDisplayMedia() error: ' + e.name);
    });

    socket.emit('create or join', signal_room);

});
  
  socket.on('created', function(signal_room) {
    console.log('Created room ' + signal_room);
    isInitiator = true;
  });

//   socket.on('accept_call', function(signal_room) {
//     console.log('Created room ' + signal_room);
//     isInitiator = true;
//   });
  
  socket.on('full', function(signal_room) {
    console.log('Room ' + signal_room + ' is full');
  });
  
  socket.on('join', function (signal_room){
    console.log('Another peer made a request to join room ' + signal_room);
    console.log('This peer is the initiator of room ' + signal_room + '!');
    isChannelReady = true;
  });
  
  socket.on('joined', function(signal_room) {
    console.log('joined: ' + signal_room);
    isChannelReady = true;
  });
  
  socket.on('log', function(array) {
    console.log.apply(console, array);
  });
  
  ////////////////////////////////////////////////
  
  function sendMessage(message) {
    console.log('Client sending message: ', message);
    socket.emit('signal_message', message);
  }
  
  // This client receives a message
  socket.on('signal_message', function(message) {
    console.log('Client received message:', message);
    if (message === 'got user media') {
      maybeStart();
    } else if (message.type === 'offer') {
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === 'answer' && isStarted) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });
      pc.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
      handleRemoteHangup();
    }
  });








function gotStream(stream) {
    console.log('Adding local stream.');
    localStream = stream;
    localVideo.srcObject = stream;
    sendMessage('got user media');
    if (isInitiator) {
      maybeStart();
    }
  }

  var constraints = {
    video: true
  };
  
  console.log('Getting user media with constraints', constraints);

  if (location.hostname !== 'localhost') {
    requestTurn(
      'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
    );
  }

  function maybeStart() {
    console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
    if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
      console.log('>>>>>> creating peer connection');
      createPeerConnection();
      pc.addStream(localStream);
      isStarted = true;
      console.log('isInitiator', isInitiator);
      if (isInitiator) {
        doCall();
      }
    }
  }

  window.onbeforeunload = function() {
    sendMessage('bye');
  };


  /////////////////////////////////////////////////////////

function createPeerConnection() {
    try {
      pc = new RTCPeerConnection(null);
      pc.onicecandidate = handleIceCandidate;
      pc.onaddstream = handleRemoteStreamAdded;
      pc.onremovestream = handleRemoteStreamRemoved;
      console.log('Created RTCPeerConnnection');
    } catch (e) {
      console.log('Failed to create PeerConnection, exception: ' + e.message);
      alert('Cannot create RTCPeerConnection object.');
      return;
    }
  }
  
  function handleIceCandidate(event) {
    console.log('icecandidate event: ', event);
    if (event.candidate) {
      sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    } else {
      console.log('End of candidates.');
    }
  }
  
  function handleCreateOfferError(event) {
    console.log('createOffer() error: ', event);
  }
  
  function doCall() {
    console.log('Sending offer to peer');
    pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
  }
  
  function doAnswer() {
    console.log('Sending answer to peer.');
    pc.createAnswer().then(
      setLocalAndSendMessage,
      onCreateSessionDescriptionError
    );
  }
  
  function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    sendMessage(sessionDescription);
  }
  
  function onCreateSessionDescriptionError(error) {
    trace('Failed to create session description: ' + error.toString());
  }
  
  function requestTurn(turnURL) {
    var turnExists = false;
    for (var i in pcConfig.iceServers) {
      if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
        turnExists = true;
        turnReady = true;
        break;
      }
    }
    if (!turnExists) {
      console.log('Getting TURN server from ', turnURL);
      // No TURN server. Get one from computeengineondemand.appspot.com:
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          var turnServer = JSON.parse(xhr.responseText);
          console.log('Got TURN server: ', turnServer);
          pcConfig.iceServers.push({
            'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
            'credential': turnServer.password
          });
          turnReady = true;
        }
      };
      xhr.open('GET', turnURL, true);
      xhr.send();
    }
  }
  
  function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
  }
  
  function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
  }
  
  function hangup() {
    console.log('Hanging up.');
    stop();
    sendMessage('bye');
  }
  
  function handleRemoteHangup() {
    console.log('Session terminated.');
    stop();
    isInitiator = false;
  }
  
  function stop() {
    isStarted = false;
    pc.close();
    pc = null;
  }