// src/modes/IsolationMode.js
import GameState from '../core/GameState.js';

let bus = null;
let shapeMgr = null;
let timeBar = null;

const IsolationMode = {
  id: 'isolation',
  title: 'Isolation',

  init({ bus: _bus, shapeManager, timeBar: _timeBar }) {
    bus = _bus;
    shapeMgr = shapeManager;
    timeBar = _timeBar;
  },

  // Called by main.js (via ModeRegistry) if you ever add a “Start” for Isolation.
  startLevel(level) {
    GameState.currentLevel = level;
    GameState.isInMiniGame = false;
    shapeMgr.resetSequence(level); // spawn the selected isolation shape
    bus?.emit('level:start', { level });
  },

  update(dt) {
    // No mini-games in Isolation — just run the active shape
    shapeMgr.update(dt, GameState.currentLevel);
  },

  onShapeCompleted() {
    // In Isolation we keep replaying the same chosen shape at the same level
    shapeMgr.markCurrentShapeComplete();
    shapeMgr.resetSequence(GameState.currentLevel);
  },

  onEnter(ctx) {},
  onExit(ctx) {},

  // Time-bar intent: objective shapes show their own timer; survival hides it
  getTimeBarIntent() {
    const s = shapeMgr.currentShape;
    const type = shapeMgr.getCurrentShapeType?.() || (s?.behaviorType ?? 'survival');
    if (type === 'objective' && s?.getTimerInfo) {
      const t = s.getTimerInfo();
      return { mode: 'objective', remaining: t.remaining, duration: t.duration, color: '#ffffff' };
    }
    return { mode: 'hidden' };
  },
};

export default IsolationMode;
