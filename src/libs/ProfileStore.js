// src/libs/ProfileStore.js
import { shapeRegistry } from '../shapes/shapes.js';
import RankSystem from './RankSystem.js';
const STORAGE_KEY = 'SS_PROFILE';
const VERSION = 2;

function makeDefaultProfile() {
  return {
    version: VERSION,
    // identity
    playerName: 'Player',
    uid: `U-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    avatarSeed: Math.floor(Math.random() * 1e9),
    favoriteShapes: [],

    // currencies + progression
    copper: 0,
    iridium: 0,
    xp: 0,
    bestScore: 0,
    bests: {
      score: 0,
      longestRunSec: 0,
      fastestRunSec: 0,
      mostShapesInRun: 0,
      highestLevel: 0,
      bestRun: null,
    },

    // ownership
    unlocks: { shapes: [], skins: [], powerUps: [], trails: [], boosters: [] },

    // settings
    settings: {
      volume: 1,
      colorblind: false,
      reducedMotion: false,
      haptics: true,
      wowMode: false,
      showInstallBanner: true,
      showQR: true,
    },

    // streaks
    streak: { daily: 0, lastDate: null, weeklyForgiveness: 1 },

    // stats
    stats: {
      lifetime: {
        runsStarted: 0,
        runsCompleted: 0,
        playTimeSec: 0,
        shapesCompleted: 0,
        miniGamesPlayed: 0,
        miniGamesCompleted: 0,
      },
      perShape: {},
    },

    // recent activity
    recentRuns: [],

    _meta: { createdAt: Date.now(), updatedAt: Date.now() },
  };
}

let _profile = null;
const shouldLog = () => localStorage.getItem('PROFILE_DEBUG') === '1';
const notify = (evt = 'profile:updated', detail = {}) => {
  try {
    window.dispatchEvent(new CustomEvent(evt, { detail }));
  } catch {}
};

function getStartingShapeIds(count = 10) {
  try {
    return (shapeRegistry || [])
      .filter((s) => s && s.active && s.name && s.name !== 'Shapeless')
      .slice(0, count)
      .map((s) => s.name);
  } catch {
    return [];
  }
}

// ── Unlock rules registry ───────────────────────────────────────────────────
const UNLOCK_RULES = [
  {
    kind: 'shape',
    id: 'Shapeless',
    desc: 'Max Rank',
    check: (p) => {
      const R = RankSystem.fromXp(p.xp || 0);
      const maxIndex = RankSystem.TIERS.length * 5;
      return R.index >= maxIndex && R.percent >= 100;
    },
  },
];

function _evaluateUnlockRules(p) {
  p.unlocks ||= { shapes: [], skins: [], powerUps: [], trails: [], boosters: [] };
  for (const rule of UNLOCK_RULES) {
    if (rule.kind === 'shape') {
      const hasIt = p.unlocks.shapes.includes(rule.id);
      if (!hasIt && rule.check(p)) {
        p.unlocks.shapes.push(rule.id);
        try {
          window.dispatchEvent(
            new CustomEvent('unlock:granted', { detail: { kind: 'shape', id: rule.id } })
          );
        } catch {}
      }
    }
  }
}

function _loadRaw() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
function _saveRaw(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}
function migrate(p) {
  if (!p || typeof p !== 'object') return makeDefaultProfile();
  if (!('version' in p)) p.version = 1;
  // coins/gems → copper/iridium
  if (typeof p.copper !== 'number' && typeof p.coins === 'number') p.copper = p.coins | 0;
  if (typeof p.iridium !== 'number' && typeof p.gems === 'number') p.iridium = p.gems | 0;
  delete p.coins;
  delete p.gems;

  if (p.version < 2) {
    p.version = 2;
    const per = (p.stats && p.stats.perShape) || {};
    const sum = Object.values(per).reduce((a, s) => a + (s?.completed || 0), 0);
    p.stats ||= {};
    p.stats.lifetime ||= {};
    if (typeof p.stats.lifetime.shapesCompleted !== 'number') {
      p.stats.lifetime.shapesCompleted = sum;
    }
  }

  const d = makeDefaultProfile();
  p.unlocks ||= d.unlocks;
  p.settings ||= d.settings;
  p.stats ||= d.stats;
  p.stats.lifetime ||= d.stats.lifetime;
  if (typeof p.stats.lifetime.shapesCompleted !== 'number') p.stats.lifetime.shapesCompleted = 0;
  p.stats.lifetime.miniGamesPlayed ??= 0;
  p.stats.lifetime.miniGamesCompleted ??= 0;

  p.uid ??= `U-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

  p.bests ||= d.bests;
  if (!p.bests || typeof p.bests !== 'object') p.bests = JSON.parse(JSON.stringify(d.bests));
  if (!p.bests.bestRun && Array.isArray(p.recentRuns) && p.recentRuns.length) {
    const runs = p.recentRuns;
    const best = runs.reduce((a, r) => (r.score > (a?.score || 0) ? r : a), runs[0]);
    p.bests.bestRun = best || null;
    p.bests.score = Math.max(p.bestScore || 0, best?.score || 0);
    p.bests.longestRunSec = Math.max(0, ...runs.map((r) => r.durationSec || 0));
    p.bests.fastestRunSec = Math.min(...runs.map((r) => r.durationSec || 1e9)) || 0;
    p.bests.mostShapesInRun = Math.max(0, ...runs.map((r) => r.shapesCompleted || 0));
    p.bests.highestLevel = Math.max(0, ...runs.map((r) => r.levelReached || 0));
  }

  if (!Array.isArray(p.favoriteShapes)) {
    p.favoriteShapes = [];
    if (p.favoriteShape) {
      p.favoriteShapes = [p.favoriteShape];
      delete p.favoriteShape;
    }
  }
  // ensure newer unlock arrays exist
  p.unlocks.trails ||= [];
  p.unlocks.boosters ||= [];
  return p;
}

const ProfileStore = {
  init() {
    const raw = _loadRaw();
    _profile = raw ? migrate(raw) : makeDefaultProfile();
    // Ensure canonical currencies object exists + mirror to flat fields
    _profile.currencies ||= {};
    _profile.currencies.copper = Number(_profile.currencies.copper ?? _profile.copper ?? 0);
    _profile.currencies.iridium = Number(_profile.currencies.iridium ?? _profile.iridium ?? 0);
    _profile.copper = _profile.currencies.copper;
    _profile.iridium = _profile.currencies.iridium;
    try {
      const has = Array.isArray(_profile.unlocks?.shapes) ? _profile.unlocks.shapes.length : 0;
      if (!has) {
        const seeds = getStartingShapeIds(10);
        _profile.unlocks ||= { shapes: [], skins: [], powerUps: [], trails: [], boosters: [] };
        _profile.unlocks.shapes = seeds;
      }
    } catch {}

    _saveRaw(_profile);
    notify('profile:initialized', { profile: this.get() });
    return _profile;
  },

  // NEW: explicit save (used by Shop + helpers)
  save(obj) {
    try {
      _profile = migrate(obj || _profile || makeDefaultProfile());
      _profile._meta ||= {};
      _profile._meta.updatedAt = Date.now();
      _saveRaw(_profile);
      if (shouldLog()) console.log('[ProfileStore] save →', _profile);
      notify('profile:updated', { profile: this.get() });
    } catch (e) {
      console.warn('[ProfileStore] save failed', e);
    }
    return this.get();
  },

  get() {
    if (!_profile) this.init();
    // evaluate unlock rules before returning a copy
    try {
      _evaluateUnlockRules(_profile);
    } catch {}
    return JSON.parse(JSON.stringify(_profile));
  },

  update(mutator) {
    if (!_profile) this.init();
    const p = this.get();
    mutator && mutator(p);
    p._meta.updatedAt = Date.now();
    _profile = p;
    _saveRaw(_profile);
    if (shouldLog()) console.log('[ProfileStore] update →', _profile);
    notify('profile:updated', { profile: this.get() });
    return this.get();
  },

  reset({ hard = false } = {}) {
    _profile = makeDefaultProfile();
    _saveRaw(_profile);
    if (hard) {
      try {
        localStorage.removeItem('personalBest');
      } catch {}
    }
    if (shouldLog()) console.log('[ProfileStore] reset');
    notify('profile:reset', { profile: this.get() });
    return this.get();
  },

  setFavoriteShapes(list) {
    const arr = Array.isArray(list) ? list.slice(0, 5) : [];
    return this.update((p) => {
      p.favoriteShapes = arr;
    });
  },
  toggleFavoriteShape(id) {
    return this.update((p) => {
      p.favoriteShapes ||= [];
      const i = p.favoriteShapes.indexOf(id);
      if (i >= 0) p.favoriteShapes.splice(i, 1);
      else if (p.favoriteShapes.length < 5) p.favoriteShapes.push(id);
    });
  },
  isFavorite(id) {
    const p = this.get();
    return Array.isArray(p.favoriteShapes) && p.favoriteShapes.includes(id);
  },

  // Identity
  setPlayerName(name) {
    return this.update((p) => {
      p.playerName = String(name || 'Player').slice(0, 24);
    });
  },
  setFavoriteShape(id) {
    return this.update((p) => {
      p.favoriteShape = id || null;
    });
  },

  // Economy
  addCopper(n) {
    return this.update((p) => {
      const v = Math.max(0, (p.copper || 0) + (+n || 0));
      p.copper = v;
      p.currencies ||= {};
      p.currencies.copper = v;
    });
  },
  addIridium(n) {
    return this.update((p) => {
      const v = Math.max(0, (p.iridium || 0) + (+n || 0));
      p.iridium = v;
      p.currencies ||= {};
      p.currencies.iridium = v;
    });
  },
  setCopper(n) {
    return this.update((p) => {
      const v = Math.max(0, +n || 0);
      p.copper = v;
      p.currencies ||= {};
      p.currencies.copper = v;
    });
  },
  setIridium(n) {
    return this.update((p) => {
      const v = Math.max(0, +n || 0);
      p.iridium = v;
      p.currencies ||= {};
      p.currencies.iridium = v;
    });
  },
  addXp(n) {
    return this.update((p) => {
      const v = Math.max(0, (p.xp || 0) + (+n || 0));
      p.xp = v;
      p.currencies ||= {};
      p.currencies.xp = v;
      _evaluateUnlockRules(p);
    });
  },
  setXp(n) {
    return this.update((p) => {
      const v = Math.max(0, +n || 0);
      p.xp = v;
      p.currencies ||= {};
      p.currencies.xp = v;
      _evaluateUnlockRules(p);
    });
  },

  // legacy shims
  addCoins(n) {
    return this.addCopper(n);
  },
  addGems(n) {
    return this.addIridium(n);
  },
  setCoins(n) {
    return this.setCopper(n);
  },
  setGems(n) {
    return this.setIridium(n);
  },

  // generic helpers
  getBalance(kind) {
    const p = this.get();
    return Math.max(0, p[kind] | 0);
  },
  addCurrency(kind, n) {
    return this.update((p) => {
      const v = Math.max(0, (p[kind] || 0) + (+n || 0));
      p[kind] = v;
      if (kind === 'copper' || kind === 'iridium' || kind === 'xp') {
        p.currencies ||= {};
        p.currencies[kind] = v;
      }
    });
  },
  spend(kind, n) {
    const amt = Math.max(0, +n || 0);
    let ok = false;
    this.update((p) => {
      const cur = Math.max(0, p[kind] || 0);
      if (cur >= amt) {
        const v = cur - amt;
        p[kind] = v;
        if (kind === 'copper' || kind === 'iridium' || kind === 'xp') {
          p.currencies ||= {};
          p.currencies[kind] = v;
        }
        ok = true;
      }
    });
    if (ok) {
      try {
        window.dispatchEvent(new CustomEvent('economy:spend', { detail: { kind, amount: amt } }));
      } catch {}
    }
    return ok;
  },

  setBestScore(s) {
    return this.update((p) => {
      p.bestScore = Math.max(p.bestScore || 0, +s || 0);
    });
  },

  // Unlocks API
  isUnlocked(kind, id) {
    const p = this.get();
    if (kind === 'shape') return !!p.unlocks?.shapes?.includes(id);
    if (kind === 'skin') return !!p.unlocks?.skins?.includes(id);
    if (kind === 'powerUp') return !!p.unlocks?.powerUps?.includes(id);
    if (kind === 'trail') return !!p.unlocks?.trails?.includes(id);
    if (kind === 'booster') return !!p.unlocks?.boosters?.includes(id);
    return false;
  },

  getUnlockedShapes() {
    const p = this.get();
    return Array.isArray(p.unlocks?.shapes) ? p.unlocks.shapes.slice() : [];
  },

  unlockShape(name) {
    if (!name) return this.get();
    return this.update((p) => {
      p.unlocks ||= { shapes: [], skins: [], powerUps: [], trails: [], boosters: [] };
      p.unlocks.shapes ||= [];
      if (!p.unlocks.shapes.includes(name)) {
        p.unlocks.shapes.push(name);
        try {
          window.dispatchEvent(
            new CustomEvent('unlock:granted', { detail: { kind: 'shape', id: name } })
          );
        } catch {}
      }
    });
  },

  unlockSkin(id) {
    if (!id) return this.get();
    return this.update((p) => {
      p.unlocks ||= { shapes: [], skins: [], powerUps: [], trails: [], boosters: [] };
      p.unlocks.skins ||= [];
      if (!p.unlocks.skins.includes(id)) {
        p.unlocks.skins.push(id);
        try {
          window.dispatchEvent(new CustomEvent('unlock:granted', { detail: { kind: 'skin', id } }));
        } catch {}
      }
    });
  },

  unlockAll(kind = 'shapes') {
    if (kind === 'shapes') {
      const all = (shapeRegistry || [])
        .filter((s) => s?.active && s.name && s.name !== 'Shapeless')
        .map((s) => s.name);
      return this.update((p) => {
        p.unlocks ||= { shapes: [], skins: [], powerUps: [], trails: [], boosters: [] };
        p.unlocks.shapes = Array.from(new Set([...(p.unlocks.shapes || []), ...all]));
      });
    }
    if (kind === 'skins') {
      const ids =
        (Array.isArray(window.__shopCatalog?.skins) &&
          window.__shopCatalog.skins.map((s) => s.id)) ||
        (Array.isArray(window.__skinsCatalog) && window.__skinsCatalog) ||
        [];
      return this.update((p) => {
        p.unlocks ||= { shapes: [], skins: [], powerUps: [], trails: [], boosters: [] };
        p.unlocks.skins = Array.from(new Set([...(p.unlocks.skins || []), ...ids]));
      });
    }
    return this.get();
  },

  resetUnlocks() {
    return this.update((p) => {
      p.unlocks = { shapes: [], skins: [], powerUps: [], trails: [], boosters: [] };
      if (p.mastery && Array.isArray(p.mastery.badges)) {
        p.mastery.badges = [];
      }
    });
  },

  // Unlock rules API
  registerUnlockRule(rule) {
    if (rule && typeof rule.check === 'function' && rule.kind && rule.id) {
      UNLOCK_RULES.push(rule);
    }
    return this.get();
  },
  forceEvaluateUnlocks() {
    return this.update((p) => _evaluateUnlockRules(p));
  },

  // CSV summary (unchanged)
  summarizeUnlockables({ includeLocked = true } = {}) {
    const p = this.get();
    const ownedShapes = new Set((p.unlocks && p.unlocks.shapes) || []);
    const ownedSkins = new Set((p.unlocks && p.unlocks.skins) || []);
    const rows = [];

    const ruleDescFor = (kind, id) => {
      const r = ((typeof UNLOCK_RULES !== 'undefined' && UNLOCK_RULES) || []).find(
        (x) => x.kind === kind && x.id === id
      );
      return r
        ? {
            condition: r.desc || 'Rule',
            source: 'rule',
            notes: id === 'Shapeless' ? 'secret until owned' : '',
          }
        : null;
    };

    const seeds = (() => {
      try {
        return (shapeRegistry || [])
          .filter((s) => s && s.active && s.name && s.name !== 'Shapeless')
          .slice(0, 10)
          .map((s) => s.name);
      } catch {
        return [];
      }
    })();

    (shapeRegistry || []).forEach((s) => {
      if (!s || !s.name || !s.active) return;
      const id = s.name;
      const owned = ownedShapes.has(id);
      let condition = 'TBD';
      let source = 'placeholder';
      let notes = '';

      if (seeds.includes(id)) {
        condition = 'Starter';
        source = 'seed';
      }
      const r = ruleDescFor('shape', id);
      if (r) {
        condition = r.condition;
        source = 'rule:maxRank';
        notes = r.notes || notes;
      }

      if (!includeLocked && !owned) return;
      rows.push({
        type: 'shape',
        id,
        name: id,
        owned,
        condition,
        condition_source: source,
        notes,
        rarity: '',
        availability: '',
      });
    });

    const cat =
      (window.__mastery && window.__mastery.getCatalog && window.__mastery.getCatalog()) || [];
    const earnedIds = new Set(
      ((p.mastery && Array.isArray(p.mastery.badges) && p.mastery.badges) || []).map((b) =>
        typeof b === 'string' ? b : b.id
      )
    );
    cat.forEach((b) => {
      const id = b.id;
      const owned = earnedIds.has(id);
      let condition = 'Mastery: TBD';
      let source = 'mastery.json';
      if (b.unlock && b.unlock.type) {
        if (b.unlock.type === 'runs') condition = `Mastery: Runs ≥ ${b.unlock.count || 1}`;
        else if (b.unlock.type === 'shapes') condition = `Mastery: Shapes ≥ ${b.unlock.count || 1}`;
      } else if (b.desc) {
        condition = b.desc;
      }
      if (!includeLocked && !owned) return;
      rows.push({
        type: 'badge',
        id,
        name: b.title || b.name || id,
        owned,
        condition,
        condition_source: source,
        notes: '',
        rarity: '',
        availability: '',
      });
    });

    const skinsCatalog = (() => {
      try {
        const ids =
          (Array.isArray(window.__shopSkins) && window.__shopSkins) ||
          (Array.isArray(window.__shopCatalog?.skins) &&
            window.__shopCatalog.skins.map((s) => s.id)) ||
          (Array.isArray(window.__skinsCatalog) && window.__skinsCatalog) ||
          []; // legacy fallback
        // Always include Default exactly once, first
        const uniq = Array.from(new Set(['Default', ...ids]));
        return uniq.length ? uniq : ['Default'];
      } catch {
        return ['Default'];
      }
    })();
    skinsCatalog.forEach((id) => {
      const owned = ownedSkins.has(id) || id === 'Default';
      if (!includeLocked && !owned) return;
      rows.push({
        type: 'skin',
        id,
        name: id,
        owned,
        condition: id === 'Default' ? 'Starter' : 'TBD',
        condition_source: id === 'Default' ? 'seed' : 'placeholder',
        notes: '',
        rarity: '',
        availability: '',
      });
    });

    rows.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type.localeCompare(b.type)
    );

    const header = [
      'type',
      'id',
      'name',
      'owned',
      'condition',
      'condition_source',
      'notes',
      'rarity',
      'availability',
    ];
    const esc = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const csv = [header.join(',')]
      .concat(rows.map((r) => header.map((h) => esc(r[h])).join(',')))
      .join('\n');

    const ts = new Date();
    const stamp = [
      ts.getFullYear(),
      String(ts.getMonth() + 1).padStart(2, '0'),
      String(ts.getDate()).padStart(2, '0'),
      '_',
      String(ts.getHours()).padStart(2, '0'),
      String(ts.getMinutes()).padStart(2, '0'),
    ].join('');
    const fileName = `unlockables_${stamp}.csv`;

    return { rows, csv, fileName };
  },

  // Settings / Stats / Runs (unchanged below)
  setSetting(key, value) {
    return this.update((p) => {
      p.settings ||= {};
      p.settings[key] = value;
    });
  },
  bumpLifetime(key, by = 1) {
    return this.update((p) => {
      p.stats.lifetime[key] = (p.stats.lifetime[key] || 0) + by;
    });
  },
  addPlayTime(sec) {
    return this.update((p) => {
      p.stats.lifetime.playTimeSec = (p.stats.lifetime.playTimeSec || 0) + Math.max(0, +sec || 0);
    });
  },
  bumpShape(id, field) {
    return this.update((p) => {
      p.stats.perShape ||= {};
      p.stats.perShape[id] ||= { seen: 0, completed: 0, fails: 0 };
      p.stats.perShape[id][field] = (p.stats.perShape[id][field] || 0) + 1;
    });
  },
  pushRecentRun(run) {
    return this.update((p) => {
      p.recentRuns ||= [];
      p.recentRuns.unshift(run);
      if (p.recentRuns.length > 12) p.recentRuns.length = 12;
    });
  },
  incrementShapesCompleted(by = 1) {
    return this.update((p) => {
      p.stats.lifetime.shapesCompleted = Math.max(
        0,
        (p.stats.lifetime.shapesCompleted || 0) + (+by || 0)
      );
    });
  },
  commitRunSummary({
    score = 0,
    durationSec = 0,
    levelReached = 0,
    revivesUsed = 0,
    shapesCompleted = 0,
    coinsEarned = 0,
    xpGained = 0,
    cycles = 0,
  } = {}) {
    return this.update((p) => {
      p.stats.lifetime.runsCompleted = (p.stats.lifetime.runsCompleted || 0) + 1;
      if (durationSec > 0)
        p.stats.lifetime.playTimeSec =
          (p.stats.lifetime.playTimeSec || 0) + Math.round(durationSec);
      p.bestScore = Math.max(p.bestScore || 0, Math.floor(score || 0));
      p.stats.lifetime.shapesCompleted =
        (p.stats.lifetime.shapesCompleted || 0) + Math.max(0, Math.floor(shapesCompleted || 0));
      p.recentRuns ||= [];
      p.recentRuns.unshift({
        ts: Date.now(),
        score: Math.floor(score || 0),
        durationSec: Math.round(durationSec || 0),
        levelReached: Math.max(0, levelReached || 0),
        revivesUsed: Math.max(0, revivesUsed || 0),
        shapesCompleted: Math.max(0, Math.floor(shapesCompleted || 0)),
        coinsEarned: Math.max(0, Math.floor(coinsEarned || 0)),
        xpGained: Math.max(0, Math.floor(xpGained || 0)),
        cycles: Math.max(0, cycles | 0),
      });
      p.bests ||= {
        score: 0,
        longestRunSec: 0,
        fastestRunSec: 0,
        mostShapesInRun: 0,
        highestLevel: 0,
        bestRun: null,
      };
      if (score >= (p.bests.score || 0)) {
        p.bests.score = Math.floor(score || 0);
        p.bests.bestRun = p.recentRuns[0];
      }
      p.bests.longestRunSec = Math.max(p.bests.longestRunSec || 0, Math.round(durationSec || 0));
      if ((p.bests.fastestRunSec || 0) === 0) p.bests.fastestRunSec = Math.round(durationSec || 0);
      else p.bests.fastestRunSec = Math.min(p.bests.fastestRunSec, Math.round(durationSec || 0));
      p.bests.mostShapesInRun = Math.max(
        p.bests.mostShapesInRun || 0,
        Math.floor(shapesCompleted || 0)
      );
      p.bests.highestLevel = Math.max(p.bests.highestLevel || 0, Math.max(0, levelReached || 0));
      if (p.recentRuns.length > 30) p.recentRuns.length = 30;
    });
  },
  getUnlockedShapesCount() {
    const p = this.get();
    return p.unlocks?.shapes?.length || 0;
  },
  getFavoriteShapesList() {
    const p = this.get();
    return Array.isArray(p.favoriteShapes) ? p.favoriteShapes.slice() : [];
  },
};

