// the old main.js is this whole file
import ProfileStore from './libs/ProfileStore.js';
import StatsTracker from './libs/StatsTracker.js';
import DebugMenu from './ui/DebugMenu.js';
import OverlayFX from './libs/OverlayFX.js';
import PlayArea from './PlayArea.js';
import EventBus from './libs/EventBus.js';
import Analytics from './libs/Analytics.js';
import ScoreSystem from './libs/ScoreSystem.js';
import ShapeManager from './ShapeManager.js';
window.__ShapeManagerSilentInit = true;
import { Shape } from './shapes/Shape.js';
import MiniGameManager from './MiniGameManager.js';
import { miniGameRegistry } from './minigames/miniGames.js';
import Hotbar from './ui/Hotbar.js';
import UpgradeManager, { UPGRADE_PRICES } from './UpgradeManager.js';
import { Upgrade, registerUpgrade } from './libs/UpgradeLibrary.js';
import PowerUpManager from './PowerUpManager.js';
import { getPowerUpById, getAllPowerUpIds } from './libs/PowerUpLibrary.js';
import HUD from './ui/HUD.js';
import Router from './ui/Router.js';
import TitleScreen from './ui/TitleScreen.js';
import MainMenu from './ui/MainMenu.js';
import Shop from './ui/Shop.js';
import Profile from './ui/Profile.js';
import Vault from './ui/Vault.js';
import Settings from './ui/Settings.js';
import Jukebox from './ui/Jukebox.js';
import MasteryManager from './libs/MasteryManager.js';

// DEV guard — set in index.html  (dev builds only)
const DEV = !!window.__DEV__;
let DEBUG_SPEED = 1; // 1.0x by default (dev-only override via Debug Menu)
let clockSec = 0; // scaled internal clock (sec)
const clockNowSec = () => clockSec;
const clockReset = () => {
  clockSec = 0;
};

let totalShapesCompleted = 0; // run-wide tally (resets only at startGame)
// --- FPS tracker (EMA-smoothed, independent of DEBUG_SPEED) ---
let fpsEMA = 60;
const FPS_ALPHA = 0.12; // smoothing (0.05–0.2 is good)
let fpsLastUpdateMs = 0;

// --- PERF core --------------------------------------------------------------
const PERF = {
  spikeTimes: [], // timestamps (ms) for frames <45 FPS
  buckets: { update: [], playArea: [], fx: [], hud: [] }, // ring-buffers of ms
  max: 90, // store last N frame samples per bucket
  longTasks: 0,
};

function perfPush(bucket, ms) {
  const arr = PERF.buckets[bucket];
  if (!arr) return;
  arr.push(ms);
  if (arr.length > PERF.max) arr.shift();
}
function perfAvg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function getPerfSnapshot() {
  const now = performance.now();
  // spikes in the last 3000ms
  while (PERF.spikeTimes.length && now - PERF.spikeTimes[0] > 3000) PERF.spikeTimes.shift();
  const buckets = {};
  for (const k of Object.keys(PERF.buckets)) buckets[k] = perfAvg(PERF.buckets[k]);
  return {
    fps: Math.round(fpsEMA),
    spikes3s: PERF.spikeTimes.length,
    longTasks: PERF.longTasks,
    buckets,
    memoryMB: getMemoryMB(),
  };
}
function getMemoryMB() {
  try {
    const m = performance.memory;
    if (!m) return null;
    return Math.round((m.usedJSHeapSize / 1048576) * 10) / 10;
  } catch {
    return null;
  }
}
function perfMeasure(bucket, fn) {
  const s = performance.now();
  const r = fn();
  const e = performance.now();
  const ms = e - s;
  perfPush(bucket, ms);
  // keep last-measured values per bucket for CSV rows
  PERF.last = PERF.last || { update: 0, playArea: 0, fx: 0, hud: 0 };
  PERF.last[bucket] = ms;
  return r;
}
// Long task observer (main-thread stalls >50ms)
(function hookLongTasks() {
  try {
    if ('PerformanceObserver' in window) {
      const types = PerformanceObserver.supportedEntryTypes || [];
      if (types.includes && types.includes('longtask')) {
        const po = new PerformanceObserver((list) => {
          PERF.longTasks += list.getEntries().length;
        });
        po.observe({ entryTypes: ['longtask'] });
      }
    }
  } catch {}
})();

// --- PERF CSV capture (dev-only; built lazily) ------------------------------
const PERFCSV = {
  enabled: false, // toggled from Debug Menu
  capturing: false, // true only during a run if enabled
  ready: false, // set when run:end fires
  runId: 0,
  startTs: 0,
  endTs: 0,
  frames: [], // per-frame rows (only if enabled)
  events: [], // key game events while capturing
  meta: {}, // device/canvas/settings snapshot
  generatedUrl: null, // blob URL when we build CSV
};
let __perfFrameIndex = 0;
let __RUN_IN_PROGRESS = false;

function setPerfCsvEnabled(on) {
  PERFCSV.enabled = !!on;
  // if a run is active, honor the toggle immediately
  PERFCSV.capturing = !!on && __RUN_IN_PROGRESS;
}
function getPerfCsvStatus() {
  return {
    enabled: PERFCSV.enabled,
    capturing: PERFCSV.capturing,
    ready: PERFCSV.ready,
    frames: PERFCSV.frames.length,
    events: PERFCSV.events.length,
    runId: PERFCSV.runId,
  };
}
function perfLogEvent(evt, extra = {}) {
  if (!PERFCSV.capturing) return;
  PERFCSV.events.push({ ts: Date.now(), evt, ...extra });
}
function buildPerfCSV() {
  if (!PERFCSV.ready) return null;
  try {
    if (PERFCSV.generatedUrl) URL.revokeObjectURL(PERFCSV.generatedUrl);
  } catch {}
  const rid = PERFCSV.runId;
  const rows = [];
  const iso = (ts) => new Date(ts).toISOString();
  const m = PERFCSV.meta || {};
  rows.push(
    [
      'type',
      'ts_iso',
      'run_id',
      'level',
      'cycle',
      'shape',
      'behavior',
      'event',
      'frame',
      'dt_raw_ms',
      'dt_scaled_ms',
      'fps',
      'fps_ema',
      'upd_ms',
      'play_ms',
      'fx_ms',
      'hud_ms',
      'spikes3s',
      'longTasks',
      'mem_mb',
      'canvas_w',
      'canvas_h',
      'dpr',
      'speed',
      'score',
    ].join(',')
  );
  // start meta
  rows.push(
    [
      'meta',
      iso(PERFCSV.startTs),
      rid,
      '',
      '',
      '',
      '',
      'run_start',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      m.canvasW || '',
      m.canvasH || '',
      m.dpr || '',
      m.speed || '',
      typeof score !== 'undefined' ? score : '',
    ].join(',')
  );
  // frames
  for (const f of PERFCSV.frames) {
    rows.push(
      [
        'frame',
        iso(f.t),
        rid,
        f.level ?? '',
        f.cycle ?? '',
        '',
        '',
        '',
        f.i,
        f.rawDt?.toFixed(3),
        f.dt?.toFixed(3),
        f.fps?.toFixed(2),
        f.fpsE?.toFixed(2),
        f.upd?.toFixed(3),
        f.play?.toFixed(3),
        f.fx?.toFixed(3),
        f.hud?.toFixed(3),
        f.spikes3s ?? '',
        f.longTasks ?? '',
        f.memMB ?? '',
        m.canvasW || '',
        m.canvasH || '',
        m.dpr || '',
        m.speed || '',
        f.score ?? '',
      ].join(',')
    );
  }
  // events
  for (const e of PERFCSV.events) {
    rows.push(
      [
        'event',
        iso(e.ts),
        rid,
        e.level ?? '',
        e.cycle ?? '',
        e.shape ?? '',
        e.behavior ?? '',
        e.evt,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        m.canvasW || '',
        m.canvasH || '',
        m.dpr || '',
        m.speed || '',
        '',
      ].join(',')
    );
  }
  // end meta
  rows.push(
    [
      'meta',
      iso(PERFCSV.endTs),
      rid,
      '',
      '',
      '',
      '',
      'run_end',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      m.canvasW || '',
      m.canvasH || '',
      m.dpr || '',
      m.speed || '',
      typeof score !== 'undefined' ? score : '',
    ].join(',')
  );
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  PERFCSV.generatedUrl = url;
  return { url, bytes: blob.size, rows: rows.length, fileName: `perf_run_${rid}.csv` };
}

