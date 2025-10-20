// src/libs/Bank.js
// Single source of truth for balances across the whole app.

import ProfileStore from './ProfileStore.js';

// --- internal listeners ------------------------------------------------------
const _subs = new Set();
const emit = (state) => {
  // local subscribers
  _subs.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.warn('[Bank] subscriber error', e);
    }
  });
  // global event for any UI that prefers DOM events
  try {
    window.dispatchEvent(new CustomEvent('bank:changed', { detail: state }));
  } catch {}
};

// Always read from ProfileStore to avoid stale copies
function _read() {
  const p = ProfileStore.get() || {};
  const copper = Number(p.currencies?.copper ?? p.copper ?? 0);
  const iridium = Number(p.currencies?.iridium ?? p.iridium ?? 0);
  const xp = Number(p.xp ?? p.currencies?.xp ?? 0);
  return { copper, iridium, xp };
}

function _write(next) {
  // Keep both the canonical nested object and flat fields (legacy readers)
  ProfileStore.update((p) => {
    p.currencies ||= {};
    p.currencies.copper = Math.max(0, Number(next.copper || 0));
    p.currencies.iridium = Math.max(0, Number(next.iridium || 0));
    p.xp = Math.max(0, Number(next.xp || 0));

    // mirror for older screens that still read flat fields
    p.copper = p.currencies.copper;
    p.iridium = p.currencies.iridium;
  });
  emit(_read());
}

// --- public API --------------------------------------------------------------
export function get() {
  return _read();
}

export function set(partial = {}) {
  const cur = _read();
  const next = { ...cur, ...partial };
  _write(next);
  return next;
}

/** Add positive amounts (negative values are clamped to 0 delta) */
export function deposit(partial = {}) {
  const cur = _read();
  const add = (v) => Math.max(0, Number(v || 0));
  const next = {
    copper: cur.copper + add(partial.copper),
    iridium: cur.iridium + add(partial.iridium),
    xp: cur.xp + add(partial.xp),
  };
  _write(next);
  return next;
}

/** Spend returns true/false and only commits if all requirements are met */
export function spend(cost = {}) {
  // accept either {copper,iridium,xp} or [{type,amount}, …]
  const asObj = Array.isArray(cost)
    ? cost.reduce((a, c) => ((a[c.type] = (a[c.type] || 0) + Number(c.amount || 0)), a), {})
    : cost;

  const need = {
    copper: Math.max(0, Number(asObj.copper || 0)),
    iridium: Math.max(0, Number(asObj.iridium || 0)),
    xp: Math.max(0, Number(asObj.xp || 0)),
  };

  const cur = _read();
  const ok = cur.copper >= need.copper && cur.iridium >= need.iridium && cur.xp >= need.xp;
  if (!ok) return false;

  const next = {
    copper: cur.copper - need.copper,
    iridium: cur.iridium - need.iridium,
    xp: cur.xp - need.xp,
  };
  _write(next);
  return true;
}

export function canAfford(cost = {}) {
  const cur = _read();
  const asObj = Array.isArray(cost)
    ? cost.reduce((a, c) => ((a[c.type] = (a[c.type] || 0) + Number(c.amount || 0)), a), {})
    : cost;
  return (
    cur.copper >= Number(asObj.copper || 0) &&
    cur.iridium >= Number(asObj.iridium || 0) &&
    cur.xp >= Number(asObj.xp || 0)
  );
}

/** Subscribe to changes; returns an unbind function */
export function onChange(fn) {
  if (typeof fn !== 'function') return () => {};
  _subs.add(fn);
  return () => _subs.delete(fn);
}

/** Keep Bank in sync if any code updates the profile directly */
window.addEventListener('profile:updated', () => emit(_read()));
window.addEventListener('profile:initialized', () => emit(_read()));
