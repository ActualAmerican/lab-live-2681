// THIS IS THE TEST MESSAGE! LOOK HERE!
// main.js
import { showPauseOverlay, hidePauseOverlay } from './ui/PauseOverlay.js';
import ReviveHandler from './core/ReviveHandler.js';
import GameCore from './core/GameCore.js';
import GameState from './core/GameState.js';
import ModeRegistry from './modes/ModeRegistry.js';
import RotationMode from './modes/RotationMode.js';
import IsolationMode from './modes/IsolationMode.js';
import ProfileStore from './libs/ProfileStore.js';
import StatsTracker from './libs/StatsTracker.js';
import DebugMenu from './ui/DebugMenu.js';
import Scoreboard from './ui/Scoreboard.js';
import PlayArea from './PlayArea.js';
import TimeBar from './ui/TimeBar.js';
import {
  initIntroSequence,
  startIntroSequence,
  runIntroOverlay,
  INTRO,
} from './core/IntroSequence.js';
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
import MasteryManager from './libs/MasteryManager.js';
import RevivePopup from './ui/RevivePopup.js';
import initAppRouter from './ui/AppRouter.js';
import {
  perfMeasure,
  getPerfSnapshot,
  setPerfCsvEnabled,
  getPerfCsvStatus,
  perfLogEvent,
  buildPerfCSV,
  buildPerfSummary,
  onRunStart as perfOnRunStart,
  onRunEnd as perfOnRunEnd,
  tickFps,
  getFPS as getFPSValue,
  recordPerfFrame,
} from './systems/PerfMonitor.js';
import { ensureFPSOverlay, setFPSOverlay, getFPSOverlay, updateFPS } from './ui/FPSOverlay.js';
import FxRenderer from './effects/FxRenderer.js';

// DEV guard — set in index.html  (dev builds only)
const DEV = !!window.__DEV__;
let DEBUG_SPEED = 1; // 1.0x by default (dev-only override via Debug Menu)
let clockSec = 0; // scaled internal clock (sec)
const clockNowSec = () => clockSec;
const clockReset = () => {
  clockSec = 0;
};

let totalShapesCompleted = 0; // run-wide tally (resets only at startGame)

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