function percentile(arr, p) {
  if (!arr || !arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  const idx = Math.max(0, Math.min(a.length - 1, Math.floor((p / 100) * (a.length - 1))));
  return a[idx];
}
function mean(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function round(n, d = 2) {
  const k = Math.pow(10, d);
  return Math.round(n * k) / k;
}

/**
 * Builds a quick, in-memory summary (object) from the current PERFCSV buffers.
 * Does NOT build or download any file; used by the Debug Menu “CSV Quick Summary” box.
 */
function buildPerfSummary() {
  if (!PERFCSV || !PERFCSV.ready) return null;
  const frames = PERFCSV.frames || [];
  const events = PERFCSV.events || [];
  const m = PERFCSV.meta || {};
  const durMs = Math.max(0, (PERFCSV.endTs || 0) - (PERFCSV.startTs || 0));

  const rawDt = frames.map((f) => +f.rawDt || 0);
  const fps = frames.map((f) => +f.fps || 0);
  const upd = frames.map((f) => +f.upd || 0);
  const play = frames.map((f) => +f.play || 0);
  const fx = frames.map((f) => +f.fx || 0);
  const hud = frames.map((f) => +f.hud || 0);
  const mem = frames
    .map((f) => (typeof f.memMB === 'number' ? f.memMB : NaN))
    .filter(Number.isFinite);

  // Top 10 worst frames by raw dt
  const worst = frames
    .slice()
    .sort((a, b) => (b.rawDt || 0) - (a.rawDt || 0))
    .slice(0, 10)
    .map((f) => ({
      frame: f.i,
      dt_ms: round(f.rawDt, 3),
      fps: round(f.fps, 2),
      upd: round(f.upd, 3),
      play: round(f.play, 3),
      fx: round(f.fx, 3),
      hud: round(f.hud, 3),
      ts_iso: new Date(f.t).toISOString(),
    }));

  // Event counts by type
  const evtCounts = {};
  for (const e of events) {
    evtCounts[e.evt] = (evtCounts[e.evt] || 0) + 1;
  }

  const summary = {
    run: {
      runId: PERFCSV.runId,
      duration_s: round(durMs / 1000, 2),
      frames: frames.length,
      events: events.length,
      canvas: { w: m.canvasW || 0, h: m.canvasH || 0, dpr: m.dpr || 1 },
      speed: m.speed || 1,
    },
    frame_time_ms: {
      avg: round(mean(rawDt)),
      p50: round(percentile(rawDt, 50)),
      p95: round(percentile(rawDt, 95)),
      p99: round(percentile(rawDt, 99)),
    },
    fps: {
      avg: round(mean(fps), 2),
      p50: round(percentile(fps, 50), 2),
      p05: round(percentile(fps, 5), 2), // low tail
    },
    buckets_ms_avg: {
      update: round(mean(upd), 2),
      playArea: round(mean(play), 2),
      fx: round(mean(fx), 2),
      hud: round(mean(hud), 2),
    },
    buckets_ms_p95: {
      update: round(percentile(upd, 95), 2),
      playArea: round(percentile(play, 95), 2),
      fx: round(percentile(fx, 95), 2),
      hud: round(percentile(hud, 95), 2),
    },
    memory_mb: mem.length
      ? { min: round(Math.min(...mem), 1), max: round(Math.max(...mem), 1) }
      : null,
    spikes_last3s_at_end: PERF.spikeTimes ? PERF.spikeTimes.length : 0,
    longTasks_total: PERF.longTasks || 0,
    events_by_type: evtCounts,
    worst_frames: worst,
  };

  return summary;
}

let FPS_OVERLAY_ON = localStorage.getItem('DBG_FPS_OVERLAY') === '1';
let fpsOverlayEl = null;

function ensureFPSOverlay() {
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
function setFPSOverlay(on) {
  FPS_OVERLAY_ON = !!on;
  localStorage.setItem('DBG_FPS_OVERLAY', on ? '1' : '0');
  ensureFPSOverlay().style.display = on ? 'block' : 'none';
}
function getFPSOverlay() {
  return FPS_OVERLAY_ON;
}
function getFPS() {
  return fpsEMA;
}

let __runStartMs = performance.now();
function __getRunSeconds() {
  return (performance.now() - __runStartMs) / 1000;
}

// Lazy-load the shapes registry to avoid a big fetch burst at boot
let shapeRegistry = [];
async function loadShapeRegistry() {
  if (shapeRegistry.length) return shapeRegistry;
  try {
    const mod = await import('./shapes/shapes.js');
    shapeRegistry = mod.shapeRegistry || [];
  } catch (err) {
    console.warn('[shapes] registry failed to load:', err);
  }
  return shapeRegistry;
}
const TRANSITION_DELAY = 0; // ms, set to 0 for no delay
// Game canvas setup
const gameCanvas = document.getElementById('gameCanvas');
const gameCtx = gameCanvas.getContext('2d');
gameCanvas.width = 800;
gameCanvas.height = 600;

// Universal veil intro/outro and easing
window.EDGE_VEIL_MS = 3000; // intro speed (match Circle paddle)
window.EDGE_VEIL_OUTRO_MS = 180; // quick reverse
window.EDGE_VEIL_EASE = 'cubic'; // smooth in/out

// Scoreboard canvas setup (Hi-DPI)
const scoreboardCanvas = document.createElement('canvas');
scoreboardCanvas.id = 'scoreboardCanvas';
scoreboardCanvas.style.position = 'absolute';
scoreboardCanvas.style.zIndex = '12';
scoreboardCanvas.style.pointerEvents = 'none'; // ✨ let clicks pass through
document.body.appendChild(scoreboardCanvas);
const scoreboardCtx = scoreboardCanvas.getContext('2d', { alpha: true });

// Scale for devicePixelRatio so text is crisp and stable
let SCOREBOARD_CSS_W = 300;
const SCOREBOARD_CSS_H = 50;
const SCOREBOARD_DPR = Math.max(1, window.devicePixelRatio || 1);
scoreboardCanvas.width = Math.round(SCOREBOARD_CSS_W * SCOREBOARD_DPR);
scoreboardCanvas.height = Math.round(SCOREBOARD_CSS_H * SCOREBOARD_DPR);
scoreboardCanvas.style.width = SCOREBOARD_CSS_W + 'px';
scoreboardCanvas.style.height = SCOREBOARD_CSS_H + 'px';
scoreboardCtx.setTransform(SCOREBOARD_DPR, 0, 0, SCOREBOARD_DPR, 0, 0);
scoreboardCanvas.style.opacity = '0';
scoreboardCanvas.style.transition = 'opacity 0.5s ease-in-out';
const px = (v) => Math.round(v * SCOREBOARD_DPR) / SCOREBOARD_DPR;
const SCORE_FMT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// --- Score POPUP canvas (separate layer placed above the scoreboard) ---
let POPUP_CSS_W = SCOREBOARD_CSS_W;
const POPUP_CSS_H = 72;
const scorePopupCanvas = document.createElement('canvas');
scorePopupCanvas.id = 'scorePopupCanvas';
scorePopupCanvas.style.position = 'absolute';
scorePopupCanvas.style.zIndex = '13';
scorePopupCanvas.style.pointerEvents = 'none';
document.body.appendChild(scorePopupCanvas);

const scorePopupCtx = scorePopupCanvas.getContext('2d', { alpha: true });

// Hi-DPI scale (match scoreboard DPR)
scorePopupCanvas.width = Math.round(POPUP_CSS_W * SCOREBOARD_DPR);
scorePopupCanvas.height = Math.round(POPUP_CSS_H * SCOREBOARD_DPR);
scorePopupCanvas.style.width = POPUP_CSS_W + 'px';
scorePopupCanvas.style.height = POPUP_CSS_H + 'px';
scorePopupCtx.setTransform(SCOREBOARD_DPR, 0, 0, SCOREBOARD_DPR, 0, 0);
// --- Fullscreen FX canvas (particles can fly beyond popup bounds) ---
const fxCanvas = document.createElement('canvas');
fxCanvas.id = 'fxCanvas';
fxCanvas.style.position = 'fixed';
fxCanvas.style.top = '0';
fxCanvas.style.left = '0';
fxCanvas.style.width = '100vw';
fxCanvas.style.height = '100vh';
fxCanvas.style.pointerEvents = 'none';
fxCanvas.style.zIndex = '11';
document.body.appendChild(fxCanvas);

const fxCtx = fxCanvas.getContext('2d', { alpha: true });

function resizeFxCanvas() {
  // Use the actual DPR (can be < 1 when zoomed out) so 1 CSS px maps cleanly.
  const dpr = window.devicePixelRatio || 1;
  fxCanvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
  fxCanvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
  // 1 canvas unit == 1 CSS px
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resizeFxCanvas();
window.addEventListener('resize', resizeFxCanvas);
// Reconfigure FX canvas whenever DPR changes (zoom in/out)
(function watchDPR() {
  let last = window.devicePixelRatio || 1;
  const onChange = () => {
    resizeFxCanvas();
    rearm();
  };
  const rearm = () => {
    try {
      mq.removeEventListener('change', onChange);
    } catch (_) {}
    watchDPR();
  };
  const mq = window.matchMedia(`(resolution: ${last}dppx)`);
  if (mq && mq.addEventListener) mq.addEventListener('change', onChange);
})();

function setScoreboardWidth(cssW) {
  // clamp between 300 and playAreaSize
  const target = Math.max(300, Math.min(cssW, playAreaSize));

  // scoreboard
  SCOREBOARD_CSS_W = target;
  scoreboardCanvas.width = Math.round(SCOREBOARD_CSS_W * SCOREBOARD_DPR);
  scoreboardCanvas.style.width = SCOREBOARD_CSS_W + 'px';
  // reapply DPR transform (resize resets it)
  scoreboardCtx.setTransform(SCOREBOARD_DPR, 0, 0, SCOREBOARD_DPR, 0, 0);

  // popup (match scoreboard width)
  POPUP_CSS_W = SCOREBOARD_CSS_W;
  scorePopupCanvas.width = Math.round(POPUP_CSS_W * SCOREBOARD_DPR);
  scorePopupCanvas.style.width = POPUP_CSS_W + 'px';
  scorePopupCtx.setTransform(SCOREBOARD_DPR, 0, 0, SCOREBOARD_DPR, 0, 0);

  // keep right edges aligned with the play area
  updateScoreboardPosition();
  updateScorePopupPosition();
}

// Position the popup canvas near the scoreboard, but never off-screen
function updateScorePopupPosition() {
  const sb = scoreboardCanvas.getBoundingClientRect();

  // keep the left edges aligned
  scorePopupCanvas.style.left = sb.left + 'px';

  // try to sit above the scoreboard; if that would be off-screen, overlap it
  const desiredTop = sb.top - POPUP_CSS_H; // "above" position
  const clampedTop = Math.max(0, desiredTop);
  scorePopupCanvas.style.top = clampedTop + 'px';
}

updateScorePopupPosition();
window.addEventListener('resize', updateScorePopupPosition);
window.addEventListener('scroll', updateScorePopupPosition, { passive: true });

function showScoreboard() {
  // idempotent guard
  if (scoreboardCanvas.style.display === 'block' && scoreboardCanvas.style.opacity === '1') return;

  // Make it measurable first (display:none → getBoundingClientRect() is 0)
  scoreboardCanvas.style.display = 'block';

  // position both layers on the next layout frame, then again one frame later
  // (covers font load / CSS transitions that can shift metrics)
  requestAnimationFrame(() => {
    updateScoreboardPosition();
    updateScorePopupPosition();
    requestAnimationFrame(() => {
      updateScoreboardPosition();
      updateScorePopupPosition();
    });
    // finally fade in
    scoreboardCanvas.style.opacity = '1';
  });
}

function hideScoreboard() {
  scoreboardCanvas.style.opacity = '0';
  setTimeout(() => {
    scoreboardCanvas.style.display = 'none';
  }, 500); // match HUD
}

function fadeScoreboardIn(ms = 500) {
  if (!scoreboardCanvas) return;
  scoreboardCanvas.style.display = 'block';
  scoreboardCanvas.style.transition = `opacity ${ms}ms cubic-bezier(.22,.61,.36,1)`;

  // Ensure correct anchoring right as we start the fade
  updateScoreboardPosition();
  updateScorePopupPosition();

  // And once more on the next frame (handles late font/layout changes)
  requestAnimationFrame(() => {
    updateScoreboardPosition();
    updateScorePopupPosition();
  });

  scoreboardCanvas.style.opacity = '1';
}

function fadeScoreboardOut(ms = 500) {
  if (!scoreboardCanvas) return;
  scoreboardCanvas.style.transition = `opacity ${ms}ms cubic-bezier(.22,.61,.36,1)`;
  scoreboardCanvas.style.opacity = '0';
}

// ─── Scoreboard label + number typewriter ────────────────────────────────────
const SB_TYPE = {
  running: false,
  t0: 0,
  // slower & smoother timing
  perChar: 110, // ms per label character
  numPerChar: 95, // ms per number character
  stagger: 180, // "Best:" starts after "Score:"
  numDelay: 160, // numbers start after their labels

  scoreChars: 0,
  bestChars: 0,
  scoreNumChars: 0,
  bestNumChars: 0,
};

function startScoreboardTypewriter(totalMs = 800) {
  SB_TYPE.running = true;
  SB_TYPE.t0 = performance.now();
  SB_TYPE.scoreChars = SB_TYPE.bestChars = 0;
  SB_TYPE.scoreNumChars = SB_TYPE.bestNumChars = 0;
}

function resetScoreboardTypewriter() {
  SB_TYPE.running = false;
  SB_TYPE.t0 = 0;
  SB_TYPE.scoreChars = SB_TYPE.bestChars = 0;
  SB_TYPE.scoreNumChars = SB_TYPE.bestNumChars = 0;
}

// cubic in-out → returns how many chars to reveal
function smoothCount(elapsedMs, perCharMs, totalChars, delayMs = 0) {
  const t = Math.max(0, elapsedMs - delayMs);
  const total = Math.max(1, perCharMs * totalChars);
  let p = Math.max(0, Math.min(1, t / total));
  // easeInOutCubic
  p = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  return Math.floor(p * totalChars + 1e-6);
}

// Per-character pop timing + indices
const SB_POP = {
  scoreLblIdx: -1,
  scoreLblT: 0,
  bestLblIdx: -1,
  bestLblT: 0,
  scoreNumIdx: -1,
  scoreNumT: 0,
  bestNumIdx: -1,
  bestNumT: 0,
};
const POP_MS = 260;

function popScale01(t) {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.6) {
    // grow 0.70 -> 1.08 (ease-out)
    const p = t / 0.6;
    return 0.7 + 0.38 * (1 - Math.pow(1 - p, 3));
  } else {
    // settle 1.08 -> 1.00 (ease-in)
    const p = (t - 0.6) / 0.4;
    return 1.08 - 0.08 * (p * p);
  }
}

// --- Score popups (float above score) ---
const SCORE_POPUP_LIFE_MS = 1200; // duration (smoother fade)
const SCORE_POPUP_RISE_PX = 24; // how far it floats up
const SCORE_POPUP_MIN = 5; // ignore tiny ticks
const scorePopups = []; // active popups
const scoreParticles = []; // tiny burst particles for popups
const ENABLE_SCORE_BURSTS = false; // 🔕 soft-remove particle bursts
const PARTICLE_BURST_COUNT = 18; // (kept for later when re-enabled)

const REASON_COLORS = {
  'shape:clear': '#7CFC00', // lime
  'minigame:win': '#FFD700', // gold
  'infinite:cycle': '#00FFFF', // cyan
  'powerup:overflow': '#FF69B4', // pink
  interaction: '#FFFFFF', // white
  default: '#FFFFFF',
};
function ensureVisible(color) {
  const c = (color || '').toLowerCase().trim();
  // Treat pure hex black as "too dark"; lift to a readable near-black
  if (c === '#000000' || c === '#000') return '#262626';
  return color;
}

function getShapeColorByName(name) {
  const s = shapeRegistry.find((sh) => sh.name === name);
  return s?.color || '#FFFFFF';
}
function randomBrightColor() {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h}, 100%, 65%)`;
}
let lastShapeCompleteColor = '#FFFFFF';

function spawnScorePopup(delta, info = {}) {
  if (!Number.isFinite(delta)) return;
  if (Math.abs(delta) < SCORE_POPUP_MIN) return; // filter drip/ticks
  const now = performance.now();
  const reason = info.reason || 'default';

  // Color per mapping
  let color;
  switch (reason) {
    case 'shape:clear': {
      // Prefer explicit info, then event-captured color, then current shape, then white
      const byInfo =
        info.color || info.shapeColor || (info.name ? getShapeColorByName(info.name) : null);
      const byCurrent = shapeManager?.getCurrentShapeName
        ? getShapeColorByName(shapeManager.getCurrentShapeName())
        : null;
      color = byInfo || lastShapeCompleteColor || byCurrent || '#FFFFFF';
      break;
    }
    case 'minigame:win':
    case 'infinite:cycle':
      color = randomBrightColor();
      break;
    case 'powerup:overflow':
    case 'interaction':
      color = '#FFFFFF';
      break;
    default:
      color = REASON_COLORS[reason] || REASON_COLORS.default;
  }

  color = ensureVisible(color);
  scorePopups.push({
    born: now,
    life: SCORE_POPUP_LIFE_MS,
    amount: delta,
    reason,
    color,
  });
  // ensure popup canvas is visible (drainOverlays() hides it between runs)
  if (scorePopupCanvas.style.display !== 'block') {
    scorePopupCanvas.style.display = 'block';
    scorePopupCanvas.style.opacity = '1';
  }
  // brighter, faster light-burst near the popup text origin (viewport space)
  const sb = scoreboardCanvas.getBoundingClientRect();
  const originX = sb.right - 12;
  const originY = sb.top - 6;

  if (ENABLE_SCORE_BURSTS) {
    for (let i = 0; i < PARTICLE_BURST_COUNT; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      const speed = 90 + Math.random() * 220;
      scoreParticles.push({
        /* unchanged fields */ x: originX - Math.random() * 6,
        y: originY,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        born: now,
        life: 650 + Math.random() * 350,
        size: 2.5 + Math.random() * 2.0,
        color,
      });
    }
  }
}

function spawnParticleBurst(color) {
  if (!ENABLE_SCORE_BURSTS) return; // 🔕 disabled
  color = ensureVisible(color);
  const sb = scoreboardCanvas.getBoundingClientRect();
  const originX = sb.right - 12;
  const originY = sb.top - 6;
  const now = performance.now();

  for (let i = 0; i < PARTICLE_BURST_COUNT; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
    const speed = 90 + Math.random() * 220;
    scoreParticles.push({
      x: originX - Math.random() * 6,
      y: originY,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      born: now,
      life: 650 + Math.random() * 350,
      size: 2.5 + Math.random() * 2.0,
      color,
    });
  }
}

const LOG_SCORE = localStorage.getItem('LOG_SCORE') === '1';
const LOG_SCORE_TICKS = localStorage.getItem('LOG_SCORE_TICKS') === '1';

// --- Demo upgrade jewels (neutral names) ---
class ScoreBoost extends Upgrade {
  id = 'score_boost';
  name = 'Score +5%';
  icon = '➕';
  maxLevel = 1;
  apply(game, level) {
    window.scoreMultiplier = 1 + 0.05;
  }
}
class TimebarBoost extends Upgrade {
  id = 'timebar_boost';
  name = 'Time +10%';
  icon = '⏱️';
  maxLevel = 1;
  apply(game, level) {
    window.timeBonus = 1 + 0.1;
  }
}
class FailShield extends Upgrade {
  id = 'fail_shield';
  name = 'Shield';
  icon = '🛡️';
  maxLevel = 1;
  apply(game, level) {
    window.mistakeShields = (window.mistakeShields || 0) + 1;
  }
}
class DemoGlow extends Upgrade {
  id = 'demo_glow';
  name = 'Glow';
  icon = '✨';
  maxLevel = 1;
  apply(game, level) {
    /* no-op placeholder */
  }
}
class DemoTrail extends Upgrade {
  id = 'demo_trail';
  name = 'Trail';
  icon = '🌀';
  maxLevel = 1;
  apply(game, level) {
    /* no-op placeholder */
  }
}
class DemoCharm extends Upgrade {
  id = 'demo_charm';
  name = 'Charm';
  icon = '🍀';
  maxLevel = 1;
  apply(game, level) {
    /* no-op placeholder */
  }
}

registerUpgrade(new ScoreBoost());
registerUpgrade(new TimebarBoost());
registerUpgrade(new FailShield());
registerUpgrade(new DemoGlow());
registerUpgrade(new DemoTrail());
registerUpgrade(new DemoCharm());

// Function to update scoreboard position dynamically
function updateScoreboardPosition() {
  const canvasRect = gameCanvas.getBoundingClientRect();
  const playRight = canvasRect.left + playAreaX + playAreaSize; // right edge of the white square

  // Place the scoreboard so its RIGHT edge sits exactly on the play-area right edge
  scoreboardCanvas.style.left = Math.round(playRight - SCOREBOARD_CSS_W) + 'px';

  // Keep your existing vertical placement (adjust this if you want it higher/lower)
  scoreboardCanvas.style.top = Math.round(canvasRect.top - 80) + 'px';

  // Re-anchor the popup layer to stay flush above the scoreboard
  updateScorePopupPosition();
}

// --- PlayArea bootstrap (authoritative square inside the canvas) ---
const playArea = new PlayArea(gameCanvas, { top: 0, padding: 0, borderPx: 2 });
playArea.exportGlobals(); // sets window.playAreaX/Y/Size for legacy code

// keep canvases aligned to the square’s right edge
setScoreboardWidth(window.playAreaSize);
loadShapeRegistry();
updateScoreboardPosition();

function handleResize() {
  // if you later change gameCanvas size, do that first, then:
  playArea.resize(); // recompute square + globals
  setScoreboardWidth(window.playAreaSize); // scoreboard/popup width clamp
  updateScoreboardPosition(); // re-anchor to right edge
  updateTimeBarPosition(); // keep timebar glued
}

window.addEventListener('resize', handleResize);
window.addEventListener('scroll', updateScoreboardPosition, { passive: true });

// TimeBar canvas setup
const timeBarCanvas = document.createElement('canvas');
timeBarCanvas.id = 'timeBarCanvas';
timeBarCanvas.width = playAreaSize;
timeBarCanvas.height = 10;
timeBarCanvas.style.position = 'absolute';
timeBarCanvas.style.zIndex = '10';
timeBarCanvas.style.opacity = '0';
timeBarCanvas.style.transition = 'opacity 0.6s ease-in-out';
timeBarCanvas.style.pointerEvents = 'none'; // ✨ let clicks pass through
document.body.appendChild(timeBarCanvas);

const timeBarCtx = timeBarCanvas.getContext('2d');

// Position TimeBar above the play area
function updateTimeBarPosition() {
  const canvasRect = gameCanvas.getBoundingClientRect();
  timeBarCanvas.style.left = canvasRect.left + playAreaX + 'px';
  timeBarCanvas.style.top = canvasRect.top + playAreaY - 20 + 'px'; // 12px above play area edge
}

function logProgress(message) {
  if (localStorage.getItem('LOG_PROGRESS') === '1') {
    console.log(`[PROGRESS] ${message}`);
  }
}

function showTimeBar() {
  if (timeBarCanvas.style.display === 'block' && timeBarCanvas.style.opacity === '1') return;
  timeBarCanvas.style.display = 'block';
  requestAnimationFrame(() => {
    timeBarCanvas.style.opacity = '1';
  });
}

function showMiniGameTimeBar() {
  if (timeBarCanvas.style.display === 'block' && timeBarCanvas.style.opacity === '1') return;

  timeBarCanvas.style.display = 'block';
  timeBarCanvas.style.opacity = '0';
  requestAnimationFrame(() => {
    timeBarCanvas.style.opacity = '1';
  });
}

function triggerMiniGameTransition() {
  // --- Isolation: start a mini-game immediately and do NOT prewarm or advance
  if (gameMode === 'isolation') {
    isInMiniGame = true;
    pendingLevelAdvance = false;
    shapeManager.currentShape = null;
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    miniGameManager.reset();
    const pool = miniGameRegistry.filter((m) => m.active);
    let selected;
    if (__debugForcedMini) {
      selected = pool.find((m) => m.name === __debugForcedMini) || pool[0];
      __debugForcedMini = null;
    } else {
      selected = pool[Math.floor(Math.random() * pool.length)];
    }
    miniGameManager.setMiniGame(selected.name);
    bus.emit('minigame:start', { id: selected.name });
    hideTimeBar();
    return; // ⛔ isolation does not prep next level or auto-advance
  }

  // --- Rotation: existing behavior (prewarm next level and mark advance)
  pendingLevelAdvance = true;
  isInMiniGame = true;
  const nextLvl = currentLevel < 4 ? currentLevel + 1 : 4;
  shapeManager.prewarmNextSet(nextLvl);
  shapeManager.currentShape = null;
  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  miniGameManager.reset();
  const pool = miniGameRegistry.filter((m) => m.active);
  let selected;
  if (__debugForcedMini) {
    selected = pool.find((m) => m.name === __debugForcedMini) || pool[0];
    __debugForcedMini = null;
  } else {
    selected = pool[Math.floor(Math.random() * pool.length)];
  }
  miniGameManager.setMiniGame(selected.name);
  bus.emit('minigame:start', { id: selected.name });
  hideTimeBar();
}

function hideTimeBar() {
  if (timeBarCanvas.style.opacity === '0') return; // Skip if already hidden
  timeBarCanvas.style.opacity = '0';
  setTimeout(() => {
    if (timeBarCanvas.style.opacity === '0') {
      // Double-check state
      timeBarCanvas.style.display = 'none';
    }
  }, 600); // Match fade duration
}

updateTimeBarPosition();
function updateHUDPosition() {
  const canvasRect = gameCanvas.getBoundingClientRect();
  hud.container.style.left = `${canvasRect.left + gameCanvas.width / 2}px`; // Center relative to canvas
  hud.container.style.top = `${canvasRect.bottom + 20}px`; // 20px below canvas (matches original bottom: 20px)
  hud.container.style.transform = 'translateX(-50%)'; // Keep centered
}

window.addEventListener('resize', updateHUDPosition);

window.addEventListener('resize', updateTimeBarPosition);

// Game state
let score = 0;
window.scoreMultiplier = 1;

// Raw award sink (no multipliers here). Final addScore() does the math + UI.
function addScore(amount, info = {}) {
  // hard gate: no scoring until intro finished AND game declared ready/active
  if (!gameActive || !gameReady || INTRO.running) return;

  const sysMul = amount > 0 ? scoreSystem.getMultiplier() : 1;
  const upgMul = amount > 0 ? window.scoreMultiplier || 1 : 1;
  const mult = sysMul * upgMul;

  const delta = amount * mult;
  score = Math.max(0, score + delta);

  spawnScorePopup(delta, info);
  refreshUpgradeAffordance();
}

// --- HUD level/shape counter updates (I/II/III or '∞') ---
function updateHudCounters() {
  const levelLabel = currentLevel === 4 ? '∞' : currentLevel;
  hud.update(levelLabel, totalShapesCompleted);
}

function refreshUpgradeAffordance() {
  UPGRADE_PRICES.forEach((price, i) => {
    const prevBought = i === 0 ? true : upgrades.purchasedSlots?.has(i - 1);
    const thisBought = upgrades.purchasedSlots?.has(i);
    const canAfford = getScore() >= price;

    if (thisBought) {
      // already revealed; HUD locks it itself — nothing to do
      return;
    }

    // decide state for HUD
    let state = 'locked';
    if (prevBought) {
      state = canAfford ? 'enabled' : 'locked';
    } else {
      state = canAfford ? 'queued' : 'locked';
    }
    hud.setUpgradeState(i, state);
  });
}

function getScore() {
  return score;
}
function spendScore(amount) {
  score = Math.max(0, score - amount);
  refreshUpgradeAffordance(); // <- live update on spending too
}
// Dev-only: add score regardless of intro/game gates
function debugAddScore(amount) {
  const v = Number(amount) || 0;
  score = Math.max(0, (score || 0) + v);
  refreshUpgradeAffordance(); // update upgrade tiles
  bus?.emit('score:update', { score }); // keep anything listening in sync
  updateDebugMenu?.(); // reflect in panel immediately
}

let personalBest = localStorage.getItem('personalBest') || 0;
let gameActive = false;
let lastTime = 0;
let animationFrameId = null;

let __router = null;
let __paused = false;

function isGameResumable() {
  return !!gameActive;
}

function pauseGame() {
  if (!gameActive || __paused) return;
  __paused = true;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  bus.emit('game:pause');
  bus.emit('timer:pause');
  showPauseOverlay();
}

function resumeGame() {
  if (!gameActive) return;
  hidePauseOverlay();
  __paused = false;
  lastTime = 0;
  bus.emit('game:resume');
  bus.emit('timer:resume');
  animationFrameId = requestAnimationFrame(gameLoop);
}

function showPauseOverlay() {
  if (document.getElementById('pauseOverlay')) return;
  const div = document.createElement('div');
  div.id = 'pauseOverlay';
  div.style.cssText = `position:fixed; inset:0; z-index:21; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.45);`;
  div.innerHTML = `
    <div style="background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.2); border-radius:14px; padding:16px 18px; width: 280px; text-align:center; color:#fff; font-family: Orbitron, sans-serif;">
      <div style="font-weight:800; font-size:18px; margin-bottom:12px;">Paused</div>
      <div style="display:flex; gap:10px; justify-content:center;">
        <button id="btnResume" style="padding:8px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.06); color:#fff; cursor:pointer;">Resume</button>
        <button id="btnMenu" style="padding:8px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.06); color:#fff; cursor:pointer;">Main Menu</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  div.querySelector('#btnResume').addEventListener('click', () => resumeGame());
  div.querySelector('#btnMenu').addEventListener('click', () => {
    hidePauseOverlay();
    __router && __router.navigate('MAIN');
  });
}
function hidePauseOverlay() {
  const el = document.getElementById('pauseOverlay');
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

let elapsedTime = 0;
let endFadeRAF = null;
// Smoothed scoreboard values
let displayedScore = 0;
let displayedBest = parseFloat(personalBest) || 0;
let lastScoreTick = 0;
// Fixed-advance rendering for scoreboard numerals
const SCORE_TICK_MS = 50; // ~20 FPS updates (reduces shimmer)
const SCORE_EASE = 0.35; // easing toward true value

// Level settings
const LEVELS = [
  { label: 'Level 1', duration: 60 },
  { label: 'Level 2', duration: 60 },
  { label: 'Level 3', duration: 60 },
  { label: 'Level ∞', duration: 90 },
];

let currentLevel = 1;
let gameTime = 0;
let shapeWasReady = false;
let justBecameReady = false;
let pendingLevelAdvance = false;
let gameReady = false;

// Score rate
const scoreIncreaseRate = 1;

// Mode: "rotation" or "isolation"
let gameMode = 'rotation';
let selectedDebugShape = 'Square';
let selectedDebugLevel = 1;
let isInMiniGame = false;
let miniGameManager = new MiniGameManager(
  playAreaX + playAreaSize / 2,
  playAreaY + playAreaSize / 2,
  50
);

// Create ShapeManager instance
const shapeManager = new ShapeManager(
  playAreaX + playAreaSize / 2,
  playAreaY + playAreaSize / 2,
  50,
  '#228B22',
  selectedDebugShape
);

//HUD instance
const hud = new HUD();
updateHUDPosition();
window.HUD = hud;

// === Hotbar mount into the HUD dock ===
const hotbar = new Hotbar({ slots: 4 });
hud.mountHotbar(hotbar.element);

// === EventBus ===
const bus = new EventBus();
window.bus = bus; // debug helper in console

// --- Badge toast wiring (register before MasteryManager.init) ---
(function wireBadgeToasts() {
  const root = document.getElementById('toast-root');

  function showBadgeToast({ id, name, title, icon, unlockedAt }) {
    if (!root) return;

    // Resolve icon path if we only have an id
    let url = icon;
    if (!url && id) url = `assets/badges/${id}.png`;

    const el = document.createElement('div');
    el.className = 'toast-badge';
    el.innerHTML = `
      <div class="icon">${url ? `<img src="${url}" alt="">` : ''}</div>
      <div class="lines">
        <div class="title">New Badge Unlocked</div>
        <div class="sub">${title || name || id || 'Badge'}</div>
      </div>
    `;
    root.appendChild(el);

    // auto cleanup
    setTimeout(() => el.remove(), 3600);
  }

  // From MasteryManager (bus emits 'mastery:badge' with badge data)
  bus.on('mastery:badge', (payload) => showBadgeToast(payload));
})();

// === Profile persistence (B.2) ===
ProfileStore.init();
const statsTracker = new StatsTracker({ bus, profile: ProfileStore });
window.ProfileStore = ProfileStore; // handy in console

// Mastery System boot
const __mastery = new MasteryManager({ bus });
await __mastery.init();

window.__mastery = __mastery;

// expose for debugging/inspection
window.__mastery = __mastery;

// ── Analytics boot (C.7) ─────────────────────────────────────────────────────
Analytics.init({
  bus,
  profile: ProfileStore,
  buildVersion: window.BUILD_VERSION || 'dev',
});
window.__AN = Analytics; // (optional) global for quick inspection

// router wires (B.1)
(async function bootRouter() {
  const root = document.getElementById('router-root');
  const r = Router.init({ rootEl: root, bus });

  const title = new TitleScreen({ onContinue: () => r.navigate('MAIN') });
  const main = new MainMenu({
    onPlay: () => r.navigate('GAME'),
    onShop: () => r.navigate('SHOP'),
    onProfile: () => r.navigate('PROFILE'),
    onSettings: () => r.navigate('SETTINGS'),
    onVault: () => r.navigate('VAULT'),
    onJukebox: () => router.navigate('JUKEBOX'),
  });

  // ⬇️ await the async Shop() factory
  const shop = await Shop({ onBack: () => r.back() });
  const profile = new Profile({ onBack: () => r.back() });
  const settings = new Settings({ onBack: () => r.back() });

  r.registerScreens({
    TITLE: title,
    MAIN: main,
    SHOP: shop, // factory returns { mount, unmount }
    PROFILE: profile,
    SETTINGS: settings,
    VAULT: new Vault({ onBack: () => r.back() }),
    JUKEBOX: new Jukebox(),
  });

  bus.on('router:navigate', ({ to, from }) => {
    if (to === 'GAME') {
      if (!gameActive) startGame();
      else if (__paused) resumeGame();
    } else if (from === 'GAME' && to !== 'GAME') {
      if (gameActive && !__paused) pauseGame();
    }
  });

  const startState = (location.hash || '').toLowerCase().startsWith('#/main')
    ? 'MAIN'
    : (location.hash || '').toLowerCase().startsWith('#/game') && isGameResumable()
    ? 'GAME'
    : 'TITLE';
  r.navigate(startState);

  window.__router = r;
})();

// --- Rescue toggle: make 'W' bring up the Debug Menu on any screen (dev only) ---
if (window.__DEV__ !== false) {
  const rescueKeyHandler = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

    // don't hijack typing in form fields
    const t = e.target;
    const tag = (t && t.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;

    // If the panel is already mounted, let its own handler manage W
    if (window.__debugUI) return;

    if (e.code === 'KeyW') {
      e.preventDefault();
      // create + show once
      createDebugMenu();
      createDebugToggleBtn();
      document.getElementById('debugToggleBtn')?.click?.();
    }
  };
  window.addEventListener('keydown', rescueKeyHandler, true);
}

// global back/esc
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (__router?.getState() === 'GAME') {
      if (__paused) resumeGame();
      else pauseGame();
    } else {
      __router?.back();
    }
  }
});

