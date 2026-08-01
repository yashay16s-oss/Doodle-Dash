"use client";

import { useEffect, useRef, useState } from "react";
import { createGameSocket } from "@/lib/gameSocket";

function getPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export default function Play() {
  const socketRef = useRef(null);
  const myIdRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const isDrawerRef = useRef(false);
  const chatLogRef = useRef(null);
  const timerIntervalRef = useRef(null);

  const [screen, setScreen] = useState("lobby");
  const [name, setName] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [lobbyError, setLobbyError] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [roundStatus, setRoundStatus] = useState("Waiting for players...");
  const [timerText, setTimerText] = useState("");
  const [wordBanner, setWordBanner] = useState("");
  const [isDrawer, setIsDrawer] = useState(false);
  const [chat, setChat] = useState([]);
  const [guess, setGuess] = useState("");
  const [color, setColor] = useState("#1a1a1a");
  const [brushSize, setBrushSize] = useState(5);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    const socket = createGameSocket();
    socketRef.current = socket;

    const unsubs = [
      socket.on("connected", ({ id }) => {
        myIdRef.current = id;
      }),
      socket.on("join-error", ({ message }) => setLobbyError(message)),
      socket.on("joined-room", ({ roomCode }) => {
        setRoomCode(roomCode);
        setScreen("game");
      }),
      socket.on("player-list", ({ players }) => setPlayers(players)),
      socket.on("round-start", ({ drawerId, drawerName, wordLength, seconds }) => {
        const iAmDrawer = drawerId === myIdRef.current;
        isDrawerRef.current = iAmDrawer;
        setIsDrawer(iAmDrawer);
        setRoundStatus(iAmDrawer ? "Your turn to draw!" : `${drawerName} is drawing...`);
        setWordBanner(iAmDrawer ? "" : "_ ".repeat(wordLength).trim());
        clearGameCanvas();
        setChat([]);
        addSystemMessage(`New round! ${drawerName} is drawing.`);
        setGuess("");

        let remaining = seconds;
        setTimerText(`⏱ ${remaining}s`);
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => {
          remaining -= 1;
          setTimerText(`⏱ ${Math.max(remaining, 0)}s`);
          if (remaining <= 0) clearInterval(timerIntervalRef.current);
        }, 1000);
      }),
      socket.on("your-word", ({ word }) => setWordBanner(`Your word: ${word}`)),
      socket.on("round-end", ({ word }) => {
        clearInterval(timerIntervalRef.current);
        setRoundStatus("Round over!");
        setWordBanner(`The word was: ${word}`);
        addSystemMessage(`The word was "${word}". Next round starting soon...`);
      }),
      socket.on("draw-stroke", ({ x0, y0, x1, y1, color, size }) => {
        strokeLine(x0, y0, x1, y1, color, size);
      }),
      socket.on("clear-canvas", () => clearGameCanvas()),
      socket.on("chat-message", ({ system, name, text }) => {
        if (system) {
          addSystemMessage(text);
        } else {
          appendChat({ system: false, name, text });
        }
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
      clearInterval(timerIntervalRef.current);
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSystemMessage = (text) => appendChat({ system: true, text });

  const appendChat = (entry) => {
    setChat((prev) => [...prev, entry]);
  };

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [chat]);

  const clearGameCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const strokeLine = (x0, y0, x1, y1, strokeColor, size) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  const createRoom = () => {
    const trimmed = name.trim();
    if (!trimmed) return setLobbyError("Enter your name first.");
    setLobbyError("");
    socketRef.current.emit("create-room", { name: trimmed });
  };

  const joinRoom = () => {
    const trimmed = name.trim();
    const code = roomCodeInput.trim();
    if (!trimmed) return setLobbyError("Enter your name first.");
    if (!code) return setLobbyError("Enter a room code.");
    setLobbyError("");
    socketRef.current.emit("join-room", { name: trimmed, roomCode: code });
  };

  const startGame = () => {
    socketRef.current.emit("start-game");
  };

  const onMouseDown = (e) => {
    if (!isDrawerRef.current) return;
    drawingRef.current = true;
    lastPosRef.current = getPos(canvasRef.current, e);
  };

  const onMouseMove = (e) => {
    if (!isDrawerRef.current || !drawingRef.current) return;
    const pos = getPos(canvasRef.current, e);
    const strokeColor = erasing ? "#ffffff" : color;
    strokeLine(lastPosRef.current.x, lastPosRef.current.y, pos.x, pos.y, strokeColor, brushSize);
    socketRef.current.emit("draw-stroke", {
      x0: lastPosRef.current.x,
      y0: lastPosRef.current.y,
      x1: pos.x,
      y1: pos.y,
      color: strokeColor,
      size: brushSize,
    });
    lastPosRef.current = pos;
  };

  const onMouseUp = () => {
    drawingRef.current = false;
  };

  const clearAndBroadcast = () => {
    clearGameCanvas();
    socketRef.current.emit("clear-canvas");
  };

  const sendGuess = (e) => {
    e.preventDefault();
    const text = guess.trim();
    if (!text) return;
    socketRef.current.emit("guess", { text });
    setGuess("");
  };

  return (
    <>
      <div id="lobby-screen" className={screen === "lobby" ? "" : "hidden"}>
        <div className="lobby-box">
          <h2>Play with friends</h2>
          <input
            type="text"
            placeholder="Your name"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="lobby-actions">
            <button id="create-room-btn" onClick={createRoom}>
              Create Room
            </button>
            <div className="lobby-divider">or</div>
            <div className="join-row">
              <input
                type="text"
                placeholder="ROOM CODE"
                maxLength={4}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value)}
              />
              <button id="join-room-btn" onClick={joinRoom}>
                Join
              </button>
            </div>
          </div>
          {lobbyError && <p className="lobby-error">{lobbyError}</p>}
        </div>
      </div>

      <div id="game-screen" className={screen === "game" ? "" : "hidden"}>
        <div className="game-top">
          <div className="room-code-display">
            Room: <span>{roomCode}</span>
          </div>
          <div id="round-status">{roundStatus}</div>
          <div id="timer-display">{timerText}</div>
        </div>

        <div className="game-layout">
          <div className="game-canvas-col">
            <div className={`word-banner ${wordBanner ? "" : "hidden"}`}>{wordBanner}</div>

            <div className="toolbar" id="game-toolbar" style={{ display: isDrawer ? "flex" : "none" }}>
              <label>
                Color
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </label>
              <label>
                Brush
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                />
              </label>
              <button onClick={() => setErasing((v) => !v)}>{erasing ? "Eraser (on)" : "Eraser"}</button>
              <button onClick={clearAndBroadcast}>Clear</button>
            </div>

            <canvas
              id="game-canvas"
              ref={canvasRef}
              width={700}
              height={450}
              style={{ cursor: isDrawer ? "crosshair" : "default" }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />

            <button id="start-game-btn" className={players.length < 2 ? "hidden" : ""} onClick={startGame}>
              Start Game
            </button>
          </div>

          <div className="game-side-col">
            <div className="player-panel">
              <h4>Players</h4>
              <ul id="player-list">
                {players.map((p) => (
                  <li key={p.id} className={p.id === myIdRef.current ? "me" : ""}>
                    {p.name} — {p.score} pts
                  </li>
                ))}
              </ul>
            </div>

            <div className="chat-panel">
              <div id="chat-log" ref={chatLogRef}>
                {chat.map((entry, i) => (
                  <div key={i} className={`chat-line ${entry.system ? "system" : ""}`}>
                    {entry.system ? entry.text : (
                      <>
                        <strong>{entry.name}:</strong> {entry.text}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <form id="guess-form" onSubmit={sendGuess}>
                <input
                  type="text"
                  id="guess-input"
                  placeholder={isDrawer ? "You're drawing — can't guess" : "Type your guess..."}
                  disabled={isDrawer}
                  autoComplete="off"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                />
                <button type="submit">Send</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
