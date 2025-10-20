// src/MiniGameManager.js
import { miniGameRegistry } from './minigames/miniGames.js';
import { getRandomShapeColor } from './shapes/shapes.js'; // ✅ import it

class MiniGameManager {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.currentMiniGame = null;
    this.timerColor = getRandomShapeColor(); // 🆕
    // Back-compat flags used by loop/UI policy
    this.hasStarted = false; // flips true once the stub says it's ready
    this.playIntro = false; // while the stub runs its intro fade
    this.introTimer = 0; // used only by some stubs

    // Start when gameplay actually begins
    this._t0 = null;
  }

  setMiniGame(name) {
    const entry = miniGameRegistry.find((m) => m.name === name && m.classRef);
    if (!entry) {
      console.error('Mini-game not found:', name);
      return;
    }
    this.currentMiniGame = new entry.classRef(this.x, this.y, this.size);
    if (typeof this.currentMiniGame.reset === 'function') {
      this.currentMiniGame.reset();
    }
    this.timerColor = getRandomShapeColor(); // 🆕 pick new color every mini-game
    const bus = window.bus;
    bus?.emit('mini:start', { name });
    this.playIntro = true;
    this.introTimer = 0;
  }

  getTimerColor() {
    return this.timerColor;
  }

  getTimerInfo() {
    const gm = this.currentMiniGame;
    if (!gm) return { remaining: 0, duration: 0 };

    // Prefer a direct struct if the stub provides it
    if (typeof gm.getTimerInfo === 'function') return gm.getTimerInfo();

    // Determine duration (prefer explicit values/APIs)
    const duration =
      (Number.isFinite(gm.durationSec) && gm.durationSec) ??
      (Number.isFinite(gm.maxTimeSec) && gm.maxTimeSec) ??
      (typeof gm.getDurationSec === 'function' && gm.getDurationSec()) ??
      (typeof gm.getMaxTimeSec === 'function' && gm.getMaxTimeSec()) ??
      8;

    // Determine elapsed: prefer the stub; else use our stopwatch
    const elapsedProvided =
      (typeof gm.getElapsedSec === 'function' && gm.getElapsedSec()) ??
      (typeof gm.getTimeElapsedSec === 'function' && gm.getTimeElapsedSec());

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = Number.isFinite(elapsedProvided)
      ? elapsedProvided
      : this._t0
      ? (nowMs - this._t0) / 1000
      : 0;

    return {
      remaining: Math.max(0, duration - Math.max(0, elapsed)),
      duration,
    };
  }

  update(deltaTime) {
    if (!this.currentMiniGame) return;
    // Advance the stub’s own introTimer
    this.currentMiniGame.update(deltaTime);

    // When the stub is ready (or has no isReady at all), exit the intro.
    // We leave `hasStarted` for main.js to flip so it can call timeBar.show() exactly once.
    if (this.playIntro) {
      const gm = this.currentMiniGame;
      const ready = typeof gm?.isReady === 'function' ? !!gm.isReady() : true; // 🆕 default ready
      if (ready) {
        this.playIntro = false;
        const bus = window.bus;
        bus?.emit('mini:ready', { name: this.getName() });
        // (optional) start the internal stopwatch here if you use getTimerInfo() elsewhere:
        this._t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      }
    }
  }

  draw(ctx) {
    if (!this.currentMiniGame) return;
    const gm = this.currentMiniGame;

    // compute alpha from the stub’s own introTimer / introDuration
    const alpha =
      this.playIntro && gm.introDuration > 0 ? Math.min(1, gm.introTimer / gm.introDuration) : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    gm.draw(ctx);
    ctx.restore();
  }

  handleClick(x, y) {
    return this.currentMiniGame?.handleClick?.(x, y) ?? false;
  }

  isReady() {
    const gm = this.currentMiniGame;
    if (!gm) return false;
    return typeof gm.isReady === 'function' ? !!gm.isReady() : true; // 🆕 default ready
  }

  isSequenceCompleted() {
    if (!this.currentMiniGame || typeof this.currentMiniGame.isSequenceCompleted !== 'function') {
      return false;
    }
    const done = this.currentMiniGame.isSequenceCompleted();
    if (done && !this._reportedEnd) {
      this._reportedEnd = true;
      const bus = window.bus;
      // If your mini-game exposes win/elapsed, pass them; otherwise we send best-effort.
      const info = {
        name: this.getName(),
        win:
          typeof this.currentMiniGame.getResult === 'function'
            ? !!this.currentMiniGame.getResult()?.win
            : true,
        durationSec:
          (typeof this.currentMiniGame.getElapsedSec === 'function'
            ? this.currentMiniGame.getElapsedSec()
            : 0) | 0,
      };
      bus?.emit('mini:complete', info);
    }
    return done;
  }

  reset() {
    this.currentMiniGame?.reset?.();
    this.currentMiniGame = null;
    this.hasStarted = false;
    this.playIntro = false;
    this.introTimer = 0;
  }

  getName() {
    return this.currentMiniGame?.name ?? '';
  }
}

export default MiniGameManager;
