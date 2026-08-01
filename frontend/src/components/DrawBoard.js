"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/config";

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

export default function DrawBoard({ onSaved }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const [color, setColor] = useState("#1a1a1a");
  const [brushSize, setBrushSize] = useState(5);
  const [erasing, setErasing] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  }, []);

  const startDraw = (e) => {
    drawingRef.current = true;
    lastPosRef.current = getPos(canvasRef.current, e);
  };

  const draw = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const pos = getPos(canvas, e);

    ctx.strokeStyle = erasing ? "#ffffff" : color;
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPosRef.current = pos;
  };

  const stopDraw = () => {
    drawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const save = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      alert("Give your drawing a title first!");
      return;
    }

    const imageData = canvasRef.current.toDataURL("image/png");
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/drawings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          author: author.trim() || "Anonymous",
          image_data: imageData,
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      setTitle("");
      setAuthor("");
      onSaved?.();
    } catch (err) {
      alert("Could not save drawing. Is the backend running on port 8080?");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="toolbar">
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

        <button className={erasing ? "active" : ""} onClick={() => setErasing((v) => !v)}>
          {erasing ? "Eraser (on)" : "Eraser"}
        </button>
        <button onClick={clearCanvas}>Clear</button>
      </div>

      <canvas
        id="canvas"
        ref={canvasRef}
        width={800}
        height={500}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />

      <div className="save-bar">
        <input
          type="text"
          placeholder="Give it a title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="text"
          placeholder="Your name (optional)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />
        <button id="save-btn" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Drawing"}
        </button>
      </div>
    </>
  );
}
