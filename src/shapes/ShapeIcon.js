// ShapeIcon.js
// Draws *exact* miniatures by instantiating each shape class and asking it to
// render once into an offscreen canvas, with intro/animations forcibly disabled.

import { shapeRegistry } from './shapes.js';

/** Public: render a single icon into a canvas for the given shape name */
export async function renderShapeIcon(canvas, shapeName, opts = {}) {
  const entry = shapeRegistry.find((s) => s.name === shapeName);
  if (!entry || !entry.classRef) return;

  // 1) Resolve CSS size & DPR so we render crisply and avoid soft clipping
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect?.() || { width: canvas.width, height: canvas.height };
  const cssW = Math.max(1, Math.round(rect.width || canvas.width || 72));
  const cssH = Math.max(1, Math.round(rect.height || canvas.height || 72));
  const tw = cssW * dpr;
  const th = cssH * dpr;
  if (canvas.width !== tw || canvas.height !== th) {
    canvas.width = tw;
    canvas.height = th;
  }

  // 2) Offscreen render at high resolution to preserve corners/thin details
  const OS = document.createElement('canvas');
  OS.width = OS.height = 384; // larger than before for detail -> better crop fit
  const os = OS.getContext('2d', { alpha: true });
  os.setTransform(1, 0, 0, 1, 0, 0);
  os.globalCompositeOperation = 'source-over';
  os.globalAlpha = 1;
  os.filter = 'none';
  os.imageSmoothingEnabled = true;
  os.imageSmoothingQuality = 'high';

  // 3) Instantiate shape centered and in neutral "thumbnail" state
  const C = entry.classRef;
  const baseColor = entry.color || '#ffffff';
  const s = new C(OS.width / 2, OS.height / 2, OS.width * 0.43, baseColor, entry.name);
  freezeShapeForThumbnail(s, baseColor);

  // 4) Spoof PlayArea so PlayArea-aware shapes never clip during icon render
  const prev = { x: window.playAreaX, y: window.playAreaY, size: window.playAreaSize };
  window.playAreaX = 0;
  window.playAreaY = 0;
  window.playAreaSize = OS.width;

  // 5) Draw once at native resolution (guard shapes that require onStart)
  os.clearRect(0, 0, OS.width, OS.height);
  try {
    s.draw(os);
  } catch (e) {
    try {
      s.onStart?.();
      s.update?.(0);
      s.draw(os);
    } catch (_) {}
  }

  // 6) Restore globals we touched
  window.playAreaX = prev.x;
  window.playAreaY = prev.y;
  window.playAreaSize = prev.size;

  // 7) Auto-crop alpha with a safety margin, fit with final padding
  const raw = alphaBounds(OS);
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, tw, th);

  if (raw) {
    // margin protects thin wings/stems from being cropped
    const margin = Math.ceil(Math.min(raw.w, raw.h) * 0.06); // ~6% bound expansion
    const sx = Math.max(0, raw.x - margin);
    const sy = Math.max(0, raw.y - margin);
    const sw = Math.min(OS.width - sx, raw.w + margin * 2);
    const sh = Math.min(OS.height - sy, raw.h + margin * 2);

    const pad = Math.round(Math.min(tw, th) * 0.1); // ~10% breathing room
    const scale = Math.min((tw - pad * 2) / sw, (th - pad * 2) / sh);
    const dw = Math.floor(sw * scale);
    const dh = Math.floor(sh * scale);
    const dx = Math.floor((tw - dw) / 2);
    const dy = Math.floor((th - dh) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(OS, sx, sy, sw, sh, dx, dy, dw, dh);
  } else {
    // extremely rare; just center the full offscreen
    ctx.drawImage(OS, 0, 0, tw, th);
  }
}

/** Public helper: bulk render (what Vault calls) */
export function renderIconsBulk(nodeList) {
  nodeList.forEach((node) => {
    const name = node.getAttribute('data-shape');
    renderShapeIcon(node, name);
  });
}

/* ===== Helpers ===== */

function freezeShapeForThumbnail(s, baseColor) {
  // Reset geometry, if available
  if (typeof s.reset === 'function') {
    try {
      s.reset();
    } catch {}
  }

  // Force canonical base color (prevents runtime tint drift in icons)
  if (baseColor) {
    if ('baseColor' in s) s.baseColor = baseColor;
    if ('color' in s) s.color = baseColor;
  }

  // Neutral state – no intros/FX
  if ('playIntro' in s) s.playIntro = false;
  if ('introTimer' in s) s.introTimer = s.introDuration || 0;
  if ('isReadyToPlay' in s) s.isReadyToPlay = true;

  // Quieten common animation flags
  if ('shakeTime' in s) s.shakeTime = 0;
  if ('mode' in s) s.mode = 'display';
  if ('transitionProgress' in s) s.transitionProgress = 0;
  if ('guidelineFade' in s) s.guidelineFade = 0;

  // Normalize size/position if present
  if ('baseSize' in s && s.baseSize) s.size = s.baseSize;
  if (typeof s.initialX === 'number') s.x = s.initialX;
  if (typeof s.initialY === 'number') s.y = s.initialY;
}

/** Compute the tight bounding box of non-transparent pixels */
function alphaBounds(cnv) {
  const { width: w, height: h } = cnv;
  const ctx = cnv.getContext('2d', { alpha: true });
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
