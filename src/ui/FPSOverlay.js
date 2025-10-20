// ui/FPSOverlay.js
let FPS_OVERLAY_ON = localStorage.getItem('DBG_FPS_OVERLAY') === '1';
let fpsOverlayEl = null;
let lastTextAt = 0;

export function ensureFPSOverlay() {
  if (fpsOverlayEl) return fpsOverlayEl;
  const el = document.createElement('div');
  el.id = 'fpsOverlay';
  el.style.cssText = `
    position:fixed; top:8px; left:50%; transform:translateX(-50%);
    z-index:100; font: 700 16px Orbitron, sans-serif;
    color:#fff; text-shadow:0 2px 6px #000;
    pointer-events:none; opacity:0.95;
  `;
  el.textContent = '60 FPS';
  document.body.appendChild(el);
  fpsOverlayEl = el;
  el.style.display = FPS_OVERLAY_ON ? 'block' : 'none';
  return el;
}
export function setFPSOverlay(on) {
  FPS_OVERLAY_ON = !!on;
  localStorage.setItem('DBG_FPS_OVERLAY', on ? '1' : '0');
  ensureFPSOverlay().style.display = on ? 'block' : 'none';
}
export function getFPSOverlay() {
  return FPS_OVERLAY_ON;
}
export function updateFPS(value) {
  if (!FPS_OVERLAY_ON) return;
  const now = performance.now();
  if (now - lastTextAt < 250) return; // throttle updates
  ensureFPSOverlay().textContent = `${value} FPS`;
  lastTextAt = now;
}
