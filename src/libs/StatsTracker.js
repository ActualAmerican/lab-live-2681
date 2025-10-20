// src/libs/StatsTracker.js
export default class StatsTracker {
  constructor({ bus, profile }) {
    this.bus = bus;
    this.profile = profile;
    this._runStartMs = 0;
    this._runMeta = { levelReached: 0, revivesUsed: 0 };
    this._runShapesCompleted = 0;
    this._xpStart = 0;
    this._runCycles = 0;

    bus.on('run:start', ({ level = 1 } = {}) => {
      this._runStartMs = performance.now();
      this._runMeta = { levelReached: level, revivesUsed: 0 };
      this._runShapesCompleted = 0;
      this._xpStart = this.profile.get().xp || 0;
      this._runCycles = 0;
      this.profile.bumpLifetime('runsStarted', 1);
    });

    // optional integrations if you emit these elsewhere:
    bus.on('revive_used', () => {
      this._runMeta.revivesUsed++;
    });
    bus.on('level:complete', ({ level }) => {
      this._runMeta.levelReached = Math.max(this._runMeta.levelReached || 0, level || 0);
      if ((level | 0) === 4) this._runCycles++;
    });

    bus.on('run:end', ({ score = 0, coinsEarned = 0 } = {}) => {
      const dt = this._runStartMs ? (performance.now() - this._runStartMs) / 1000 : 0;

      // TEMP: baseline XP so XP/Run trend has signal (swap with rewards engine later)
      const xpDelta = Math.max(0, this._runShapesCompleted | 0); // 1 XP per shape
      if (xpDelta > 0) this.profile.addXp(xpDelta);

      const xpNow = this.profile.get().xp || 0;
      const xpGained = Math.max(0, xpNow - (this._xpStart || 0));
      this.profile.commitRunSummary({
        score,
        durationSec: dt,
        levelReached: this._runMeta.levelReached || 0,
        revivesUsed: this._runMeta.revivesUsed || 0,
        shapesCompleted: this._runShapesCompleted || 0,
        coinsEarned: coinsEarned || 0,
        xpGained,
        cycles: this._runCycles || 0,
      });
      this.profile.bumpLifetime?.('runsCompleted', 1);
    });
    // Level updates (1,2,3,4 where 4=∞)
    bus.on('level:start', ({ level = 1 } = {}) => {
      // Remember latest level for the run summary
      this._runMeta.levelReached = level;
    });
    bus.on('mini:start', () => {
      this.profile.bumpLifetime('miniGamesPlayed', 1);
    });
    // Mini-game results
    bus.on('mini:complete', ({ win = true } = {}) => {
      if (win) this.profile.bumpLifetime('miniGamesCompleted', 1);
    });
    // also accept 'minigame:*' events
    bus.on('minigame:start', () => {
      this.profile.bumpLifetime('miniGamesPlayed', 1);
    });
    bus.on('minigame:win', () => {
      this.profile.bumpLifetime('miniGamesCompleted', 1);
    });
    // per-shape counters
    bus.on('shape:start', ({ name } = {}) => {
      if (name) this.profile.bumpShape(name, 'seen');
    });
    bus.on('shape:complete', ({ name } = {}) => {
      if (name) this.profile.bumpShape(name, 'completed');
      this._runShapesCompleted++;
      this.profile.incrementShapesCompleted(1);
    });
    bus.on('shape:fail', ({ name } = {}) => {
      if (name) this.profile.bumpShape(name, 'fails');
    });
  }
}
