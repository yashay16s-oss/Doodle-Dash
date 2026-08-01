# 🎨 Doodle Dash

A real-time multiplayer drawing & guessing game — one player sketches a secret word on a shared canvas while everyone else races to guess it in the chat. Includes room codes for private games, live score tracking, and a standalone doodle gallery for saving your favorite drawings.

## Features

- 🖌️ **Draw** — a simple canvas with color picker, brush size, eraser, and clear
- 🖼️ **Gallery** — save your doodles to a database and browse them later
- 🎮 **Play** — real-time multiplayer Pictionary-style rounds
  - Create or join a room with a 4-letter code
  - One player draws each round while others guess in the chat
  - Points awarded based on how fast you guess
  - Automatic drawer rotation and round timer

## Tech stack

- **Frontend:** Next.js (App Router), plain HTML/CSS — no UI framework
- **Backend:** Java, Spring Boot
- **Real-time sync:** raw WebSocket (rooms, drawing sync, chat/guessing)
- **Database:** H2 (file-based) via Spring Data JPA, for the drawing gallery

## Project structure

```
backend/    Spring Boot app — WebSocket game server + REST gallery API
frontend/   Next.js app — Draw / Gallery / Play UI
render.yaml Render Blueprint for deploying both services
```

## Running it locally

### Prerequisites

- Java 17+ and Maven
- Node.js 18+

### Backend (port 8080)

```bash
cd backend
mvn spring-boot:run
```

### Frontend (port 3000)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**. The frontend talks to the backend at `http://localhost:8080` by default (see `frontend/src/lib/config.js` — override with `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` env vars).

## Deploying (Render)

This repo includes a `render.yaml` Blueprint that deploys both services:

1. Create a free account at [render.com](https://render.com).
2. In the Render dashboard: **New +** → **Blueprint** → connect this GitHub repo (`Doodle-Dash`) → Render reads `render.yaml` and proposes two services: `doodledash-backend` (Docker) and `doodledash-frontend` (Node).
3. Click **Apply**. Render builds and deploys both.
4. Once both are live, check the actual URL Render assigned each service (it may differ from the `onrender.com` names guessed in `render.yaml` if those names were taken). If they differ, update:
   - `doodledash-frontend` env vars `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` → point at the backend's real URL (`https://...` and `wss://.../ws`)
   - `doodledash-backend` env var `APP_CORS_ALLOWED_ORIGIN` → the frontend's real URL
   - Redeploy both services after changing env vars.

Note: on Render's free plan there's no persistent disk, so the gallery's H2 database resets whenever the backend restarts/redeploys. Live multiplayer play (rooms, drawing, guessing) isn't affected since that's all in-memory anyway.
