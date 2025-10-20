// src/libs/MasteryManager.js
import ProfileStore from './ProfileStore.js';

/**
 * MasteryManager
 * - Loads badge catalog from /assets/mastery.json
 * - Checks profile stats to award badges
 * - Stores earned badges as objects: { id, name, desc, icon, unlockedAt }
 */
export default class MasteryManager {
  constructor({ bus } = {}) {
    this.bus = bus;
    this.catalog = [];
    this._bound = false;
  }

  async init() {
    // 1) Load catalog (tolerate dev/local)
    try {
      const res = await fetch('./assets/mastery.json', { cache: 'no-store' });
      this.catalog = (await res.json())?.badges || [];
    } catch (e) {
      console.warn('[Mastery] failed to load mastery.json:', e);
      this.catalog = [];
    }

    // 2) Normalize any persisted badges to the full object shape
    this._normalizeEarned();

    // 3) Listen for events that can unlock badges
    if (!this._bound && this.bus?.on) {
      this._bound = true;
      // Runs end → most basic trigger for "runs_X" style badges
      this.bus.on('run:end', () => this.evaluateAll());
      // Shape or mini-game events could also unlock future badges:
      this.bus.on('shape:complete', () => this.evaluateAll());
      this.bus.on('minigame:win', () => this.evaluateAll());
    }

    // expose for debug tools (grants & catalog)
    try {
      window.__mastery = this;
    } catch {}

    // First pass on boot
    this.evaluateAll();
    this.bus.on('mastery:grant', (e = {}) => {
      const id = e?.id || e?.detail?.id;
      if (id) this._award(id);
    });
  }

  getCatalog() {
    return this.catalog.slice();
  }

  // ---------- internal ----------

  _normalizeEarned() {
    const p = ProfileStore.get() || {};
    const earned = p.mastery && Array.isArray(p.mastery.badges) ? p.mastery.badges : [];

    // Index catalog by id
    const byId = Object.create(null);
    for (const b of this.catalog) byId[b.id] = b;

    const fixed = earned.map((e) => {
      const id = typeof e === 'string' ? e : e.id;
      const def = byId[id] || {};
      const base = def.icon || id;
      const file = base.endsWith('.png') ? base : `${base}.png`;
      const icon = `./assets/badges/${file}`;
      return {
        id,
        name: def.name || def.title || e.name || id,
        desc: def.desc || e.desc || '',
        icon,
        unlockedAt: e.unlockedAt || Date.now(),
      };
    });

    if (!p.mastery || !Array.isArray(p.mastery.badges)) {
      // ✅ use ProfileStore.update (no _save in this store)
      ProfileStore.update((q) => {
        q.mastery = { badges: fixed };
      });
    } else if (JSON.stringify(earned) !== JSON.stringify(fixed)) {
      ProfileStore.update((q) => {
        q.mastery.badges = fixed;
      });
    }
    // no manual dispatch — ProfileStore.update already fires 'profile:updated'
  }

  _alreadyHas(id) {
    const p = ProfileStore.get() || {};
    const list = (p.mastery && p.mastery.badges) || [];
    return !!list.find((b) => (b.id || b) === id);
  }

  _award(id) {
    if (this._alreadyHas(id)) return false;

    const def = this.catalog.find((b) => b.id === id) || { id };
    const base = def.icon || id;
    const file = base.endsWith('.png') ? base : `${base}.png`;
    const badge = {
      id,
      name: def.name || def.title || id,
      desc: def.desc || '',
      icon: `./assets/badges/${file}`,
      unlockedAt: Date.now(),
    };

    ProfileStore.update((p) => {
      if (!p.mastery) p.mastery = { badges: [] };
      if (!Array.isArray(p.mastery.badges)) p.mastery.badges = [];
      p.mastery.badges.unshift(badge); // newest first
    });

    try {
      this.bus?.emit?.('mastery:badge', { id, ...badge });
    } catch {}
    return true;
  }

  grantBadgeById(id) {
    return this._award(id);
  }

  grantAllBadges() {
    if (!Array.isArray(this.catalog) || !this.catalog.length) return 0;
    let n = 0;
    for (const b of this.catalog) {
      if (this._award(b.id)) n++;
    }
    return n;
  }

  // Simple helpers that match likely rules in mastery.json
  _getRunsStarted() {
    const p = ProfileStore.get() || {};
    return p.stats?.lifetime?.runsStarted || 0;
  }
  _getShapesCompleted() {
    const p = ProfileStore.get() || {};
    return p.stats?.lifetime?.shapesCompleted || 0;
  }

  evaluateAll() {
    if (!this.catalog.length) return;

    const runs = this._getRunsStarted();
    const shapes = this._getShapesCompleted();

    // Default set that matches your /assets/badges/*
    // If mastery.json has "unlock" blocks, we’ll respect them below.
    const impliedRules = {
      runs_1: runs >= 1,
      runs_10: runs >= 10,
      runs_50: runs >= 50,
      runs_100: runs >= 100,
      // add more quick checks here as needed…
    };

    for (const def of this.catalog) {
      const id = def.id;
      let ok = false;

      if (def.unlock && def.unlock.type) {
        // Interpret simple unlock styles from mastery.json
        const u = def.unlock;
        if (u.type === 'runs' && runs >= (u.count || 1)) ok = true;
        if (u.type === 'shapes' && shapes >= (u.count || 1)) ok = true;
        // add more rule types if you add them to mastery.json
      } else if (id in impliedRules) {
        ok = !!impliedRules[id];
      }

      if (ok) this._award(id);
    }
  }
}