// global back/esc
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (__router?.getState() === 'GAME') {
      if (__paused) resumeGame();
      else pauseGame();
    } else {
      __router?.back();
    }
  }
});

// PERF CSV: arm/disarm on run start/end, and snapshot meta
function __perfOnRunStart() {
  __RUN_IN_PROGRESS = true;
  PERFCSV.capturing = PERFCSV.enabled; // honor current toggle
  PERFCSV.ready = false;
  PERFCSV.runId = Date.now();
  PERFCSV.startTs = PERFCSV.runId;
  PERFCSV.endTs = 0;
  PERFCSV.frames.length = 0;
  PERFCSV.events.length = 0;
  __perfFrameIndex = 0;
  PERFCSV.meta = {
    dpr: window.devicePixelRatio || 1,
    canvasW: gameCanvas?.width || 0,
    canvasH: gameCanvas?.height || 0,
    speed: DEBUG_SPEED || 1,
  };
}
function __perfOnRunEnd() {
  __RUN_IN_PROGRESS = false;
  PERFCSV.endTs = Date.now();
  PERFCSV.ready = true;
  PERFCSV.capturing = false;
}

// support both naming schemes
bus.on('run:start', __perfOnRunStart);
bus.on('game:start', __perfOnRunStart);
bus.on('run:end', __perfOnRunEnd);
bus.on('game:over', __perfOnRunEnd);

