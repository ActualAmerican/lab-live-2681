// src/libs/SkinManager.js
// A small registry + loader. Catalog comes from shop.json (setCatalog).
let _catalog = []; // array of { id, name, price, module, ... }
const _skins = new Map(); // id -> { id, apply: fn }

let _activeId = 'Default';
const storageKey = 'activeSkin';

// --- Registry ---------------------------------------------------------------
export function register(id, applyFn) {
  if (!id || typeof applyFn !== 'function') return;
  _skins.set(id, { id, apply: applyFn });
}

export function getRegisteredSkins() {
  return Array.from(_skins.values());
}

export function setCatalog(arr) {
  _catalog = Array.isArray(arr) ? arr.slice() : [];
  // expose for tooling (Debug / ProfileStore CSV)
  try {
    window.__skinsCatalog = _catalog.map((s) => s.id);
  } catch {}
}

export function getCatalog() {
  return _catalog.slice();
}

// --- Dynamic load from catalog ---------------------------------------------
async function ensureLoaded(id) {
  if (_skins.has(id)) return true;
  const spec = _catalog.find((s) => s.id === id && s.module);
  if (!spec) return false;
  try {
    const mod = await import(/* @vite-ignore */ spec.module);
    // accept mod.apply OR default OR a named export matching id
    const fn = mod.apply || mod.default || mod[id] || mod.applySkin;
    if (typeof fn === 'function') register(id, fn);
    return _skins.has(id);
  } catch (e) {
    console.warn('[SkinManager] failed to import', spec.module, e);
    return false;
  }
}

// optional bulk preload (call once after shop.json is read)
export async function preloadFromCatalog() {
  for (const s of _catalog) {
    if (!_skins.has(s.id) && s.module) {
      try {
        await ensureLoaded(s.id);
      } catch {}
    }
  }
}

// --- Core API used by game/UI ----------------------------------------------
export async function apply(shape) {
  const cur = _activeId || 'Default';
  if (!_skins.has(cur)) await ensureLoaded(cur);
  const rec = _skins.get(cur);
  if (rec && typeof rec.apply === 'function') rec.apply(shape);
}

export async function preview(id) {
  const prev = get();
  await set(id);
  // return a restore function
  return () => set(prev);
}

export function get() {
  return _activeId;
}
export async function set(id) {
  if (!id) return _activeId;
  if (!_skins.has(id)) await ensureLoaded(id);
  if (_skins.has(id)) {
    _activeId = id;
    try {
      localStorage.setItem(storageKey, id);
    } catch {}
  }
  return _activeId;
}

export async function loadSaved() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) await set(saved);
  } catch {}
  return _activeId;
}

// default facade (keeps old imports working)
const SkinManager = {
  register,
  setCatalog,
  getCatalog,
  getRegisteredSkins,
  preloadFromCatalog,
  apply,
  preview,
  get,
  set,
  loadSaved,
};
export default SkinManager;
