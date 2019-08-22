var os = require('os');
var nodeStatic = require('node-static');

const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom} = require('./utils/users'); 

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');


// Setup static directory to serve
app.use(express.static(publicDirectoryPath));

io.on('connection', (socket) => {

    console.log('New WS connection');
    
    socket.on('join', (options, callback) => {

        const { error, user } = addUser({id: socket.id, ...options});

        if (error) {
            return callback(error);
        }

        socket.join(user.room);

        socket.emit('message', generateMessage('Welcome!'), 'Admin');
        socket.broadcast.to(user.room).emit(
            'message',
            generateMessage(user.username + ' has joined'),
            'Admin'
        );

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        });
        callback();
    });

    socket.on('sendMessage', (msg, callback) => {
        const filter = new Filter();
        const user = getUser(socket.id);
        if (filter.isProfane(msg)) {
            return callback('Profanity is not allowed!');
        }
        io.to(user.room).emit('message', generateMessage(msg), user.username);
        callback();
    });

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);
        
        if (user) {
            io.to(user.room).emit(
                'message',
                generateMessage(user.username + ' has left'),
                'Admin'
            );
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    });

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id);
        io.to(user.room).emit('locationMessage',
            generateLocationMessage(
                'https://google.com/maps?q=' + coords.latitude + ',' + coords.longitude,
                user.username
            )
        );
        callback();
    });

    // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('signal_message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('signal_message', message);
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);

    } else if (numClients === 1) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

  // socket.on('connect_message', function(room) {

  // io.sockets.in(room).emit('join', room);
  // socket.join(room);

  //   // socket.emit('accept_call', room);
  // });

});

server.listen(port, () => {
    console.log('Server is up on port ' + port + '.');
});