// PERF CSV taps (safe: adds rows only when capturing)
bus.on('level:start', (d) => perfLogEvent('level:start', d || {}));
bus.on('level:advance', (d) => perfLogEvent('level:advance', d || {}));
bus.on('level:complete', (d) => perfLogEvent('level:complete', d || {}));
bus.on('shape:start', (d) => perfLogEvent('shape:start', d || {}));
bus.on('shape:complete', (d) => perfLogEvent('shape:complete', d || {}));
bus.on('shape:fail', (d) => perfLogEvent('shape:fail', d || {}));
bus.on('shape:timeout', (d) => perfLogEvent('shape:timeout', d || {}));
bus.on('minigame:start', (d) => perfLogEvent('minigame:start', d || {}));
bus.on('minigame:win', (d) => perfLogEvent('minigame:win', d || {}));
bus.on('minigame:lose', (d) => perfLogEvent('minigame:lose', d || {}));

// ── Universal edge-veil & morph timings (one source of truth) ───────────────
// Intro: how long edges shrink from ends→center (and shape morph intros)
// Outro: reverse wipe duration (fast)
// Ease:  'linear' matches Circle paddle morph 1:1
window.EDGE_VEIL_MS = 3000; // intro (ms)
window.EDGE_VEIL_OUTRO_MS = 180; // veil outro (ms)
window.EDGE_VEIL_EASE = 'linear';

// Paddle/Platform “return to edge” (Circle/Pentagon) — can match or be a hair longer
window.EDGE_VEIL_OUTRO_PADDLE_MS = 200; // (ms)

bus.on('shape:complete', ({ name }) => {
  lastShapeCompleteColor = ensureVisible(getShapeColorByName(name));
});
bus.on('shape:complete', () => {
  // Don’t run this during or after game over.
  if (!gameActive) return;
  bus.emit('playArea/clearEdgeMasks', { animate: true, outMs: 220 });
});
bus.on('shape:complete', () => {
  if (!gameActive) return;
  totalShapesCompleted += 1;
  updateHudCounters(); // reflect immediately
});

// === Universal overlay: edge-mask prefabs ===
const overlayFX = new OverlayFX({ fxCtx, playArea, bus, color: '#FFFFFF' });
// --- Veil gate: keep masks OFF until a shape explicitly asks for them ---
bus.on('playArea/edgeScope', () => {
  // Every new shape/minigame gets a clean slate; nothing renders until unlocked.
  EDGE_VEIL_UNLOCK_AT = Infinity;
});

// The moment any shape requests a veil, unlock drawing right away.
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

bus.on('minigame:win', () => {
  spawnParticleBurst(randomBrightColor());
});
bus.on('minigame:start', () => {
  bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
  bus.emit('playArea/edgeScope');
});
bus.on('infinite:cycle', () => {
  spawnParticleBurst(randomBrightColor());
});
// When the level changes, (re)toggle the PlayArea pulse for ∞ mode and use the current shape color
bus.on('level:advance', ({ to }) => {
  if (typeof to === 'number') currentLevel = to; // keep local state in sync
  const name = shapeManager.getCurrentShapeName?.() || '';
  const entry = (shapeRegistry || []).find((s) => s.name === name);
  const color = entry ? entry.color : '#FFFFFF';
  playArea.setPulse(currentLevel >= 4, color);
  hud.setPulse(currentLevel >= 4, color);
});

// raw sink → optional log → forward to addScore()
function addScoreRaw(amount, info = {}) {
  // gate ScoreSystem awards / ticks before Start!
  if (!gameActive || !gameReady || INTRO.running) return;

  const isTick = info?.reason === 'tick';
  if (LOG_SCORE && (LOG_SCORE_TICKS || !isTick)) {
    console.log('%c[SCORE]', 'color:#6cf', `+${amount}`, info?.reason || '', info);
  }
  addScore(amount, info);
}

// === ScoreSystem ===
const scoreSystem = new ScoreSystem({
  bus,
  award: addScoreRaw,
});
window.scoreSystem = scoreSystem; // handy for console checks

// === Event Debug (auto-on in dev; toggle with localStorage EVT_DEBUG or ?ev=0/1) ===
(function wireEventDebug() {
  const url = new URL(location.href);
  const qp = url.searchParams.get('ev'); // ?ev=1 or ?ev=0
  const stored = localStorage.getItem('EVT_DEBUG'); // "1" or "0"
  const isDev = location.protocol === 'file:' || /localhost|127\.0\.0\.1/.test(location.hostname);

  // Decide ON/OFF:
  // 1) query param wins, else 2) stored flag, else 3) default ON in dev
  const ON = qp !== null ? qp === '1' : stored !== null ? stored === '1' : isDev;

  // If nothing was stored yet, persist the default so it sticks across reloads
  if (stored === null) localStorage.setItem('EVT_DEBUG', ON ? '1' : '0');

  if (!ON) return;

  const tap = (e) => bus.on(e, (p) => console.log('%c[EVT] ' + e, 'color:#0bf', p));
  [
    'run:start',
    'run:end',
    'level:advance',
    'infinite:cycle',
    'shape:complete',
    'minigame:start',
    'minigame:win',
    'minigame:lose',
    'upgrade:purchased',
    'powerup:granted',
    'powerup:used',
  ].forEach(tap);

  // (optional) live multiplier peek so you can see combo/level/boost effects
  bus.on('shape:complete', () => console.log('[MULT]', scoreSystem.getMultiplier().toFixed(2)));
})();

// === PowerUpManager glue ===
const powerUps = new PowerUpManager({ shapeManager, hud, hotbar, bus });
window.PowerUps = powerUps;

// Hotbar events -> PowerUpManager
hotbar.on('activate', ({ slot, id }) => {
  console.log('[Hotbar] activate', slot, id);
  powerUps.activate(slot);
});

// === Upgrades (random draw per slot) ===
const upgrades = new UpgradeManager({ hud, shapeManager, bus });
upgrades.setScoreAccessors({ getScore, spendScore });

// label the six price tiles along the bottom row
hud.setUpgradePrices(UPGRADE_PRICES);
refreshUpgradeAffordance();

// clicks on a price tile -> purchase a random upgrade from the pool
hud.setUpgradeHandler((slotIdx) => {
  const res = upgrades.purchase(slotIdx);
  if (!res.ok) {
    console.log('[Upgrade] purchase failed:', res.reason);
    return;
  }
  hud.revealUpgrade(slotIdx, { icon: res.icon, level: res.level });
  refreshUpgradeAffordance(); // reflect the new lock/afford state immediately
});

function resetSequenceAndMaybeSpin() {
  const prev = shapeManager.infiniteCycleIndex || 0;

  shapeManager.resetSequence(currentLevel);

  // ⛔ If we just started a NEW Level ∞ cycle, hard-stop any veil outro
  const now = shapeManager.infiniteCycleIndex || 0;
  if (currentLevel === 4 && now > prev) {
    bus.emit('playArea/finishEdgeMasks'); // <- cancel any running outro
    bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
    bus.emit('playArea/edgeScope'); // fresh scope for the new cycle
  }

  // (your pulse/color sync can stay here)
  {
    const name = shapeManager.getCurrentShapeName?.() || '';
    const entry = (shapeRegistry || []).find((s) => s.name === name);
    const color = entry ? entry.color : '#FFFFFF';
    playArea.setPulse(currentLevel >= 4, color);
    hud.setPulse(currentLevel >= 4, color);
  }

  // existing infinity spin + powerup grant
  if (currentLevel === 4 && now > prev) {
    console.log('[∞] cycle', prev, '→', now, '→ spinning');
    hud.spinInfinity?.();
    bus.emit('infinite:cycle', { from: prev, to: now });
    grantRandomPowerUp('cycle');
  }
}

function grantRandomPowerUp(reason = 'level') {
  // find first empty slot
  const idx = powerUps.equipped.findIndex((s) => !s);

  // If full: award score bump and flash feedback
  if (idx === -1) {
    addScore(10_000, { reason: 'powerup:overflow' });
    hotbar.flashFull?.();
    console.log(`[PU] All slots full → awarded +10,000 score (${reason})`);
    return;
  }

  const pool = getAllPowerUpIds();
  if (!pool.length) return;

  const id = pool[Math.floor(Math.random() * pool.length)];
  if (!id) return;

  if (powerUps.equip(idx, id)) {
    const bp = getPowerUpById(id) || {};
    hotbar.setSlot(idx, { id, level: 1, icon: bp.icon || '★' });
  }
}

// ==== DEBUG MENU (externalized) ==============================================
let __debugUI = null;
let __debugForcedMini = null;
let __isolationMiniName = null; // when set, isolation will loop this mini-game

// Bridges used by the panel. All logic stays in main.js.
function __setGameMode(mode) {
  gameMode = mode;
  shapeManager.setMode(gameMode);
  if (mode !== 'isolation') __isolationMiniName = null; // leaving Isolation cancels mini loop
}

function __setLevel(lvl) {
  if (gameMode !== 'isolation') {
    console.log('[Debug] setLevel ignored in rotation mode');
    return;
  }
  hideTimeBar();
  selectedDebugLevel = lvl;
  currentLevel = lvl;
  shapeManager.setLevel(currentLevel, true);
  shapeManager.resetSequence(currentLevel);
  gameTime = clockNowSec();
}

function __setRotationCurrentShape(name) {
  // Rotation forcing has been removed; keep a harmless stub so the panel can mount.
  console.log('[Debug] setRotationCurrentShape ignored; Isolation-only now.');
}

function __cancelMiniGame(reason = 'switch') {
  if (!isInMiniGame) return;
  const id = miniGameManager.getName?.() || 'unknown';
  try {
    bus.emit('minigame:lose', { id, via: reason });
  } catch {}
  isInMiniGame = false;
  miniGameManager.reset();
  hideTimeBar();

  // scrub anything that could linger this frame
  try {
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  } catch {}
  try {
    bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
    bus.emit('playArea/edgeScope');
  } catch {}
}

function __setIsolationShape(name) {
  selectedDebugShape = name;
  __isolationMiniName = null; // picking a shape cancels mini loop

  // if a mini is running, kill it before swapping to a shape
  __cancelMiniGame('switch-to-shape');

  if (gameMode === 'isolation') {
    shapeManager.setIsolationShape(name); // resetSequence() runs inside
  }
}

function __getSpeed() {
  return DEBUG_SPEED;
}
function __setSpeed(v) {
  const x = Number(v);
  DEBUG_SPEED = isFinite(x) && x > 0 ? x : 1;
}
// Force Complete handler (previous inline logic, as a callable)
function __forceMiniGameGo({ miniName, level }) {
  if (gameMode !== 'isolation') {
    console.log('[Debug] forceMiniGameGo ignored in rotation; use Isolation mode.');
    return;
  }
  isInMiniGame = true;
  pendingLevelAdvance = false; // no level hop in isolation
  miniGameManager.reset();
  shapeManager.currentShape = null;
  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  const pool = miniGameRegistry.filter((m) => m.active);
  const selected = pool.find((m) => m.name === miniName) || pool[0];
  __isolationMiniName = selected.name;
  bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
  bus.emit('playArea/edgeScope');
  miniGameManager.setMiniGame(selected.name);
  bus.emit('minigame:start', { id: selected.name });
  hideTimeBar();
}

