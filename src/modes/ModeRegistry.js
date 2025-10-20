// src/modes/ModeRegistry.js
import GameState from '../core/GameState.js';
import RotationMode from './RotationMode.js';
import IsolationMode from './IsolationMode.js';

let _bus = null;
let _shapeMgr = null;
let _miniMgr = null;
let _timeBar = null;

const ModeRegistry = {
  active: 'rotation', // 'rotation' | 'isolation'

  init({ bus, shapeManager, miniGameManager, timeBar }) {
    _bus = bus;
    _shapeMgr = shapeManager;
    _miniMgr = miniGameManager;
    _timeBar = timeBar;

    RotationMode.init({
      bus: _bus,
      shapeManager: _shapeMgr,
      miniGameManager: _miniMgr,
      timeBar: _timeBar,
    });
    IsolationMode.init?.({ bus: _bus, shapeManager: _shapeMgr, timeBar: _timeBar });

    // DEV bridges (kept here to avoid main.js clutter)
    _bus.on('dev:force-rotation-go', ({ shapeName }) => {
      this.setActive('rotation');
      RotationMode.forceGo(shapeName);
    });
    _bus.on('dev:force-mini-go', ({ name }) => {
      this.setActive('rotation');
      RotationMode.startMiniGame(name);
    });
  },

  setActive(name) {
    if (name !== 'rotation' && name !== 'isolation') return;
    this.active = name;
  },

  getActive() {
    return this.active === 'isolation' ? IsolationMode : RotationMode;
  },

  // Convenience delegates used by main.js
  startLevel(level) {
    return this.getActive().startLevel?.(level);
  },
  update(dt) {
    return this.getActive().update?.(dt);
  },
  onShapeCompleted() {
    return this.getActive().onShapeCompleted?.();
  },
  onMiniGameCompleted() {
    return this.getActive().onMiniGameCompleted?.();
  },

  // Time-bar intent
  getTimeBarIntent() {
    return this.getActive().getTimeBarIntent?.() ?? { mode: 'hidden' };
  },

  // DEV helpers exposed for window bridges
  rotation: {
    forceGo(shapeName) {
      ModeRegistry.setActive('rotation');
      RotationMode.forceGo(shapeName);
    },
    startMiniGame(name) {
      ModeRegistry.setActive('rotation');
      RotationMode.startMiniGame(name);
    },
  },
};

export default ModeRegistry;
