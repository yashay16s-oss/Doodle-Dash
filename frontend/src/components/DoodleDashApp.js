"use client";

import { useState } from "react";
import DrawBoard from "./DrawBoard";
import Gallery from "./Gallery";
import Play from "./Play";

export default function DoodleDashApp() {
  const [view, setView] = useState("draw");

  return (
    <>
      <header>
        <h1>🎨 Doodle Dash</h1>
        <nav>
          <button className={`nav-btn ${view === "draw" ? "active" : ""}`} onClick={() => setView("draw")}>
            Draw
          </button>
          <button className={`nav-btn ${view === "gallery" ? "active" : ""}`} onClick={() => setView("gallery")}>
            Gallery
          </button>
          <button className={`nav-btn ${view === "play" ? "active" : ""}`} onClick={() => setView("play")}>
            Play
          </button>
        </nav>
      </header>

      <section className={`view ${view === "draw" ? "" : "hidden"}`}>
        <DrawBoard onSaved={() => setView("gallery")} />
      </section>

      <section className={`view ${view === "gallery" ? "" : "hidden"}`}>
        <Gallery active={view === "gallery"} />
      </section>

      <section className={`view ${view === "play" ? "" : "hidden"}`}>
        <Play active={view === "play"} />
      </section>
    </>
  );
}
