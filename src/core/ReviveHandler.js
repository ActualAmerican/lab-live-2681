// core/ReviveHandler.js
import RevivePopup from '../ui/RevivePopup.js';

export default class ReviveHandler {
  constructor(opts) {
    this.bus = opts.bus;
    this.hud = opts.hud;
    this.scoreboard = opts.scoreboard;
    this.timeBar = opts.timeBar;
    this.playArea = opts.playArea;
    this.shapeManager = opts.shapeManager;
    this.miniGameManager = opts.miniGameManager;
    this.FxRenderer = opts.FxRenderer;

    // state get/set closures supplied by main.js
    this.get = {
      score: opts.getScore,
      runRevives: opts.getRunRevives,
      lastDeath: opts.getLastDeath,
      currentLevel: opts.getCurrentLevel,
      gameReady: opts.getGameReady,
      gameActive: opts.getGameActive,
      pendingLevelAdvance: opts.getPendingLevelAdvance,
    };
    this.set = {
      score: opts.setScore,
      runRevives: opts.setRunRevives,
      lastDeath: opts.setLastDeath,
      currentLevel: opts.setCurrentLevel,
      gameReady: opts.setGameReady,
      gameActive: opts.setGameActive,
      pendingLevelAdvance: opts.setPendingLevelAdvance,
    };

    this.INTRO = opts.INTRO; // ref to IntroSequence state
    this.startIntroSequence = opts.startIntroSequence;
    this.resumeLoop = opts.resumeLoop; // schedules RAF(gameLoop) and sets flags
    this.startGame = opts.startGame; // fresh run restart
  }

  applyRevivePenalty(pct = 0.05) {
    const s = Math.floor(this.get.score() * (1 - pct));
    this.set.score(s);
  }

  prepReviveIntro() {
    // stop any end-fade loop (caller handles in main, but safe here)
    try {
      /* no-op; kept minimal */
    } catch {}

    try {
      this.playArea.resetIntro?.();
      this.playArea.unlockVisible?.();
      this.playArea.fadeTo?.(0, 0);
    } catch {}

    try {
      this.bus.emit?.('playArea/clearEdgeMasks', { animate: false, __force: true });
      this.bus.emit?.('playArea/edgeScope');
    } catch {}

    try {
      this.hud.hide?.();
      this.hud.resetAnimations?.();
    } catch {}
    try {
      this.scoreboard.hide?.();
      this.scoreboard.resetTypewriter?.();
    } catch {}
  }

  continueAfterRevive() {
    try {
      this.bus.emit?.('playArea/clearEdgeMasks', { animate: false, __force: true });
      this.bus.emit?.('playArea/edgeScope');
    } catch {}

    const death = this.get.lastDeath?.();
    if (death?.type === 'shape') {
      try {
        // 1) clear stale death so loop doesn’t immediately re-kill
        this.set.lastDeath(null);

        // 2) mark the failed shape complete (removes it from remainingShapes)
        this.shapeManager.markCurrentShapeComplete?.();

        // 3) force the main loop to pick a new current shape on the next frame
        this.shapeManager.currentShape = null;

        // 4) hide timer for a frame; it’ll show again when the next shape is ready
        this.timeBar.hide?.();

        // 5) tell main.js to reset its timers/counters before resuming
        this.bus.emit?.('revive:continue', { type: 'shape', from: death });
      } catch (e) {
        console.warn('[revive] shape-branch resume error', e);
      }
      return;
    } else if (death?.type === 'mini') {
      try {
        // treat mini failure as pass and proceed (rotation behavior)
        this.miniGameManager.reset();
        if (this.get.pendingLevelAdvance?.() && this.get.currentLevel() < 4) {
          this.set.currentLevel(this.get.currentLevel() + 1);
          this.bus.emit?.('level:advance', { to: this.get.currentLevel() });
          this.set.pendingLevelAdvance(false);
        }
        this.shapeManager.resetPickSet();
        this.shapeManager.setLevel(this.get.currentLevel(), true);
        this.shapeManager.initPickSet(this.get.currentLevel());
        this.bus.emit?.('revive:continue', { type: 'mini', from: death });
      } catch (e) {
        console.warn('[revive] mini-game resume error', e);
      }
    }
  }

  showGameOverPopup() {
    const runRevives = this.get.runRevives?.() || 0;
    RevivePopup.show({
      score: this.get.score?.() || 0,
      runRevives,
      onRestart: () => this.startGame(),
      onRevive: (method) => {
        // bookkeeping
        this.set.runRevives(runRevives + 1);
        try {
          this.bus.emit?.('revive:used', { runRevives: this.get.runRevives?.(), method });
        } catch {}

        // penalty
        this.applyRevivePenalty(0.05);

        // prep & run intro in revive mode
        this.prepReviveIntro();
        this.set.gameReady(false);
        this.INTRO.mode = 'revive';
        this.INTRO.onComplete = () => {
          this.continueAfterRevive();
        };

        // drive intro frames and resume main loop
        this.set.gameActive(true);
        this.startIntroSequence();
        this.resumeLoop();
      },
    });
  }
}
