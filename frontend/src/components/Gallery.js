"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/config";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Gallery({ active }) {
  const [drawings, setDrawings] = useState(null);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const loadGallery = async () => {
    setError(false);
    setDrawings(null);
    try {
      const res = await fetch(`${API_URL}/api/drawings`);
      const data = await res.json();
      setDrawings(data);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  };

  useEffect(() => {
    if (active) loadGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const openLightbox = async (id) => {
    const res = await fetch(`${API_URL}/api/drawings/${id}`);
    const d = await res.json();
    setLightbox(d);
  };

  const deleteDrawing = async () => {
    if (!lightbox) return;
    if (!confirm("Delete this drawing?")) return;
    await fetch(`${API_URL}/api/drawings/${lightbox.id}`, { method: "DELETE" });
    setLightbox(null);
    loadGallery();
  };

  return (
    <>
      <div className="gallery-grid">
        {error && <p className="empty-msg">Could not load gallery.</p>}
        {!error && drawings === null && <p className="empty-msg">Loading...</p>}
        {!error && drawings && drawings.length === 0 && (
          <p className="empty-msg">No drawings yet — go make one!</p>
        )}
        {!error &&
          drawings &&
          drawings.map((d) => (
            <div className="gallery-card" key={d.id} onClick={() => openLightbox(d.id)}>
              <div className="gallery-card-info">
                <h4>{d.title}</h4>
                <p>
                  by {d.author} · {formatDate(d.createdAt)}
                </p>
              </div>
            </div>
          ))}
      </div>

      <div className={`lightbox ${lightbox ? "" : "hidden"}`} onClick={(e) => e.target === e.currentTarget && setLightbox(null)}>
        {lightbox && (
          <div className="lightbox-content">
            <button id="lightbox-close" onClick={() => setLightbox(null)}>
              &times;
            </button>
            <img src={lightbox.imageData} alt={lightbox.title} />
            <div className="lightbox-info">
              <h3>{lightbox.title}</h3>
              <p>
                by {lightbox.author} · {formatDate(lightbox.createdAt)}
              </p>
              <button id="lightbox-delete" onClick={deleteDrawing}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
