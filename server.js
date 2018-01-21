const path = require('path');
const express = require('express');
const app = express();
const assert = require('assert');


// import Piece from "./js/classes/Pieces";
const { createChessBoard }  = require('./js/Chess');


// If an incoming request uses
// a protocol other than HTTPS,
// redirect that request to the
// same url but with HTTPS
const forceSSL = function() {
  return function (req, res, next) {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(
        ['https://', req.get('Host'), req.url].join('')
      );
    }
    next();
  }
};
// Instruct the app
// to use the forceSSL
// middleware

// app.use(forceSSL());

// API Config

app.use(express.static(path.join(__dirname, '/dist')));

app.get('/api/json', (req, res) => {
  res.send({'name': 'Alex', 'email': 'atnelon@andrew.cmu.edu'});
});

app.get('*', (req, res, next) => {
  res.sendFile(__dirname+"/dist/index.html");
});

// Socket / Mongo Config


const http = require('http').createServer(app);
const io = require('socket.io')(http);
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectId;
const mongoUri = 'mongodb://atnelson:Buddy1009@ds155577.mlab.com:55577/saynplay';

MongoClient.connect(mongoUri, (err, client) => {
  if (err) return console.log(err);
  db = client.db('saynplay');

  console.log('Connected to the database');
  // SOCKET CONFIG
  io.on('connection', (socket) => {
    socket.on('request to play', (id) => {
      // send a private message to the socket with the given id
      socket.to(id).emit('received request', socket.id);
    });

    // socket.broadcast.emit('somebody just connected');

    updateClients();

    socket.on('accept', (socket_id) => {
      // console.log('Accepted Request');
      // console.log(socket.id, socket_id);
      createGame(db, (startTime) => {
        findGameByStart(db, startTime, (game) => {
          const id = game['_id'];
          // Create socket group here
          socket.join( `${id}`);
          const socket2 = io.sockets.connected[socket_id];
          socket2.join(`${id}`);
          io.to(`${id}`).emit('game update', game);
        })
      })
    });

    socket.on('fetch game', (id) => {
      findGameById(db, id, (game) => {
        const id = game['_id'];
        socket.join(`${id}`);
        io.to(`${id}`).emit('game update', game);
      })
    });

    socket.on('update game', (board, game_id, data) => {
      console.log('UPDATING THE GAME NOW');
      updateGameById(db, game_id, board, (res) => {
        console.log(res);
        findGameById(db, game_id, (game) => {
          const id = game['_id'];
          console.log(game);
          socket.join(`${id}`);
          io.to(`${id}`).emit('game update', game, data);
        })
      })
    });

    socket.on('decline', (socket_id) => {
      console.log('Declined Request');
    });

    socket.on('update clients', () => {
      updateClients();
    });

    socket.on('disconnect', () => {
      updateClients();
    });
  });
});


// SOCKET IO CODE

function updateClients() {
  io.clients((error, clients) => {
    if (error) throw error;
    io.emit('updated clients', clients);
  });
}

function remove(array, element) {
  return array.filter(e => e !== element);
}


// CHESS DB OPERATIONS
const createGame = function(db, callback) {
  const collection = db.collection('games');
  const time = Date.now();
  collection.insertOne({
    game: createChessBoard(),
    startTime: time,
  }, (err, result) => {
    callback(time);
  })
};

const findGameByStart = function(db, startTime, callback) {
  const collection = db.collection('games');
  collection.find({startTime: startTime}).toArray((err, games) => {
    if (games.length === 1) {
      const game = games[0];
      callback(game);
    }
  })
};

const findGameById = function(db, id, callback) {
  const collection = db.collection('games');
  collection.find({_id: ObjectId(id)}).toArray((err, games) => {
    if (games.length === 1) {
      const game = games[0];
      callback(game);
    }
  })
};

const updateGameById = function(db, id, board, callback) {
  const collection = db.collection('games');
  collection.updateOne({_id: ObjectId(id)}, {$set: {game : board}}, (err, res) => {
    callback(res);
  })
};


http.listen( process.env.PORT || 8000, () => {
  console.log('listening to port 8000')
});


// Chess Flow
/*
Once a person accepts a request to play, create a new board
Save that board with the following attributes
{
  board: board,
  startTime: Date.now()
  _id: id
}
Store the game startTime in a variable
Once the board has been successfully saved, fetch the board with the start time as indicated in the stored variable
Create a Socket Group with the name of the id of the board
Add the two sockets to the group
Emit the fetched board to both sockets in the group


*/

