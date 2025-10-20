// src/modes/RotationMode.js
import GameState from '../core/GameState.js';
import { miniGameRegistry } from '../minigames/miniGames.js';

let bus = null;
let shapeMgr = null;
let miniMgr = null;
let timeBar = null;

let _miniActive = false;

function _pickMiniName() {
  // Stable default: first enabled entry with a classRef
  const entry = miniGameRegistry.find((m) => m.classRef);
  return entry ? entry.name : 'SimonSays';
}

const RotationMode = {
  init({ bus: _bus, shapeManager, miniGameManager, timeBar: _timeBar }) {
    bus = _bus;
    shapeMgr = shapeManager;
    miniMgr = miniGameManager;
    timeBar = _timeBar;
  },

  startLevel(level) {
    GameState.currentLevel = level;
    GameState.isInMiniGame = false;
    _miniActive = false;
    shapeMgr.resetSequence(level);
    bus?.emit('level:start', { level });
  },

  update(dt) {
    if (GameState.isInMiniGame) {
      miniMgr.update(dt);
      // transition handled by main via onMiniGameCompleted()
    } else {
      shapeMgr.update(dt, GameState.currentLevel);
      // transition handled by main via onShapeCompleted()
    }
  },

  // Called by main.js when a shape’s sequence says “done”
  onShapeCompleted() {
    shapeMgr.markCurrentShapeComplete();

    // If the whole pick set is done → launch a mini-game and then advance level
    if (shapeMgr.isPickSetCompleted() && GameState.currentLevel < 4) {
      const name = _pickMiniName();
      this.startMiniGame(name);
      return;
    }

    // Otherwise, keep rotating through the same level’s remaining set
    shapeMgr.resetSequence(GameState.currentLevel);
  },

  // Called by main.js when a mini-game reports completion
  onMiniGameCompleted() {
    _miniActive = false;
    GameState.isInMiniGame = false;
    // Level-up after every mini-game at levels 1-3
    if (GameState.currentLevel < 4) {
      GameState.currentLevel += 1;
    }
    shapeMgr.resetSequence(GameState.currentLevel);
    bus?.emit('level:advance', { level: GameState.currentLevel });
  },

  // ————— Time bar policy intent for main.js —————
  getTimeBarIntent() {
    const miniLive = GameState.isInMiniGame || _miniActive || !!miniMgr?.getName?.();

    if (miniLive) {
      const t = miniMgr.getTimerInfo?.() || { remaining: 0, duration: 0 };
      return {
        mode: 'mini',
        remaining: t.remaining ?? 0,
        duration: t.duration ?? 0,
        color: miniMgr.getTimerColor?.(),
      };
    }

    // Objective shapes can show their own timer
    const s = shapeMgr.currentShape;
    const type = shapeMgr.getCurrentShapeType?.() || (s?.behaviorType ?? 'survival');
    if (type === 'objective' && s?.getTimerInfo) {
      const t = s.getTimerInfo();
      return {
        mode: 'objective',
        remaining: t.remaining ?? 0,
        duration: t.duration ?? 0,
        color: '#ffffff',
      };
    }
    return { mode: 'hidden' };
  },

  // ————— DEV helpers —————
  forceGo(shapeName) {
    // Prewarm and make <shapeName> the first shape at the current level
    shapeMgr.forceRotation({ level: GameState.currentLevel, shapeName });
    GameState.isInMiniGame = false;
    _miniActive = false;
    bus?.emit('dev:rotation-forced', { level: GameState.currentLevel, shapeName });
  },

  startMiniGame(name) {
    const chosen = name || _pickMiniName();
    miniMgr.setMiniGame(chosen);
    GameState.isInMiniGame = true;
    _miniActive = true;
    bus?.emit('mini:launch', { name: chosen, level: GameState.currentLevel });
  },
};

export default RotationMode;
