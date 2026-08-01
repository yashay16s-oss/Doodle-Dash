const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 3000;

const server = http.createServer(app);
const io = new Server(server);

// ---- Game state (in-memory, resets on server restart) ----
const WORDS = [
  'apple', 'banana', 'guitar', 'rocket', 'castle', 'dragon', 'bicycle',
  'umbrella', 'penguin', 'volcano', 'sandwich', 'octopus', 'rainbow',
  'skateboard', 'telescope', 'lighthouse', 'butterfly', 'mountain',
  'campfire', 'submarine', 'cactus', 'dinosaur', 'pirate', 'robot',
  'snowman', 'waterfall', 'jellyfish', 'kangaroo', 'helicopter', 'wizard'
];

const ROUND_SECONDS = 60;

// rooms: Map<roomCode, RoomState>
const rooms = new Map();

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function publicPlayerList(room) {
  return room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
}

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function startRound(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.players.length === 0) return;

  room.drawerIndex = (room.drawerIndex + 1) % room.players.length;
  const drawer = room.players[room.drawerIndex];
  room.currentWord = pickWord();
  room.correctGuessers = new Set();
  room.roundStartedAt = Date.now();

  io.to(roomCode).emit('round-start', {
    drawerId: drawer.id,
    drawerName: drawer.name,
    wordLength: room.currentWord.length,
    seconds: ROUND_SECONDS
  });

  io.to(drawer.id).emit('your-word', { word: room.currentWord });

  clearTimeout(room.timer);
  room.timer = setTimeout(() => endRound(roomCode, false), ROUND_SECONDS * 1000);
}

function endRound(roomCode, allGuessedEarly) {
  const room = rooms.get(roomCode);
  if (!room) return;

  clearTimeout(room.timer);
  io.to(roomCode).emit('round-end', {
    word: room.currentWord,
    scores: publicPlayerList(room)
  });

  room.currentWord = null;

  // brief pause before next round
  setTimeout(() => startRound(roomCode), 4000);
}

// ---- Database setup ----
const db = new Database(path.join(__dirname, 'drawings.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS drawings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Anonymous',
    image_data TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// ---- Middleware ----
app.use(express.json({ limit: '10mb' })); // drawings as base64 can be sizable
app.use(express.static(path.join(__dirname, 'public')));

// ---- API routes ----

// Save a new drawing
app.post('/api/drawings', (req, res) => {
  const { title, author, image_data } = req.body;

  if (!title || !image_data) {
    return res.status(400).json({ error: 'title and image_data are required' });
  }

  const stmt = db.prepare(
    'INSERT INTO drawings (title, author, image_data) VALUES (?, ?, ?)'
  );
  const result = stmt.run(title, author || 'Anonymous', image_data);

  res.json({ id: result.lastInsertRowid });
});

// Get all drawings (without full image data, for a fast gallery list)
app.get('/api/drawings', (req, res) => {
  const rows = db.prepare(
    'SELECT id, title, author, created_at FROM drawings ORDER BY created_at DESC'
  ).all();
  res.json(rows);
});

// Get a single drawing (with full image data)
app.get('/api/drawings/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM drawings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Delete a drawing
app.delete('/api/drawings/:id', (req, res) => {
  db.prepare('DELETE FROM drawings WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ---- Socket.io game logic ----
io.on('connection', (socket) => {

  socket.on('create-room', ({ name }) => {
    const roomCode = makeRoomCode();
    rooms.set(roomCode, {
      players: [],
      drawerIndex: -1,
      currentWord: null,
      correctGuessers: new Set(),
      timer: null
    });
    joinRoom(socket, roomCode, name);
  });

  socket.on('join-room', ({ roomCode, name }) => {
    roomCode = (roomCode || '').toUpperCase().trim();
    if (!rooms.has(roomCode)) {
      socket.emit('join-error', { message: 'Room not found. Check the code and try again.' });
      return;
    }
    joinRoom(socket, roomCode, name);
  });

  function joinRoom(socket, roomCode, name) {
    const room = rooms.get(roomCode);
    room.players.push({ id: socket.id, name: name || 'Player', score: 0 });
    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    socket.emit('joined-room', { roomCode, players: publicPlayerList(room) });
    io.to(roomCode).emit('player-list', { players: publicPlayerList(room) });

    // If a round is already in progress, catch the new player up
    if (room.currentWord) {
      const drawer = room.players[room.drawerIndex];
      socket.emit('round-start', {
        drawerId: drawer.id,
        drawerName: drawer.name,
        wordLength: room.currentWord.length,
        seconds: ROUND_SECONDS
      });
    }
  }

  socket.on('start-game', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room || room.currentWord) return; // already running
    startRound(roomCode);
  });

  socket.on('draw-stroke', (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    socket.to(roomCode).emit('draw-stroke', data);
  });

  socket.on('clear-canvas', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    socket.to(roomCode).emit('clear-canvas');
  });

  socket.on('guess', ({ text }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room || !room.currentWord) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const isDrawer = room.players[room.drawerIndex].id === socket.id;
    if (isDrawer) return; // drawer can't guess

    const guess = (text || '').trim();
    const correct = guess.toLowerCase() === room.currentWord.toLowerCase();

    if (correct && !room.correctGuessers.has(socket.id)) {
      room.correctGuessers.add(socket.id);
      const secondsElapsed = (Date.now() - room.roundStartedAt) / 1000;
      const points = Math.max(10, Math.round(100 - secondsElapsed));
      player.score += points;
      room.players[room.drawerIndex].score += 20;

      io.to(roomCode).emit('chat-message', {
        system: true,
        text: `${player.name} guessed the word! (+${points})`
      });
      io.to(roomCode).emit('player-list', { players: publicPlayerList(room) });

      // If everyone (except drawer) has guessed, end round early
      const guessersNeeded = room.players.length - 1;
      if (room.correctGuessers.size >= guessersNeeded && guessersNeeded > 0) {
        endRound(roomCode, true);
      }
    } else {
      io.to(roomCode).emit('chat-message', {
        system: false,
        name: player.name,
        text: guess
      });
    }
  });

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;

    const wasDrawer = idx === room.drawerIndex;
    room.players.splice(idx, 1);

    if (room.players.length === 0) {
      clearTimeout(room.timer);
      rooms.delete(roomCode);
      return;
    }

    io.to(roomCode).emit('player-list', { players: publicPlayerList(room) });

    if (wasDrawer) {
      room.drawerIndex -= 1; // startRound will increment
      startRound(roomCode);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Drawing app running at http://localhost:${PORT}`);
});