// Force jump to a fresh rotation level and start with a specific shape
function __forceRotationGo({ shapeName, level }) {
  // 1) hard reset any mini-game + UI remnants
  try {
    if (typeof miniGameManager?.isRunning === 'function' && miniGameManager.isRunning()) {
      miniGameManager.end?.('aborted'); // no-op if not implemented
    }
  } catch (_) {}
  isInMiniGame = false;
  pendingLevelAdvance = false;
  miniGameManager.reset?.();
  hideTimeBar(); // fades then sets display:none

  // 2) normalize, rebuild, consume fresh pick set (shape first)
  const target = Math.max(1, Math.min(4, level | 0));
  currentLevel = target;
  shapeManager.forceRotation({ level: target, shapeName });

  // 3) visual and state reset used everywhere else
  resetSequenceAndMaybeSpin();

  // 4) scrub timers/flags so nothing carries over
  gameTime = clockNowSec();
  elapsedTime = 0;
  lastTime = 0;
  shapeWasReady = false;
  justBecameReady = false;

  updateDebugMenu();
}

// === Debug: Force Complete (works for both shapes and mini-games) ===========
function __forceComplete() {
  // If we're currently in a mini-game, finish it cleanly.
  if (isInMiniGame) {
    const name = miniGameManager.getName?.() || 'unknown';
    bus.emit('minigame:win', { id: name, via: 'force' });

    isInMiniGame = false;
    miniGameManager.reset();
    shapeManager.currentShape = null;
    hideTimeBar();

    // In isolation, loop the same mini if one is latched
    if (gameMode === 'isolation') {
      if (__isolationMiniName) {
        isInMiniGame = true;
        pendingLevelAdvance = false;
        miniGameManager.reset();
        miniGameManager.setMiniGame(__isolationMiniName);
        bus.emit('minigame:start', { id: __isolationMiniName, via: 'force' });
      }
      updateDebugMenu?.();
      return;
    }

    // Rotation: mirror normal mini-game finish → level advance / new pick set.
    setTimeout(() => {
      if (pendingLevelAdvance && currentLevel < 4) {
        currentLevel += 1;
        bus.emit('level:advance', { to: currentLevel });
        pendingLevelAdvance = false;
        grantRandomPowerUp('level');
      }
      // clear any old masks, then move to a fresh scope
      bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
      bus.emit('playArea/edgeScope');

      shapeManager.resetPickSet();
      shapeManager.setLevel(currentLevel, true);
      shapeManager.initPickSet(currentLevel);

      resetSequenceAndMaybeSpin();
      gameTime = clockNowSec();
      elapsedTime = 0;
      shapeWasReady = false;
      justBecameReady = false;
      updateDebugMenu?.();
    }, 0);

    return;
  }

  // Otherwise: we're on a shape → mark it complete and proceed.
  const shape = shapeManager.currentShape;
  if (!shape) {
    console.log('[Debug] __forceComplete: no current shape/mini to complete.');
    return;
  }

  // Complete current shape immediately
  try {
    shape.forceComplete?.();
  } catch (_) {}
  shapeManager.markCurrentShapeComplete();

  const behavior = shape?.behaviorType || 'survival';
  const levelDuration = LEVELS[currentLevel - 1].duration;
  const levelTimeRemaining = Math.max(0, levelDuration - (clockNowSec() - gameTime));

  bus.emit('shape:complete', {
    level: currentLevel,
    name: shapeManager.getCurrentShapeName(),
    behavior,
    remaining: levelTimeRemaining,
    duration: levelDuration,
    mode: currentLevel === 4 ? 'infinite' : 'normal',
  });

  setTimeout(
    () => {
      // 🔑 Check final-shape BEFORE resetting the sequence
      const isFinalShape = shapeManager.isPickSetCompleted();

      if (gameMode === 'rotation' && isFinalShape && !isInMiniGame) {
        if (currentLevel < 4) {
          // Go to mini-game; triggerMiniGameTransition handles prewarm/flags
          triggerMiniGameTransition();
          return; // don't rebuild pick set here
        }
        // Level ∞: just keep cycling
        resetSequenceAndMaybeSpin();
      } else {
        // Not final → normal next shape
        resetSequenceAndMaybeSpin();
      }

      gameTime = clockNowSec();
      updateDebugMenu?.();
    },
    typeof TRANSITION_DELAY === 'number' ? TRANSITION_DELAY : 0
  );
}

// Make debug bridges accessible to hotkeys (global, safe wrappers)
Object.assign(window, {
  __forceComplete, // finish current shape/mini cleanly
  __forceRotationGo: (args) => __forceRotationGo(args),
  __forceMiniGameGo: (args) => __forceMiniGameGo(args),

  // quick controls used by hotkeys
  __restartRun: () => startGame(),
  __loseNow: () => endGame(),

  // “difficulty” nudge = level down/up
  __diffDown: () => {
    if (gameMode === 'rotation') {
      const lvl = Math.max(1, (currentLevel | 0) - 1);
      __forceRotationGo({ shapeName: shapeManager.getCurrentShapeName?.(), level: lvl });
    } else {
      __setLevel(Math.max(1, (currentLevel | 0) - 1));
    }
  },
  __diffUp: () => {
    if (gameMode === 'rotation') {
      const lvl = Math.min(4, (currentLevel | 0) + 1);
      __forceRotationGo({ shapeName: shapeManager.getCurrentShapeName?.(), level: lvl });
    } else {
      __setLevel(Math.min(4, (currentLevel | 0) + 1));
    }
  },
});

// The new externalized panel
function createDebugMenu() {
  if (__debugUI) __debugUI.destroy();
  __debugUI = new DebugMenu({
    bus,
    shapeManager,
    miniGameManager,
    hud,

    // existing bridges
    getMode: () => gameMode,
    setMode: __setGameMode,
    getLevel: () => currentLevel,
    setLevel: __setLevel,
    getShape: () => selectedDebugShape,
    getRunCompleted: () => totalShapesCompleted,
    setIsolationShape: __setIsolationShape,
    setRotationCurrentShape: __setRotationCurrentShape,
    getSpeed: __getSpeed,
    setSpeed: __setSpeed,
    // 🆕 Force-jump bridges
    forceRotationGo: (args) => __forceRotationGo(args),
    forceMiniGameGo: (args) => __forceMiniGameGo(args),
    getMiniGameIds: () => (miniGameRegistry || []).filter((m) => m.active).map((m) => m.name),
    forceComplete: __forceComplete,
    getRunSeconds: __getRunSeconds, // Run Time for the Info section
    getFPS: () => getFPS(),
    getPerf: () => getPerfSnapshot(), // 🆕 Perf box data
    getEventTail: () => Analytics.tail(50),
    clearEventTail: () => Analytics.clear(),
    exportAnalytics: () => Analytics.exportJSON(),
    getPerfCsvStatus: () => getPerfCsvStatus(),
    setPerfCsvEnabled: (on) => setPerfCsvEnabled(on),
    buildPerfCSV: () => buildPerfCSV(),
    buildPerfSummary: () => buildPerfSummary(),
    runVerifiers: () => runVerifiers(), // 🆕 Trigger verifiers
    getShowFPSOverlay: () => getFPSOverlay(),
    setShowFPSOverlay: (on) => setFPSOverlay(on),
    // 🆕 Economy / inventory hooks
    addScore: (amt) => debugAddScore(amt), // +150M / custom
    // === Profile economy & reset ===
    getProfile: () => ProfileStore.get(),
    addCoins: (n) => ProfileStore.addCoins(n),
    addGems: (n) => ProfileStore.addGems(n),
    addXp: (n) => ProfileStore.addXp(n),
    setCoins: (n) => ProfileStore.setCoins(n),
    setGems: (n) => ProfileStore.setGems(n),
    setXp: (n) => ProfileStore.setXp(n),
    resetProfile: (hard = false) => ProfileStore.reset({ hard }),
    getAvailableUpgrades: () => upgrades.getAvailableUpgrades(), // dropdown list
    grantUpgradeById: (id) => {
      const r = upgrades.grantById(id);
      if (r?.ok) refreshUpgradeAffordance(); // update lock/enable states
      return r;
    },
    grantPowerUpById: (id) => powerUps.grantById(id),
    getPowerUpIds: () => getAllPowerUpIds(),

    resetPB: () => {
      personalBest = 0;
      localStorage.setItem('personalBest', '0');
    },
  });
  __debugUI.mount();
}

function createDebugToggleBtn() {
  __debugUI?.ensureToggle();
}
// Adapters so existing calls keep working
function updateDebugMenu() {
  __debugUI?.update();
}
function updateTimeRemaining(sec) {
  __debugUI?.setTimeRemaining(sec);
}

// --- Verifiers (shapes + mini-games) ---------------------------------------
async function runVerifiers() {
  const out = { shapes: [], minigames: [], errors: [] };
  try {
    const SM = await import('./ShapeManager.js');
    if (typeof SM.validateAllShapes === 'function') {
      // Use same center/radius you validate with in DOMContentLoaded
      const results = await SM.validateAllShapes(
        playAreaX + playAreaSize / 2,
        playAreaY + playAreaSize / 2,
        50,
        '#ffffff'
      );
      out.shapes = results?.results || results || [];
    } else {
      out.errors.push('ShapeManager.validateAllShapes() not found');
    }
  } catch (e) {
    out.errors.push('Shapes: ' + (e?.message || String(e)));
  }
  try {
    const MM = await import('./minigames/miniGames.js');
    const reg = MM.miniGameRegistry || [];
    out.minigames = reg.map((m) => {
      const ok = !!(m && m.name && (m.onStart || m.update || m.onComplete));
      const errs = [];
      if (!m.name) errs.push('missing name');
      if (!m.update) errs.push('missing update()');
      return { id: m.name || m.id || 'unknown', ok, errs };
    });
  } catch (e) {
    out.errors.push('MiniGames: ' + (e?.message || String(e)));
  }
  bus.emit('verify:report', out);
  return out;
}

// =================== DRAWING =====================

