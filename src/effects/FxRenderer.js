// effects/FxRenderer.js
import OverlayFX from '../libs/OverlayFX.js';

let fxCanvas, fxCtx;
let overlayFX = null;

// Intro gate + unlock timer (lives here now)
let getIntroRunning = () => false;
let getGameReady = () => false;
let EDGE_VEIL_UNLOCK_AT = 0;

// Default veil timings (used by shapes/PlayArea via window.*)
function ensureGlobalTimings() {
  if (typeof window.EDGE_VEIL_MS !== 'number') window.EDGE_VEIL_MS = 3000;
  if (typeof window.EDGE_VEIL_OUTRO_MS !== 'number') window.EDGE_VEIL_OUTRO_MS = 180;
  if (typeof window.EDGE_VEIL_EASE !== 'string') window.EDGE_VEIL_EASE = 'linear';
  if (typeof window.EDGE_VEIL_OUTRO_PADDLE_MS !== 'number') window.EDGE_VEIL_OUTRO_PADDLE_MS = 200;
}

function resize() {
  if (!fxCanvas) return;
  fxCanvas.width = window.innerWidth;
  fxCanvas.height = window.innerHeight;
}

export function setVeilUnlockAt(ms) {
  EDGE_VEIL_UNLOCK_AT = ms | 0;
}
export function isVeilUnlocked() {
  return performance.now() >= EDGE_VEIL_UNLOCK_AT;
}

export function configureVeil(bus, opts = {}) {
  // (optional) allow overrides/reads
  if (opts.getGameReady) getGameReady = opts.getGameReady;
  if (opts.isIntroRunning) getIntroRunning = opts.isIntroRunning;

  // Fresh scope: nothing renders until an edge gets hidden once
  bus.on('playArea/edgeScope', () => {
    EDGE_VEIL_UNLOCK_AT = Infinity;
  });

  // Any edge-hide unlocks drawing immediately
  [
    'playArea/hideTopEdge',
    'playArea/hideBottomEdge',
    'playArea/hideLeftEdge',
    'playArea/hideRightEdge',
  ].forEach((evt) =>
    bus.on(evt, () => {
      EDGE_VEIL_UNLOCK_AT = performance.now() - 1;
    })
  );

  // Clear masks when a shape completes (with a short outro)
  bus.on('shape:complete', () => {
    if (!getGameReady?.()) return;
    bus.emit('playArea/clearEdgeMasks', { animate: true, outMs: 220 });
  });

  // Every mini-game start forces a clean scope so nothing carries over
  bus.on('minigame:start', () => {
    bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
    bus.emit('playArea/edgeScope');
  });

  // Small celebratory “burst” hooks (safe if not visually implemented)
  bus.on('minigame:win', () => burstScore());
  bus.on('infinite:cycle', () => burstScore());
}

export function init({ playArea, bus, isIntroRunning }) {
  getIntroRunning = typeof isIntroRunning === 'function' ? isIntroRunning : () => false;
  ensureGlobalTimings();

  fxCanvas = document.getElementById('fxCanvas');
  if (!fxCanvas) {
    fxCanvas = document.createElement('canvas');
    fxCanvas.id = 'fxCanvas';
    fxCanvas.style.cssText = `
      position:fixed; inset:0; z-index:12; pointer-events:none;
      width:100vw; height:100vh;
    `;
    document.body.appendChild(fxCanvas);
  }
  fxCtx = fxCanvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize, { passive: true });

  overlayFX = new OverlayFX({ fxCtx, playArea, bus, color: '#FFFFFF' });
}

export function clear() {
  try {
    fxCtx?.clearRect(0, 0, fxCanvas?.width || 0, fxCanvas?.height || 0);
  } catch {}
  try {
    overlayFX?.clear?.();
  } catch {}
}

export function burstScore(/* color? */) {
  // Placeholder; implement particle burst here if/when you want.
  // Keeping this as a no-op avoids errors while still centralizing the hook.
}

export function render({ playArea, gameReady }) {
  if (!fxCtx) return;

  // clear once per frame
  fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // 1) PlayArea intro (on FX)
  playArea.drawIntroFX(fxCtx);

  // 2) During countdown, keep a static border visible
  if (getIntroRunning() && !playArea.isIntroAnimating()) {
    playArea.drawStaticFXBorder(fxCtx, { useFade: false });
  }

  // 3) Infinite-mode glow (wide halo + core)
  playArea.drawGlowFX(fxCtx);

  // 4) Static border during gameplay
  if (!getIntroRunning()) {
    playArea.drawStaticFXBorder(fxCtx, { useFade: true });
  }

  // 5) Edge masks (after intro handoff and unlock)
  const canRenderEdges = !getIntroRunning() && isVeilUnlocked() && !!gameReady;
  if (canRenderEdges) {
    overlayFX.render();
  }
}

export default { init, render, clear, configureVeil, setVeilUnlockAt, isVeilUnlocked, burstScore };
