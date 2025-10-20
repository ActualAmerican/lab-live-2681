// src/libs/ScoreSystem.js
export default class ScoreSystem {
  constructor({ bus, award }) {
    this.bus = bus;
    this.award = award; // callback from main.js (it multiplies + updates HUD)

    // ===== Tunables (single knobs) =====
    this.BASE_RATE = 5; // pts/sec at Level 1 (continuous drip)
    this.LEVEL_FACTOR = { 1: 1.00, 2: 1.25, 3: 1.50, inf: 1.75 };

    this.BONUS = {
      SHAPE_CLEAR: 50,
      MINIGAME_WIN: 200,
      MINIGAME_PERFECT: 100,
      INFTY_BASE: 200,
      INFTY_PER_SEC: 5,
      INFTY_MAX: 400,        // cap of time bonus
      OVERFLOW: 10000,       // when power-up slots are full
      INTERACTION_DEFAULT: 2 // fallback if an interaction doesn't pass a value
    };

    // ===== State =====
    this.level = 1;
    this._permMap = {};      // id -> multiplier (upgrades)
    this.perm = 1.0;         // product of _permMap
    this.temp = {};          // id -> multiplier (active power-ups)

    // drip accumulator
    this._tickOn = false;
    this._accum = 0;
    this._lastTs = 0;

    // ===== Event wiring =====
    bus.on('run:start', () => this.startDrip());
    bus.on('run:end',   () => this.stopDrip());

    bus.on('level:advance', ({ to }) => this.setLevel(to));
    // entering infinite might only be obvious when the first cycle fires
    bus.on('infinite:cycle', (p) => { this.setLevel('inf'); this.onInfiniteCycle(p); });

    // flat bonuses
    bus.on('shape:complete', () => this.onShapeClear());
    bus.on('minigame:win',   (p) => this.onMiniGameWin(p));
    bus.on('powerup:overflow', () => this.awardRaw(this.BONUS.OVERFLOW, { reason: 'powerup:overflow' }));

    // optional generic shape interaction events (bounce, jump, etc.)
    bus.on('shape:interaction', ({ value = this.BONUS.INTERACTION_DEFAULT } = {}) => this.onInteraction(value));

    // multipliers (permanent & temporary)
    bus.on('score:perm-mult:add',    ({ id, mod }) => this.addPermMult(id, mod));
    bus.on('score:perm-mult:remove', ({ id })      => this.removePermMult(id));
    bus.on('score:perm-mult:clear',  ()            => this.clearPerm());

    bus.on('score:temp-mult:start',  ({ id, mod }) => { this.temp[id] = mod; this.bump(); });
    bus.on('score:temp-mult:end',    ({ id })      => { delete this.temp[id]; this.bump(); });
  }

  // ===== Public breakdown for HUD pill =====
  getBreakdown() {
    const level = this.levelFactor();
    const permanent = this.perm;
    let temporary = 1;
    for (const k in this.temp) temporary *= this.temp[k];
    const total = level * permanent * temporary;
    return { level, permanent, temporary, total };
  }

    // === Back-compat for main.js & debug probes ===
  getMultiplier() {
    // return the current total multiplier used by main.js addScore()
    const b = this.getBreakdown();
    return (b && typeof b.total === 'number')
      ? b.total
      : (b.level * b.permanent * b.temporary);
  }

  // (Optional helper if you ever want the pieces directly)
  getMultiplierBreakdown() {
    return this.getBreakdown();
  }

  // ===== Internals =====
  setLevel(to) {
    if (to === '∞' || to === 'inf' || to === Infinity || to === 4) this.level = 'inf';
    else this.level = Number(to) || 1;
    this.bump();
  }

  levelFactor() {
    const key = (this.level === 'inf') ? 'inf' : this.level;
    return this.LEVEL_FACTOR[key] ?? 1;
  }

  recalcPerm() {
    let p = 1;
    for (const k in this._permMap) p *= this._permMap[k];
    this.perm = p;
  }

  addPermMult(id, mod) {
    if (this._permMap[id]) return; // idempotent
    this._permMap[id] = mod;
    this.recalcPerm();
    this.bump();
  }

  removePermMult(id) {
    if (!this._permMap[id]) return;
    delete this._permMap[id];
    this.recalcPerm();
    this.bump();
  }

  clearPerm() {
    this._permMap = {};
    this.perm = 1.0;
    this.bump();
  }

  clearTemp() {
    this.temp = {};
    this.bump();
  }

  bump() {
    // tell HUD to refresh the multiplier pill
    this.bus.emit('score:multiplier', this.getBreakdown());
  }

  // ===== Continuous accumulation ("drip") =====
  startDrip() {
    this._tickOn = true;
    this._accum = 0;
    this._lastTs = performance.now();
    this.bump();
    this._loop();
  }

  stopDrip() {
    this._tickOn = false;
    this._accum = 0;
    this._lastTs = 0;
    // per-run reset
    this.clearTemp();
    this.clearPerm();
  }

  _loop() {
    if (!this._tickOn) return;
    const now = performance.now();
    const dt = (now - this._lastTs) / 1000;
    this._lastTs = now;

    // drip amount this frame (raw, before multipliers)
    const raw = dt * this.BASE_RATE;
    this._accum += raw;

    // only emit whole points to avoid log/HUD spam
    if (this._accum >= 1) {
      const whole = Math.floor(this._accum);
      this._accum -= whole;
      this.awardRaw(whole, { reason: 'tick', dt });
    }
    requestAnimationFrame(() => this._loop());
  }

  // ===== Flat awards =====
  awardRaw(raw, info) {
    if (raw <= 0) return;
    this.award(raw, info);        // main.js multiplies + updates HUD + popup
    this.bump();                  // refresh the pill in case multipliers changed
  }

  onShapeClear() {
    this.awardRaw(this.BONUS.SHAPE_CLEAR, { reason: 'shape:clear' });
  }

  onMiniGameWin({ quality = 'normal' } = {}) {
    const raw = this.BONUS.MINIGAME_WIN + (quality === 'perfect' ? this.BONUS.MINIGAME_PERFECT : 0);
    this.awardRaw(raw, { reason: 'minigame:win', quality });
  }

  onInfiniteCycle({ timeLeft = 0, duration = 0, cycle = 0 } = {}) {
    const extra = Math.min(timeLeft * this.BONUS.INFTY_PER_SEC, this.BONUS.INFTY_MAX);
    const raw = this.BONUS.INFTY_BASE + Math.round(extra);
    this.awardRaw(raw, { reason: 'infinite:cycle', timeLeft, duration, cycle });
  }

  onInteraction(value = this.BONUS.INTERACTION_DEFAULT) {
    this.awardRaw(value, { reason: 'interaction' });
  }
}