function drawScore() {
  // Throttle + ease the displayed numbers (keeps motion smooth)
  const now = performance.now();
  if (now - lastScoreTick >= SCORE_TICK_MS) {
    displayedScore += (score - displayedScore) * SCORE_EASE;
    displayedBest += (+personalBest - displayedBest) * SCORE_EASE;

    // snap to hundredths so widths don’t flicker
    displayedScore = Math.round(displayedScore * 100) / 100;
    displayedBest = Math.round(displayedBest * 100) / 100;

    lastScoreTick = now;
  }

  // Clear and draw
  scoreboardCtx.clearRect(0, 0, SCOREBOARD_CSS_W, SCOREBOARD_CSS_H);
  if (!gameActive) return;

  const rightX = SCOREBOARD_CSS_W - 1; // flush right
  const gap = 8;
  scoreboardCtx.textBaseline = 'alphabetic';

  // Typewriter reveal for labels (smoothed)
  let scoreLabel = 'Score:';
  let bestLabel = 'Best:';

  if (SB_TYPE.running) {
    const tNow = performance.now() - SB_TYPE.t0;

    SB_TYPE.scoreChars = smoothCount(tNow, SB_TYPE.perChar, scoreLabel.length, 0);
    SB_TYPE.bestChars = smoothCount(tNow, SB_TYPE.perChar, bestLabel.length, SB_TYPE.stagger);
    // start pop for the newest label character
    const nowPop = performance.now();
    const newLblIdx = SB_TYPE.scoreChars - 1;
    if (SB_TYPE.running && newLblIdx >= 0 && newLblIdx !== SB_POP.scoreLblIdx) {
      SB_POP.scoreLblIdx = newLblIdx;
      SB_POP.scoreLblT = nowPop;
    }
    const newBestLblIdx = SB_TYPE.bestChars - 1;
    if (SB_TYPE.running && newBestLblIdx >= 0 && newBestLblIdx !== SB_POP.bestLblIdx) {
      SB_POP.bestLblIdx = newBestLblIdx;
      SB_POP.bestLblT = nowPop;
    }

    scoreLabel = scoreLabel.slice(0, SB_TYPE.scoreChars);
    bestLabel = bestLabel.slice(0, SB_TYPE.bestChars);

    if (SB_TYPE.scoreChars >= 6 && SB_TYPE.bestChars >= 5) {
    }
  }

  // ----- SCORE LINE -----
  const beatingBest = score > personalBest;
  const pulse = beatingBest ? 1 + 0.06 * Math.sin(now * 0.008) : 1;

  scoreboardCtx.font = '700 24px Orbitron';
  let scoreStr = SCORE_FMT.format(displayedScore);

  // typewriter for number (already in your file)
  if (SB_TYPE.running) {
    const tNow = performance.now() - SB_TYPE.t0;
    SB_TYPE.scoreNumChars = smoothCount(
      tNow,
      SB_TYPE.numPerChar,
      scoreStr.length,
      SB_TYPE.numDelay
    );
    scoreStr = scoreStr.slice(0, SB_TYPE.scoreNumChars);
  }

  // precompute widths
  const baseNumW = scoreboardCtx.measureText(scoreStr).width;
  const numRightX = rightX;
  const numY = 30;
  const numColor = beatingBest ? `hsl(${(now / 10) % 360}, 100%, 70%)` : 'white';

  // draw, popping the newest char only
  scoreboardCtx.save();
  scoreboardCtx.translate(numRightX, numY);
  scoreboardCtx.scale(pulse, pulse);
  scoreboardCtx.textAlign = 'right';
  scoreboardCtx.fillStyle = numColor;

  const popIdx = SB_TYPE.running ? SB_TYPE.scoreNumChars - 1 : -1;
  const popAge = performance.now() - SB_POP.scoreNumT;
  if (popIdx >= 0 && popIdx === SB_POP.scoreNumIdx && popAge <= POP_MS && scoreStr.length > 0) {
    const prefix = scoreStr.slice(0, -1);
    const active = scoreStr.slice(-1);
    const pfxW = scoreboardCtx.measureText(prefix).width;
    const aw = scoreboardCtx.measureText(active).width;

    // prefix (normal)
    scoreboardCtx.fillText(prefix, 0, 0);

    // active char with pop (place by LEFT edge, then scale around center)
    const s = popScale01(popAge / POP_MS);
    scoreboardCtx.save();
    const kNum = pulse || 1; // parent scale
    const xLeft = -pfxW / kNum; // left edge of active char
    scoreboardCtx.translate(xLeft, 0); // move origin to char's left
    scoreboardCtx.translate(aw / 2 / kNum, 0); // move to center
    scoreboardCtx.scale(s, s);
    scoreboardCtx.textAlign = 'center';
    scoreboardCtx.fillText(active, 0, 0);
    scoreboardCtx.restore();
  } else {
    scoreboardCtx.fillText(scoreStr, 0, 0);
  }
  scoreboardCtx.restore();

  // label (right-aligned, tiny pulse when beating best)
  const scoreLabelRight = numRightX - baseNumW * pulse - gap;
  const labelColor = beatingBest ? `hsl(${(now / 10) % 360}, 100%, 70%)` : 'white';
  const labelPulse = beatingBest ? 1 + 0.03 * Math.sin(now * 0.008) : 1;

  scoreboardCtx.font = '700 24px Orbitron';
  scoreboardCtx.save();
  scoreboardCtx.translate(scoreLabelRight, numY);
  scoreboardCtx.scale(labelPulse, labelPulse);
  scoreboardCtx.textAlign = 'right';
  scoreboardCtx.fillStyle = labelColor;

  // pop newest label char
  const lblPopIdx = SB_TYPE.running ? SB_TYPE.scoreChars - 1 : -1;
  const lblPopAge = performance.now() - SB_POP.scoreLblT;
  if (
    lblPopIdx >= 0 &&
    lblPopIdx === SB_POP.scoreLblIdx &&
    lblPopAge <= POP_MS &&
    scoreLabel.length > 0
  ) {
    const prefix = scoreLabel.slice(0, -1);
    const active = scoreLabel.slice(-1);
    const pfxW = scoreboardCtx.measureText(prefix).width;
    const aw = scoreboardCtx.measureText(active).width;
    scoreboardCtx.fillText(prefix, 0, 0);
    const s = popScale01(lblPopAge / POP_MS);
    scoreboardCtx.save();
    const kLbl = labelPulse || 1;
    const xLeft = -pfxW / kLbl; // left edge of active char
    scoreboardCtx.translate(xLeft, 0);
    scoreboardCtx.translate(aw / 2 / kLbl, 0); // center
    scoreboardCtx.scale(s, s);
    scoreboardCtx.textAlign = 'center';
    scoreboardCtx.fillText(active, 0, 0);
    scoreboardCtx.restore();
  } else {
    scoreboardCtx.fillText(scoreLabel, 0, 0);
  }
  scoreboardCtx.restore();

  // ----- BEST LINE -----
  scoreboardCtx.font = '700 16px Orbitron';
  let bestStr = SCORE_FMT.format(displayedBest);

  // typewriter for BEST number (already in your file)
  if (SB_TYPE.running) {
    const tNow = performance.now() - SB_TYPE.t0 - SB_TYPE.stagger;
    SB_TYPE.bestNumChars = smoothCount(tNow, SB_TYPE.numPerChar, bestStr.length, SB_TYPE.numDelay);
    bestStr = bestStr.slice(0, SB_TYPE.bestNumChars);

    if (
      SB_TYPE.scoreChars >= 6 &&
      SB_TYPE.bestChars >= 5 &&
      SB_TYPE.scoreNumChars >= SCORE_FMT.format(displayedScore).length &&
      SB_TYPE.bestNumChars >= SCORE_FMT.format(displayedBest).length
    ) {
      SB_TYPE.running = false;
    }
  }

  const bestRightX = rightX;
  const bestY = 50;
  const bestNumW = scoreboardCtx.measureText(bestStr).width;

  // number with pop
  scoreboardCtx.save();
  scoreboardCtx.translate(bestRightX, bestY);
  scoreboardCtx.textAlign = 'right';
  scoreboardCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';

  const bestPopIdx = SB_TYPE.running ? SB_TYPE.bestNumChars - 1 : -1;
  const bestPopAge = performance.now() - SB_POP.bestNumT;
  if (
    bestPopIdx >= 0 &&
    bestPopIdx === SB_POP.bestNumIdx &&
    bestPopAge <= POP_MS &&
    bestStr.length > 0
  ) {
    const prefix = bestStr.slice(0, -1);
    const active = bestStr.slice(-1);
    const pfxW = scoreboardCtx.measureText(prefix).width;
    const aw = scoreboardCtx.measureText(active).width;
    scoreboardCtx.fillText(prefix, 0, 0);
    const s = popScale01(bestPopAge / POP_MS);
    scoreboardCtx.save();
    // no parent scale on this group
    const xLeft = -pfxW; // left edge of active char
    scoreboardCtx.translate(xLeft, 0);
    scoreboardCtx.translate(aw / 2, 0); // center
    scoreboardCtx.scale(s, s);
    scoreboardCtx.textAlign = 'center';
    scoreboardCtx.fillText(active, 0, 0);
    scoreboardCtx.restore();
  } else {
    scoreboardCtx.fillText(bestStr, 0, 0);
  }
  scoreboardCtx.restore();

  // label (right-aligned) with pop
  const bestLabelRight = bestRightX - bestNumW - gap;
  scoreboardCtx.font = '700 16px Orbitron';
  scoreboardCtx.textAlign = 'right';
  scoreboardCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';

  const bestLblPopIdx = SB_TYPE.running ? SB_TYPE.bestChars - 1 : -1;
  const bestLblPopAge = performance.now() - SB_POP.bestLblT;
  if (
    bestLblPopIdx >= 0 &&
    bestLblPopIdx === SB_POP.bestLblIdx &&
    bestLblPopAge <= POP_MS &&
    bestLabel.length > 0
  ) {
    const prefix = bestLabel.slice(0, -1);
    const active = bestLabel.slice(-1);
    const pfxW = scoreboardCtx.measureText(prefix).width;
    const aw = scoreboardCtx.measureText(active).width;
    scoreboardCtx.fillText(prefix, bestLabelRight, bestY);
    scoreboardCtx.save();
    scoreboardCtx.translate(bestLabelRight - pfxW - aw / 2, bestY);
    scoreboardCtx.scale(popScale01(bestLblPopAge / POP_MS), popScale01(bestLblPopAge / POP_MS));
    scoreboardCtx.textAlign = 'center';
    scoreboardCtx.fillText(active, 0, 0);
    scoreboardCtx.restore();
  } else {
    scoreboardCtx.fillText(bestLabel, bestLabelRight, bestY);
  }
}

function drawScorePopups() {
  scorePopupCtx.clearRect(0, 0, POPUP_CSS_W, POPUP_CSS_H);
  if (scorePopups.length === 0) return;

  const now = performance.now();
  const rightX = POPUP_CSS_W - 1;
  const baseY = POPUP_CSS_H - 6; // near the bottom
  const maxRise = SCORE_POPUP_RISE_PX; // fixed rise distance
  const topPad = 6;
  scorePopupCtx.textBaseline = 'alphabetic';

  for (let i = scorePopups.length - 1; i >= 0; i--) {
    const p = scorePopups[i];
    const t = Math.min(1, (now - p.born) / p.life);
    const ease = 1 - Math.pow(1 - t, 2.6);
    const y = Math.max(topPad, baseY - ease * maxRise);
    const alpha = 1 - Math.pow(ease, 2.2);

    const color = p.color || REASON_COLORS[p.reason] || REASON_COLORS.default;
    const text = (p.amount >= 0 ? '+' : '') + Math.round(p.amount);

    scorePopupCtx.save();
    scorePopupCtx.globalAlpha = alpha;
    scorePopupCtx.textAlign = 'right';
    scorePopupCtx.font = '700 22px Orbitron';

    // subtle but firm shadow behind text
    scorePopupCtx.shadowColor = 'rgba(0,0,0,0.85)';
    scorePopupCtx.shadowBlur = 6;
    scorePopupCtx.shadowOffsetX = 0;
    scorePopupCtx.shadowOffsetY = 1;

    // thin outline for edge cases on bright backgrounds
    scorePopupCtx.lineWidth = 2;
    scorePopupCtx.strokeStyle = 'rgba(0,0,0,0.35)';

    scorePopupCtx.fillStyle = color;
    scorePopupCtx.strokeText(text, rightX, y);
    scorePopupCtx.fillText(text, rightX, y);
    scorePopupCtx.restore();

    if (t >= 1) scorePopups.splice(i, 1);
  }
}

function renderFxLayer() {
  // Clear once per frame
  fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // 1) PlayArea intro (on FX)
  playArea.drawIntroFX(fxCtx);

  // While the countdown is running, keep a static border visible
  if (INTRO.running && !playArea.isIntroAnimating()) {
    // During countdown, ignore fade so the border can’t disappear between intro→gameplay frames
    playArea.drawStaticFXBorder(fxCtx, { useFade: false });
  }

  // 2) Infinite-mode glow (wide halo + core)
  playArea.drawGlowFX(fxCtx);

  // 3) Static border (drawn on FX each frame during gameplay)
  if (!INTRO.running) playArea.drawStaticFXBorder(fxCtx, { useFade: true });

  // 4) Edge masks (render right after handoff; intro animations need these frames)
  if (!INTRO.running && performance.now() >= EDGE_VEIL_UNLOCK_AT && gameReady) {
    overlayFX.render();
  }

  if (ENABLE_SCORE_BURSTS && scoreParticles.length > 0) {
    const now = performance.now();
    fxCtx.save();
    fxCtx.globalCompositeOperation = 'lighter';
    for (let i = scoreParticles.length - 1; i >= 0; i--) {
      const pt = scoreParticles[i];
      const t = (now - pt.born) / pt.life;
      if (t >= 1) {
        scoreParticles.splice(i, 1);
        continue;
      }
      const dt = (now - pt.born) / 1000;
      const x = pt.x + pt.vx * dt;
      const y = pt.y + pt.vy * dt;

      const coreAlpha = Math.pow(1 - t, 1.2);
      const glowAlpha = Math.pow(1 - t, 1.6) * 0.4;
      const coreR = Math.max(0.8, pt.size * (1 - t * 0.5));
      const glowR = coreR * 2.2;

      fxCtx.save();
      fxCtx.globalAlpha = glowAlpha;
      fxCtx.shadowBlur = 12;
      fxCtx.shadowColor = pt.color;
      fxCtx.fillStyle = pt.color;
      fxCtx.beginPath();
      fxCtx.arc(x, y, glowR, 0, Math.PI * 2);
      fxCtx.fill();
      fxCtx.restore();

      fxCtx.save();
      fxCtx.globalAlpha = Math.min(1, coreAlpha);
      fxCtx.fillStyle = pt.color;
      fxCtx.beginPath();
      fxCtx.arc(x, y, coreR, 0, Math.PI * 2);
      fxCtx.fill();
      fxCtx.restore();
    }
    fxCtx.restore();
  }
}

// ===== INTRO ORCHESTRATOR =====
const INTRO = {
  running: false,
  t0: 0,
  // PlayArea animation (choose one: 'wipe' | 'scale' | 'grid')
  variant: 'wipe',
  playMs: 2000, // 2.0s PlayArea intro
  // Countdown
  stepMs: 600, // 0.6s per step
  steps: ['3', '2', '1', 'Start!'],
  // sync HUD/Scoreboard so their intros FINISH at "Start!"
  _hudStarted: false,
  _sbStarted: false,
};
// Small buffer so edge veils can't erase the border on the very first frame after intro
const HANDOFF_SHIELD_MS = 60;
let EDGE_VEIL_UNLOCK_AT = 0;

