// ---- View switching ----
const navDraw = document.getElementById('nav-draw');
const navGallery = document.getElementById('nav-gallery');
const drawView = document.getElementById('draw-view');
const galleryView = document.getElementById('gallery-view');


navDraw.addEventListener('click', () => switchView('draw'));
navGallery.addEventListener('click', () => switchView('gallery'));


function switchView(view) {
  const isDraw = view === 'draw';
  drawView.classList.toggle('hidden', !isDraw);
  galleryView.classList.toggle('hidden', isDraw);
  navDraw.classList.toggle('active', isDraw);
  navGallery.classList.toggle('active', !isDraw);
  if (!isDraw) loadGallery();
}

// ---- Canvas drawing ----
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('color-picker');
const brushSize = document.getElementById('brush-size');
const eraserBtn = document.getElementById('eraser-btn');
const clearBtn = document.getElementById('clear-btn');

// Start with a white background (so saved PNGs aren't transparent)
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

let drawing = false;
let erasing = false;
let lastX = 0, lastY = 0;

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function startDraw(e) {
  drawing = true;
  const pos = getPos(e);
  lastX = pos.x;
  lastY = pos.y;
}

function draw(e) {
  if (!drawing) return;
  e.preventDefault();
  const pos = getPos(e);

  ctx.strokeStyle = erasing ? '#ffffff' : colorPicker.value;
  ctx.lineWidth = brushSize.value;
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();

  lastX = pos.x;
  lastY = pos.y;
}

function stopDraw() {
  drawing = false;
}

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseleave', stopDraw);

canvas.addEventListener('touchstart', startDraw);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDraw);

eraserBtn.addEventListener('click', () => {
  erasing = !erasing;
  eraserBtn.textContent = erasing ? 'Eraser (on)' : 'Eraser';
});

clearBtn.addEventListener('click', () => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
});

// ---- Save drawing ----
const titleInput = document.getElementById('title-input');
const authorInput = document.getElementById('author-input');
const saveBtn = document.getElementById('save-btn');

saveBtn.addEventListener('click', async () => {
  const title = titleInput.value.trim();
  if (!title) {
    alert('Give your drawing a title first!');
    return;
  }

  const imageData = canvas.toDataURL('image/png');

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/drawings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        author: authorInput.value.trim() || 'Anonymous',
        image_data: imageData
      })
    });

    if (!res.ok) throw new Error('Save failed');

    titleInput.value = '';
    authorInput.value = '';
    switchView('gallery');
  } catch (err) {
    alert('Could not save drawing. Is the server running?');
    console.error(err);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Drawing';
  }
});

// ---- Gallery ----
const galleryGrid = document.getElementById('gallery-grid');

async function loadGallery() {
  galleryGrid.innerHTML = '<p class="empty-msg">Loading...</p>';

  try {
    const res = await fetch('/api/drawings');
    const drawings = await res.json();

    if (drawings.length === 0) {
      galleryGrid.innerHTML = '<p class="empty-msg">No drawings yet — go make one!</p>';
      return;
    }

    galleryGrid.innerHTML = '';
    for (const d of drawings) {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.innerHTML = `
        <div class="gallery-card-info">
          <h4>${escapeHtml(d.title)}</h4>
          <p>by ${escapeHtml(d.author)} · ${formatDate(d.created_at)}</p>
        </div>
      `;
      card.addEventListener('click', () => openLightbox(d.id));
      galleryGrid.appendChild(card);
    }
  } catch (err) {
    galleryGrid.innerHTML = '<p class="empty-msg">Could not load gallery.</p>';
    console.error(err);
  }
}

function formatDate(iso) {
  const d = new Date(iso + 'Z'); // SQLite CURRENT_TIMESTAMP is UTC
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Lightbox ----
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxMeta = document.getElementById('lightbox-meta');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxDelete = document.getElementById('lightbox-delete');

let currentDrawingId = null;

async function openLightbox(id) {
  const res = await fetch(`/api/drawings/${id}`);
  const d = await res.json();

  currentDrawingId = id;
  lightboxImg.src = d.image_data;
  lightboxTitle.textContent = d.title;
  lightboxMeta.textContent = `by ${d.author} · ${formatDate(d.created_at)}`;
  lightbox.classList.remove('hidden');
}

lightboxClose.addEventListener('click', () => lightbox.classList.add('hidden'));
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) lightbox.classList.add('hidden');
});

lightboxDelete.addEventListener('click', async () => {
  if (!currentDrawingId) return;
  if (!confirm('Delete this drawing?')) return;

  await fetch(`/api/drawings/${currentDrawingId}`, { method: 'DELETE' });
  lightbox.classList.add('hidden');
  loadGallery();
});