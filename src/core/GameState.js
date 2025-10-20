// src/core/GameState.js
// Minimal, non-invasive state hub. We bind to main.js variables via getters/setters
// so we don't have to rewrite the whole codebase at once.

const _reads = {};
const _writes = {};

function _guard(k) {
  if (!(k in _reads) || !(k in _writes)) {
    throw new Error(
      `[GameState] "${k}" not bound. Did you call GameState.init(...) after vars are declared?`
    );
  }
}

const GameState = {
  init({ getters = {}, setters = {} } = {}) {
    // Bind only what is provided; safe to call multiple times if needed.
    for (const k of Object.keys(getters)) _reads[k] = getters[k];
    for (const k of Object.keys(setters)) _writes[k] = setters[k];
  },

  // Common fields we’ll lean on first (expand later as we migrate)
  get score() {
    _guard('score');
    return _reads.score();
  },
  set score(v) {
    _guard('score');
    _writes.score(v);
  },

  get personalBest() {
    _guard('personalBest');
    return _reads.personalBest();
  },
  set personalBest(v) {
    _guard('personalBest');
    _writes.personalBest(v);
  },

  get currentLevel() {
    _guard('currentLevel');
    return _reads.currentLevel();
  },
  set currentLevel(v) {
    _guard('currentLevel');
    _writes.currentLevel(v);
  },

  get gameActive() {
    _guard('gameActive');
    return _reads.gameActive();
  },
  set gameActive(v) {
    _guard('gameActive');
    _writes.gameActive(!!v);
  },

  get gameReady() {
    _guard('gameReady');
    return _reads.gameReady();
  },
  set gameReady(v) {
    _guard('gameReady');
    _writes.gameReady(!!v);
  },

  get isInMiniGame() {
    _guard('isInMiniGame');
    return _reads.isInMiniGame();
  },
  set isInMiniGame(v) {
    _guard('isInMiniGame');
    _writes.isInMiniGame(!!v);
  },

  get pendingLevelAdvance() {
    _guard('pendingLevelAdvance');
    return _reads.pendingLevelAdvance();
  },
  set pendingLevelAdvance(v) {
    _guard('pendingLevelAdvance');
    _writes.pendingLevelAdvance(!!v);
  },

  get paused() {
    _guard('paused');
    return _reads.paused();
  },
  set paused(v) {
    _guard('paused');
    _writes.paused(!!v);
  },

  snapshot() {
    const safe = (k) => (k in _reads ? _reads[k]() : undefined);
    return {
      score: safe('score'),
      personalBest: safe('personalBest'),
      currentLevel: safe('currentLevel'),
      gameActive: safe('gameActive'),
      gameReady: safe('gameReady'),
      isInMiniGame: safe('isInMiniGame'),
      pendingLevelAdvance: safe('pendingLevelAdvance'),
      paused: safe('paused'),
    };
  },
};

export default GameState;