function _chooseVariant() {
  const pool = ['wipe', 'scale', 'grid', 'assemble'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function startIntroSequence() {
  bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
  INTRO.running = true;
  INTRO.t0 = performance.now();
  INTRO.variant = _chooseVariant();
  INTRO._hudStarted = false;
  INTRO._sbStarted = false;
  EDGE_VEIL_UNLOCK_AT = Infinity;

  // kick PlayArea intro
  playArea.beginIntro(INTRO.variant, INTRO.playMs);
  // start border fade at the same time
  playArea.fadeInBorders(INTRO.playMs);
}

function _drawCountdownOverlay(text) {
  // Big center text in the play area
  const rect = gameCanvas.getBoundingClientRect();
  const cx = playAreaX + playAreaSize / 2;
  const cy = playAreaY + playAreaSize / 2;

  gameCtx.save();
  gameCtx.textAlign = 'center';
  gameCtx.textBaseline = 'middle';
  gameCtx.font = '700 64px Orbitron';
  gameCtx.fillStyle = 'white';
  // subtle glow
  gameCtx.shadowColor = 'rgba(255,255,255,0.65)';
  gameCtx.shadowBlur = 14;
  gameCtx.fillText(text, cx, cy);
  gameCtx.restore();
}

function runIntroOverlay() {
  if (!INTRO.running) return;

  const now = performance.now();
  const t = now - INTRO.t0;

  // 1) PlayArea intro window
  if (t < INTRO.playMs) {
    // nothing extra to draw here; PlayArea.draw() handles the border animation
  } else {
    // 2) Countdown phase
    const ct = t - INTRO.playMs;
    const total = INTRO.stepMs * INTRO.steps.length;
    const idx = Math.min(INTRO.steps.length - 1, Math.floor(ct / INTRO.stepMs));
    const stepT = (ct % INTRO.stepMs) / INTRO.stepMs;
    const ease = 1 - Math.pow(1 - stepT, 3);

    // Start HUD/Scoreboard so they FINISH at the end of the “1” step
    // Steps are: ‘3’, ‘2’, ‘1’, ‘Start!’ (each lasts stepMs)
    const HUD_INTRO_MS = 850; // match HUD.js intro duration
    const SB_INTRO_MS = 800;
    const endOfOneMs = INTRO.stepMs * 3; // end boundary of “1”
    const hudStartAt = Math.max(0, endOfOneMs - HUD_INTRO_MS);
    const sbStartAt = Math.max(0, endOfOneMs - SB_INTRO_MS);

    if (!INTRO._hudStarted && ct >= hudStartAt) {
      INTRO._hudStarted = true;
      hud.show?.();
      updateHudCounters();
    }
    if (!INTRO._sbStarted && ct >= sbStartAt) {
      INTRO._sbStarted = true;
      showScoreboard();
      startScoreboardTypewriter(SB_INTRO_MS); // ← start typing now
    }

    // countdown text
    _drawCountdownOverlay(INTRO.steps[idx]);
    if (INTRO.steps[idx] === '1') {
      fadeScoreboardIn(320);
    }
    // all done → drop intro gate
    if (ct >= total) {
      INTRO.running = false;
      playArea.lockVisible();
      gameReady = true;
      shapeManager.resetSequence(currentLevel);
      gameTime = clockNowSec();
      elapsedTime = 0;
      shapeWasReady = false;
      justBecameReady = false;

      // Keep veils locked. Only a shape that emits hide… events will unlock them.
      EDGE_VEIL_UNLOCK_AT = Infinity;
    }
  }
}

// TimeBar for objective shapes

function drawObjectiveTimeBar(remaining, duration) {
  if (isInMiniGame) {
    // allow draw in mini-games
  } else {
    if (!shapeManager.currentShape) return;
    if (shapeManager.currentShape.behaviorType !== 'objective') return;
    if (!shapeManager.currentShape.isReady()) return;
  }

  const ctx = timeBarCtx;
  const barWidth = timeBarCanvas.width;
  const barHeight = timeBarCanvas.height;
  const x = 0,
    y = 0;

  // progress calc (unchanged)
  ctx.clearRect(0, 0, barWidth, barHeight);
  const visualBuffer = 0.25;
  let adjustedRemaining = Math.max(0, remaining);
  let rawPct =
    adjustedRemaining > duration - visualBuffer
      ? (adjustedRemaining + visualBuffer) / duration
      : adjustedRemaining / duration;
  let pct = Math.max(0, Math.min(1, rawPct));

  const barColor = isInMiniGame
    ? miniGameManager.getTimerColor()
    : shapeManager.currentShape?.color || '#ffffff';

  // rounded-corner helpers (uses roundRect if available)
  const rr = (ctx, x, y, w, h, r) => {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
  };

  // subtle HUD-like rounding
  const r = Math.min(4, barHeight / 2);

  // Background (rounded)
  ctx.save();
  ctx.fillStyle = 'transparent';
  ctx.beginPath();
  rr(ctx, x, y, barWidth, barHeight, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Fill (rounded on the leading end; avoid bulge for very small widths)
  const fillW = Math.max(0, barWidth * pct);
  if (fillW > 0.001) {
    const rFill = Math.min(r, fillW / 2);
    ctx.save();
    ctx.fillStyle = barColor;
    ctx.beginPath();
    rr(ctx, x, y, fillW, barHeight, rFill);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Outline (rounded) — 1px like before
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  rr(ctx, x + 0.5, y + 0.5, barWidth - 1, barHeight - 1, Math.max(0, r - 0.5));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// Function to start game
function startGame(opts = {}) {
  // 0) stop any outro loop immediately
  if (endFadeRAF) {
    cancelAnimationFrame(endFadeRAF);
    endFadeRAF = null;
  }

  // 1) wipe UI/canvases & hide layers (no stale flashes between runs)
  drainOverlays();
  hideTimeBar();

  // 2) nuke any pending edge-veils from previous run
  try {
    bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
  } catch {}

  // 3) cancel an old main loop if it exists
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // 4) hard-reset global intro gate so only ONE fresh intro runs
  INTRO.running = false;
  INTRO.t0 = 0;
  INTRO._hudStarted = false;
  INTRO._sbStarted = false;

  // 5) reset PlayArea visual state to a known baseline
  playArea.resetIntro?.(); // clears prior intro/fade/lock
  playArea.unlockVisible?.(); // ensure new intros are allowed
  playArea.fadeTo(0, 0); // start fully hidden; intro will fade in

  // 6) fresh run bookkeeping
  const revive = !!opts.revive;
  gameActive = true;
  bus.emit('run:start', { ts: Date.now() });
  __runStartMs = performance.now();
  bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
  bus.emit('playArea/edgeScope'); // new FX scope for veils
  hud.resetAnimations();
  hideScoreboard(); // scoreboard will fade in via intro
  resetScoreboardTypewriter();
  scorePopupCanvas.style.display = 'block';
  scorePopupCanvas.style.opacity = '1';

  // 7) score/upgrade reset (unchanged)
  if (!revive) {
    score = 0;
    displayedScore = 0;
    displayedBest = parseFloat(personalBest) || 0; // best shows immediately
  } else {
    displayedScore = score;
    displayedBest = parseFloat(personalBest) || 0;
  }
  lastScoreTick = performance.now();
  upgrades.resetRun();
  hud.setUpgradePrices(UPGRADE_PRICES);
  hud.resetUpgradeTiles();
  refreshUpgradeAffordance();
  powerUps.resetRun?.();
  for (let i = 0; i < 4; i++) hotbar.setSlot(i, { id: null, level: 0, icon: '' });
  refreshUpgradeAffordance();

  totalShapesCompleted = 0;
  clockReset();

  // 8) level/shape reset (unchanged)
  currentLevel = selectedDebugLevel;
  shapeManager.setMode(gameMode);
  shapeManager.setIsolationShape(selectedDebugShape);
  shapeManager.setLevel(currentLevel, true);
  if (currentLevel === 4) {
    shapeManager.infiniteCycleIndex = 0;
  }
  shapeManager.initPickSet(currentLevel);
  updateHudCounters();
  if (shapeManager.getPickSet().length === 0) {
    console.warn('⚠️ No shapes in pickSet after init. Using fallback shape.');
    shapeManager.pickSet = [
      new Shape(
        playAreaX + playAreaSize / 2,
        playAreaY + playAreaSize / 2,
        50,
        '#228B22',
        'FallbackShape'
      ),
    ];
    shapeManager.remainingShapes = [...shapeManager.pickSet];
  }

  // 9) gate gameplay until intro finishes
  gameReady = false;

  // ∞-pulse color sync (unchanged)
  {
    const name = shapeManager.getCurrentShapeName?.() || '';
    const entry = (shapeRegistry || []).find((s) => s.name === name);
    const color = entry ? entry.color : '#FFFFFF';
    playArea.setPulse(currentLevel >= 4, color);
    hud.setPulse(currentLevel >= 4, color);
  }

  // 10) kick the unified intro (PlayArea + countdown + HUD/scoreboard)
  startIntroSequence(); // 2s PlayArea intro → 3•2•1•Start!

  // 11) timers/UI wires (unchanged)
  gameTime = clockNowSec();
  elapsedTime = 0;
  lastTime = 0;
  createEndButton();
  queueMicrotask(() => {
    updateScoreboardPosition();
    updateScorePopupPosition();
  });
  if (DEV) {
    createDebugMenu();
    createDebugToggleBtn();
  }
  updateScoreboardPosition();
  updateScorePopupPosition();
  isInMiniGame = false;
  miniGameManager.reset();
  __isolationMiniName = null;
  drawScore();
  drawScorePopups();
  renderFxLayer();
  shapeManager.totalShapesCompleted = 0;

  // 12) start main loop
  animationFrameId = requestAnimationFrame(gameLoop);
  logProgress(`Game started: Level ${currentLevel}, Shape: ${shapeManager.getCurrentShapeName()}`);
}

function drainOverlays() {
  scorePopups.length = 0;
  scoreParticles.length = 0;
  try {
    scoreboardCtx.clearRect(0, 0, SCOREBOARD_CSS_W, SCOREBOARD_CSS_H);
  } catch {}
  try {
    scorePopupCtx.clearRect(0, 0, POPUP_CSS_W, POPUP_CSS_H);
  } catch {}
  try {
    fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  } catch {}

  // 🔒 make them invisible between runs so stale text never flashes
  if (scoreboardCanvas) {
    scoreboardCanvas.style.opacity = '0';
    scoreboardCanvas.style.display = 'none';
  }
  if (scorePopupCanvas) {
    scorePopupCanvas.style.opacity = '0';
    scorePopupCanvas.style.display = 'none';
  }
}

function runEndFade(ms = 520) {
  const endAt = performance.now() + ms;
  if (endFadeRAF) cancelAnimationFrame(endFadeRAF);
  const step = () => {
    try {
      gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    } catch {}
    try {
      playArea.draw(16);
    } catch {}
    try {
      renderFxLayer();
    } catch {}
    if (performance.now() < endAt) {
      endFadeRAF = requestAnimationFrame(step);
    } else {
      endFadeRAF = null;
      drainOverlays();
      try {
        bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
      } catch {}
      bus.emit('run:end', { ts: Date.now(), score, bestScore: personalBest });
    }
  };

  endFadeRAF = requestAnimationFrame(step);
}

// Function to handle game over
function endGame() {
  try {
    bus.emit('playArea/finishEdgeMasks');
  } catch {}
  gameActive = false;
  bus.emit('run:ending');
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (score > personalBest) {
    personalBest = score;
    localStorage.setItem('personalBest', personalBest);
  }
  const endButton = document.getElementById('endGameButton');
  if (endButton) document.body.removeChild(endButton);
  playArea.unlockVisible?.();
  try {
    hud.hide();
  } catch (e) {}
  playArea.fadeOutBorders(500, { force: true });
  fadeScoreboardOut(500);
  hideTimeBar();
  hud.setPulse(false);
  runEndFade(520);
  createGameOverPopup();
  logProgress(`Game ended: Score ${score.toFixed(2)}`);
}

function createGameOverPopup() {
  const popup = document.createElement('div');
  popup.id = 'gameOverPopup';
  popup.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: rgba(0, 0, 0, 0.8);
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    z-index: 12;
  `;

  const scoreDisplay = document.createElement('p');
  scoreDisplay.textContent = `Your Score: ${SCORE_FMT.format(score)}`;
  scoreDisplay.style.color = 'white';
  scoreDisplay.style.fontSize = '24px';
  popup.appendChild(scoreDisplay);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; justify-content: center; gap: 10px;';

  const restartButton = document.createElement('button');
  restartButton.textContent = 'Restart Game';
  restartButton.style.cssText = 'font-size: 16px; padding: 10px;';
  restartButton.addEventListener('click', () => {
    document.body.removeChild(popup);
    startGame();
  });
  buttonContainer.appendChild(restartButton);

  const shareButton = document.createElement('button');
  shareButton.textContent = 'Share Score';
  shareButton.style.cssText = 'font-size: 16px; padding: 10px;';
  shareButton.addEventListener('click', () => {
    navigator.clipboard.writeText(`My score in ShapeShifters: ${SCORE_FMT.format(score)}`).then(
      () => {
        alert('Score copied to clipboard!');
      },
      () => {
        alert('Failed to copy score to clipboard');
      }
    );
  });
  buttonContainer.appendChild(shareButton);

  popup.appendChild(buttonContainer);

  const continueWithAdButton = document.createElement('button');
  continueWithAdButton.textContent = 'Watch Ad to Continue';
  continueWithAdButton.style.cssText =
    'font-size: 16px; padding: 10px; margin-top: 10px; display: block; width: 100%;';
  continueWithAdButton.disabled = true;
  continueWithAdButton.addEventListener('click', () => {
    console.log('Watch ad functionality not yet implemented');
  });
  popup.appendChild(continueWithAdButton);

  document.body.appendChild(popup);
}

function launchMiniGameAndAdvance() {
  logProgress(`Launching Mini-Game for Level ${currentLevel}`);
  isInMiniGame = true;
  pendingLevelAdvance = true;
  miniGameManager.reset();

  const pool = miniGameRegistry.filter((m) => m.active);
  const selected = pool[Math.floor(Math.random() * pool.length)];
  shapeManager.currentShape = null;
  shapeManager.currentShapeCompleted = false;
  shapeManager.inProgressShapes = [];
  shapeManager.remainingShapes = [];
  shapeManager.pickSet = [];
  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); // Clear canvas
  miniGameManager.setMiniGame(selected.name);
  bus.emit('minigame:start', { id: selected.name });
  miniGameManager.hasStarted = false;
}

// ================ MAIN GAME LOOP ================
function gameLoop(timestamp) {
  if (!gameActive) return;
  if (lastTime === 0) {
    lastTime = timestamp;
    animationFrameId = requestAnimationFrame(gameLoop);
    return;
  }

  // raw (unscaled) frame time for true FPS
  const rawDt = Math.min(timestamp - lastTime, 100);
  lastTime = timestamp;

  // gameplay delta respects DEBUG_SPEED but FPS does not
  let deltaTime = rawDt * (DEBUG_SPEED || 1);
  clockSec += deltaTime / 1000;

  // FPS EMA update (stable)
  const instFps = rawDt > 0 ? 1000 / rawDt : 0;
  fpsEMA += (instFps - fpsEMA) * FPS_ALPHA;
  if (FPS_OVERLAY_ON && ensureFPSOverlay() && performance.now() - fpsLastUpdateMs > 250) {
    fpsOverlayEl.textContent = `${Math.round(fpsEMA)} FPS`;
    fpsLastUpdateMs = performance.now();
  }
  if (instFps && instFps < 45) PERF.spikeTimes.push(performance.now());
  powerUps.tick?.();

  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  overlayFX.tick();

  if (isInMiniGame) {
    miniGameManager.update(deltaTime);
    miniGameManager.draw(gameCtx);
    playArea.draw(deltaTime);
    runIntroOverlay();

    // If intro is running (or game isn't ready), hold gameplay
    if (INTRO.running || !gameReady) {
      renderFxLayer();
      drawScore();
      drawScorePopups();
      animationFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    const ready = miniGameManager.isReady();
    const done = miniGameManager.isSequenceCompleted();

    if (ready && !miniGameManager.hasStarted) {
      miniGameManager.hasStarted = true;
      elapsedTime = 0;
      lastTime = timestamp;
      gameTime = clockNowSec();
      showMiniGameTimeBar();
    }

    // ⏳ Wait until intro is fully done before starting gameplay timer
    if (!miniGameManager.hasStarted) {
      // No scoring during intro
      renderFxLayer();
      drawScore();
      drawScorePopups();
      updateHudCounters();
      animationFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    const levelDuration = 30;
    elapsedTime += deltaTime / 1000;
    const levelTimeRemaining = Math.max(0, levelDuration - elapsedTime);

    addScore((scoreIncreaseRate * deltaTime) / 1000);
    perfMeasure('fx', () => renderFxLayer());
    perfMeasure('hud', () => {
      drawScore();
      drawScorePopups();
      updateHudCounters();
    });
    updateTimeRemaining(levelTimeRemaining);
    updateDebugMenu();
    // PERF CSV: per-frame row (lazy; only if capturing) — NORMAL GAMEPLAY
    if (PERFCSV.capturing) {
      PERFCSV.frames.push({
        t: performance.now(),
        i: (__perfFrameIndex = (__perfFrameIndex || 0) + 1) - 1,
        rawDt,
        dt: deltaTime,
        fps: instFps,
        fpsE: fpsEMA,
        upd: PERF.last?.update || 0,
        play: PERF.last?.playArea || 0,
        fx: PERF.last?.fx || 0,
        hud: PERF.last?.hud || 0,
        spikes3s: PERF.spikeTimes.length,
        longTasks: PERF.longTasks,
        memMB: getMemoryMB(),
        level: currentLevel === 4 ? '∞' : currentLevel,
        cycle:
          currentLevel === 4 && shapeManager?.getInfiniteCycleIndex
            ? shapeManager.getInfiniteCycleIndex()
            : '',
        score,
      });
    }

    // PERF CSV: per-frame row (lazy; only if capturing)
    if (PERFCSV.capturing) {
      PERFCSV.frames.push({
        t: performance.now(),
        i: (__perfFrameIndex = (__perfFrameIndex || 0) + 1) - 1,
        rawDt,
        dt: deltaTime,
        fps: instFps,
        fpsE: fpsEMA,
        upd: PERF.last?.update || 0,
        play: PERF.last?.playArea || 0,
        fx: PERF.last?.fx || 0,
        hud: PERF.last?.hud || 0,
        spikes3s: PERF.spikeTimes.length,
        longTasks: PERF.longTasks,
        memMB: getMemoryMB(),
        level: currentLevel === 4 ? '∞' : currentLevel,
        cycle:
          currentLevel === 4 && shapeManager?.getInfiniteCycleIndex
            ? shapeManager.getInfiniteCycleIndex()
            : '',
        score,
      });
    }

    drawObjectiveTimeBar(levelTimeRemaining, levelDuration);

    if ((ready && done) || levelTimeRemaining <= 0) {
      // If the stub times out, treat it as a WIN (auto-complete)
      const name = miniGameManager.getName?.() || 'unknown';
      const timedOut = levelTimeRemaining <= 0;
      const isWin = (ready && done) || timedOut;

      bus.emit(isWin ? 'minigame:win' : 'minigame:lose', {
        id: name,
        via: timedOut ? 'timeout' : 'logic',
      });
      if (isWin) spawnParticleBurst(randomBrightColor()); // ensure RGB burst

      isInMiniGame = false;
      miniGameManager.reset();
      shapeManager.currentShape = null;
      hideTimeBar();
      if (gameMode === 'isolation') {
        if (__isolationMiniName) {
          // loop the same mini-game again
          isInMiniGame = true;
          pendingLevelAdvance = false;
          miniGameManager.reset();
          miniGameManager.setMiniGame(__isolationMiniName);
          bus.emit('minigame:start', { id: __isolationMiniName });
        } else {
          // no forced mini: stay idle and ensure no shape wakes up
          shapeManager.currentShape = null;
          shapeManager.remainingShapes = [];
          shapeManager.pickSet = [];
        }
        updateDebugMenu();
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }
      setTimeout(() => {
        if (pendingLevelAdvance && currentLevel < 4) {
          currentLevel += 1;
          bus.emit('level:advance', { to: currentLevel });
          logProgress(`Advancing to Level ${currentLevel}`);
          pendingLevelAdvance = false;
          grantRandomPowerUp('level');
        } else if (currentLevel === 4) {
          logProgress('Continuing in Infinite Mode');
        }

        // New shape run → fresh veil scope (prevents any mini-game veil carrying over)
        bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
        bus.emit('playArea/edgeScope');

        shapeManager.resetPickSet();
        shapeManager.setLevel(currentLevel, true);
        shapeManager.initPickSet(currentLevel);
        resetSequenceAndMaybeSpin();
        gameTime = clockNowSec();
        elapsedTime = 0;
        shapeWasReady = false;
        justBecameReady = false;
        updateDebugMenu();
      }, 500);

      animationFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
    return;
  }

  const shape = shapeManager.currentShape;
  const isReady = shape?.isReady?.() ?? false;
  justBecameReady = isReady && !shapeWasReady;
  shapeWasReady = isReady;

  if (justBecameReady) {
    shapeManager.currentShapeStarted = true;
    gameTime = clockNowSec();
    logProgress(`Timer started for Shape: ${shapeManager.getCurrentShapeName()}`);
  }

  let levelDuration = LEVELS[currentLevel - 1].duration;
  let levelTimeRemaining = !shape?.isReady?.()
    ? levelDuration
    : Math.max(0, levelDuration - (clockNowSec() - gameTime));

  // Optimize rendering: skip redundant draws
  runIntroOverlay();

  // Gate gameplay until intro completes and we flip gameReady
  if (INTRO.running || !gameReady) {
    renderFxLayer();
    drawScore();
    drawScorePopups();
    updateHudCounters();
    updateDebugMenu();
    animationFrameId = requestAnimationFrame(gameLoop);
    return;
  }

  if (shape) {
    perfMeasure('update', () => {
      shapeManager.update(deltaTime, currentLevel);
      shapeManager.draw(gameCtx);
    });
  }
  perfMeasure('playArea', () => playArea.draw(deltaTime));

  perfMeasure('fx', () => renderFxLayer());
  perfMeasure('hud', () => {
    drawScore();
    drawScorePopups();
    updateHudCounters();
  });
  updateTimeRemaining(levelTimeRemaining);
  updateDebugMenu();

  const isObjectiveReady = shape?.behaviorType === 'objective' && shape?.isReady?.();
  if (isInMiniGame) {
    drawObjectiveTimeBar(levelTimeRemaining, levelDuration);
  } else if (isObjectiveReady) {
    drawObjectiveTimeBar(levelTimeRemaining, levelDuration);
    if (timeBarCanvas.style.opacity === '0') showTimeBar();
  } else if (!isInMiniGame && timeBarCanvas.style.opacity !== '0') {
    hideTimeBar();
  }

  addScore((scoreIncreaseRate * deltaTime) / 1000);

  if (shapeManager.checkBoundary(playAreaX, playAreaY, playAreaSize)) {
    endGame();
    return;
  }

  const inFinalSequence = shape?.isInActiveSequence || false;
  const shapeDone = shapeManager.isSequenceCompleted?.() ?? false;

  if (!shape && shapeManager.remainingShapes.length > 0) {
    console.warn('⚠️ No current shape but remainingShapes is not empty. Resetting sequence.');
    resetSequenceAndMaybeSpin();
  }

  if (
    isReady &&
    shapeDone &&
    !shapeManager.currentShapeCompleted &&
    shapeManager.currentShapeStarted &&
    shape?.isReadyToPlay &&
    !inFinalSequence &&
    shape?.behaviorType !== 'survival'
  ) {
    shapeManager.markCurrentShapeComplete();
    bus.emit('shape:complete', {
      level: currentLevel,
      name: shapeManager.getCurrentShapeName(),
      behavior: shape?.behaviorType || 'survival',
      remaining: levelTimeRemaining,
      duration: levelDuration,
      mode: currentLevel === 4 ? 'infinite' : 'normal',
    });
    setTimeout(() => {
      resetSequenceAndMaybeSpin();
      gameTime = clockNowSec();
      updateDebugMenu();
      logProgress(`Shape completed: ${shapeManager.getCurrentShapeName()}`);

      if (gameMode === 'rotation' && shapeManager.isPickSetCompleted() && !isInMiniGame) {
        if (currentLevel < 4) {
          logProgress(`Level ${currentLevel} completed. Triggering mini-game.`);
          launchMiniGameAndAdvance();
        }
        // Level ∞ continues automatically; the reset/spin already happened above
      }
    }, TRANSITION_DELAY);
  }

  const behavior = shape?.behaviorType ?? 'survival';
  if (behavior === 'survival' && levelTimeRemaining <= 0 && !shapeManager.currentShapeCompleted) {
    if (shape) shape.forceComplete();
    shapeManager.markCurrentShapeComplete();
    bus.emit('shape:complete', {
      level: currentLevel,
      name: shapeManager.getCurrentShapeName(),
      behavior: shape?.behaviorType || 'survival',
      remaining: levelTimeRemaining,
      duration: levelDuration,
      mode: currentLevel === 4 ? 'infinite' : 'normal',
    });
    setTimeout(() => {
      const isFinalShape = shapeManager.isPickSetCompleted();
      if (isFinalShape && currentLevel < 4 && gameMode === 'rotation') {
        triggerMiniGameTransition();
        return;
      }

      resetSequenceAndMaybeSpin();
      gameTime = clockNowSec();
      updateDebugMenu();
      console.log('✅ Survival shape completed due to time:', shapeManager.getCurrentShapeName());
    }, 500);
  } else if (
    behavior === 'objective' &&
    levelTimeRemaining <= 0 &&
    !shapeDone &&
    !shapeManager.currentShapeCompleted
  ) {
    console.log('❌ Objective shape failed:', shapeManager.getCurrentShapeName());
    endGame();
    return;
  } else if (
    behavior === 'objective' &&
    levelTimeRemaining <= 0 &&
    shapeDone &&
    !shapeManager.currentShapeCompleted
  ) {
    shapeManager.markCurrentShapeComplete();
    bus.emit('shape:complete', {
      level: currentLevel,
      name: shapeManager.getCurrentShapeName(),
      behavior: shape?.behaviorType || 'survival',
      remaining: levelTimeRemaining,
      duration: levelDuration,
      mode: currentLevel === 4 ? 'infinite' : 'normal',
    });
    setTimeout(() => {
      resetSequenceAndMaybeSpin();
      gameTime = clockNowSec();
      updateDebugMenu();
      console.log('✅ Objective shape completed:', shapeManager.getCurrentShapeName());
    }, 500);
    if (!isInMiniGame && gameMode === 'rotation' && shapeManager.isPickSetCompleted()) {
      if (currentLevel < 4) {
        console.log(`🎯 Level ${currentLevel} completed. Transitioning to mini-game.`);
        triggerMiniGameTransition();
      } else {
        resetSequenceAndMaybeSpin();
        gameTime = clockNowSec();
        console.log('🔁 Infinite mode pick set refreshed');
      }
    }
  } else if (
    behavior === 'sequence' &&
    levelTimeRemaining <= 0 &&
    shapeDone &&
    !shapeManager.currentShapeCompleted
  ) {
    shapeManager.markCurrentShapeComplete();
    bus.emit('shape:complete', {
      level: currentLevel,
      name: shapeManager.getCurrentShapeName(),
      behavior: shape?.behaviorType || 'survival',
      remaining: levelTimeRemaining,
      duration: levelDuration,
      mode: currentLevel === 4 ? 'infinite' : 'normal',
    });
    setTimeout(() => {
      resetSequenceAndMaybeSpin();
      gameTime = clockNowSec();
      updateDebugMenu();
      console.log('✅ Sequence shape completed:', shapeManager.getCurrentShapeName());
    }, 500);
  } else if (behavior === 'sequence' && levelTimeRemaining <= 0 && !shapeDone) {
    console.log('❌ Sequence shape failed:', shapeManager.getCurrentShapeName());
    endGame();
    return;
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

// DEV keyboard helpers, de-duped and guarded against text inputs
function registerDebugHotkeys() {
  const DEV = window.__DEV__ !== false;
  if (!DEV) return;

  const isTyping = () => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
  };

  window.addEventListener('keydown', (e) => {
    if (!DEV || e.repeat || isTyping()) return;

    const k = e.key.toLowerCase();

    // Toggle Debug Menu – 'W'
    if (k === 'w') {
      e.preventDefault();
      window.__debugUI?.ensureToggle?.(); // create if needed
      document.getElementById('debugToggleBtn')?.click?.();
      return;
    }

    // Force Win – Space
    if (k === ' ') {
      e.preventDefault();
      window.__forceComplete?.();
      return;
    }

    // Force Lose – 's'
    if (k === 's') {
      e.preventDefault();
      window.__loseNow?.();
      return;
    }

    // Difficulty down / up – 'a' / 'd'
    if (k === 'a') {
      e.preventDefault();
      window.__diffDown?.();
      return;
    }
    if (k === 'd') {
      e.preventDefault();
      window.__diffUp?.();
      return;
    }

    // Optional: restart run – 'r'
    if (k === 'r') {
      e.preventDefault();
      if (window.__router?.getState() === 'GAME') {
        window.__restartRun?.();
      }
    }
  });
}

// =============== INPUT HANDLERS ================
gameCanvas.addEventListener('click', handleClick);

function handleClick(event) {
  if (!gameActive || !gameReady || INTRO.running) return;
  const { x, y } = {
    x: event.clientX - gameCanvas.getBoundingClientRect().left,
    y: event.clientY - gameCanvas.getBoundingClientRect().top,
  };
  if (shapeManager.handleClick(x, y)) {
    addScore(10, { reason: 'interaction' });
  }
}

// =========== UI BUTTONS =============
function createStartButton() {
  const startButton = document.createElement('button');
  startButton.textContent = 'Start Game';
  startButton.style.cssText =
    'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; padding: 10px 20px; z-index: 11;';
  startButton.addEventListener('click', () => {
    document.body.removeChild(startButton);
    startGame();
  });
  document.body.appendChild(startButton);
}

function createEndButton() {
  if (document.getElementById('endGameButton')) return;
  const endButton = document.createElement('button');
  endButton.id = 'endGameButton';
  endButton.textContent = 'End Game';
  endButton.style.cssText =
    'position: absolute; top: 20px; right: 20px; font-size: 16px; padding: 5px 10px; z-index: 11;';
  endButton.addEventListener('click', endGame);
  document.body.appendChild(endButton);
}

// =========== INIT ============

document.addEventListener('DOMContentLoaded', () => {
  scoreboardCanvas.style.display = 'none';
  timeBarCanvas.style.display = 'none';
  timeBarCanvas.style.opacity = '0';

  createDebugMenu();
  createDebugToggleBtn();
  ensureFPSOverlay(); // top-center FPS text
  registerDebugHotkeys(); // Space/W/S/A/D bindings
  // Optional: run validators only when requested (?verify=1)
  if (new URLSearchParams(location.search).get('verify') === '1') {
    import('./ShapeManager.js')
      .then((m) =>
        m.validateAllShapes(
          playAreaX + playAreaSize / 2,
          playAreaY + playAreaSize / 2,
          50,
          '#ffffff'
        )
      )
      .catch((err) => console.warn('[verify] failed:', err));
  }
});
