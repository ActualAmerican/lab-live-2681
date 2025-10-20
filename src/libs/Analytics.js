// src/libs/Analytics.js
import AnalyticsTransport from './AnalyticsTransport.js';

function uuid() {
  return (
    crypto?.randomUUID?.() ||
    'xxyyxxxy'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
  );
}
function deviceClass() {
  const w = Math.min(window.innerWidth, window.outerWidth || window.innerWidth);
  if (w <= 812) return 'phone';
  if (w <= 1280) return 'tablet';
  return 'desktop';
}
function platformTag() {
  try {
    if (window.__PORTAL__ === 'poki') return 'web-poki';
    if (window.__PORTAL__ === 'crazy') return 'web-crazy';
  } catch {}
  return 'web-other';
}

class RingBuffer {
  constructor(size = 500) {
    this.buf = new Array(size);
    this.size = size;
    this.head = 0;
    this.count = 0;
  }
  push(v) {
    this.buf[this.head] = v;
    this.head = (this.head + 1) % this.size;
    this.count = Math.min(this.count + 1, this.size);
  }
  toArray() {
    const out = [];
    for (let i = this.count; i > 0; i--) {
      const idx = (this.head - i + this.size) % this.size;
      out.push(this.buf[idx]);
    }
    return out;
  }
  tail(n = 50) {
    const a = this.toArray();
    return a.slice(Math.max(0, a.length - n));
  }
  clear() {
    this.head = 0;
    this.count = 0;
  }
}

class Analytics {
  init({ bus, profile, buildVersion = 'dev' }) {
    this.bus = bus;
    this.profile = profile;
    const p = profile.get?.() || {};
    if (!p.uid) {
      p.uid = `U-${uuid()}`;
      profile.update?.((dst) => {
        dst.uid = p.uid;
      });
    }
    this.uid = p.uid;
    this.ver = buildVersion || window.BUILD_VERSION || 'dev';
    this.plat = platformTag();
    this.dev = deviceClass();
    this.sid = null;
    this.sessionStart = 0;
    this.counters = { levels: 0, shapes: 0 };
    this.buf = new RingBuffer(500);
    this._recentKeys = new Map();
    this._seen = (key, winMs = 60) => {
      const now = Date.now();
      const last = this._recentKeys.get(key) || 0;
      if (now - last < winMs) return true;
      this._recentKeys.set(key, now);
      return false;
    };

    this._bindVisibility();
    this._bindEventMap(bus);
    this._startSession('boot');
  }

  _bindVisibility() {
    let endTimer = null;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        endTimer = setTimeout(() => this._endSession('hidden'), 3000);
      } else {
        if (endTimer) clearTimeout(endTimer);
        if (!this.sid) this._startSession('resume');
      }
    });
  }

  _bindEventMap(bus) {
    const log = (evt, extras) => this.log(evt, extras);

    // core lifecycle
    bus.on('run:start', ({ level = 1 } = {}) => {
      this.counters = { levels: 0, shapes: 0 };
      log('game_start', { lvl: level });
    });
    bus.on('run:end', ({ score = 0, bestScore = 0 } = {}) =>
      log('game_over', { score: Number(score), best: Number(bestScore) })
    );

    bus.on('game:pause', () => log('game_pause'));
    bus.on('game:resume', () => log('game_resume'));

    const onLevelStart = ({ level = 1 } = {}) => {
      if (this._seen(`lvl_start:${level}`)) return;
      this.counters.levels++;
      log('level_start', { lvl: level });
    };
    bus.on('level:start', onLevelStart);

    bus.on('level:advance', ({ level } = {}) => log('level_advance', { lvl: level }));
    bus.on('level:complete', ({ level, dur } = {}) => log('level_complete', { lvl: level, dur }));

    bus.on('infinite:cycle', ({ cycle = 1 } = {}) => log('infinite_cycle', { cyc: cycle }));
    bus.on('minigame:start', ({ id } = {}) => log('mini_start', { mini: id }));
    bus.on('minigame:win', ({ id, dur } = {}) => log('mini_complete', { mini: id, dur }));
    bus.on('minigame:fail', ({ id, dur } = {}) => log('mini_fail', { mini: id, dur }));

    bus.on('shape:start', ({ name } = {}) => log('shape_start', { shape: name }));
    bus.on('shape:complete', ({ name, score, dur } = {}) => {
      this.counters.shapes++;
      log('shape_complete', { shape: name, score, dur });
    });
    bus.on('shape:fail', ({ name, dur } = {}) => log('shape_fail', { shape: name, dur }));
    bus.on('shape:timeout', ({ name } = {}) => log('shape_timeout', { shape: name }));

    const onMiniStart = ({ name } = {}) => {
      const id = name || '';
      if (this._seen(`mini_start:${id}`)) return;
      log('mini_start', { mini: id });
    };
    bus.on('minigame:start', onMiniStart);
    bus.on('mini:start', onMiniStart);

    const onMiniComplete = ({ name, win = true } = {}) => {
      const id = name || '';
      if (this._seen(`mini_complete:${id}`)) return;
      log('mini_complete', { mini: id, win: win ? 1 : 0 });
    };
    bus.on('minigame:win', (p = {}) => onMiniComplete({ ...p, win: true }));
    bus.on('mini:complete', onMiniComplete);

    // meta / economy stubs
    bus.on('unlock:granted', ({ type, id } = {}) => log('unlock_granted', { type, id }));
    bus.on('shop:purchase', ({ item, price, currency } = {}) =>
      log('shop_purchase', { econ: { item, price, cur: currency } })
    );

    bus.on('ad:rewarded:shown', () => log('ad_rewarded_shown'));
    bus.on('ad:rewarded:reward', () => log('ad_rewarded_reward'));
    bus.on('ad:interstitial:shown', () => log('ad_interstitial_shown'));
    bus.on('ad:error', ({ code } = {}) => log('ad_error', { ad: { code } }));

    bus.on('revive:offered', () => log('revive_offered'));
    bus.on('revive:accepted', () => log('revive_accepted'));
    bus.on('revive:declined', () => log('revive_declined'));

    bus.on('router:navigate', ({ to, from } = {}) => log('nav', { to, from }));
  }

  _startSession(reason = 'start') {
    this.sid = `S-${uuid()}`;
    this.sessionStart = Date.now();
    this.log('session_start', { reason });
  }

  _endSession(reason = 'end') {
    if (!this.sid) return;
    const dur = Date.now() - this.sessionStart;
    this.log('session_end', {
      reason,
      dur,
      levels: this.counters.levels,
      shapes: this.counters.shapes,
    });
    this.sid = null;
    this.counters = { levels: 0, shapes: 0 };
  }

  log(evt, extras = {}) {
    const rec = {
      ts: Date.now(),
      evt,
      sid: this.sid || null,
      uid: this.uid,
      ver: this.ver,
      plat: this.plat,
      dev: this.dev,
      ...extras,
    };
    this.buf.push(rec);
    AnalyticsTransport.enqueue(rec);
  }

  // NEW: simple alias so UI can call Analytics.event(...)
  event(evt, extras = {}) {
    this.log(evt, extras);
  }

  tail(n = 50) {
    return this.buf.tail(n);
  }
  getBuffer() {
    return this.buf.toArray();
  }
  clear() {
    this.buf.clear();
  }

  exportJSON(filename = 'analytics.json') {
    try {
      const data = JSON.stringify(this.getBuffer(), null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      console.warn('Analytics export failed', e);
    }
  }
}

const instance = new Analytics();
export default instance;
