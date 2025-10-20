// src/core/IntroSequence.js
// Orchestrates the PlayArea intro, 3-2-1 overlay, HUD/Scoreboard timing, and veil handoff.
// No behavior changes; this is a lift-and-shift with explicit init().

let gameCanvas, playArea, hud, scoreboard, bus;
let setGameReady, setVeilUnlockAt;

export const INTRO = {
  running: false,
  t0: 0,
  variant: 'wipe',
  playMs: 2000,
  stepMs: 600,
  steps: ['3', '2', '1', 'Start!'],
  _hudStarted: false,
  _sbStarted: false,
  _sbArmed: false,
  mode: 'new', // 'new' | 'revive'
  onComplete: null, // optional callback
};

export function initIntroSequence(deps) {
  ({ gameCanvas, playArea, hud, scoreboard, bus, setGameReady, setVeilUnlockAt } = deps);
}

function _chooseVariant() {
  const pool = ['wipe', 'scale', 'grid', 'assemble'];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function startIntroSequence() {
  bus?.emit('playArea/clearEdgeMasks', { animate: false, __force: true });

  INTRO.running = true;
  INTRO.t0 = performance.now();
  INTRO.variant = _chooseVariant();
  INTRO._hudStarted = false;
  INTRO._sbStarted = false;
  INTRO._sbArmed = false;

  // Lock veils until a shape/minigame requests them explicitly
  setVeilUnlockAt?.(Infinity);

  // Kick PlayArea intro + fade-in
  playArea.beginIntro(INTRO.variant, INTRO.playMs);
  playArea.fadeInBorders(INTRO.playMs);
}

function _drawCountdownOverlay(text) {
  const cx = window.playAreaX + window.playAreaSize / 2;
  const cy = window.playAreaY + window.playAreaSize / 2;
  const ctx = gameCanvas.getContext('2d');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 64px Orbitron';
  ctx.fillStyle = 'white';
  ctx.shadowColor = 'rgba(255,255,255,0.65)';
  ctx.shadowBlur = 14;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

export function runIntroOverlay() {
  if (!INTRO.running) return;

  const now = performance.now();
  const t = now - INTRO.t0;

  if (t < INTRO.playMs) {
    // PlayArea intro phase handled by playArea.draw()
    return;
  }

  // Countdown phase
  const ct = t - INTRO.playMs;
  const total = INTRO.stepMs * INTRO.steps.length;
  const idx = Math.min(INTRO.steps.length - 1, Math.floor(ct / INTRO.stepMs));

  // Arm the scoreboard (mounted & positioned, still hidden) as soon as countdown begins.
  if (!INTRO._sbArmed) {
    scoreboard.show({ armOnly: true });
    INTRO._sbArmed = true;
  }

  // Sync HUD + Scoreboard intros so they finish at the END of “Start!”
  const HUD_INTRO_MS = 850;
  const SB_INTRO_MS = 850;
  const endOfIntroMs = INTRO.stepMs * INTRO.steps.length; // end of “Start!”
  const commonStartAt = Math.max(0, endOfIntroMs - Math.max(HUD_INTRO_MS, SB_INTRO_MS));
  if (ct >= commonStartAt) {
    if (!INTRO._hudStarted) {
      INTRO._hudStarted = true;
      hud.show?.();
    }
    if (!INTRO._sbStarted) {
      INTRO._sbStarted = true;
      scoreboard.fadeIn(SB_INTRO_MS);
      scoreboard.startTypewriter?.();
    }
  }

  _drawCountdownOverlay(INTRO.steps[idx]);

  // Done → drop intro gate
  if (ct >= total) {
    INTRO.running = false;
    playArea.lockVisible();
    setGameReady?.(true);

    // Keep veils locked until an edge-hide event explicitly unlocks
    setVeilUnlockAt?.(Infinity);

    // Revive handoff or fresh-run default
    if (typeof INTRO.onComplete === 'function') {
      const fn = INTRO.onComplete;
      INTRO.onComplete = null;
      fn(); // e.g., continue run after revive
    }
  }
}
