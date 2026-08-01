const socket = io();

// ---- Nav wiring for Play tab ----
const navPlay = document.getElementById('nav-play');
const playView = document.getElementById('play-view');

navPlay.addEventListener('click', () => {
  ['draw-view', 'gallery-view', 'play-view'].forEach(id => {
    document.getElementById(id).classList.toggle('hidden', id !== 'play-view');
  });
  ['nav-draw', 'nav-gallery', 'nav-play'].forEach(id => {
    document.getElementById(id).classList.toggle('active', id === 'nav-play');
  });
});

// ---- Lobby ----
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const lobbyError = document.getElementById('lobby-error');

createRoomBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (!name) return showLobbyError('Enter your name first.');
  socket.emit('create-room', { name });
});

joinRoomBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  const roomCode = roomCodeInput.value.trim();
  if (!name) return showLobbyError('Enter your name first.');
  if (!roomCode) return showLobbyError('Enter a room code.');
  socket.emit('join-room', { name, roomCode });
});

function showLobbyError(msg) {
  lobbyError.textContent = msg;
  lobbyError.classList.remove('hidden');
}

socket.on('join-error', ({ message }) => showLobbyError(message));

let myId = null;
let isDrawer = false;

socket.on('connect', () => { myId = socket.id; });

socket.on('joined-room', ({ roomCode }) => {
  document.getElementById('room-code-display').textContent = roomCode;
  lobbyScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
});

// ---- Player list ----
const playerListEl = document.getElementById('player-list');
const startGameBtn = document.getElementById('start-game-btn');

socket.on('player-list', ({ players }) => {
  playerListEl.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} — ${p.score} pts`;
    if (p.id === myId) li.classList.add('me');
    playerListEl.appendChild(li);
  });

  // Show "Start Game" only if this player is alone-capable (anyone can start once 2+ players)
  startGameBtn.classList.toggle('hidden', players.length < 2);
});

startGameBtn.addEventListener('click', () => {
  socket.emit('start-game');
  startGameBtn.classList.add('hidden');
});

// ---- Round state ----
const roundStatus = document.getElementById('round-status');
const timerDisplay = document.getElementById('timer-display');
const wordBanner = document.getElementById('word-banner');
let timerInterval = null;

socket.on('round-start', ({ drawerId, drawerName, wordLength, seconds }) => {
  isDrawer = drawerId === myId;
  roundStatus.textContent = isDrawer
    ? 'Your turn to draw!'
    : `${drawerName} is drawing...`;

  wordBanner.classList.remove('hidden');
  wordBanner.textContent = isDrawer ? '' : '_ '.repeat(wordLength).trim();

  clearGameCanvas();
  clearChat();
  addSystemMessage(`New round! ${drawerName} is drawing.`);

  guessInput.disabled = isDrawer;
  guessInput.placeholder = isDrawer ? "You're drawing — can't guess" : 'Type your guess...';
  gameToolbar.style.display = isDrawer ? 'flex' : 'none';
  gameCanvas.style.cursor = isDrawer ? 'crosshair' : 'default';

  let remaining = seconds;
  timerDisplay.textContent = `⏱ ${remaining}s`;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    remaining -= 1;
    timerDisplay.textContent = `⏱ ${Math.max(remaining, 0)}s`;
    if (remaining <= 0) clearInterval(timerInterval);
  }, 1000);
});

socket.on('your-word', ({ word }) => {
  wordBanner.textContent = `Your word: ${word}`;
});

socket.on('round-end', ({ word }) => {
  clearInterval(timerInterval);
  roundStatus.textContent = 'Round over!';
  wordBanner.textContent = `The word was: ${word}`;
  addSystemMessage(`The word was "${word}". Next round starting soon...`);
  guessInput.disabled = true;
});

// ---- Game canvas (synced drawing) ----
const gameCanvas = document.getElementById('game-canvas');
const gctx = gameCanvas.getContext('2d');
const gameColorPicker = document.getElementById('game-color-picker');
const gameBrushSize = document.getElementById('game-brush-size');
const gameEraserBtn = document.getElementById('game-eraser-btn');
const gameClearBtn = document.getElementById('game-clear-btn');
const gameToolbar = document.getElementById('game-toolbar');

gctx.fillStyle = '#ffffff';
gctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
gctx.lineCap = 'round';
gctx.lineJoin = 'round';

let gDrawing = false;
let gErasing = false;
let gLastX = 0, gLastY = 0;

function getGamePos(e) {
  const rect = gameCanvas.getBoundingClientRect();
  const scaleX = gameCanvas.width / rect.width;
  const scaleY = gameCanvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function strokeLine(x0, y0, x1, y1, color, size) {
  gctx.strokeStyle = color;
  gctx.lineWidth = size;
  gctx.beginPath();
  gctx.moveTo(x0, y0);
  gctx.lineTo(x1, y1);
  gctx.stroke();
}

gameCanvas.addEventListener('mousedown', (e) => {
  if (!isDrawer) return;
  gDrawing = true;
  const pos = getGamePos(e);
  gLastX = pos.x; gLastY = pos.y;
});

gameCanvas.addEventListener('mousemove', (e) => {
  if (!isDrawer || !gDrawing) return;
  const pos = getGamePos(e);
  const color = gErasing ? '#ffffff' : gameColorPicker.value;
  const size = gameBrushSize.value;
  strokeLine(gLastX, gLastY, pos.x, pos.y, color, size);
  socket.emit('draw-stroke', { x0: gLastX, y0: gLastY, x1: pos.x, y1: pos.y, color, size });
  gLastX = pos.x; gLastY = pos.y;
});

gameCanvas.addEventListener('mouseup', () => { gDrawing = false; });
gameCanvas.addEventListener('mouseleave', () => { gDrawing = false; });

gameEraserBtn.addEventListener('click', () => {
  gErasing = !gErasing;
  gameEraserBtn.textContent = gErasing ? 'Eraser (on)' : 'Eraser';
});

gameClearBtn.addEventListener('click', () => {
  clearGameCanvas();
  socket.emit('clear-canvas');
});

function clearGameCanvas() {
  gctx.fillStyle = '#ffffff';
  gctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
}

socket.on('draw-stroke', ({ x0, y0, x1, y1, color, size }) => {
  strokeLine(x0, y0, x1, y1, color, size);
});

socket.on('clear-canvas', () => {
  clearGameCanvas();
});

// ---- Chat / guessing ----
const chatLog = document.getElementById('chat-log');
const guessForm = document.getElementById('guess-form');
const guessInput = document.getElementById('guess-input');

guessForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = guessInput.value.trim();
  if (!text) return;
  socket.emit('guess', { text });
  guessInput.value = '';
});

socket.on('chat-message', ({ system, name, text }) => {
  if (system) {
    addSystemMessage(text);
  } else {
    const div = document.createElement('div');
    div.className = 'chat-line';
    div.innerHTML = `<strong>${escapeHtmlGame(name)}:</strong> ${escapeHtmlGame(text)}`;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
});

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-line system';
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function clearChat() {
  chatLog.innerHTML = '';
}

function escapeHtmlGame(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}