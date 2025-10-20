// src/core/GameCore.js
import GameState from './GameState.js';
import GameLoop from './GameLoop.js';

const GameCore = (() => {
  let bus = null;

  // deps supplied by main.js (thin callbacks)
  let deps = {
    startGame: null,
    pauseGame: null,
    resumeGame: null,
    endGame: null,
    isGameResumable: null,
    getRouter: null,
    setRouter: null,
    // NEW: pure frame work that GameLoop will call
    frameTick: null, // (dt, now) => void
    onFrameEnd: null, // optional ({dt, now, fps}) => void
    getPaused: () => GameState.paused,
  };

  function init(options = {}) {
    bus = options.bus || bus;
    deps = { ...deps, ...options };
    GameLoop.init({
      tick: (dt, now) => deps.frameTick?.(dt, now),
      onFrameEnd: (info) => deps.onFrameEnd?.(info),
    });

    if (typeof window !== 'undefined') window.__GameCore = GameCore;
  }

  // Centralized route guard so main.js isn’t making decisions directly.
  function routeGuard({ to, from }) {
    const active = GameState.gameActive;
    const paused = GameState.paused;

    if (to === 'GAME') {
      if (!active) start();
      else if (paused) resume();
      return;
    }

    if (from === 'GAME' && to !== 'GAME') {
      if (active && !paused) pause();
    }
  }

  function wireBusNavigation(eventsBus) {
    if (!eventsBus) return;
    eventsBus.on('router:navigate', ({ to, from }) => routeGuard({ to, from }));
  }

  // Loop controls (GameCore is the single place that starts/stops RAF)
  function start(opts) {
    deps.startGame?.(opts);
    GameLoop.start();
  }
  function pause() {
    deps.pauseGame?.();
    GameLoop.stop();
  }
  function resume() {
    deps.resumeGame?.();
    GameLoop.start();
  }
  function end() {
    deps.endGame?.();
    GameLoop.stop();
  }

  function getFPS() {
    return GameLoop.getFPS();
  }

  return { init, routeGuard, wireBusNavigation, start, pause, resume, end, getFPS };
})();

export default GameCore;