function randomBrightColor() {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h}, 100%, 65%)`;
}

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
  // brighter, faster light-burst near the popup text origin (viewport space)
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

// --- PlayArea bootstrap (authoritative square inside the canvas) ---
const playArea = new PlayArea(gameCanvas, { top: 0, padding: 0, borderPx: 2 });
playArea.exportGlobals(); // sets window.playAreaX/Y/Size for legacy code

// keep canvases aligned to the square’s right edge
loadShapeRegistry();

function handleResize() {
  // if you later change gameCanvas size, do that first, then:
  playArea.resize(); // recompute square + globals
  timeBar.updatePosition(); // keep timebar glued
  syncTimeBarToPlayArea();
}

function logProgress(message) {
  if (localStorage.getItem('LOG_PROGRESS') === '1') {
    console.log(`[PROGRESS] ${message}`);
  }
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

updateTimeBarPosition();
function updateHUDPosition() {
  const canvasRect = gameCanvas.getBoundingClientRect();
  hud.container.style.left = `${canvasRect.left + gameCanvas.width / 2}px`; // Center relative to canvas
  hud.container.style.top = `${canvasRect.bottom + 20}px`; // 20px below canvas (matches original bottom: 20px)
  hud.container.style.transform = 'translateX(-50%)'; // Keep centered
}

window.addEventListener('resize', updateHUDPosition);

// Game state
let score = 0;
// Revive state (per run)
let runRevives = 0; // 0, 1, or 2
let __lastDeath = null; // { type: 'shape'|'mini', level, name }
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

  scoreboard.spawnPopup(delta, info);

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

let __router = null;
let __paused = false;

function isGameResumable() {
  return !!gameActive;
}

function pauseGame() {
  if (!gameActive || __paused) return;
  __paused = true;

  bus.emit('game:pause');
  bus.emit('timer:pause');
  showPauseOverlay({
    onResume: () => resumeGame(),
    onMenu: () => {
      hidePauseOverlay();
      __router && __router.navigate('MAIN');
    },
  });
}

function resumeGame() {
  if (!gameActive) return;
  hidePauseOverlay();
  __paused = false;
  bus.emit('game:resume');
  bus.emit('timer:resume');
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

// Phase 1 binding: expose main.js state to GameState (no behavior change)
GameState.init({
  getters: {
    score: () => score,
    personalBest: () => personalBest,
    currentLevel: () => currentLevel,
    gameActive: () => gameActive,
    gameReady: () => gameReady,
    isInMiniGame: () => isInMiniGame,
    pendingLevelAdvance: () => pendingLevelAdvance,
    paused: () => __paused,
  },
  setters: {
    score: (v) => (score = v),
    personalBest: (v) => (personalBest = v),
    currentLevel: (v) => (currentLevel = v),
    gameActive: (v) => (gameActive = v),
    gameReady: (v) => (gameReady = v),
    isInMiniGame: (v) => (isInMiniGame = v),
    pendingLevelAdvance: (v) => (pendingLevelAdvance = v),
    paused: (v) => (__paused = v),
  },
});

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

FxRenderer.init({
  playArea,
  bus,
  isIntroRunning: () => INTRO.running,
  shouldRenderEdges: () => !INTRO.running && performance.now() >= EDGE_VEIL_UNLOCK_AT && gameReady,
});

// === Scoreboard (externalized) ===
const scoreboard = new Scoreboard({
  gameCanvas,
  bus,
  getPlayAreaMetrics: () => {
    const rect = gameCanvas.getBoundingClientRect();
    return {
      rightEdge: rect.left + window.playAreaX + window.playAreaSize,
      top: rect.top - 80,
      playAreaSize: window.playAreaSize,
    };
  },
});
scoreboard.setWidthByPlayArea(window.playAreaSize);
scoreboard.updatePosition();

scoreboard.setGetters({
  getScore: () => score,
  getBestScore: () => personalBest,
  getActive: () => gameActive,
});
scoreboard.setColorResolver((name) => {
  const s = (shapeRegistry || []).find((sh) => sh.name === name);
  return s?.color || '#FFFFFF';
});

// --- Time Bar (extracted module) ---
const timeBar = new TimeBar({
  gameCanvas,
  playArea,
  bus,
  getMiniTimerColor: () => miniGameManager.getTimerColor?.() || '#ffffff',
});
timeBar.mount();
window.addEventListener('resize', handleResize);
const revive = new ReviveHandler({
  bus,
  hud,
  scoreboard,
  timeBar,
  playArea,
  shapeManager,
  miniGameManager,
  FxRenderer,
  // state accessors
  getScore: () => score,
  setScore: (v) => {
    score = Math.max(0, v | 0);
    refreshUpgradeAffordance?.();
  },
  getRunRevives: () => runRevives,
  setRunRevives: (v) => (runRevives = v),
  getLastDeath: () => __lastDeath,
  setLastDeath: (v) => (__lastDeath = v),
  getCurrentLevel: () => currentLevel,
  setCurrentLevel: (v) => (currentLevel = v),
  getGameReady: () => gameReady,
  setGameReady: (v) => (gameReady = !!v),
  getGameActive: () => gameActive,
  setGameActive: (v) => (gameActive = !!v),
  getPendingLevelAdvance: () => pendingLevelAdvance,
  setPendingLevelAdvance: (v) => (pendingLevelAdvance = !!v),
  INTRO,
  startIntroSequence,
  // resume the main loop exactly like your revive did
  resumeLoop: () => GameCore.resume(),

  startGame: (opts) => startGame(opts),
});

// keep it aligned when the PlayArea or canvas changes
function syncTimeBarToPlayArea() {
  timeBar.setWidthByPlayArea();
  timeBar.updatePosition();
}
window.addEventListener('resize', syncTimeBarToPlayArea);
window.addEventListener('scroll', () => timeBar.updatePosition(), { passive: true });
// Back-compat shims so existing calls still work
function hideTimeBar() {
  try {
    timeBar.hide();
  } catch {}
}
function showTimeBar(opts) {
  try {
    timeBar.show(opts);
  } catch {}
}
function updateTimeBarPosition() {
  try {
    timeBar.updatePosition();
  } catch {}
}

// === Mode Registry (singleton) ==============================================
ModeRegistry.init({
  bus,
  shapeManager,
  miniGameManager,
  timeBar,
});

// Keep a local alias so the rest of main.js can keep calling `modes.*`
const modes = ModeRegistry;

// Make sure registry mirrors our current boot mode
modes.setActive(gameMode);

// Optional: tiny hooks we may want even before we migrate logic out of main.js
const modeHooks = {
  onEnter: (id) => {
    // keep main.js as truth for now
    if (id === 'rotation' || id === 'isolation') {
      // ensure ShapeManager reflects the current mode for any mode-specific logic
      try {
        shapeManager.setMode?.(id);
      } catch {}
      // Isolation shows no time bar on entry by design (rotation manages it normally)
      if (id === 'isolation') {
        try {
          hideTimeBar?.();
        } catch {}
      }
    }
  },
  onExit: (_id) => {
    // no-op for now
  },
};

// Initialize mode singletons (no constructors, no registry needed)
RotationMode.init?.({ bus, shapeManager, miniGameManager, timeBar, hooks: modeHooks });
IsolationMode.init?.({ bus, shapeManager, miniGameManager, timeBar, hooks: modeHooks });

// Activate the boot mode
modes.setActive(gameMode);

// Expose for dev tools
window.__modes = {
  list: () => modes.list?.() ?? ['rotation', 'isolation'],
  getActiveId: () => modes.getActiveId?.() ?? modes.active ?? 'rotation',
};

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

// Router boot now lives in a dedicated module.
// We keep gameplay start/pause/resume logic here so nothing else changes.
(async function boot() {
  const r = await initAppRouter({ bus });
  window.__router = r;

  bus.on('router:navigate', ({ to, from }) => GameCore.routeGuard({ to, from }));
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
  if (e.key !== 'Escape') return;
  if (__router?.getState() === 'GAME') {
    // centralize via GameCore
    if (__paused) GameCore.resume();
    else GameCore.pause();
  } else {
    __router?.back();
  }
});

// PERF CSV: arm/disarm on run start/end, and snapshot meta
function __perfOnRunStart() {
  perfOnRunStart({
    dpr: window.devicePixelRatio || 1,
    canvasW: gameCanvas?.width || 0,
    canvasH: gameCanvas?.height || 0,
    speed: DEBUG_SPEED || 1,
  });
}
function __perfOnRunEnd() {
  perfOnRunEnd();
}

// On revive, reset frame/timing so the next shape gets a clean timer
bus.on('revive:continue', ({ type }) => {
  // reset frame/timing so the next thing (mini or next shape) gets a clean timer
  elapsedTime = 0;
  gameTime = clockNowSec();
  shapeWasReady = false;
  justBecameReady = false;

  // If we revived from a shape death, and that shape was the LAST in the set,
  // go directly to the transitional mini-game (Rotation mode).
  if (type === 'shape') {
    const isFinalShape =
      typeof shapeManager.isPickSetCompleted === 'function'
        ? !!shapeManager.isPickSetCompleted()
        : (shapeManager.remainingShapes?.length ?? 0) === 0;

    if (gameMode === 'rotation' && isFinalShape && !isInMiniGame) {
      // Prewarm + set flags + start mini (handled inside)
      triggerMiniGameTransition();
      return; // ⛔ don't reset/pick the next shape
    }

    // Otherwise (not the last), advance to the next shape now that the failed one
    // has been marked complete by ReviveHandler.
    if (!shapeManager.currentShape) {
      resetSequenceAndMaybeSpin();
    }
  }
});

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
  // Keep the existing state variable for 100% backward-compat
  gameMode = mode;

  // Switch via registry so future modes/features flow through one place
  try {
    modes.setActive(mode);
  } catch (e) {
    console.warn('[Mode] switch failed', e);
  }

  // Preserve legacy side-effects for Isolation exit
  if (mode !== 'isolation') __isolationMiniName = null;
}

function __setLevel(lvl) {
  if (gameMode !== 'isolation') {
    console.log('[Debug] setLevel ignored in rotation mode');
    return;
  }
  hideTimeBar();
  selectedDebugLevel = lvl;
  currentLevel = lvl;
  // Rebuild the pick set; let the frame loop pop the first shape.
  shapeManager.setLevel(currentLevel, false);
  shapeManager.initPickSet(currentLevel);
  resetSequenceAndMaybeSpin();
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

      // Rebuild the pick set, then pop the first shape exactly once
      shapeManager.setLevel(currentLevel, false);
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
  __restartRun: () => GameCore.start(),
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
    getFPS: () => getFPSValue(),
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

// Small buffer so edge veils can't erase the border on the very first frame after intro
let EDGE_VEIL_UNLOCK_AT = 0;

function _chooseVariant() {
  const pool = ['wipe', 'scale', 'grid', 'assemble'];
  return pool[Math.floor(Math.random() * pool.length)];
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

  // 4) hard-reset global intro gate so only ONE fresh intro runs
  INTRO.running = false;
  INTRO.t0 = 0;
  INTRO._hudStarted = false;
  INTRO._sbStarted = false;
  INTRO.mode = 'new'; // ← Restart must use the full start intro (HUD + scoreboard)
  INTRO.onComplete = null; // ← clear any leftover revive handoff

  // 5) reset PlayArea visual state to a known baseline
  playArea.resetIntro?.(); // clears prior intro/fade/lock
  playArea.unlockVisible?.(); // ensure new intros are allowed
  playArea.fadeTo(0, 0); // start fully hidden; intro will fade in

  // 6) fresh run bookkeeping
  const revive = !!opts.revive;
  gameActive = true;
  // On a full fresh start, wipe revive count and death marker
  if (!revive) {
    runRevives = 0;
    __lastDeath = null;
  }
  bus.emit('run:start', { ts: Date.now() });
  __runStartMs = performance.now();
  bus.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
  bus.emit('playArea/edgeScope'); // new FX scope for veils
  // Keep HUD hidden; intro will reveal it with the correct timing
  try {
    hud.hide();
  } catch {}
  hud.resetAnimations();
  hud.resetAnimations();
  scoreboard.hide(); // scoreboard will fade in via intro
  scoreboard.resetTypewriter();

  initIntroSequence({
    gameCanvas,
    playArea,
    hud,
    scoreboard,
    bus,
    setGameReady: (v) => {
      gameReady = !!v;
    },
    setVeilUnlockAt: (ms) => {
      EDGE_VEIL_UNLOCK_AT = ms;
    },
  });

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
  // Build the pick set but do NOT pop the first shape yet.
  // The first pop happens in the first gameplay frame.
  shapeManager.setLevel(currentLevel, false);
  if (currentLevel === 4) {
    shapeManager.infiniteCycleIndex = 0;
  }
  shapeManager.initPickSet(currentLevel);

  // Ensure no constructor/default shape sneaks in before we pop the set
  shapeManager.currentShape = null;
  shapeManager.currentShapeStarted = false;
  shapeManager.currentShapeCompleted = false;
  shapeManager.inProgressShapes = [];

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
  createEndButton();

  queueMicrotask(() => {
    scoreboard?.updatePosition(playArea, timeBar);
  });
  if (DEV) {
    createDebugMenu();
    createDebugToggleBtn();
  }
  scoreboard?.updatePosition(playArea, timeBar);
  isInMiniGame = false;
  miniGameManager.reset();
  __isolationMiniName = null;
  scoreboard.draw();

  scoreboard.draw();
  FxRenderer.render({ playArea, gameReady });
  shapeManager.totalShapesCompleted = 0;

  logProgress(`Game started: Level ${currentLevel}, Shape: ${shapeManager.getCurrentShapeName()}`);
}

function drainOverlays() {
  try {
    FxRenderer.clear();
  } catch {}
  try {
    scoreboard?.clear?.();
  } catch {}
  try {
    timeBar?.hide?.();
  } catch {}
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
      FxRenderer.render({ playArea, gameReady });
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
  scoreboard.fadeOut(500);
  hideTimeBar();
  hud.setPulse(false);
  runEndFade(520);
  revive.showGameOverPopup();
  logProgress(`Game ended: Score ${score.toFixed(2)}`);
}

// Wire core controls to GameCore (router guard & external orchestration)
GameCore.init({
  bus,
  startGame,
  endGame,
  pauseGame,
  resumeGame,
  isGameResumable,
  getMode: () => gameMode,
  setMode: (m) => __setGameMode(m),
  // NEW: pure per-frame callback the loop will call
  frameTick,
  // Optional: drive an FPS overlay from the loop if you want
  onFrameEnd: ({ fps }) => {
    if (getFPSOverlay()) updateFPS(fps | 0);
  },
});

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

// ================ MAIN GAME FRAME (no RAF here) ================
function frameTick(dtSec, nowMs) {
  if (!gameActive) return;

  // raw (unscaled) frame time for true FPS; keep your existing FPS tools
  const rawDt = Math.min(dtSec * 1000, 100);

  // gameplay delta respects DEBUG_SPEED but FPS does not
  let deltaTime = rawDt * (DEBUG_SPEED || 1);
  clockSec += deltaTime / 1000;

  const { instFps, fpsE } = tickFps(rawDt);
  if (getFPSOverlay()) updateFPS(Math.round(fpsE));

  powerUps.tick?.();

  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  if (isInMiniGame) {
    miniGameManager.update(deltaTime);
    miniGameManager.draw(gameCtx);
    playArea.draw(deltaTime);
    runIntroOverlay();
    // keep drip alive during mini-game stubs (intro frames included)
    const frameScore = (scoreIncreaseRate * deltaTime) / 1000;
    addScore(frameScore, { reason: 'tick' });

    // If intro is running (or game isn't ready), hold gameplay
    if (INTRO.running || !gameReady) {
      FxRenderer.render({ playArea, gameReady });
      scoreboard.draw();

      scoreboard.draw();
      return;
    }

    const ready = miniGameManager.isReady();
    const done = miniGameManager.isSequenceCompleted();

    if (ready && !miniGameManager.hasStarted) {
      miniGameManager.hasStarted = true;
      elapsedTime = 0;
      gameTime = clockNowSec();
      timeBar.show({ mini: true });
    }

    // ⏳ Wait until intro is fully done before starting gameplay timer
    if (!miniGameManager.hasStarted) {
      // No scoring during intro
      FxRenderer.render({ playArea, gameReady });
      scoreboard.draw();

      scoreboard.draw();
      updateHudCounters();
      return;
    }

    const levelDuration = 30;
    elapsedTime += deltaTime / 1000;
    const levelTimeRemaining = Math.max(0, levelDuration - elapsedTime);

    perfMeasure('fx', () => FxRenderer.render({ playArea, gameReady }));
    perfMeasure('hud', () => {
      scoreboard.draw();

      scoreboard.draw();
      updateHudCounters();
    });

    updateTimeRemaining(levelTimeRemaining);
    updateDebugMenu();

    recordPerfFrame({
      rawDt,
      dt: deltaTime,
      instFps,
      level: currentLevel === 4 ? '∞' : currentLevel,
      cycle:
        currentLevel === 4 && shapeManager?.getInfiniteCycleIndex
          ? shapeManager.getInfiniteCycleIndex()
          : '',
      score,
    });

    timeBar.draw({
      remaining: levelTimeRemaining,
      duration: levelDuration,
      color:
        (isInMiniGame ? miniGameManager.getTimerColor?.() : shapeManager.currentShape?.color) ||
        '#ffffff',
    });

    timeBar.draw({
      remaining: levelTimeRemaining,
      duration: levelDuration,
      color:
        (isInMiniGame ? miniGameManager.getTimerColor?.() : shapeManager.currentShape?.color) ||
        '#ffffff',
    });

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
      timeBar.hide();
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

        // Rebuild the set, then pop exactly once via resetSequenceAndMaybeSpin()
        shapeManager.setLevel(currentLevel, false);
        shapeManager.initPickSet(currentLevel);
        resetSequenceAndMaybeSpin();

        gameTime = clockNowSec();
        elapsedTime = 0;
        shapeWasReady = false;
        justBecameReady = false;
        updateDebugMenu();
      }, 500);

      return;
    }

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
    FxRenderer.render({ playArea, gameReady });
    scoreboard.draw();

    scoreboard.draw();
    updateHudCounters();
    updateDebugMenu();
    return;
  }

  if (shape) {
    perfMeasure('update', () => {
      shapeManager.update(deltaTime, currentLevel);
      shapeManager.draw(gameCtx);
    });
  }
  perfMeasure('playArea', () => playArea.draw(deltaTime));

  perfMeasure('fx', () => FxRenderer.render({ playArea, gameReady }));
  perfMeasure('hud', () => {
    scoreboard.draw();

    scoreboard.draw();
    updateHudCounters();
  });
  updateTimeRemaining(levelTimeRemaining);
  updateDebugMenu();

  recordPerfFrame({
    rawDt,
    dt: deltaTime,
    instFps,
    level: currentLevel === 4 ? '∞' : currentLevel,
    cycle:
      currentLevel === 4 && shapeManager?.getInfiniteCycleIndex
        ? shapeManager.getInfiniteCycleIndex()
        : '',
    score,
  });

  const isObjectiveReady = shape?.behaviorType === 'objective' && shape?.isReady?.();

  if (isInMiniGame) {
    timeBar.draw({
      remaining: levelTimeRemaining,
      duration: levelDuration,
      color:
        (isInMiniGame ? miniGameManager.getTimerColor?.() : shapeManager.currentShape?.color) ||
        '#ffffff',
    });
  } else if (isObjectiveReady) {
    timeBar.draw({
      remaining: levelTimeRemaining,
      duration: levelDuration,
      color:
        (isInMiniGame ? miniGameManager.getTimerColor?.() : shapeManager.currentShape?.color) ||
        '#ffffff',
    });

    if (!timeBar.isVisible()) timeBar.show();
  } else if (!isInMiniGame && timeBar.isVisible()) {
    timeBar.hide();
  }

  addScore((scoreIncreaseRate * deltaTime) / 1000);

  if (shapeManager.checkBoundary(playAreaX, playAreaY, playAreaSize)) {
    __lastDeath = { type: 'shape', level: currentLevel, name: shapeManager.getCurrentShapeName() };
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
      // 🔑 Check final-shape BEFORE any reset
      const isFinalShape = shapeManager.isPickSetCompleted();

      if (gameMode === 'rotation' && isFinalShape && !isInMiniGame) {
        if (currentLevel < 4) {
          logProgress(`Level ${currentLevel} completed. Triggering mini-game.`);
          // Use our existing transition which prewarms the next level and sets flags
          triggerMiniGameTransition();
          return; // ⛔ do not rebuild pick set here
        }
        // ∞ mode: just roll forward
        resetSequenceAndMaybeSpin();
      } else {
        // Not final → normal next shape
        resetSequenceAndMaybeSpin();
      }

      gameTime = clockNowSec();
      updateDebugMenu();
      logProgress(`Shape completed: ${shapeManager.getCurrentShapeName()}`);
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
    __lastDeath = { type: 'shape', level: currentLevel, name: shapeManager.getCurrentShapeName() };
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
      const isFinalShape = shapeManager.isPickSetCompleted();

      if (gameMode === 'rotation' && isFinalShape && !isInMiniGame) {
        if (currentLevel < 4) {
          console.log(`🎯 Level ${currentLevel} completed. Transitioning to mini-game.`);
          triggerMiniGameTransition();
          return;
        }
        resetSequenceAndMaybeSpin(); // ∞ mode
      } else {
        resetSequenceAndMaybeSpin();
      }

      gameTime = clockNowSec();
      updateDebugMenu();
      console.log('✅ Objective shape completed:', shapeManager.getCurrentShapeName());
    }, 500);
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
      const isFinalShape = shapeManager.isPickSetCompleted();

      if (gameMode === 'rotation' && isFinalShape && !isInMiniGame) {
        if (currentLevel < 4) {
          triggerMiniGameTransition();
          return;
        }
        resetSequenceAndMaybeSpin(); // ∞ mode
      } else {
        resetSequenceAndMaybeSpin();
      }

      gameTime = clockNowSec();
      updateDebugMenu();
      console.log('✅ Sequence shape completed:', shapeManager.getCurrentShapeName());
    }, 500);
  } else if (behavior === 'sequence' && levelTimeRemaining <= 0 && !shapeDone) {
    console.log('❌ Sequence shape failed:', shapeManager.getCurrentShapeName());
    __lastDeath = { type: 'shape', level: currentLevel, name: shapeManager.getCurrentShapeName() };
    endGame();
    return;
  }
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
    GameCore.start();
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
  endButton.addEventListener('click', () => GameCore.end());
  document.body.appendChild(endButton);
}

// =========== INIT ============

document.addEventListener('DOMContentLoaded', () => {
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
