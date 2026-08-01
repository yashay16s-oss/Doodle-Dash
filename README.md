# 🎨 Doodle Dash

A real-time multiplayer drawing & guessing game — one player sketches a secret word on a shared canvas while everyone else races to guess it in the chat. Includes room codes for private games, live score tracking, and a standalone doodle gallery for saving your favorite drawings.

![Doodle Dash screenshot](screenshot.png)

## Features

- 🖌️ **Draw** — a simple canvas with color picker, brush size, eraser, and clear
- 🖼️ **Gallery** — save your doodles to a database and browse them later
- 🎮 **Play** — real-time multiplayer Pictionary-style rounds
  - Create or join a room with a 4-letter code
  - One player draws each round while others guess in the chat
  - Points awarded based on how fast you guess
  - Automatic drawer rotation and round timer

## Tech stack

- **Backend:** Node.js, Express
- **Real-time sync:** Socket.io
- **Database:** SQLite (via `better-sqlite3`)
- **Frontend:** Vanilla HTML/CSS/JS, canvas API

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) (includes npm)

### Installation

```bash
git clone https://github.com/YOUR-USERNAME/doodle-dash.git
cd doodle-dash
npm install
```

### Run it

```bash
node server.js
```

Open **http://localhost:3000** in your browser.

### Play with others

- **Same WiFi network:** share your local IP (find it with `ipconfig` on Windows or `ifconfig` on Mac/Linux) — e.g. `http://192.168.1.42:3000`
- **Different networks:** use a tunneling tool like [ngrok](https://ngrok.com) to get a temporary public URL
- **Permanent public access:** deploy to a host that supports persistent Node servers, such as [Render](https://render.com) or [Railway](https://railway.app)

## Project structure