export function canAfford(price = {}) {
  const p = ProfileStore.get();
  const needC = price.copper || 0;
  const needI = price.iridium || 0;
  const needX = price.xp || 0;
  return (p.copper || 0) >= needC && (p.iridium || 0) >= needI && (p.xp || 0) >= needX;
}
export function spend(price = {}) {
  const p = ProfileStore.get();
  const need = { copper: price.copper || 0, iridium: price.iridium || 0, xp: price.xp || 0 };
  if ((p.copper || 0) < need.copper || (p.iridium || 0) < need.iridium || (p.xp || 0) < need.xp)
    return false;
  p.copper -= need.copper;
  p.iridium -= need.iridium;
  p.xp -= need.xp;
  ProfileStore.save(p);
  window.dispatchEvent(new Event('profile:updated'));
  return true;
}
export function isOwned(type, id) {
  const p = ProfileStore.get();
  const arr = p.unlocks?.[type] || [];
  return arr.includes(id);
}
export function markOwned(type, id) {
  const p = ProfileStore.get();
  p.unlocks ||= { shapes: [], skins: [], powerUps: [], trails: [], boosters: [] };
  const arr = p.unlocks[type] || [];
  if (!arr.includes(id)) arr.push(id);
  p.unlocks[type] = arr;
  ProfileStore.save(p);
  window.dispatchEvent(new Event('profile:updated'));
  return true;
}
export function getOwned(type) {
  const p = ProfileStore.get();
  return Array.from(new Set(p.unlocks?.[type] || []));
}

export default ProfileStore;
